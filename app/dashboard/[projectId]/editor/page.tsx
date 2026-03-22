"use client";

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "next-themes";
import { useScript } from "@/lib/use-script";
import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { ChevronDownIcon } from "lucide-react";

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

interface Block {
  id: string;
  rawText: string[];
  tokens: FountainToken[];
}

function parseFountain(text: string): FountainToken[] {
  const lines = text.split("\n");
  const tokens: FountainToken[] = [];

  // Title page: everything before the first blank line after a "Key: Value" block
  let i = 0;
  let inTitlePage = false;

  // Detect title page (starts with "Title:" or other metadata keys)
  const titlePageKeys = /^(title|credit|author|authors|source|draft date|date|contact|copyright|notes|format):/i;
  if (lines.length > 0 && titlePageKeys.test(lines[0])) {
    inTitlePage = true;
  }

  let afterTitlePage = false;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // ── Title page ──────────────────────────────────────
    if (inTitlePage && !afterTitlePage) {
      if (line === "" && (tokens.length === 0 || tokens[tokens.length - 1].text !== "")) {
        inTitlePage = false;
        afterTitlePage = true;
        tokens.push({ type: "blank", text: "", raw });
        i++;
        continue;
      }
      if (titlePageKeys.test(line) || line.startsWith("   ") || line.startsWith("\t")) {
        tokens.push({ type: "title-page", text: line, raw });
        i++;
        continue;
      }
      // If it doesn't match, fall through
      inTitlePage = false;
      afterTitlePage = true;
    }

    // ── Blank line ───────────────────────────────────────
    if (line === "" || line === " ") {
      tokens.push({ type: "blank", text: "", raw });
      i++;
      continue;
    }

    // ── Page break ===────────────────────────────────────
    if (/^={3,}$/.test(line.trim())) {
      tokens.push({ type: "page-break", text: line, raw });
      i++;
      continue;
    }

    // ── Forced Scene Heading (.INT / .EXT) ────────────────
    if (/^\.[A-Z]/.test(line) && !/^\.\./.test(line)) {
      tokens.push({ type: "scene-heading", text: line.slice(1).trim(), raw });
      i++;
      continue;
    }

    // ── Scene Heading (INT. / EXT. / EST. / INT./EXT.) ───
    if (/^(INT\.|EXT\.|EST\.|INT\.\/EXT\.|I\/E\.)/i.test(line)) {
      tokens.push({ type: "scene-heading", text: line.toUpperCase(), raw });
      i++;
      continue;
    }

    // ── Transition (forced with >) ────────────────────────
    if (/^>(?!<)/.test(line)) {
      tokens.push({ type: "transition", text: line.slice(1).trim().toUpperCase(), raw });
      i++;
      continue;
    }

    // ── Centered text (>text<) ───────────────────────────
    if (/^>.*<\s*$/.test(line)) {
      tokens.push({ type: "centered", text: line.replace(/^>\s*/, "").replace(/\s*<\s*$/, ""), raw });
      i++;
      continue;
    }

    // ── Standard Transitions ─────────────────────────────
    // FADE OUT. / CUT TO: / SMASH CUT TO: / FADE TO BLACK. etc.
    if (/^[A-Z][A-Z\s]+:$/.test(line.trim()) || /^FADE (TO BLACK\.?|IN\.|OUT\.?)$/i.test(line.trim())) {
      tokens.push({ type: "transition", text: line.trim(), raw });
      i++;
      continue;
    }

    // ── Note [[…]] ───────────────────────────────────────
    if (/^\[\[/.test(line)) {
      tokens.push({ type: "note", text: line.replace(/^\[\[|\]\]$/g, ""), raw });
      i++;
      continue;
    }

    // ── Lyric (starts with ~) ────────────────────────────
    if (/^~/.test(line)) {
      tokens.push({ type: "lyric", text: line.slice(1).trim(), raw });
      i++;
      continue;
    }

    // ── Parenthetical ────────────────────────────────────
    if (/^\s*\([^)]*\)\s*$/.test(line)) {
      // Only parenthetical if the previous non-blank token was character or dialogue
      const prevMeaningful = [...tokens].reverse().find(t => t.type !== "blank");
      if (prevMeaningful && (prevMeaningful.type === "character" || prevMeaningful.type === "dialogue" || prevMeaningful.type === "parenthetical")) {
        tokens.push({ type: "parenthetical", text: line.trim(), raw });
        i++;
        continue;
      }
    }

    // ── Character name ───────────────────────────────────
    // All-caps line, optionally with (CONT'D) / (V.O.) / (O.S.) etc.
    // Preceded by a blank line (or start)
    const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const prevWasBlank = !prevToken || prevToken.type === "blank" || prevToken.type === "page-break";

    // Forced character with @
    if (/^@/.test(line)) {
      tokens.push({ type: "character", text: line.slice(1).trim(), raw });
      i++;
      continue;
    }

    // Standard character: all caps, no lowercase, not a scene heading
    const characterPattern = /^[A-Z][A-Z0-9 '\.\-\/]*((\s*\([^)]+\))?)?\s*$/;
    if (
      prevWasBlank &&
      characterPattern.test(line.trim()) &&
      line.trim().length >= 2 &&
      !line.trim().endsWith(":") &&    // not a transition
      !/^(INT\.|EXT\.|EST\.)/i.test(line) // not a scene heading
    ) {
      // Peek ahead: next non-blank line should be dialogue or parenthetical, not another all-caps
      const nextLine = lines[i + 1]?.trimEnd() || "";
      if (nextLine !== "" || lines[i + 2] !== undefined) {
        tokens.push({ type: "character", text: line.trim(), raw });
        i++;
        continue;
      }
    }

    // ── Dialogue ─────────────────────────────────────────
    // Line following a character or parenthetical
    const prevMeaningful = [...tokens].reverse().find(t => t.type !== "blank");
    if (prevMeaningful && (prevMeaningful.type === "character" || prevMeaningful.type === "parenthetical" || prevMeaningful.type === "dialogue")) {
      tokens.push({ type: "dialogue", text: line, raw });
      i++;
      continue;
    }

    // ── Action (everything else) ──────────────────────────
    tokens.push({ type: "action", text: line, raw });
    i++;
  }

  return tokens;
}

// ── Inline markdown for Fountain (*bold*, _italic_, **bold**, etc.) ──
function renderInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/^\/\*/, "<span class='underline'>").replace(/\*\/$/, "</span>");
}

