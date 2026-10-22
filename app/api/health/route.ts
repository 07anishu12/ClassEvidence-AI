import { NextResponse } from "next/server";

import { env } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const prisma = getPrisma();

  if (!prisma) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "humaniti-ai",
        database: "unconfigured",
        provider: env.ASSESSMENT_PROVIDER,
      },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "humaniti-ai",
      database: "ok",
      provider: env.ASSESSMENT_PROVIDER,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "humaniti-ai",
        database: "unavailable",
        provider: env.ASSESSMENT_PROVIDER,
      },
      { status: 503 },
    );
  }
}
