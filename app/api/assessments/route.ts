import { NextResponse } from "next/server";
import { apiError, authorize, createAssessment, listAssessments } from "@/lib/services/assessment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await createAssessment(request);
    const status = result.reused ? (result.status === "failed" ? 409 : 200) : 202;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    authorize(request);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const data = await listAssessments(cursor);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
