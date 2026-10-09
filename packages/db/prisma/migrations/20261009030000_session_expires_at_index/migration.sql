-- DropIndex
DROP INDEX "Session_hashToken_idx";

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
