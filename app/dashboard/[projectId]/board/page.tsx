"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { useScript, useScriptImages } from "@/lib/use-script";

// ─────────────────────────────────────────────────────────────────
// Fountain Parser Types & Functions
// ─────────────────────────────────────────────────────────────────

type FountainTokenType =
  | "title-page"
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "centered"
  | "page-break"
  | "blank"
  | "lyric"
  | "note";

interface FountainToken {
  type: FountainTokenType;
  text: string;
  raw: string;
}

interface SceneBit {
  id: string;
  index: number;
  slugline: string;
  tokens: FountainToken[];
  summary: string;
  characters: string[];
  wordCount: number;
}

/**
 * Parse Fountain script text into tokens.
 * Handles: scene headings, action, character, dialogue, parenthetical, transitions.
 */
function parseFountain(text: string): FountainToken[] {
  const lines = text.split("\n");
  const tokens: FountainToken[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (stored as blank tokens)
    if (!trimmed) {
      tokens.push({ type: "blank", text: "", raw: line });
      continue;
    }

    // Scene heading: INT./EXT./INT./EST. etc at start of line
    if (/^(INT|EXT|EST|INT\.\/EXT|EXT\.\/INT)[\.\s]/i.test(trimmed)) {
      tokens.push({ type: "scene-heading", text: trimmed, raw: line });
      continue;
    }

    // Character: ALL CAPS, alone on line (not indented heavily)
    if (/^[A-Z\s\(\)]+$/.test(trimmed) && !line.startsWith("  ")) {
      // Exclude lines that are likely action
      if (trimmed.length < 50) {
        tokens.push({ type: "character", text: trimmed, raw: line });
        continue;
      }
    }

    // Parenthetical: (text)
    if (/^\([^\)]*\)$/.test(trimmed)) {
      tokens.push({ type: "parenthetical", text: trimmed, raw: line });
      continue;
    }

    // Dialogue: comes after character line
    if (tokens.length > 0 && tokens[tokens.length - 1].type === "character") {
      tokens.push({ type: "dialogue", text: trimmed, raw: line });
      continue;
    }

    // Transition: TO: / FADE: / CUT TO: etc
    if (/^(TO:|FADE|CUT\s+TO|DISSOLVE|SMASH|WIPE|IRIS).*$/i.test(trimmed)) {
      tokens.push({ type: "transition", text: trimmed, raw: line });
      continue;
    }

    // Centered: lines starting/ending with >
    if (trimmed.startsWith(">") && trimmed.endsWith("<")) {
      tokens.push({ type: "centered", text: trimmed.slice(1, -1), raw: line });
      continue;
    }

    // Default to action
    tokens.push({ type: "action", text: trimmed, raw: line });
  }

  return tokens;
}

/**
 * Derive SceneBit array from parsed Fountain tokens.
 * Each scene heading starts a new bit.
 */
function deriveScenes(text: string): SceneBit[] {
  const tokens = parseFountain(text);
  const scenes: SceneBit[] = [];

  let currentSceneTokens: FountainToken[] = [];
  let slugline = "Untitled Scene";
  let sceneIndex = 0;

  for (const token of tokens) {
    if (token.type === "scene-heading") {
      // Save previous scene if it exists
      if (currentSceneTokens.length > 0) {
        const characters = extractCharacters(currentSceneTokens);
        const summary = extractSummary(currentSceneTokens);
        const wordCount = calculateWordCount(currentSceneTokens);

        scenes.push({
          id: `SCENE_${String(sceneIndex).padStart(4, "0")}`,
          index: sceneIndex,
          slugline,
          tokens: currentSceneTokens,
          summary,
          characters,
          wordCount,
        });

        sceneIndex++;
      }

      // Start new scene
      slugline = token.text;
      currentSceneTokens = [token];
    } else {
      currentSceneTokens.push(token);
    }
  }

  // Don't forget the last scene
  if (currentSceneTokens.length > 0) {
    const characters = extractCharacters(currentSceneTokens);
    const summary = extractSummary(currentSceneTokens);
    const wordCount = calculateWordCount(currentSceneTokens);

    scenes.push({
      id: `SCENE_${String(sceneIndex).padStart(4, "0")}`,
      index: sceneIndex,
      slugline,
      tokens: currentSceneTokens,
      summary,
      characters,
      wordCount,
    });
  }

  return scenes;
}

/**
 * Extract unique character names from tokens.
 */
function extractCharacters(tokens: FountainToken[]): string[] {
  const chars = new Set<string>();
  for (const token of tokens) {
    if (token.type === "character") {
      const cleanName = token.text.replace(/\([^\)]*\)/g, "").trim();
      if (cleanName) chars.add(cleanName);
    }
  }
  return Array.from(chars);
}

/**
 * Extract first meaningful action or dialogue as summary (max 80 chars).
 */
