"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Editor, { useMonaco } from "@monaco-editor/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "next-themes";
import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
// Removed top-level assignment to avoid "object not extensible" error in ESM
type SaveState = "idle" | "saving" | "saved" | "error";

const EXAMPLE_SCRIPT = `Title: Mi Proyecto
Credit: Escrito por
Author: Script Bud

===

INT. ESTUDIO DE PODCAST - NOCHE

La pantalla del micrófono parpadea en rojo. Listo para grabar.

JUAN (28, ojeras profundas) ajusta los auriculares. Su cuaderno está lleno de notas tachadas. Una taza de café, fría.

JUAN
(para sí mismo)
Esta noche es distinta.

Presiona el botón de grabación. Respira profundo.

JUAN
Bienvenidos a No Sleep Club. Soy Juan. Y esta es la historia que nunca debí contar.

Pausa. Mira al techo.

JUAN
Pero la voy a contar de todas formas.

CORTE A:

INT. SALA DE MONTAJE - MISMO MOMENTO

Una pantalla muestra el audio como onda. Alguien está escuchando.
`;

export default function EditorPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const monaco = useMonaco();
  const { theme, systemTheme } = useTheme();
  
  const [scriptText, setScriptText] = useState(EXAMPLE_SCRIPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [showTranscriptionPanel, setShowTranscriptionPanel] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const lastSaved = useRef<string>(scriptText);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (monaco) {
      monaco.languages.register({ id: "fountain" });
      
      monaco.languages.setMonarchTokensProvider("fountain", {
        tokenizer: {
          root: [
            [/^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.).*$/, "scene-heading"],
            [/^[A-Z\\s]+(A:|TO:)$/, "transition"],
            [/^[\s]*[A-Z][A-Z0-9\s\.\-]+(\s*\(CONT'D\))?(\s*\([^)]*\))?[\s]*$/, "character"],
            [/^[\s]*\([^)]+\)[\s]*$/, "parenthetical"],
            [/^(Title|Credit|Author|Draft Date|Contact):\s*(.*)$/, "metadata"],
            [/^={3,}$/, "page-break"],
          ]
        }
      });

      // Dark Theme Mode
      monaco.editor.defineTheme("fountain-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "scene-heading", foreground: "60A5FA", fontStyle: "bold" },
          { token: "transition", foreground: "A78BFA", fontStyle: "italic" },
          { token: "character", foreground: "34D399", fontStyle: "bold" },
          { token: "parenthetical", foreground: "9CA3AF", fontStyle: "italic" },
          { token: "metadata", foreground: "6B7280" },
          { token: "page-break", foreground: "4B5563", fontStyle: "bold" },
        ],
        colors: {
          "editor.background": "#09090b",
          "editor.lineHighlightBackground": "#18181b",
        }
      });

      // Light Theme Mode
      monaco.editor.defineTheme("fountain-light", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "scene-heading", foreground: "2563EB", fontStyle: "bold" },
          { token: "transition", foreground: "7C3AED", fontStyle: "italic" },
          { token: "character", foreground: "059669", fontStyle: "bold" },
          { token: "parenthetical", foreground: "6B7280", fontStyle: "italic" },
          { token: "metadata", foreground: "9CA3AF" },
          { token: "page-break", foreground: "D1D5DB", fontStyle: "bold" },
        ],
        colors: {
          "editor.background": "#ffffff",
          "editor.lineHighlightBackground": "#f4f4f5",
        }
      });
    }
  }, [monaco]);

  // Determine active theme based on user/system preference
  const currentTheme = theme === "system" ? systemTheme : theme;
  const monacoTheme = currentTheme === "dark" ? "fountain-dark" : "fountain-light";

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const words = scriptText.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.round(words / 175));
  const minutes = pages;
  const sluglines = (scriptText.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/gm) || []).length;

  const handleChange = useCallback(
    (value: string | undefined) => {
      const text = value || "";
      setScriptText(text);

      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (text === lastSaved.current) return;

      setSaveState("saving");
      saveTimeout.current = setTimeout(async () => {
        try {
          await fetch("/api/notion/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sync",
              projectId,
              content: text,
              metadata: { lastModified: new Date().toISOString() },
            }),
          });
          lastSaved.current = text;
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 3000);
        } catch {
          setSaveState("error");
        }
      }, 2000);
    },
    [projectId]
  );

  async function handleGenerate() {
    if (!transcription.trim()) return;
    setIsGenerating(true);
    setShowTranscriptionPanel(false);

    try {
      const res = await fetch("/api/guion/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, transcription, duration: 10, genre: "Drama", title: "Mi Guion" }),
      });
      const data = await res.json();
      if (data.guionText) {
        setScriptText(data.guionText);
        handleChange(data.guionText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleEvaluate() {
    setIsFeedbackLoading(true);
    setShowFeedback(true);
    try {
      const res = await fetch("/api/guion/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guionText: scriptText, projectId }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFeedbackLoading(false);
    }
  }

  async function handleExport(format: string) {
    if (format === "pdf") {
      try {
        if (pdfFonts && (pdfFonts as any).pdfMake) {
          (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
        } else if (pdfFonts) {
          (pdfMake as any).vfs = (pdfFonts as any).vfs;
        }
      } catch (e) {
        console.warn("pdfMake VFS could not be set automatically:", e);
      }

      const docDefinition = {
        content: [
          { text: "\n\n\n\n\n\n\n\n\n\n\n" },
          { text: "MI PROYECTO", fontSize: 24, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
          { text: "Escrito por\nScript Bud", fontSize: 12, alignment: "center", margin: [0, 0, 0, 40] },
          { text: "Contacto:\ninfo@scriptbud.com", fontSize: 10, alignment: "right", margin: [0, 200, 40, 0] },
          { text: "", pageBreak: "before" as const },
          { text: scriptText, preserveLeadingSpaces: true, style: "scriptBody" }
        ],
        styles: { scriptBody: { fontSize: 12, lineHeight: 1.2, margin: [40, 40, 40, 40] } },
        defaultStyle: { font: "Roboto" }
      };
      pdfMake.createPdf(docDefinition as any).download("guion_con_portada.pdf");
      return;
    }

    const res = await fetch("/api/guion/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guionText: scriptText, format, title: "mi_guion" }),
    });

    if (format === "fountain" || format === "markdown") {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guion.${format === "fountain" ? "fountain" : "md"}`;
      a.click();
    }
  }

  function insertAtCursor(text: string) {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      editorRef.current.executeEdits("toolbar", [{
        range: new monaco!.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: text, forceMoveMarkers: true,
      }]);
      editorRef.current.focus();
    } else {
      setScriptText((prev) => prev + "\n" + text);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden selection:bg-primary selection:text-primary-foreground">
      {/* ── Toolbar ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md z-30 flex-shrink-0">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
              ← Dashboard
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-sm font-semibold tracking-tight">Estudio del Guion</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => insertAtCursor("\nINT. LUGAR - MOMENTO\n")} className="px-3 py-1 text-[11px] rounded font-mono font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors">SLUG</button>
            <button onClick={() => insertAtCursor("\nDescripción de acción visual...\n")} className="px-3 py-1 text-[11px] rounded font-mono font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors">ACT</button>
            <button onClick={() => insertAtCursor("\nPERSONAJE\nTexto del diálogo...\n")} className="px-3 py-1 text-[11px] rounded font-mono font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors">DLG</button>
            <button onClick={() => insertAtCursor("\nCORTE A:\n")} className="px-3 py-1 text-[11px] rounded font-mono font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors">TRN</button>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-[11px] uppercase tracking-wider font-semibold transition-all ${
              saveState === "saving" ? "text-amber-500" :
              saveState === "saved" ? "text-green-500" :
              saveState === "error" ? "text-red-500" : "text-muted-foreground"
            }`}>
              {saveState === "saving" ? "Sync..." : saveState === "saved" ? "Sincronizado" : saveState === "error" ? "Error" : ""}
            </span>

            <ThemeToggle />

            <button onClick={handleEvaluate} className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center gap-2">
              <span>🧠</span> Análisis
            </button>

            <Link href={`/dashboard/${projectId}/board`} className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center gap-2">
              <span>🎯</span> Tablero
            </Link>

            <div className="relative group">
              <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Extraer ↓
              </button>
              <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-lg overflow-hidden shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto w-40 z-50">
                {[
                  { label: "📄 PDF Producción", format: "pdf" },
                  { label: "🎬 .Fountain", format: "fountain" },
                  { label: "📋 .JSON", format: "json" },
                ].map((opt) => (
                  <button
                    key={opt.format}
                    onClick={() => handleExport(opt.format)}
                    className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative border-r border-border">
          <div className="flex-1 w-full bg-background relative z-10">
            {monacoTheme && (
              <Editor
                height="100%"
                language="fountain"
                theme={monacoTheme}
                value={scriptText}
                onChange={handleChange}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  wordWrap: "on",
                  fontFamily: '"Courier Prime", "Monaco", "Courier New", monospace',
                  fontSize: 14,
                  lineHeight: 24,
                  padding: { top: 32, bottom: 32 },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "all",
                  formatOnType: true,
                  formatOnPaste: true,
                  scrollbar: {
                    verticalScrollbarSize: 6,
                    horizontalScrollbarSize: 6,
                  }
                }}
              />
            )}
          </div>

          {/* ── Generador IA ── */}
          <div className="border-t border-border p-4 bg-muted/30 backdrop-blur z-20">
            <button
              onClick={() => setShowTranscriptionPanel(!showTranscriptionPanel)}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              <span>{showTranscriptionPanel ? "▼" : "▶"}</span> Generación Asistida
            </button>

            {showTranscriptionPanel && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="Introduce notas libres, un resumen o transcripción... La IA lo estructurará en formato Fountain."
                  rows={4}
                  className="w-full bg-background text-foreground text-sm rounded-md px-4 py-3 border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !transcription.trim()}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-md transition-all"
                >
                  {isGenerating ? "Procesando estructura fractal..." : "Construir Secuencia"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Sidebar ── */}
        <aside className="w-64 flex-shrink-0 p-6 space-y-8 overflow-y-auto bg-muted/10">
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Métricas del Proyecto
            </h2>
            <div className="space-y-4">
              {[
                { label: "Páginas", value: pages, unit: "pág" },
                { label: "Duración", value: minutes, unit: "min" },
                { label: "Bloques", value: sluglines, unit: "esc." },
                { label: "Volumen", value: words, unit: "palabras" },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="font-semibold font-mono">
                    {stat.value} <span className="text-muted-foreground/60 text-[10px] font-sans">{stat.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground mb-2">
              <span>Ritmo Proyectado</span>
              <span>{minutes}/15 min</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (minutes / 15) * 100)}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Gramática Fountain
            </h2>
            <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Escenas:</strong> INT. / EXT.</p>
              <p><strong className="text-foreground">Personajes:</strong> TODO MAYÚSCULAS aisladas.</p>
              <p><strong className="text-foreground">Diálogo:</strong> Continua al personaje.</p>
              <p><strong className="text-foreground">Transiciones:</strong> CORTE A: / FADE TO:</p>
            </div>
          </div>
        </aside>
      </div>

      {showFeedback && (
        <div className="fixed inset-y-0 right-0 w-[400px] bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-sm">Auditoría Narrativa</h2>
            <button onClick={() => setShowFeedback(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isFeedbackLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}
                <p className="text-center text-muted-foreground text-xs mt-4 uppercase tracking-widest font-semibold">Procesando normativas...</p>
              </div>
            ) : feedback ? (
              <>
                <div className="bg-muted/50 border border-border rounded-xl p-6 text-center shadow-inner">
                  <div className="text-5xl font-bold font-mono text-foreground">{feedback.totalScore}</div>
                  <div className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mt-2">Score Crítico</div>
                  <div className={`text-xs font-bold uppercase tracking-widest mt-4 px-3 py-1.5 rounded-md inline-block ${
                    feedback.status === "Listo para enviar" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                    feedback.status === "Necesita revisión menor" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                    "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    {feedback.status}
                  </div>
                </div>

                {feedback.scores && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Dimensiones</h3>
                    {Object.entries(feedback.scores).map(([dim, score]: [string, any]) => (
                      <div key={dim} className="flex items-center gap-4">
                        <span className="text-[11px] font-semibold text-muted-foreground w-28 capitalize truncate">{dim}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${score.passing ? "bg-foreground" : "bg-red-500"}`}
                            style={{ width: `${(score.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-foreground">{score.score}/5</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
