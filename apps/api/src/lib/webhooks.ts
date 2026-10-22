import { createHash, randomBytes } from "node:crypto";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { decryptJson, encryptJson } from "@WorkOrchestrator/shared/crypto";

export function hashWebhookToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getWebhookNodeIds(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (
      typeof node === "object" &&
      node !== null &&
      "type" in node &&
      node.type === "webhookTrigger" &&
      "id" in node &&
      typeof node.id === "string"
    ) {
      return [node.id];
    }
    return [];
  });
}

export async function syncWebhookEndpoints(
  tx: Prisma.TransactionClient,
  workflowId: string,
  nodes: unknown,
): Promise<void> {
  const nodeIds = getWebhookNodeIds(nodes);
  const existingEndpoints = await tx.webhookEndpoint.findMany({
    where: { workflowId },
    select: { id: true, nodeId: true },
  });
  const nodeIdSet = new Set(nodeIds);
  const staleIds = existingEndpoints
    .filter((endpoint) => !nodeIdSet.has(endpoint.nodeId))
    .map((endpoint) => endpoint.id);

  if (staleIds.length > 0) {
    await tx.webhookEndpoint.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  const existingNodeIds = new Set(
    existingEndpoints
      .filter((endpoint) => nodeIdSet.has(endpoint.nodeId))
      .map((endpoint) => endpoint.nodeId),
  );
  const newNodeIds = nodeIds.filter((nodeId) => !existingNodeIds.has(nodeId));

  if (newNodeIds.length > 0) {
    await tx.webhookEndpoint.createMany({
      data: newNodeIds.map((nodeId) => {
        const token = randomBytes(32).toString("base64url");
        return {
          workflowId,
          nodeId,
          tokenHash: hashWebhookToken(token),
          tokenEncrypted: encryptJson(token),
        };
      }),
      skipDuplicates: true,
    });
  }
}

export async function getWebhookEndpointUrls(
  workflowId: string,
): Promise<Array<{ nodeId: string; url: string }>> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workflowId, enabled: true },
    select: { nodeId: true, tokenEncrypted: true },
    orderBy: { createdAt: "asc" },
  });
  const apiBaseUrl = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  ).replace(/\/+$/, "");

  return endpoints.map((endpoint) => {
    const token = decryptJson<string>(endpoint.tokenEncrypted);
    return {
      nodeId: endpoint.nodeId,
      url: `${apiBaseUrl}/api/v1/webhook/${encodeURIComponent(workflowId)}/${token}`,
    };
  });
}
