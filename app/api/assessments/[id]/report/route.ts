import { NextResponse } from "next/server";
import { apiError, authorize, getAssessmentReport } from "@/lib/services/assessment";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    authorize(request);
    return NextResponse.json(await getAssessmentReport((await context.params).id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
