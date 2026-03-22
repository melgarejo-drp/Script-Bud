"use client";

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Editor, { useMonaco } from "@monaco-editor/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "next-themes";
import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import {
  ColumnsIcon, FileTextIcon, EyeIcon, ChevronDownIcon,
} from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error";
type ViewMode = "editor" | "split" | "preview";

// ─── Fountain Parser ───────────────────────────────────────────────
// Token types matching real screenplay conventions
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

// ─── Live Preview Component ─────────────────────────────────────────
function FountainPreview({ text, isDark }: { text: string; isDark: boolean }) {
  const tokens = useMemo(() => parseFountain(text), [text]);
  const previewRef = useRef<HTMLDivElement>(null);

  const bg = isDark ? "#0f0f10" : "#ffffff";
  const paper = isDark ? "#141416" : "#ffffff";
  const fg = isDark ? "#e8e8e8" : "#1a1a1a";
  const muted = isDark ? "#5a5a6a" : "#888";
  const sceneColor = isDark ? "#60a5fa" : "#1d4ed8";
  const charColor = isDark ? "#34d399" : "#065f46";
  const transColor = isDark ? "#a78bfa" : "#6d28d9";
  const noteColor = isDark ? "#6b7280" : "#9ca3af";

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
          padding: "80px 80px 100px 96px", // screenplay standard margins
          minHeight: "960px",
          boxShadow: isDark ? "0 0 0 1px #2a2a2e" : "0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px #e5e5e5",
          borderRadius: "2px",
        }}
      >
        {tokens.map((token, idx) => {
          const html = renderInline(token.text);

          switch (token.type) {
            case "title-page":
              return (
                <div key={idx} style={{ color: muted, fontSize: "11px", marginBottom: "2px" }}>
                  {token.text}
                </div>
              );

            case "blank":
              return <div key={idx} style={{ height: "13px" }} />;

            case "page-break":
              return (
                <div key={idx} style={{ borderTop: `1px dashed ${muted}`, margin: "24px 0", opacity: 0.4 }} />
              );

            case "scene-heading":
              return (
                <div
                  key={idx}
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
                <div
                  key={idx}
                  style={{ marginBottom: "2px", color: fg }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );

            case "character":
              return (
                <div
                  key={idx}
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
                  key={idx}
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
                  key={idx}
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
                  key={idx}
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
                <div
                  key={idx}
                  style={{ textAlign: "center", color: fg, marginBottom: "2px" }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );

            case "lyric":
              return (
                <div
                  key={idx}
                  style={{ fontStyle: "italic", color: fg, marginBottom: "2px" }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );

            case "note":
              return (
                <div
                  key={idx}
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
        })}
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
  const monaco = useMonaco();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  const [scriptText, setScriptText] = useState(EXAMPLE_SCRIPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [showTranscriptionPanel, setShowTranscriptionPanel] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const lastSaved = useRef<string>(scriptText);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);

  // Hydration guard — prevents theme flash on initial load
  useEffect(() => { setMounted(true); }, []);

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

  useEffect(() => {
    if (!monaco) return;

    monaco.languages.register({ id: "fountain" });
    monaco.languages.setMonarchTokensProvider("fountain", {
      tokenizer: {
        root: [
          [/^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.).*$/, "scene-heading"],
          [/^[A-Z\s]+(TO:)$/, "transition"],
          [/^FADE (OUT\.?|IN\.|TO BLACK\.?)$/i, "transition"],
          [/^[A-Z][A-Z0-9\s'\.\-\/]+(\s*\([^)]*\))?[\s]*$/, "character"],
          [/^[\s]*\([^)]+\)[\s]*$/, "parenthetical"],
          [/^(Title|Credit|Author|Draft Date|Contact|Source):\s*(.*)$/i, "metadata"],
          [/^={3,}$/, "page-break"],
          [/^>.*<\s*$/, "centered"],
          [/\*\*\*(.+?)\*\*\*/, "bold-italic"],
          [/\*\*(.+?)\*\*/, "bold"],
          [/\*(.+?)\*/, "italic"],
          [/^~.*$/, "lyric"],
          [/^\[\[.*\]\]$/, "note"],
        ]
      }
    });

    monaco.editor.defineTheme("fountain-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "scene-heading", foreground: "60A5FA", fontStyle: "bold" },
        { token: "transition", foreground: "A78BFA", fontStyle: "bold" },
        { token: "character", foreground: "34D399", fontStyle: "bold" },
        { token: "parenthetical", foreground: "9CA3AF", fontStyle: "italic" },
        { token: "metadata", foreground: "6B7280" },
        { token: "page-break", foreground: "374151", fontStyle: "bold" },
        { token: "centered", foreground: "E8E8E8", fontStyle: "italic" },
        { token: "bold-italic", foreground: "F9FAFB", fontStyle: "bold italic" },
        { token: "bold", foreground: "F9FAFB", fontStyle: "bold" },
        { token: "italic", foreground: "F9FAFB", fontStyle: "italic" },
        { token: "lyric", foreground: "FCD34D", fontStyle: "italic" },
        { token: "note", foreground: "4B5563", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#09090b",
        "editor.lineHighlightBackground": "#18181b",
        "editorLineNumber.foreground": "#374151",
        "editorLineNumber.activeForeground": "#6B7280",
      }
    });

    monaco.editor.defineTheme("fountain-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "scene-heading", foreground: "1D4ED8", fontStyle: "bold" },
        { token: "transition", foreground: "6D28D9", fontStyle: "bold" },
        { token: "character", foreground: "065F46", fontStyle: "bold" },
        { token: "parenthetical", foreground: "6B7280", fontStyle: "italic" },
        { token: "metadata", foreground: "9CA3AF" },
        { token: "page-break", foreground: "D1D5DB" },
        { token: "centered", foreground: "374151", fontStyle: "italic" },
        { token: "bold", foreground: "111827", fontStyle: "bold" },
        { token: "italic", foreground: "374151", fontStyle: "italic" },
        { token: "lyric", foreground: "D97706", fontStyle: "italic" },
        { token: "note", foreground: "9CA3AF", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.lineHighlightBackground": "#f9fafb",
        "editorLineNumber.foreground": "#D1D5DB",
        "editorLineNumber.activeForeground": "#9CA3AF",
      }
    });
  }, [monaco]);

  // Use "vs-dark" as safe default until hydration resolves, avoiding theme flash
  const monacoTheme = !mounted ? "vs-dark" : (isDark ? "fountain-dark" : "fountain-light");

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
              action: "sync", projectId, content: text,
              metadata: { lastModified: new Date().toISOString() },
            }),
          });
          lastSaved.current = text;
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 3000);
        } catch {
          setSaveState("error");
        }
      }, 1500);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Parse fountain tokens → proper screenplay PDF blocks
      // Page layout: Letter 8.5×11", margins: 1.5" left, 1" top/right/bottom
      // In pdfmake points (72pt = 1"): left=108, top=72, right=72, bottom=72
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
              margin: [216, 12, 0, 0], // ~3" from content left ≈ character position
            });
            break;
          case "parenthetical":
            pdfContent.push({
              text: token.text,
              font: "Courier", fontSize: 12, italics: true,
              margin: [162, 0, 108, 0], // slightly narrower than dialogue
            });
            break;
          case "dialogue":
            pdfContent.push({
              text: token.text,
              font: "Courier", fontSize: 12,
              margin: [108, 0, 108, 0], // ~1.5" indent each side within content
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
            break; // skip in body
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
    const res = await fetch("/api/guion/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        range: new monaco!.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column
        ),
        text, forceMoveMarkers: true,
      }]);
      editorRef.current.focus();
    } else {
      setScriptText((prev) => prev + "\n" + text);
    }
  }

  const VIEW_MODES: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "editor", icon: <FileTextIcon className="w-3.5 h-3.5" />, label: "Editor" },
    { id: "split", icon: <ColumnsIcon className="w-3.5 h-3.5" />, label: "Split" },
    { id: "preview", icon: <EyeIcon className="w-3.5 h-3.5" />, label: "Vista" },
  ];

  const EXPORT_OPTS = [
    { label: "PDF Producción", format: "pdf", emoji: "📄" },
    { label: ".Fountain", format: "fountain", emoji: "🎬" },
    { label: ".JSON", format: "json", emoji: "📋" },
  ];

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
            {/* Save state */}
            <span className={`text-[11px] uppercase tracking-wider font-semibold transition-all hidden sm:block ${
              saveState === "saving" ? "text-amber-500" :
              saveState === "saved" ? "text-green-500" :
              saveState === "error" ? "text-red-500" : "text-transparent"
            }`}>
              {saveState === "saving" ? "Sync..." : saveState === "saved" ? "✓" : saveState === "error" ? "Error" : "·"}
            </span>

            {/* View mode toggle */}
            <div className="flex items-center bg-muted rounded-md p-0.5 border border-border">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id)}
                  title={m.label}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === m.id
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.icon}
                  <span className="hidden lg:inline">{m.label}</span>
                </button>
              ))}
            </div>

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

            {/* Export dropdown — click-based, no gap */}
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
      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor pane ── */}
        {(viewMode === "editor" || viewMode === "split") && (
          <div
            className={`flex flex-col overflow-hidden ${viewMode === "split" ? "w-1/2 border-r border-border" : "flex-1"}`}
          >
            <div className="flex-1 overflow-hidden bg-background relative">
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
                    fontSize: 13,
                    lineHeight: 22,
                    padding: { top: 24, bottom: 24 },
                    scrollBeyondLastLine: false,
                    renderLineHighlight: "gutter",
                    lineNumbers: "on",
                    scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5 },
                    overviewRulerLanes: 0,
                  }}
                />
              )}
            </div>

            {/* ── Generación Asistida ── */}
            <div className="border-t border-border p-3 bg-muted/20 z-20">
              <button
                onClick={() => setShowTranscriptionPanel(!showTranscriptionPanel)}
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              >
                <span>{showTranscriptionPanel ? "▼" : "▶"}</span> Generación Asistida
              </button>
              {showTranscriptionPanel && (
                <div className="mt-3 space-y-2 animate-fade-in">
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
        )}

        {/* ── Preview pane ── */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`flex flex-col overflow-hidden ${viewMode === "split" ? "w-1/2" : "flex-1"}`}>
            {/* Preview header */}
            <div className="flex items-center justify-between px-4 h-9 border-b border-border bg-muted/20 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Vista Previa · Fountain
              </span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                <span>{pages} pág</span>
                <span>{sluglines} esc.</span>
                <span>{words} palabras</span>
              </div>
            </div>

            {/* Fountain preview */}
            <div className="flex-1 overflow-hidden">
              <FountainPreview text={scriptText} isDark={isDark} />
            </div>
          </div>
        )}
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
                <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
                  <div className="text-5xl font-bold font-mono">{feedback.totalScore}</div>
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
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
