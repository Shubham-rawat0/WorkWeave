export interface ParseResult {
    /** Template with every valid placeholder replaced. */
    output: string;
    /** Placeholders that resolved to `undefined`/`null` (only set when non-empty). */
    missingVars?: string[];
    /** True when the template contained at least one valid placeholder. */
    hasSubstitutions?: boolean;
}

const TEMPLATE_PATH_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

interface ParsedTemplateToken {
    useJson: boolean;
    lookupKey: string;
}

/**
 * Validates the text between the delimiters, e.g. `json a.b` -> JSON lookup of `a.b`.
 * Returns `null` for anything that is not a well-formed placeholder, so it is
 * emitted as literal text instead of being substituted.
 */
function parseTemplateToken(
    rawKey: string,
    startDelimiter: string,
    endDelimiter: string,
): ParsedTemplateToken | null {
    const trimmed = rawKey.trim();
    if (!trimmed) return null;
    let useJson = false;
    let lookupKey = trimmed;
    if (trimmed.startsWith("json ")) {
        useJson = true;
        lookupKey = trimmed.slice(5).trim();
    }
    if (!lookupKey) return null;
    // Reject nested delimiters so a stray `}` cannot swallow the rest of the key.
    if (lookupKey.includes(startDelimiter) || lookupKey.includes(endDelimiter))
        return null;
    if (!TEMPLATE_PATH_PATTERN.test(lookupKey)) return null;
    return { useJson, lookupKey };
}

/** Walks a dotted path; stops at the first non-object segment. */
function resolvePath(values: Record<string, any>, keys: string[]): any {
    let value: any = values;
    for (const key of keys) {
        if (value && typeof value === "object") {
            value = value[key];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * Renders single- or double-braced placeholders and reports unresolved values.
 */
export function parseTemplateWithMetadata(
    template: string,
    values: Record<string, any>,
    startDelimiter = "{",
    endDelimiter = "}",
): ParseResult {
    if (typeof template !== "string") {
        return { output: String(template) };
    }
    // Literal runs are copied as slices and only joined once at the end.
    const chunks: string[] = [];
    const missingVars: string[] = [];
    let hasSubstitutions = false;
    let literalStart = 0;
    let i = 0;

    function appendToken(token: ParsedTemplateToken): void {
        chunks.push(template.slice(literalStart, i));
        hasSubstitutions = true;
        const value = resolvePath(values, token.lookupKey.split("."));
        if (value === undefined || value === null) {
            missingVars.push(token.lookupKey);
        } else {
            const rendered = token.useJson
                ? JSON.stringify(value)
                : String(value);
            chunks.push(String(rendered));
        }
    }

    while (i < template.length) {
        if (template[i] !== startDelimiter) {
            i++;
            continue;
        }
        if (
            startDelimiter.length === 1 &&
            endDelimiter.length === 1 &&
            template.startsWith(startDelimiter.repeat(2), i)
        ) {
            const doubleDelimiterLength = 2;
            const close = template.indexOf(
                endDelimiter.repeat(2),
                i + doubleDelimiterLength,
            );
            if (close === -1) {
                i += doubleDelimiterLength;
                continue;
            }
            const token = parseTemplateToken(
                template.slice(i + doubleDelimiterLength, close),
                startDelimiter,
                endDelimiter,
            );
            if (token) {
                appendToken(token);
                i = close + doubleDelimiterLength;
                literalStart = i;
            } else {
                i = close + doubleDelimiterLength;
            }
            continue;
        }
        // Scan for the closing delimiter used by single-braced placeholders.
        let close = -1;
        for (let j = i + 1; j < template.length; j++) {
            if (template[j] === endDelimiter) {
                close = j;
                break;
            }
        }
        if (close === -1) {
            // No closing delimiter left: the remainder is literal text.
            break;
        }
        const token = parseTemplateToken(
            template.slice(i + 1, close),
            startDelimiter,
            endDelimiter,
        );
        if (!token) {
            // Not a placeholder; keep the delimiter as text and scan past it.
            i++;
            continue;
        }
        appendToken(token);
        i = close + 1;
        literalStart = i;
    }
    chunks.push(template.slice(literalStart));

    const parseResult: ParseResult = {
        output: chunks.join(""),
        hasSubstitutions,
    };
    if (missingVars.length > 0) {
        parseResult.missingVars = missingVars;
    }
    return parseResult;
}

/** Convenience wrapper that returns only the rendered output. */
export function parseTemplate(
    template: string,
    values: Record<string, any>,
    startDelimiter = "{",
    endDelimiter = "}",
): string {
    return parseTemplateWithMetadata(
        template,
        values,
        startDelimiter,
        endDelimiter,
    ).output;
}
