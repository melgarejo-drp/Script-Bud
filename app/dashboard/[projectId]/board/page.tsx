"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

type BeatType = "Acción" | "Diálogo" | "Transición" | "Punto de Giro";
type ActName = "Acto 1 (Inicio)" | "Acto 2 (Nudo)" | "Acto 3 (Desenlace)";

interface Beat {
  id: string;
  sceneNumber: number; // 1 to 9
  beatNumber: number;  // 1 to 27
  act: ActName;
  beatType: BeatType;
  narrativeFunction: string;
  slugline: string;
  action: string;
  characters: string[];
  durationSeconds: number;
  imageUrl?: string;
}

const BEAT_COLORS: Record<BeatType, { class: string; badge: string; text: string }> = {
  "Acción":        { class: "beat-action",    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",   text: "text-blue-600 dark:text-blue-400" },
  "Diálogo":       { class: "beat-dialogue",  badge: "bg-green-500/10 text-green-600 dark:text-green-400", text: "text-green-600 dark:text-green-400" },
  "Transición":    { class: "beat-transition", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400", text: "text-purple-600 dark:text-purple-400" },
  "Punto de Giro": { class: "beat-turning",   badge: "bg-red-500/10 text-red-600 dark:text-red-400",     text: "text-red-600 dark:text-red-400" },
};

const ACTS: ActName[] = ["Acto 1 (Inicio)", "Acto 2 (Nudo)", "Acto 3 (Desenlace)"];

const ACT_COLORS: Record<ActName, string> = {
  "Acto 1 (Inicio)":  "border-blue-500/50",
  "Acto 2 (Nudo)": "border-green-500/50",
  "Acto 3 (Desenlace)":  "border-red-500/50",
};

const DEMO_BEATS: Beat[] = Array.from({ length: 27 }).map((_, i) => {
  const beatNumber = i + 1;
  const sceneNumber = Math.floor(i / 3) + 1;
  const actIndex = Math.floor(i / 9);
  const act = ACTS[actIndex];
  
  return {
    id: `BIT_${String(beatNumber).padStart(3, "0")}`,
    sceneNumber,
    beatNumber,
    act,
    beatType: beatNumber % 9 === 0 ? "Punto de Giro" : beatNumber % 2 === 0 ? "Diálogo" : "Acción",
    narrativeFunction: `Función Narrativa ${beatNumber}`,
    slugline: `INT. LOCACIÓN ${sceneNumber} - DÍA`,
    action: `Esta es una descripción extendida de lo que sucede en el bit ${beatNumber}. Incluye detalles que evolucionan la trama.`,
    characters: ["PROTAGONISTA"],
    durationSeconds: 30 + Math.floor(Math.random() * 60),
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

  const totalDuration = beats.reduce((a, b) => a + b.durationSeconds, 0);
  const totalMinutes = Math.round(totalDuration / 60);

  const beatsByActAndScene = ACTS.reduce((accActs, act) => {
    const actBeats = beats.filter((b) => b.act === act);
    const scenesMap = new Map<number, Beat[]>();
    
    actBeats.forEach(b => {
      if (!scenesMap.has(b.sceneNumber)) scenesMap.set(b.sceneNumber, []);
      scenesMap.get(b.sceneNumber)!.push(b);
    });

    const scenes = Array.from(scenesMap.entries())
      .map(([sceneNum, sceneBeats]) => ({
        sceneNumber: sceneNum,
        beats: sceneBeats.sort((x, y) => x.beatNumber - y.beatNumber)
      }))
      .sort((x, y) => x.sceneNumber - y.sceneNumber);

    accActs[act] = scenes;
    return accActs;
  }, {} as Record<ActName, { sceneNumber: number; beats: Beat[] }[]>);

  function handleDragStart(beatId: string) { setDragId(beatId); }

  function handleDrop(targetAct: ActName, targetScene: number) {
    if (!dragId) return;
    setBeats((prev) => prev.map((b) => (b.id === dragId ? { ...b, act: targetAct, sceneNumber: targetScene } : b)));
    setDragId(null);
    setOverTarget(null);
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function truncateAction(text: string, maxLength: number = 80): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden selection:bg-primary selection:text-primary-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md z-30 flex-shrink-0">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard`} className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
              ← Dashboard
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-sm font-semibold">Superficie de Trabajo (Board)</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground font-mono">
            <span>{beats.length}/27 bits</span>
            <span>{totalMinutes} min</span>
            <span>{beats.filter((b) => b.imageUrl).length}/{beats.length} assets</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            <div className="relative group">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center gap-2"
              >
                Render Masivo
              </button>
              
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                  <div className="p-3 border-b border-border bg-muted/30">
                    <h4 className="text-xs font-semibold">Configuración de Arte</h4>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Aspect Ratio</label>
                      <select className="w-full bg-background border border-border text-xs rounded p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                        <option>16:9 (Cinemático Estándar)</option>
                        <option>2.35:1 (Anamórfico Widescreen)</option>
                        <option>1:1 (Cuadrado)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Estilo Visual</label>
                      <select className="w-full bg-background border border-border text-xs rounded p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                        <option>Photorrealistic 8k</option>
                        <option>Cinematic Lighting / Film Noir</option>
                        <option>Studio Ghibli Anime</option>
                        <option>Concept Art Painterly</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => setShowBulkMenu(false)}
                      className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold py-2 rounded-md transition-colors"
                    >
                      Ejecutar Render
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

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-6 py-2 bg-muted/50 border-b border-border text-[11px] font-medium tracking-wide shadow-sm">
        <span className="text-muted-foreground uppercase">Leyenda:</span>
        {(Object.entries(BEAT_COLORS) as [BeatType, typeof BEAT_COLORS[BeatType]][]).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${c.badge} border border-border/10`} />
            <span className={c.text}>{type}</span>
          </div>
        ))}
      </div>

      {/* ── Board: Nested Structure (Acts -> Scenes -> Beats) ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-muted/10">
        <div className="flex gap-6 h-full min-w-max">
          {ACTS.map((act) => {
            const scenesInAct = beatsByActAndScene[act] || [];
            const actDuration = scenesInAct.reduce((total, scene) => total + scene.beats.reduce((a, b) => a + b.durationSeconds, 0),0);

            return (
              <div
                key={act}
                className={`flex flex-col shrink-0 rounded-xl border-t-4 bg-card/60 border-x border-b border-border shadow-sm transition-all ${ACT_COLORS[act]}`}
                style={{ width: "380px" }}
              >
                {/* Act Header */}
                <div className="p-4 border-b border-border bg-card/80">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-semibold text-sm tracking-tight">{act}</h2>
                    <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                      {Math.round(actDuration / 60)} min
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {scenesInAct.length} Bloques/Escenas
                  </p>
                </div>

                {/* Act Body -> Scenes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {scenesInAct.map(({ sceneNumber, beats }) => {
                    const isOver = overTarget?.act === act && overTarget?.sceneNumber === sceneNumber;
                    
                    return (
                      <div 
                        key={sceneNumber} 
                        className={`bg-background rounded-lg border border-border p-3 relative transition-colors ${
                          isOver ? "ring-2 ring-primary/50 bg-accent" : ""
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setOverTarget({ act, sceneNumber }); }}
                        onDragLeave={() => setOverTarget(null)}
                        onDrop={() => handleDrop(act, sceneNumber)}
                      >
                        {/* Scene Header */}
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Escena {sceneNumber}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{beats.length} bits</span>
                        </div>

                        {/* Scene Beats */}
                        <div className="space-y-2">
                          {beats.map((beat) => {
                            const c = BEAT_COLORS[beat.beatType];
                            return (
                              <div
                                key={beat.id}
                                draggable
                                onDragStart={() => handleDragStart(beat.id)}
                                onClick={() => setSelectedBeat(beat)}
                                className={`
                                  group relative bg-card rounded-md border border-border overflow-hidden 
                                  cursor-pointer transition-all duration-200 hover:border-foreground/30 hover:shadow-sm
                                  ${c.class}
                                  ${dragId === beat.id ? "opacity-40 scale-95" : ""}
                                `}
                              >
                                {beat.imageUrl && (
                                  <div className="relative h-20 w-full overflow-hidden border-b border-border">
                                    <img src={beat.imageUrl} alt={beat.narrativeFunction} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                  </div>
                                )}

                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-mono font-bold text-muted-foreground">BIT {beat.beatNumber}</span>
                                    <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${c.badge}`}>
                                      {beat.beatType}
                                    </span>
                                  </div>

                                  <div className="text-sm font-semibold leading-tight text-foreground mb-1.5">
                                    {beat.narrativeFunction}
                                  </div>

                                  <div className="text-[10px] text-muted-foreground font-mono truncate mb-2 px-1 py-0.5 bg-muted rounded">
                                    {beat.slugline}
                                  </div>

                                  <p className="text-[11px] text-muted-foreground leading-snug">
                                    {truncateAction(beat.action, 80)}
                                  </p>

                                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                                    <span className="text-[10px] font-mono text-muted-foreground">
                                      {formatDuration(beat.durationSeconds)}
                                    </span>
                                    <div className="flex gap-2">
                                      {!beat.imageUrl && <button className="text-[10px] opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground transition-all">Generar Imagen</button>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {beats.length === 0 && (
                            <div className="h-16 border border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground text-xs text-center p-4">
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBeat(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  {selectedBeat.act} • Escena {selectedBeat.sceneNumber} • Bit {selectedBeat.beatNumber}
                </div>
                <h2 className="text-lg font-semibold text-foreground">{selectedBeat.narrativeFunction}</h2>
              </div>
              <button onClick={() => setSelectedBeat(null)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">×</button>
            </div>

            <div className="p-6 space-y-5">
              {selectedBeat.imageUrl ? (
                <div className="relative group rounded-lg overflow-hidden border border-border">
                  <img src={selectedBeat.imageUrl} alt="Scene" className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-background border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-all">
                      Regenerar Imagen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-muted/50 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-3">
                  <span className="text-2xl opacity-40">🖼️</span>
                  <button className="text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-4 py-2 rounded-md transition-all">
                    Generar Visualización (IA)
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">SLUGLINE</p>
                  <p className="text-xs font-mono font-semibold">{selectedBeat.slugline}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">ACCIÓN</p>
                  <p className="text-sm text-foreground leading-relaxed bg-background p-3 rounded-md border border-border">
                    {selectedBeat.action}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">PERSONAJES</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBeat.characters.map((c) => (
                        <span key={c} className="text-[10px] font-medium bg-muted text-foreground rounded px-1.5 py-0.5 border border-border">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">DURACIÓN</p>
                    <p className="text-sm font-mono font-bold text-foreground">
                      {formatDuration(selectedBeat.durationSeconds)} <span className="text-[10px] text-muted-foreground font-normal">sec</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