function extractSummary(tokens: FountainToken[]): string {
  for (const token of tokens) {
    if (token.type === "action" || token.type === "dialogue") {
      const text = token.text.slice(0, 80);
      return text.length < token.text.length ? text + "..." : text;
    }
  }
  return "No content";
}

/**
 * Calculate word count in tokens.
 */
function calculateWordCount(tokens: FountainToken[]): number {
  let total = 0;
  for (const token of tokens) {
    if (token.type === "action" || token.type === "dialogue") {
      total += token.text.split(/\s+/).length;
    }
  }
  return total;
}

/**
 * Render a Fountain token with proper styling (used in modal).
 */
function renderFountainToken(token: FountainToken): React.ReactNode {
  const baseClass = "text-xs leading-relaxed";

  switch (token.type) {
    case "scene-heading":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} font-mono font-bold uppercase tracking-wider text-foreground mt-2 mb-1`}>
          {token.text}
        </div>
      );
    case "action":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} text-foreground mb-1`}>
          {token.text}
        </div>
      );
    case "character":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} font-mono font-semibold uppercase text-foreground mt-2 mb-0.5`}>
          {token.text}
        </div>
      );
    case "dialogue":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} text-foreground italic ml-4 mb-1`}>
          "{token.text}"
        </div>
      );
    case "parenthetical":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} text-muted-foreground italic ml-6 mb-1`}>
          {token.text}
        </div>
      );
    case "transition":
      return (
        <div key={`${token.type}-${token.text}`} className={`${baseClass} font-mono uppercase text-muted-foreground mt-2 mb-1`}>
          {token.text}
        </div>
      );
    case "blank":
      return <div key={`blank-${Math.random()}`} className="h-2" />;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const { text: scriptText, loaded: scriptLoaded } = useScript(projectId);
  const { images, saveImage } = useScriptImages(projectId);

  const [selectedScene, setSelectedScene] = useState<SceneBit | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Mount guard to prevent flash
  useEffect(() => {
    setMounted(true);
  }, []);

  // Derive scenes from script
  const scenes = useMemo<SceneBit[]>(() => {
    if (!scriptLoaded || !scriptText.trim()) return [];
    return deriveScenes(scriptText);
  }, [scriptText, scriptLoaded]);

  // Calculate stats
  const totalBits = scenes.length;
  const visualizedBits = scenes.filter((s) => images[s.slugline]).length;
  const totalWords = scenes.reduce((a, s) => a + s.wordCount, 0);
  const estimatedMinutes = Math.ceil(totalWords / 150); // ~150 words per minute

  // Generate image for a scene
  async function generateImage(scene: SceneBit) {
    if (generatingImageId) return;
    setGeneratingImageId(scene.id);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugline: scene.slugline,
          style: imageStyle,
          aspectRatio,
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        saveImage(scene.slugline, data.imageUrl);

        // Update selected scene if it's open
        if (selectedScene?.id === scene.id) {
          setSelectedScene((prev) =>
            prev
              ? {
                  ...prev,
                  // Trigger re-render by creating new object
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error("Image generation failed:", err);
    } finally {
      setGeneratingImageId(null);
    }
  }

  if (!mounted) return null;

  // Empty state
  if (!scriptLoaded || !scriptText.trim()) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="border-b border-border bg-background/80 backdrop-blur-md z-30 flex-shrink-0">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard`}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                ← Dashboard
              </Link>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-sm font-semibold">Superficie de Trabajo</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href={`/dashboard/${projectId}/editor`}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Editor Principal
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4 opacity-20">📝</div>
            <h2 className="text-xl font-semibold mb-2">No hay guion editado aún</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Ve al Editor para comenzar a escribir tu guion. Los bits se mostrarán aquí automáticamente.
            </p>
            <Link
              href={`/dashboard/${projectId}/editor`}
              className="inline-block px-6 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Ir al Editor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── Header ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md z-30 flex-shrink-0">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard`}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-sm font-semibold">Superficie de Trabajo</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground font-mono">
            <span>{totalBits} bits</span>
            <span>{estimatedMinutes} min estimado</span>
            <span>
              {visualizedBits}/{totalBits} visualizados
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Render Masivo Menu */}
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu((v) => !v)}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center gap-2"
              >
                Render Masivo
              </button>

              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                  <div className="p-3 border-b border-border bg-muted/30">
                    <h4 className="text-xs font-semibold">Configuración de Arte</h4>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                        Aspect Ratio
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full bg-background border border-border text-xs rounded p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="16:9">16:9 (Cinemático Estándar)</option>
                        <option value="2.35:1">2.35:1 (Anamórfico Widescreen)</option>
                        <option value="1:1">1:1 (Cuadrado)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                        Estilo Visual
                      </label>
                      <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="w-full bg-background border border-border text-xs rounded p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="photorealistic">Photorrealistic 8K</option>
                        <option value="film_noir">Cinematic / Film Noir</option>
                        <option value="ghibli">Studio Ghibli Anime</option>
                        <option value="concept_art">Concept Art Painterly</option>
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        setShowBulkMenu(false);
                        // Generate images for scenes without images
                        const scenesWithoutImage = scenes.filter(
                          (s) => !images[s.slugline]
                        );
                        for (const scene of scenesWithoutImage.slice(0, 9)) {
                          await generateImage(scene);
                        }
                      }}
                      disabled={!!generatingImageId}
                      className="w-full mt-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold py-2 rounded-md transition-colors"
                    >
                      {generatingImageId ? "Generando..." : "Ejecutar Render"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link
              href={`/dashboard/${projectId}/editor`}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Editor Principal
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content: Vertical scrollable list of scene cards ── */}
      <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
        <div className="max-w-2xl mx-auto space-y-4">
          {scenes.map((scene) => {
            const imageUrl = images[scene.slugline];

            return (
              <div
                key={scene.id}
                onClick={() => setSelectedScene(scene)}
                className="group relative bg-card border border-border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-foreground/30 hover:shadow-md"
              >
                {/* Scene image if exists */}
                {imageUrl && (
                  <div className="h-40 w-full overflow-hidden border-b border-border">
                    <img
                      src={imageUrl}
                      alt={scene.slugline}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Scene details */}
                <div className="p-5">
                  {/* Header: bit number + slugline */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        BIT {String(scene.index + 1).padStart(2, "0")}
                      </div>
                      <div className="text-sm font-mono font-semibold text-foreground leading-tight">
                        {scene.slugline}
                      </div>
                    </div>

                    {/* Character count badge */}
                    {scene.characters.length > 0 && (
                      <div className="bg-muted px-2 py-1 rounded text-[10px] font-semibold text-muted-foreground shrink-0">
                        {scene.characters.length} personaje{scene.characters.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Summary text */}
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {scene.summary}
                  </p>

                  {/* Character pills */}
                  {scene.characters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {scene.characters.slice(0, 4).map((char) => (
                        <span
                          key={char}
                          className="text-[9px] font-medium bg-background text-foreground rounded px-2 py-1 border border-border"
                        >
                          {char}
                        </span>
                      ))}
                      {scene.characters.length > 4 && (
                        <span className="text-[9px] font-medium text-muted-foreground">
                          +{scene.characters.length - 4} más
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer: word count + action button */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {scene.wordCount} palabras
                    </span>

                    {!imageUrl && (
                      <button
                        className="text-[10px] opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all disabled:opacity-30"
                        disabled={generatingImageId === scene.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateImage(scene);
                        }}
                      >
                        {generatingImageId === scene.id
                          ? "Generando..."
                          : "Generar imagen"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scene Detail Modal ── */}
      {selectedScene && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedScene(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Bit {String(selectedScene.index + 1).padStart(2, "0")}
                </div>
                <h2 className="text-sm font-semibold font-mono text-foreground">
                  {selectedScene.slugline}
                </h2>
              </div>
              <button
                onClick={() => setSelectedScene(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors shrink-0"
              >
                ×
              </button>
            </div>

            {/* Modal content (scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Scene image */}
              {images[selectedScene.slugline] ? (
                <div className="relative group rounded-lg overflow-hidden border border-border">
                  <img
                    src={images[selectedScene.slugline]}
                    alt="Scene"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => generateImage(selectedScene)}
                      disabled={generatingImageId === selectedScene.id}
                      className="bg-background border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-all disabled:opacity-50"
                    >
                      {generatingImageId === selectedScene.id
                        ? "Regenerando..."
                        : "Regenerar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-muted/50 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl opacity-30">🎬</span>
                  <button
                    disabled={!!generatingImageId}
                    onClick={() => generateImage(selectedScene)}
                    className="text-xs font-medium bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-secondary-foreground border border-border px-4 py-1.5 rounded-md transition-all"
                  >
                    {generatingImageId === selectedScene.id
                      ? "Generando..."
                      : "Generar Visualización (IA)"}
                  </button>
                </div>
              )}

              {/* Script fragment */}
              <div className="bg-muted/30 rounded-lg border border-border p-4 space-y-1.5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Contenido del Guion
                </div>
                <div className="space-y-0.5">
                  {selectedScene.tokens.map((token, idx) =>
                    renderFountainToken(token)
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Palabras
                  </p>
                  <p className="text-sm font-semibold">{selectedScene.wordCount}</p>
                </div>
                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Personajes
                  </p>
                  <p className="text-sm font-semibold">{selectedScene.characters.length}</p>
                </div>
              </div>

              {/* Characters section */}
              {selectedScene.characters.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Personajes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedScene.characters.map((char) => (
                      <span
                        key={char}
                        className="text-xs font-medium bg-background text-foreground rounded px-3 py-1.5 border border-border"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