// ── Block management ──
function textToBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let currentBlock: string[] = [];
  let blockCounter = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join("\n");
        blocks.push({
          id: `block-${blockCounter}`,
          rawText: currentBlock,
          tokens: parseFountain(blockText),
        });
        blockCounter++;
        currentBlock = [];
      }
      // Add blank block
      blocks.push({
        id: `block-${blockCounter}`,
        rawText: [""],
        tokens: [{ type: "blank", text: "", raw: "" }],
      });
      blockCounter++;
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    const blockText = currentBlock.join("\n");
    blocks.push({
      id: `block-${blockCounter}`,
      rawText: currentBlock,
      tokens: parseFountain(blockText),
    });
  }

  return blocks;
}

function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => b.rawText.join("\n")).join("\n");
}

// ── Token View Component ──
function TokenView({ token, isDark }: { token: FountainToken; isDark: boolean }) {
  const fg = isDark ? "#e8e8e8" : "#1a1a1a";
  const muted = isDark ? "#5a5a6a" : "#888";
  const sceneColor = isDark ? "#60a5fa" : "#1d4ed8";
  const charColor = isDark ? "#34d399" : "#065f46";
  const transColor = isDark ? "#a78bfa" : "#6d28d9";
  const noteColor = isDark ? "#6b7280" : "#9ca3af";

  const html = renderInline(token.text);

  switch (token.type) {
    case "title-page":
      return (
        <div style={{ color: muted, fontSize: "11px", marginBottom: "2px" }}>
          {token.text}
        </div>
      );

    case "blank":
      return <div style={{ height: "13px" }} />;

    case "page-break":
      return (
        <div style={{ borderTop: `1px dashed ${muted}`, margin: "24px 0", opacity: 0.4 }} />
      );

    case "scene-heading":
      return (
        <div
          style={{
            color: sceneColor,
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            marginTop: "8px",
            marginBottom: "2px",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    case "action":
      return (
        <div style={{ marginBottom: "2px", color: fg }} dangerouslySetInnerHTML={{ __html: html }} />
      );

    case "character":
      return (
        <div
          style={{
            color: charColor,
            fontWeight: "bold",
            textTransform: "uppercase",
            marginLeft: "42%",
            marginTop: "8px",
            marginBottom: "2px",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    case "parenthetical":
      return (
        <div
          style={{
            color: muted,
            fontStyle: "italic",
            marginLeft: "35%",
            marginRight: "20%",
            marginBottom: "2px",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    case "dialogue":
      return (
        <div
          style={{
            marginLeft: "24%",
            marginRight: "16%",
            marginBottom: "2px",
            color: fg,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    case "transition":
      return (
        <div
          style={{
            color: transColor,
            textAlign: "right",
            fontWeight: "bold",
            textTransform: "uppercase",
            marginTop: "8px",
            marginBottom: "2px",
            letterSpacing: "0.03em",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    case "centered":
      return (
        <div style={{ textAlign: "center", color: fg, marginBottom: "2px" }} dangerouslySetInnerHTML={{ __html: html }} />
      );

    case "lyric":
      return (
        <div style={{ fontStyle: "italic", color: fg, marginBottom: "2px" }} dangerouslySetInnerHTML={{ __html: html }} />
      );

    case "note":
      return (
        <div
          style={{
            color: noteColor,
            fontSize: "11px",
            fontStyle: "italic",
            borderLeft: `2px solid ${noteColor}`,
            paddingLeft: "8px",
            marginBottom: "4px",
            opacity: 0.7,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );

    default:
      return null;
  }
}

// ─── Live Preview Component with Inline Editing ─────────────────────────
function FountainEditor({
  blocks,
  onBlockChange,
  isDark,
}: {
  blocks: Block[];
  onBlockChange: (blocks: Block[]) => void;
  isDark: boolean;
}) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const bg = isDark ? "#0f0f10" : "#ffffff";
  const paper = isDark ? "#141416" : "#ffffff";
  const fg = isDark ? "#e8e8e8" : "#1a1a1a";

  const handleBlockClick = (block: Block) => {
    setEditingBlockId(block.id);
    setEditingText(block.rawText.join("\n"));
  };

  const handleBlockBlur = () => {
    if (editingBlockId) {
      const updated = blocks.map((b) => {
        if (b.id === editingBlockId) {
          const newRawText = editingText.split("\n");
          return {
            ...b,
            rawText: newRawText,
            tokens: parseFountain(editingText),
          };
        }
        return b;
      });
      onBlockChange(updated);
      setEditingBlockId(null);
      setEditingText("");
    }
  };

  const handleInsertBlock = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 0, {
      id: `block-${Date.now()}`,
      rawText: [""],
      tokens: [{ type: "blank", text: "", raw: "" }],
    });
    onBlockChange(newBlocks);
  };

  return (
    <div
      ref={previewRef}
      style={{
        background: bg,
        height: "100%",
        overflowY: "auto",
        padding: "48px 0",
        fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
        fontSize: "13px",
        lineHeight: "1.6",
        color: fg,
      }}
    >
      {/* Page simulation */}
      <div
        style={{
          background: paper,
          maxWidth: "680px",
          margin: "0 auto",
          padding: "80px 80px 100px 96px",
          minHeight: "960px",
          boxShadow: isDark ? "0 0 0 1px #2a2a2e" : "0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px #e5e5e5",
          borderRadius: "2px",
          cursor: "text",
        }}
      >
        {blocks.map((block, idx) => (
          <div key={block.id}>
            <div
              onClick={() => handleBlockClick(block)}
              style={{ position: "relative", minHeight: "20px" }}
              className={`group transition-colors rounded px-1 ${
                editingBlockId === block.id ? "bg-blue-500/10" : "hover:bg-muted/50"
              }`}
            >
              {editingBlockId === block.id ? (
                <textarea
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={handleBlockBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingBlockId(null);
                      setEditingText("");
                    }
                  }}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: fg,
                    background: isDark ? "#09090b" : "#f9fafb",
                    border: `2px solid ${isDark ? "#3a3a3f" : "#e5e5e5"}`,
                    padding: "8px",
                    borderRadius: "4px",
                    width: "100%",
                    minHeight: "60px",
                    resize: "none",
                  }}
                />
              ) : (
                <div className="opacity-0 group-hover:opacity-100 absolute right-2 top-0 text-[10px] text-muted-foreground font-semibold uppercase tracking-widest pointer-events-none">
                  Click to edit
                </div>
              )}
            </div>

            {editingBlockId !== block.id && (
              <div>
                {block.tokens.map((token, tokenIdx) => (
                  <TokenView key={tokenIdx} token={token} isDark={isDark} />
                ))}
              </div>
            )}

            {/* Insert block button */}
            {!editingBlockId && (
              <button
                onClick={() => handleInsertBlock(idx + 1)}
                className="mx-auto block my-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest px-3 py-1 rounded hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
              >
                + Bloque
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Editor Page ───────────────────────────────────────────────

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  const { text: scriptText, save: saveScript, loaded } = useScript(projectId, EXAMPLE_SCRIPT);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [showTranscriptionPanel, setShowTranscriptionPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Hydration guard
  useEffect(() => { setMounted(true); }, []);

  // Initialize blocks from text
  useEffect(() => {
    if (loaded) {
      setBlocks(textToBlocks(scriptText));
    }
  }, [scriptText, loaded]);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const handleBlockChange = useCallback(
    (updatedBlocks: Block[]) => {
      setBlocks(updatedBlocks);
      const newText = blocksToText(updatedBlocks);
      saveScript(newText);
    },
    [saveScript]
  );

  const words = scriptText.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.round(words / 175));
  const sluglines = (scriptText.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/gm) || []).length;

  async function handleGenerate() {
    if (!transcription.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    setShowTranscriptionPanel(false);
    try {
      const res = await fetch("/api/guion/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, transcription, duration: 10, genre: "Drama", title: "Mi Guion" }),
      });

      if (!res.ok) {
        const err = await res.text();
        setGenerateError(`Error: ${res.status} - ${err}`);
        setIsGenerating(false);
        return;
      }

      const data = await res.json();
      if (data.guionText) {
        saveScript(data.guionText);
      }
    } catch (err: any) {
      setGenerateError(err?.message || "Error generating script");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleEvaluate() {
    setIsFeedbackLoading(true);
    setShowFeedback(true);
    try {
      const res = await fetch("/api/guion/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guionText: scriptText, projectId }),
      });

      if (!res.ok) {
        const err = await res.text();
        setFeedback({ error: `Error: ${res.status} - ${err}` });
        setIsFeedbackLoading(false);
        return;
      }

      const data = await res.json();
      setFeedback(data);
    } catch (err: any) {
      setFeedback({ error: err?.message || "Error evaluating script" });
    } finally {
      setIsFeedbackLoading(false);
    }
  }

  async function handleExport(format: string) {
    setShowExportMenu(false);
    if (format === "pdf") {
      try {
        if (pdfFonts && (pdfFonts as any).pdfMake) {
          (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
        } else if (pdfFonts) {
          (pdfMake as any).vfs = (pdfFonts as any).vfs;
        }
      } catch (e) {
        console.warn("pdfMake VFS:", e);
      }
      // Configure Courier as standard PDF built-in font for screenplay format
      try {
        (pdfMake as any).fonts = {
          Courier: {
            normal: "Courier",
            bold: "Courier-Bold",
            italics: "Courier-Oblique",
            bolditalics: "Courier-BoldOblique",
          },
          Roboto: {
            normal: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Regular.ttf",
            bold: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Medium.ttf",
            italics: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Italic.ttf",
            bolditalics: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-MediumItalic.ttf",
          },
        };
      } catch (e) { console.warn("pdfmake font config:", e); }

      const pdfTokens = parseFountain(scriptText);
      const pdfContent: any[] = [];

      // ── Title page ──
      pdfContent.push(
        { text: "\n\n\n\n\n\n\n\n", font: "Courier", fontSize: 12 },
        { text: "GUION", font: "Courier", fontSize: 14, bold: true, alignment: "center", margin: [0, 0, 0, 12] },
        { text: "Escrito con Script Bud", font: "Courier", fontSize: 12, alignment: "center" },
        { text: "", pageBreak: "before" as const }
      );

      // ── Script body ──
      for (const token of pdfTokens) {
        switch (token.type) {
          case "blank":
            pdfContent.push({ text: " ", font: "Courier", fontSize: 12, lineHeight: 1 });
            break;
          case "scene-heading":
            pdfContent.push({
              text: token.text.toUpperCase(),
              font: "Courier", fontSize: 12, bold: true,
              margin: [0, 12, 0, 0],
            });
            break;
          case "action":
            pdfContent.push({ text: token.text, font: "Courier", fontSize: 12 });
            break;
          case "character":
            pdfContent.push({
              text: token.text.toUpperCase(),
              font: "Courier", fontSize: 12, bold: true,
              margin: [216, 12, 0, 0],
            });
            break;
          case "parenthetical":
            pdfContent.push({
              text: token.text,
              font: "Courier", fontSize: 12, italics: true,
              margin: [162, 0, 108, 0],
            });
            break;
          case "dialogue":
            pdfContent.push({
              text: token.text,
              font: "Courier", fontSize: 12,
              margin: [108, 0, 108, 0],
            });
            break;
          case "transition":
            pdfContent.push({
              text: token.text.toUpperCase(),
              font: "Courier", fontSize: 12, bold: true,
              alignment: "right",
              margin: [0, 12, 0, 0],
            });
            break;
          case "centered":
            pdfContent.push({ text: token.text, font: "Courier", fontSize: 12, alignment: "center" });
            break;
          case "page-break":
            pdfContent.push({ text: "", pageBreak: "before" as const });
            break;
          case "lyric":
            pdfContent.push({ text: `~${token.text}`, font: "Courier", fontSize: 12, italics: true });
            break;
          case "title-page":
          case "note":
            break;
        }
      }

      const docDefinition = {
        pageSize: "LETTER" as const,
        pageMargins: [108, 72, 72, 72] as [number, number, number, number],
        content: pdfContent,
        defaultStyle: { font: "Courier", fontSize: 12, lineHeight: 1 },
      };
      pdfMake.createPdf(docDefinition as any).download("guion.pdf");
      return;
    }

    try {
      const res = await fetch("/api/guion/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guionText: scriptText, format, title: "mi_guion" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `guion.${format === "fountain" ? "fountain" : "json"}`;
        a.click();
      }
    } catch (err) {
      console.error("Export error:", err);
    }
  }

  function insertAtCursor(text: string) {
    const newText = scriptText + "\n" + text;
    saveScript(newText);
  }

  const EXPORT_OPTS = [
    { label: "PDF Producción", format: "pdf", emoji: "📄" },
    { label: ".Fountain", format: "fountain", emoji: "🎬" },
    { label: ".JSON", format: "json", emoji: "📋" },
  ];

  if (!mounted || !loaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Cargando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── Toolbar ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md z-30 flex-shrink-0">
        <div className="flex items-center justify-between px-5 h-14 gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors shrink-0"
            >
              ← Dashboard
            </Link>
            <span className="text-muted-foreground/30 shrink-0">|</span>
            <span className="text-sm font-semibold tracking-tight truncate">Estudio del Guion</span>
          </div>

          {/* Center — snippet buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            {[
              { label: "SLUG", snippet: "\nINT. LUGAR - MOMENTO\n\n" },
              { label: "ACT", snippet: "\nDescripción de acción...\n\n" },
              { label: "DLG", snippet: "\nPERSONAJE\nTexto del diálogo...\n\n" },
              { label: "TRN", snippet: "\nCORTE A:\n\n" },
            ].map((b) => (
              <button
                key={b.label}
                onClick={() => insertAtCursor(b.snippet)}
                className="px-2.5 py-1 text-[11px] rounded font-mono font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            <button
              onClick={handleEvaluate}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors hidden sm:flex items-center gap-1.5"
            >
              🧠 Análisis
            </button>

            <Link
              href={`/dashboard/${projectId}/board`}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors hidden sm:flex items-center gap-1.5"
            >
              🎯 Tablero
            </Link>

            {/* Export dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                Extraer
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl py-1 w-44 z-50 animate-fade-in">
                  {EXPORT_OPTS.map((opt) => (
                    <button
                      key={opt.format}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => handleExport(opt.format)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <span>{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Fountain Editor with inline blocks */}
        <div className="flex-1 overflow-hidden">
          <FountainEditor blocks={blocks} onBlockChange={handleBlockChange} isDark={isDark} />
        </div>

        {/* ── Generación Asistida ── */}
        <div className="border-t border-border p-3 bg-muted/20 z-20 flex-shrink-0">
          <button
            onClick={() => setShowTranscriptionPanel(!showTranscriptionPanel)}
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <span>{showTranscriptionPanel ? "▼" : "▶"}</span> Generación Asistida
          </button>
          {showTranscriptionPanel && (
            <div className="mt-3 space-y-2 animate-fade-in">
              {generateError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs p-2 rounded-md">
                  {generateError}
                </div>
              )}
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder="Introduce notas, resumen o transcripción... La IA estructurará el guion en Fountain."
                rows={3}
                className="w-full bg-background text-foreground text-xs rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !transcription.trim()}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-md transition-all"
              >
                {isGenerating ? "Procesando..." : "Construir Secuencia"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-4 h-9 border-t border-border bg-muted/20 text-[10px] text-muted-foreground font-mono shrink-0">
        <span className="font-semibold uppercase tracking-widest">Vista Previa · Fountain</span>
        <div className="flex items-center gap-3">
          <span>{pages} pág</span>
          <span>{sluglines} esc.</span>
          <span>{words} palabras</span>
        </div>
      </div>

      {/* ── Feedback panel ── */}
      {showFeedback && (
        <div className="fixed inset-y-0 right-0 w-[380px] bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-sm">Auditoría Narrativa</h2>
            <button onClick={() => setShowFeedback(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isFeedbackLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}
                <p className="text-center text-muted-foreground text-xs mt-4 uppercase tracking-widest font-semibold">Procesando...</p>
              </div>
            ) : feedback ? (
              <>
                {feedback.error ? (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs p-3 rounded-md">
                    {feedback.error}
                  </div>
                ) : (
                  <>
                    <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
                      <div className="text-5xl font-bold font-mono">{feedback.totalScore || "—"}</div>
                      <div className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mt-2">Score Crítico</div>
                      {feedback.status && (
                        <div className={`text-xs font-bold uppercase tracking-widest mt-4 px-3 py-1.5 rounded-md inline-block ${
                          feedback.status === "Listo para enviar" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          feedback.status === "Necesita revisión menor" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}>
                          {feedback.status}
                        </div>
                      )}
                    </div>
                    {feedback.scores && (
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Dimensiones</h3>
                        {Object.entries(feedback.scores).map(([dim, score]: [string, any]) => (
                          <div key={dim} className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-muted-foreground w-24 capitalize truncate">{dim}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${score.passing ? "bg-foreground" : "bg-red-500"}`}
                                style={{ width: `${(score.score / 5) * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-mono font-bold w-8 text-right">{score.score}/5</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {feedback.recommendations && feedback.recommendations.length > 0 && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recomendaciones</h3>
                        {feedback.recommendations.map((rec: any, idx: number) => (
                          <div key={idx} className="text-xs text-foreground bg-muted/30 p-2 rounded-md border border-border">
                            {rec.priority && <span className="inline-block mb-1 px-2 py-0.5 text-[9px] rounded font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 mr-2">{rec.priority}</span>}
                            {rec.text || rec.message || rec}
                          </div>
                        ))}
                      </div>
                    )}
                    {feedback.checklist && feedback.checklist.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Checklist</h3>
                        {feedback.checklist.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
                            <span className={`text-sm ${item.completed || item.passed ? "text-green-500" : "text-red-500"}`}>
                              {item.completed || item.passed ? "✓" : "✗"}
                            </span>
                            {item.text || item.label || item}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
