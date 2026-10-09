import bcrypt from "bcrypt";
import crypto from "crypto"

//session tokens

export function generateSessionToken(): string {
    return crypto.randomBytes(32).toString("base64url");
}

export function getHashToken(token: string): string {
    return crypto.createHash("sha256")
        .update(token)
        .digest("hex");
}

//password hashing
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function comparePassword(
    password: string,
    hashedPassword: string,
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

export const hash = {
    hash: hashPassword,
    compare: comparePassword,
};

