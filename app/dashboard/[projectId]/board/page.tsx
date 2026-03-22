"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

type BeatType = "Acción" | "Diálogo" | "Transición" | "Punto de Giro";
type ActName = "Acto 1 (Inicio)" | "Acto 2 (Nudo)" | "Acto 3 (Desenlace)";

interface Beat {
  id: string;
  sceneNumber: number;
  beatNumber: number;
  act: ActName;
  beatType: BeatType;
  slugline: string;
  characters: string[];
  durationSeconds: number;
  imageUrl?: string;
}

const ACTS: ActName[] = ["Acto 1 (Inicio)", "Acto 2 (Nudo)", "Acto 3 (Desenlace)"];

// Demo structure — in production this is populated from the parsed Fountain script
const DEMO_BEATS: Beat[] = Array.from({ length: 27 }).map((_, i) => {
  const beatNumber = i + 1;
  const sceneNumber = Math.floor(i / 3) + 1;
  const actIndex = Math.floor(i / 9);
  const act = ACTS[actIndex];

  const beatTypes: BeatType[] = ["Acción", "Diálogo", "Transición", "Punto de Giro"];
  const beatType = beatNumber % 9 === 0 ? "Punto de Giro" : beatNumber % 3 === 0 ? "Transición" : beatNumber % 2 === 0 ? "Diálogo" : "Acción";

  const sluglines = [
    "INT. ESTUDIO DE PODCAST - NOCHE",
    "EXT. CALLE - AMANECER",
    "INT. SALA DE MONTAJE - DÍA",
    "INT. CAFETERÍA - TARDE",
    "EXT. AZOTEA - NOCHE",
    "INT. ARCHIVO - DÍA",
    "INT. AUTO - NOCHE",
    "EXT. PARQUE - AMANECER",
    "INT. HABITACIÓN - NOCHE",
  ];

  return {
    id: `BIT_${String(beatNumber).padStart(3, "0")}`,
    sceneNumber,
    beatNumber,
    act,
    beatType,
    slugline: sluglines[(sceneNumber - 1) % sluglines.length],
    characters: ["PROTAGONISTA"],
    durationSeconds: 30 + ((beatNumber * 7) % 90),
  };
});

