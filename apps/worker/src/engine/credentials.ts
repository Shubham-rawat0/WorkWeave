import { prisma } from "@WorkOrchestrator/prisma";
import { decryptJson } from "@WorkOrchestrator/shared/crypto";


export interface ResolvedCredential {
    platform: string;
    keys: Record<string, string>;
}

export type CredentialPlatform =
    | "openai"
    | "anthropic"
    | "gemini"
    | "github"
    | "notion"
    | "slack"
    | "telegram";

export async function resolveCredentials(credentialId:string,userId:string):Promise<ResolvedCredential>{
    const cred=await prisma.credentials.findFirst({
        where:{
            userId,
            id:credentialId
        },
            select:{
                platform:true,
                keys:true
            }
    })

    if (!cred){
        throw new Error("Please provide correct credentials")
    }
    return {
        platform:cred.platform,
        keys: decryptJson<Record<string, string>>(cred.keys as string),
    }
}   

export async function resolveCredentialByPlatform(
    ownerUserId: string,
    platform: CredentialPlatform,
): Promise<ResolvedCredential | null> {
    const credential = await prisma.credentials.findFirst({
        where: {
            platform,
            userId: ownerUserId,
        },
        select: {
            platform: true,
            keys: true,
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    if (!credential) {
        return null;
    }

    return {
        platform: credential.platform,
        keys: decryptJson<Record<string, string>>(
            credential.keys as string,
        ),
    };
}