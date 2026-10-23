import { NextResponse } from "next/server";
import { apiError, createAssessment } from "@/lib/services/assessment";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return NextResponse.json(await createAssessment(request), { status: 202, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
