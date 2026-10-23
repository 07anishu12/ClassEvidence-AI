-- DropIndex
DROP INDEX "EvidenceObservation_evidenceId_key";

-- AlterTable
ALTER TABLE "AssessmentJob" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaseToken" TEXT;

-- AlterTable
ALTER TABLE "AssessmentReport" ALTER COLUMN "scorePercent" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceObservation_reportId_evidenceId_key" ON "EvidenceObservation"("reportId", "evidenceId");

