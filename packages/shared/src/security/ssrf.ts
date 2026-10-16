import { promises as dns } from "node:dns";
import { isIP } from "node:net";

// Hostnames that always point at internal services (cloud metadata endpoint).
const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "metadata",
    "metadata.google.internal",
]);

// TLDs/suffixes reserved for private networks, never public targets.
const BLOCKED_HOSTNAME_SUFFIXES = [
    ".localhost",
    ".internal",
    ".local",
    ".home.arpa",
];

// Non-routable / reserved / multicast IPv4 blocks as [network, CIDR prefix].
const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
];

/** Thrown whenever an outbound URL is rejected by validation. */
export class SsrfError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SsrfError";
    }
}

export { SsrfError as ssrfError };

/** Parses common truthy/falsey env strings; `null` = unset or unrecognized. */
function envFlag(value: string | undefined): boolean | null {
    if (value === undefined) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return null;
}

const DEVELOPMENT_ENVS = new Set(["dev", "development", "test", "local"]);

/** `SSRF_ENFORCE` wins over `NODE_ENV`; anything non-dev counts as production. */
function resolveIsProduction(): boolean {
    const override = envFlag(process.env.SSRF_ENFORCE);
    if (override !== null) {
        return override;
    }
    const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
    return !DEVELOPMENT_ENVS.has(nodeEnv);
}

export const isProduction: boolean = resolveIsProduction();

/** Lowercases, strips IPv6 brackets and trailing dots so names compare cleanly. */
function normalizeHostname(hostname: string): string {
    let normalized = hostname.trim().toLowerCase();
    if (normalized.startsWith("[") && normalized.endsWith("]")) {
        normalized = normalized.slice(1, -1);
    }
    while (normalized.endsWith(".")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

/** Dotted quad -> 32-bit unsigned int, or `null` if malformed. */
function ipv4ToInt(ip: string): number | null {
    const parts = ip.split(".");
    if (parts.length !== 4) {
        return null;
    }
    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) {
            return null;
        }
        const octet = Number.parseInt(part, 10);
        if (octet > 255) {
            return null;
        }
        value = value * 256 + octet;
    }
    return value;
}

// Ranges pre-converted to {network, mask} for O(1) CIDR masking per check.
const PRIVATE_IPV4_NETWORKS: Array<{ network: number; mask: number }> =
    PRIVATE_IPV4_RANGES.flatMap(([base, prefix]) => {
        const network = ipv4ToInt(base);
        if (network === null) {
            return [];
        }
        const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
        return [{ network, mask }];
    });

function isPrivateIpv4(ip: string): boolean {
    const value = ipv4ToInt(ip);
    if (value === null) {
        return false;
    }
    return PRIVATE_IPV4_NETWORKS.some(
        ({ network, mask }) =>
            ((value & mask) >>> 0) === ((network & mask) >>> 0),
    );
}

/**
 * Expands an IPv6 address into its 8 16-bit groups, handling `::` compression,
 * embedded IPv4 tail notations and zone IDs. Returns `null` if malformed.
 */
function parseIpv6(ip: string): number[] | null {
    const address = ip.toLowerCase().split("%")[0] ?? "";
    const halves = address.split("::");
    if (halves.length > 2) {
        return null;
    }
    const parseSide = (side: string): number[] | null => {
        if (side === "") {
            return [];
        }
        const groups: number[] = [];
        for (const chunk of side.split(":")) {
            if (chunk.includes(".")) {
                // Embedded IPv4 (e.g. ::ffff:127.0.0.1) becomes two groups.
                const embedded = ipv4ToInt(chunk);
                if (embedded === null) {
                    return null;
                }
                groups.push(Math.floor(embedded / 65536), embedded % 65536);
            } else {
                if (!/^[0-9a-f]{1,4}$/.test(chunk)) {
                    return null;
                }
                groups.push(Number.parseInt(chunk, 16));
            }
        }
        return groups;
    };
    const head = parseSide(halves[0] ?? "");
    if (head === null) {
        return null;
    }
    if (halves.length === 1) {
        return head.length === 8 ? head : null;
    }
    const tail = parseSide(halves[1] ?? "");
    if (tail === null) {
        return null;
    }
    // `::` must stand for at least one omitted group (RFC 4291).
    const filler = 8 - head.length - tail.length;
    if (filler < 1) {
        return null;
    }
    return [...head, ...new Array<number>(filler).fill(0), ...tail];
}

