import { NextResponse } from "next/server";

import { assessmentCreateSchema, assessmentCreatedSchema } from "@/lib/contracts/assessment";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = assessmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_source", "The assessment source is invalid.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    return errorResponse(503, "database_unavailable", "Assessment storage is not configured.");
  }

  try {
    const job = await prisma.assessmentJob.create({
      data: {
        sourceKind: parsed.data.source.kind === "url" ? "URL" : "UPLOAD",
        sourceRef: parsed.data.source.kind === "url" ? parsed.data.source.url : parsed.data.source.storageKey,
        status: "QUEUED",
        progress: 0,
        stage: "queued",
        events: {
          create: {
            eventType: "job.created",
            message: "Assessment accepted and awaiting an organiser-approved processor.",
          },
        },
      },
    });

    return NextResponse.json(
      assessmentCreatedSchema.parse({ id: job.id, status: "queued" }),
      { status: 202 },
    );
  } catch {
    return errorResponse(503, "database_unavailable", "Assessment storage could not create the job.");
  }
}
