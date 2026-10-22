-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('URL', 'UPLOAD');

-- CreateEnum
CREATE TYPE "EvidenceModality" AS ENUM ('AUDIO', 'TRANSCRIPT', 'VIDEO', 'METADATA');

-- CreateEnum
CREATE TYPE "EvidenceImpact" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'NOT_ASSESSABLE');

-- CreateEnum
CREATE TYPE "QualityLabel" AS ENUM ('POOR', 'AVERAGE', 'GOOD', 'EXCELLENT');

-- CreateTable
CREATE TABLE "AssessmentJob" (
    "id" TEXT NOT NULL,
    "sourceKind" "SourceKind" NOT NULL DEFAULT 'URL',
    "sourceRef" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "qualityLabel" "QualityLabel" NOT NULL,
    "scorePercent" INTEGER,
    "confidence" DOUBLE PRECISION,
    "limitations" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionScore" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rationale" TEXT NOT NULL,
    "evidenceIds" JSONB NOT NULL,

    CONSTRAINT "DimensionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceObservation" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,
    "modality" "EvidenceModality" NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "impact" "EvidenceImpact" NOT NULL,
    "provenance" JSONB NOT NULL,

    CONSTRAINT "EvidenceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentJob_idempotencyKey_key" ON "AssessmentJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AssessmentJob_status_updatedAt_idx" ON "AssessmentJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProcessingEvent_jobId_createdAt_idx" ON "ProcessingEvent"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RubricVersion_version_key" ON "RubricVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_jobId_key" ON "AssessmentReport"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "DimensionScore_reportId_key_key" ON "DimensionScore"("reportId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceObservation_evidenceId_key" ON "EvidenceObservation"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceObservation_reportId_startSec_idx" ON "EvidenceObservation"("reportId", "startSec");

-- AddForeignKey
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AssessmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AssessmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionScore" ADD CONSTRAINT "DimensionScore_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AssessmentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObservation" ADD CONSTRAINT "EvidenceObservation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AssessmentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
