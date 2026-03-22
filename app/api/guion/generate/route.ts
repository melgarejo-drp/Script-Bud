import { NextRequest, NextResponse } from "next/server";
import { generateGuion, decideNarrativeStructure } from "@/lib/openai";
import { updateProjectGuion } from "@/lib/notion";
import { generateScreenplayText } from "@/lib/guion-processor";
import type { ProjectGenre } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, transcription, duration, genre, title } = body;

    if (!transcription || !projectId) {
      return NextResponse.json(
        { error: "projectId and transcription are required" },
        { status: 400 }
      );
    }

    const durationMinutes = duration || 10;
    const projectGenre: ProjectGenre = genre || "Drama";
    const structure = decideNarrativeStructure(durationMinutes, projectGenre);

    // a) Generate structured JSON from transcription
    const guionJSON = await generateGuion({
      transcription,
      durationMinutes,
      genre: projectGenre,
      structure,
      title: title || "Sin título",
    });

    // b) Convert JSON → formatted screenplay text
    const guionText = generateScreenplayText(guionJSON);

    // c) Save to Notion
    if (process.env.NOTION_API_KEY) {
      await updateProjectGuion(projectId, guionText, guionJSON);
    }

    return NextResponse.json({
      success: true,
      guionText,
      guionJSON,
      structure,
    });
  } catch (error: any) {
    console.error("[/api/guion/generate]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate guion" },
      { status: 500 }
    );
  }
}
