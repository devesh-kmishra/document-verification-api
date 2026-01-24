/*
  Warnings:

  - Added the required column `updatedAt` to the `EmploymentVerification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmploymentVerification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "tenureTo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "EmploymentVerification_tokenExpiresAt_idx" ON "EmploymentVerification"("tokenExpiresAt");

-- CreateIndex
CREATE INDEX "EmploymentVerification_candidateId_status_idx" ON "EmploymentVerification"("candidateId", "status");
