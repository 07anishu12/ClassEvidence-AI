import { NextResponse } from "next/server";

import { jobSchema, reportSchema } from "@/lib/contracts/assessment";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function serializeReport(report: {
  qualityLabel: string;
  scorePercent: number | null;
  rubricVersion: { version: string };
  confidence: number | null;
  limitations: unknown;
  dimensions: Array<{ key: string; score: number | null; rationale: string; evidenceIds: unknown }>;
  observations: Array<{
    evidenceId: string;
    startSec: number;
    endSec: number;
    modality: string;
    claim: string;
    evidence: string;
    impact: string;
    provenance: unknown;
  }>;
  recommendations: unknown;
}) {
  return reportSchema.parse({
    qualityLabel: report.qualityLabel[0] + report.qualityLabel.slice(1).toLowerCase(),
    scorePercent: report.scorePercent,
    rubricVersion: report.rubricVersion.version,
    confidence: report.confidence,
    assessmentLimitations: report.limitations,
    dimensions: report.dimensions,
    observations: report.observations.map((observation) => ({
      id: observation.evidenceId,
      startSec: observation.startSec,
      endSec: observation.endSec,
      modality: observation.modality.toLowerCase(),
      claim: observation.claim,
      evidence: observation.evidence,
      impact: observation.impact.toLowerCase(),
      provenance: observation.provenance,
    })),
    recommendations: report.recommendations,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length > 100) {
    return errorResponse(400, "invalid_job_id", "The assessment job ID is invalid.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    return errorResponse(503, "database_unavailable", "Assessment storage is not configured.");
  }

  try {
    const job = await prisma.assessmentJob.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            rubricVersion: true,
            dimensions: true,
            observations: true,
          },
        },
      },
    });

    if (!job) {
      return errorResponse(404, "job_not_found", "Assessment job was not found.");
    }

    return NextResponse.json(
      jobSchema.parse({
        id: job.id,
        status: job.status.toLowerCase(),
        progress: job.progress,
        stage: job.stage,
        error: job.errorCode && job.errorMessage ? { code: job.errorCode, message: job.errorMessage } : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        report: job.report ? serializeReport(job.report) : null,
      }),
    );
  } catch {
    return errorResponse(503, "database_unavailable", "Assessment storage could not retrieve the job.");
  }
}
