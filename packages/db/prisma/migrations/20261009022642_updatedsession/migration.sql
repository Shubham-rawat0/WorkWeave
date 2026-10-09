/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `accessTokenExpiresAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpiresAt` on the `Session` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hashToken]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hashToken` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "accessToken",
DROP COLUMN "accessTokenExpiresAt",
DROP COLUMN "refreshToken",
DROP COLUMN "refreshTokenExpiresAt",
ADD COLUMN     "hashToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_hashToken_key" ON "Session"("hashToken");

-- CreateIndex
CREATE INDEX "Session_hashToken_idx" ON "Session"("hashToken");
