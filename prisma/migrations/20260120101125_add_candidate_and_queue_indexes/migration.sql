-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CLEAR', 'DISCREPANCY', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OFFER_LETTER', 'RELIEVING_LETTER');

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "joiningDesignation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateNote" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentVerification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "previousCompanyName" TEXT NOT NULL,
    "previousCompanyEmail" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "tenureFrom" TIMESTAMP(3) NOT NULL,
    "tenureTo" TIMESTAMP(3) NOT NULL,
    "reasonForExit" TEXT,
    "hrContactName" TEXT,
    "hrContactPhone" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResponse" (
    "id" TEXT NOT NULL,
    "employmentVerificationId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallingLog" (
    "id" TEXT NOT NULL,
    "employmentVerificationId" TEXT NOT NULL,
    "callTime" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CallingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_city_idx" ON "Candidate"("city");

-- CreateIndex
CREATE INDEX "Candidate_joiningDesignation_idx" ON "Candidate"("joiningDesignation");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "Candidate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentVerification_verificationToken_key" ON "EmploymentVerification"("verificationToken");

-- CreateIndex
CREATE INDEX "EmploymentVerification_candidateId_idx" ON "EmploymentVerification"("candidateId");

-- CreateIndex
CREATE INDEX "EmploymentVerification_status_idx" ON "EmploymentVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationResponse_employmentVerificationId_key" ON "VerificationResponse"("employmentVerificationId");

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentVerification" ADD CONSTRAINT "EmploymentVerification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResponse" ADD CONSTRAINT "VerificationResponse_employmentVerificationId_fkey" FOREIGN KEY ("employmentVerificationId") REFERENCES "EmploymentVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingLog" ADD CONSTRAINT "CallingLog_employmentVerificationId_fkey" FOREIGN KEY ("employmentVerificationId") REFERENCES "EmploymentVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "VerificationResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
