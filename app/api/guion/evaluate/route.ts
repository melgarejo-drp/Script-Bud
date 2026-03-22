import { NextRequest, NextResponse } from "next/server";
import { evaluateGuion } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guionText, projectId } = body;

    if (!guionText) {
      return NextResponse.json(
        { error: "guionText is required" },
        { status: 400 }
      );
    }

    const report = await evaluateGuion(guionText);

    return NextResponse.json({
      success: true,
      projectId,
      ...report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[/api/guion/evaluate]", error);
    return NextResponse.json(
      { error: error.message || "Failed to evaluate guion" },
      { status: 500 }
    );
  }
}