/** True for private, loopback, link-local, ULA, multicast and special ranges. */
function isPrivateIpv6(ip: string): boolean {
    const groups = parseIpv6(ip);
    if (groups === null) {
        return false;
    }
    const at = (index: number): number => groups[index] ?? 0;
    const zeros = (from: number, to: number): boolean =>
        groups.slice(from, to).every((group) => group === 0);
    // Renders groups 6-7 as an IPv4 address so the v4 rules can be reused.
    const embedded = (high: number, low: number): boolean =>
        isPrivateIpv4(
            `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
        );

    if (zeros(0, 5) && at(5) === 0xffff) {
        return embedded(at(6), at(7)); // ::ffff:a.b.c.d IPv4-mapped
    }
    if (zeros(0, 6)) {
        return embedded(at(6), at(7)); // ::a.b.c.d IPv4-compatible
    }
    if (at(0) === 0x64 && at(1) === 0xff9b && zeros(2, 6)) {
        return embedded(at(6), at(7)); // NAT64 64:ff9b::/96
    }
    if (at(0) === 0x2002) {
        return embedded(at(1), at(2)); // 6to4 2002::/16
    }
    if ((at(0) & 0xffc0) === 0xfe80) {
        return true; // link-local fe80::/10
    }
    if ((at(0) & 0xffc0) === 0xfec0) {
        return true; // site-local fec0::/10
    }
    if ((at(0) & 0xfe00) === 0xfc00) {
        return true; // unique-local fc00::/7
    }
    if (at(0) >= 0xff00) {
        return true; // multicast / reserved ff00::/8
    }
    if (at(0) === 0x2001 && at(1) === 0x0db8) {
        return true; // documentation 2001:db8::/32
    }
    return false;
}

/**
 * Checks whether an IP literal falls in a private/reserved range.
 * Non-IP input (a hostname) returns `false` — hosts are checked separately.
 */
export function isPrivateIp(ip: string): boolean {
    const normalized = normalizeHostname(ip);
    const address = normalized.split("%")[0] ?? "";
    const version = isIP(address);
    if (version === 4) {
        return isPrivateIpv4(address);
    }
    if (version === 6) {
        return isPrivateIpv6(address);
    }
    return false;
}

export function isBlockedHostname(hostname: string): boolean {
    const normalized = normalizeHostname(hostname);
    if (BLOCKED_HOSTNAMES.has(normalized)) {
        return true;
    }
    return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) =>
        normalized.endsWith(suffix),
    );
}

/** Comma-separated allow-list from `SSRF_ALLOW_HOSTS`; entries bypass checks. */
function allowedHostnames(): Set<string> {
    return new Set(
        (process.env.SSRF_ALLOW_HOSTS ?? "")
            .split(",")
            .map((entry) => normalizeHostname(entry))
            .filter((entry) => entry.length > 0),
    );
}

/** Parses the URL and restricts outbound requests to http(s) only. */
function parseHttpUrl(url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new SsrfError(`Invalid URL: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new SsrfError(`Blocked outbound protocol: ${parsed.protocol}`);
    }
    return parsed;
}

/**
 * Rejects URLs that target internal hosts or resolve to private addresses.
 * Order: literal hostname/IP checks first (cheap), then DNS resolution so every
 * returned address is checked — this is what catches DNS-rebinding targets.
 * Enforcement is skipped in dev/test unless `SSRF_ENFORCE` forces it on.
 */
export async function validateOutboundUrl(
    url: string,
): Promise<void> {
    const parsed = parseHttpUrl(url);
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) {
        throw new SsrfError("Missing hostname");
    }

    if (!isProduction || allowedHostnames().has(hostname)) {
        return;
    }

    if (isBlockedHostname(hostname)) {
        throw new SsrfError(`Blocked outbound hostname: ${hostname}`);
    }
    if (isPrivateIp(hostname)) {
        throw new SsrfError(`Blocked outbound private IP: ${hostname}`);
    }

    // Resolve everything the hostname points at; failure means it is unusable.
    let addresses: string[] = [];
    try {
        const resolved = await dns.lookup(hostname, {
            all: true,
            verbatim: true,
        });
        addresses = resolved.map((entry) => entry.address);
    } catch {
        throw new SsrfError(`Unable to resolve host: ${hostname}`);
    }

    if (addresses.length === 0) {
        throw new SsrfError(`Unable to resolve host: ${hostname}`);
    }
    for (const address of addresses) {
        if (isPrivateIp(address)) {
            throw new SsrfError(
                `Blocked outbound private address: ${hostname} -> ${address}`,
            );
        }
    }
}