export default function BoardPage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  const [beats, setBeats] = useState<Beat[]>(DEMO_BEATS);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<{ act: ActName; sceneNumber: number } | null>(null);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const totalDuration = beats.reduce((a, b) => a + b.durationSeconds, 0);
  const totalMinutes = Math.round(totalDuration / 60);

  const beatsByActAndScene = ACTS.reduce((accActs, act) => {
    const actBeats = beats.filter((b) => b.act === act);
    const scenesMap = new Map<number, Beat[]>();
    actBeats.forEach((b) => {
      if (!scenesMap.has(b.sceneNumber)) scenesMap.set(b.sceneNumber, []);
      scenesMap.get(b.sceneNumber)!.push(b);
    });
    const scenes = Array.from(scenesMap.entries())
      .map(([sceneNum, sceneBeats]) => ({
        sceneNumber: sceneNum,
        beats: sceneBeats.sort((x, y) => x.beatNumber - y.beatNumber),
      }))
      .sort((x, y) => x.sceneNumber - y.sceneNumber);
    accActs[act] = scenes;
    return accActs;
  }, {} as Record<ActName, { sceneNumber: number; beats: Beat[] }[]>);

  function handleDrop(targetAct: ActName, targetScene: number) {
    if (!dragId) return;
    setBeats((prev) =>
      prev.map((b) => (b.id === dragId ? { ...b, act: targetAct, sceneNumber: targetScene } : b))
    );
    setDragId(null);
    setOverTarget(null);
  }

  async function generateImage(beat: Beat) {
    if (generatingImageId) return;
    setGeneratingImageId(beat.id);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugline: beat.slugline,
          style: imageStyle,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setBeats((prev) =>
          prev.map((b) => (b.id === beat.id ? { ...b, imageUrl: data.imageUrl } : b))
        );
        // Update modal if it's the active beat
        if (selectedBeat?.id === beat.id) {
          setSelectedBeat((prev) => prev ? { ...prev, imageUrl: data.imageUrl } : null);
        }
      }
    } catch (err) {
      console.error("Image generation failed:", err);
    } finally {
      setGeneratingImageId(null);
    }
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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
            <span>{beats.length} bits</span>
            <span>{totalMinutes} min estimado</span>
            <span>{beats.filter((b) => b.imageUrl).length}/{beats.length} visualizados</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

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
                        // Generate images for beats without an image, sequentially to avoid rate limits
                        const beatsWithoutImage = beats.filter((b) => !b.imageUrl);
                        for (const beat of beatsWithoutImage.slice(0, 9)) {
                          await generateImage(beat);
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

      {/* ── Board: Acts → Scenes → Beats ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-muted/5" style={{ minHeight: 0 }}>
        <div className="flex gap-4 h-full" style={{ minWidth: "max-content" }}>
          {ACTS.map((act) => {
            const scenesInAct = beatsByActAndScene[act] || [];
            const actDuration = scenesInAct.reduce(
              (total, scene) => total + scene.beats.reduce((a, b) => a + b.durationSeconds, 0),
              0
            );

            return (
              <div
                key={act}
                className="flex flex-col shrink-0 rounded-xl bg-card border border-border shadow-sm"
                style={{ width: "340px", height: "100%" }}
              >
                {/* Act Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm tracking-tight">{act}</h2>
                    <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {Math.round(actDuration / 60)} min
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {scenesInAct.length} escenas · {scenesInAct.reduce((a, s) => a + s.beats.length, 0)} bits
                  </p>
                </div>

                {/* Act Body → Scenes */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {scenesInAct.map(({ sceneNumber, beats: sceneBeats }) => {
                    const isOver =
                      overTarget?.act === act && overTarget?.sceneNumber === sceneNumber;

                    return (
                      <div
                        key={sceneNumber}
                        className={`bg-background rounded-lg border border-border p-2.5 transition-colors ${
                          isOver ? "ring-2 ring-primary/50 bg-accent" : ""
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverTarget({ act, sceneNumber });
                        }}
                        onDragLeave={() => setOverTarget(null)}
                        onDrop={() => handleDrop(act, sceneNumber)}
                      >
                        {/* Scene label */}
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Escena {sceneNumber}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                            {sceneBeats.length} bits
                          </span>
                        </div>

                        {/* Beat cards */}
                        <div className="space-y-1.5">
                          {sceneBeats.map((beat) => (
                            <div
                              key={beat.id}
                              draggable
                              onDragStart={() => setDragId(beat.id)}
                              onClick={() => setSelectedBeat(beat)}
                              className={`group relative bg-card rounded-md border border-border overflow-hidden cursor-pointer transition-all duration-150 hover:border-foreground/30 hover:shadow-sm ${
                                dragId === beat.id ? "opacity-40 scale-95" : ""
                              }`}
                            >
                              {beat.imageUrl && (
                                <div className="h-20 w-full overflow-hidden border-b border-border">
                                  <img
                                    src={beat.imageUrl}
                                    alt={beat.slugline}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                </div>
                              )}

                              <div className="p-2.5">
                                {/* Beat number + type */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9px] font-mono font-bold text-muted-foreground tracking-wider">
                                    BIT {beat.beatNumber}
                                  </span>
                                  <span className="text-[9px] font-medium text-muted-foreground">
                                    {beat.beatType}
                                  </span>
                                </div>

                                {/* Slugline as main title */}
                                <div className="text-[11px] font-mono font-semibold text-foreground leading-tight truncate">
                                  {beat.slugline}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
                                  <span className="text-[9px] font-mono text-muted-foreground">
                                    {formatDuration(beat.durationSeconds)}
                                  </span>
                                  {!beat.imageUrl && (
                                    <button
                                      className="text-[9px] opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all disabled:opacity-30"
                                      disabled={generatingImageId === beat.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateImage(beat);
                                      }}
                                    >
                                      {generatingImageId === beat.id ? "..." : "Generar imagen"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {sceneBeats.length === 0 && (
                            <div className="h-14 border border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground text-[10px]">
                              Arrastra bits aquí
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Beat Detail Modal ── */}
      {selectedBeat && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBeat(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  {selectedBeat.act} · Escena {selectedBeat.sceneNumber} · Bit {selectedBeat.beatNumber}
                </div>
                <h2 className="text-sm font-semibold font-mono text-foreground">
                  {selectedBeat.slugline}
                </h2>
              </div>
              <button
                onClick={() => setSelectedBeat(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Storyboard image */}
              {selectedBeat.imageUrl ? (
                <div className="relative group rounded-lg overflow-hidden border border-border">
                  <img
                    src={selectedBeat.imageUrl}
                    alt="Scene"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-background border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-all">
                      Regenerar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-28 bg-muted/50 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl opacity-30">🎬</span>
                  <button
                    disabled={!!generatingImageId}
                    onClick={() => selectedBeat && generateImage(selectedBeat)}
                    className="text-xs font-medium bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-secondary-foreground border border-border px-4 py-1.5 rounded-md transition-all"
                  >
                    {generatingImageId === selectedBeat?.id ? "Generando..." : "Generar Visualización (IA)"}
                  </button>
                </div>
              )}

              {/* Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted p-2.5 rounded-md border border-border">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Tipo</p>
                    <p className="text-xs font-semibold">{selectedBeat.beatType}</p>
                  </div>
                  <div className="bg-muted p-2.5 rounded-md border border-border">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Duración</p>
                    <p className="text-xs font-mono font-semibold">{formatDuration(selectedBeat.durationSeconds)}</p>
                  </div>
                  <div className="bg-muted p-2.5 rounded-md border border-border">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Personajes</p>
                    <p className="text-xs font-semibold">{selectedBeat.characters.length}</p>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Slugline</p>
                  <p className="text-xs font-mono font-semibold">{selectedBeat.slugline}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedBeat.characters.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-medium bg-background text-foreground rounded px-2 py-0.5 border border-border"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
