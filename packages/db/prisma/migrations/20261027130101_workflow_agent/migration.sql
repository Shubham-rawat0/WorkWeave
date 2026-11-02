-- CreateEnum
CREATE TYPE "WorkflowAgentStatus" AS ENUM ('Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "WorkflowAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "WorkflowAgentStatus" NOT NULL DEFAULT 'Processing',
    "model" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT,

    CONSTRAINT "WorkflowAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowAgent_userId_createdAt_idx" ON "WorkflowAgent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowAgent" ADD CONSTRAINT "WorkflowAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
