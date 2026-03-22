import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

// ─── Storyboard image generation via Replicate (Flux Schnell) ────────────────
// Used by the Board view to generate visual storyboard assets per beat/scene.
//
// Expected body:
//   slugline:   string  — "INT. ESTUDIO - NOCHE" used to infer visual description
//   prompt:     string  — optional override for the image prompt
//   style:      string  — "photorealistic" | "film_noir" | "ghibli" | "concept_art"
//   aspectRatio: string — "16:9" | "1:1" | "2.35:1"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slugline = "",
      prompt: promptOverride,
      style = "photorealistic",
      aspectRatio = "16:9",
    } = body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 503 }
      );
    }

    // Build a cinematic prompt from the slugline if no override
    const styleMap: Record<string, string> = {
      photorealistic: "photorealistic, 8K, cinematic lighting, shallow depth of field, professional cinematography",
      film_noir:      "film noir style, high contrast black and white, dramatic shadows, 1940s cinematography",
      ghibli:         "Studio Ghibli anime style, lush painterly backgrounds, warm soft light",
      concept_art:    "concept art, matte painting, detailed environment, professional illustration",
    };
    const styleDesc = styleMap[style] || styleMap.photorealistic;

    // Parse slugline into environment description
    const slugUpper = slugline.toUpperCase();
    const isInterior = slugUpper.startsWith("INT.");
    const isNight    = slugUpper.includes("NOCHE") || slugUpper.includes("NIGHT");
    const location   = slugline.replace(/^(INT\.|EXT\.)\s*/i, "").replace(/\s*-\s*.+$/, "").trim();

    const lightingHint = isNight
      ? "night scene, artificial lighting, deep shadows"
      : isInterior
        ? "interior lighting, warm practical lights"
        : "natural daylight, outdoor lighting";

    const generatedPrompt = promptOverride ||
      `Cinematic still frame: ${location || "dramatic location"}. ${lightingHint}. ${styleDesc}. Film storyboard frame. No text or subtitles.`;

    // Replicate aspect ratio mapping for Flux Schnell
    const arMap: Record<string, string> = {
      "16:9":   "16:9",
      "1:1":    "1:1",
      "2.35:1": "custom",  // Flux doesn't support 2.35:1 natively, use 16:9
    };
    const fluxAR = arMap[aspectRatio] || "16:9";

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(
      "black-forest-labs/flux-schnell" as `${string}/${string}`,
      {
        input: {
          prompt: generatedPrompt,
          aspect_ratio: fluxAR === "custom" ? "16:9" : fluxAR,
          output_format: "jpg",
          output_quality: 80,
          num_inference_steps: 4,
        },
      }
    );

    // Replicate returns either a URL string or an array
    const imageUrl = Array.isArray(output) ? output[0] : output;

    return NextResponse.json({
      success: true,
      imageUrl: String(imageUrl),
      prompt: generatedPrompt,
    });
  } catch (error: any) {
    console.error("[/api/image/generate]", error);
    return NextResponse.json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
}
