CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEndpoint_tokenHash_key" ON "WebhookEndpoint"("tokenHash");
CREATE UNIQUE INDEX "WebhookEndpoint_workflowId_nodeId_key" ON "WebhookEndpoint"("workflowId", "nodeId");
CREATE INDEX "WebhookEndpoint_workflowId_idx" ON "WebhookEndpoint"("workflowId");

ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
