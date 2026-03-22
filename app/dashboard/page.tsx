"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  FilmIcon, PencilIcon, TrashIcon, MoreVerticalIcon,
  UploadIcon, MicIcon, FileTextIcon, XIcon, CheckIcon,
} from "lucide-react";

type ProjectStatus = "Draft" | "Review" | "Final";
type ProjectGenre =
  | "Drama" | "Thriller" | "Comedia" | "Ciencia Ficción"
  | "Terror" | "Documental" | "Romance" | "Acción" | "Otro";

interface ProjectCard {
  id: string;
  title: string;
  genre: ProjectGenre;
  duration: number;
  status: ProjectStatus;
  lastModified: string;
  logline?: string;
  thumbnail?: string;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Final: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const GENRE_EMOJIS: Record<string, string> = {
  Drama: "🎭", Thriller: "🔪", Comedia: "😂", "Ciencia Ficción": "🚀",
  Terror: "👻", Documental: "📽️", Romance: "💕", Acción: "💥", Otro: "🎬",
};

const GENRES: ProjectGenre[] = [
  "Drama", "Thriller", "Comedia", "Ciencia Ficción",
  "Terror", "Documental", "Romance", "Acción", "Otro",
];

const DEMO_PROJECTS: ProjectCard[] = [
  {
    id: "demo-1",
    title: "Hermanas",
    genre: "Drama",
    duration: 12,
    status: "Draft",
    lastModified: new Date().toISOString(),
    logline: "Dos hermanas enfrentan el pasado familiar mientras preparan el funeral de su madre.",
  },
  {
    id: "demo-2",
    title: "Ecos del Futuro",
    genre: "Ciencia Ficción",
    duration: 8,
    status: "Final",
    lastModified: new Date(Date.now() - 86400000).toISOString(),
    logline: "Un ingeniero descubre que puede enviar mensajes al pasado, pero cada uno altera el presente.",
  },
];

type InputTab = "text" | "file" | "audio" | "image";

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectCard[]>(DEMO_PROJECTS);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [inputTab, setInputTab] = useState<InputTab>("text");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Ref map for outside-click detection per menu
  const menuRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [form, setForm] = useState({
    title: "",
    logline: "",
    description: "",
    genre: "Drama" as ProjectGenre,
    format: "Cortometraje (< 15 min)",
    duration: 10,
    transcription: "",
    uploadedFileName: "",
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  // Close menu when clicking outside — uses pointerdown + ref check to avoid
  // React 17+ root-delegation race that breaks stopPropagation on document listeners
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!openMenuId) return;
      const menuEl = menuRefs.current.get(openMenuId);
      if (menuEl && menuEl.contains(e.target as Node)) return;
      setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openMenuId]);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/notion/projects");
      if (res.ok) {
        const data = await res.json();
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
        }
      }
    } catch {
      // Offline / Notion missing
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/notion/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: form.title,
          logline: form.logline,
          description: form.description,
          genre: form.genre,
          format: form.format,
          duration: form.duration,
        }),
      });
      const data = await res.json();
      const projectId = data.project?.id || `local-${Date.now()}`;

      if (form.transcription) {
        await fetch("/api/guion/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            transcription: form.transcription,
            duration: form.duration,
            genre: form.genre,
            title: form.title,
          }),
        });
      }
      window.location.href = `/dashboard/${projectId}/editor`;
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  }

  function handleRename(projectId: string, currentTitle: string) {
    setRenamingId(projectId);
    setRenameValue(currentTitle);
    setOpenMenuId(null);
  }

  function confirmRename(projectId: string) {
    if (!renameValue.trim()) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, title: renameValue.trim(), lastModified: new Date().toISOString() }
          : p
      )
    );
    setRenamingId(null);
  }

  function handleDelete(projectId: string) {
    setDeleteConfirmId(projectId);
    setOpenMenuId(null);
  }

  function confirmDelete(projectId: string) {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setDeleteConfirmId(null);
  }

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "file" | "audio" | "image"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((prev) => ({ ...prev, uploadedFileName: file.name }));

    if (type === "file") {
      // Read text file
      const text = await file.text();
      setForm((prev) => ({ ...prev, transcription: text }));
    } else {
      // For audio/image, store the name for display (actual transcription would be done via API)
      setForm((prev) => ({
        ...prev,
        transcription: `[Archivo adjunto: ${file.name}]\nLa IA procesará este archivo al crear el proyecto.`,
      }));
    }
  }

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  const INPUT_TABS: { id: InputTab; label: string; icon: React.ReactNode }[] = [
    { id: "text", label: "Texto", icon: <FileTextIcon className="w-3.5 h-3.5" /> },
    { id: "file", label: "Archivo", icon: <UploadIcon className="w-3.5 h-3.5" /> },
    { id: "audio", label: "Audio", icon: <MicIcon className="w-3.5 h-3.5" /> },
    { id: "image", label: "Imagen", icon: <FilmIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>✍️</span>
            <span>Script Bud</span>
          </Link>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted border-transparent focus:border-border focus:bg-background rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all w-48"
            />
            <ThemeToggle />
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Nuevo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ── Title ── */}
        <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
            <p className="text-muted-foreground text-sm mt-1">Directorio de guiones activos</p>
          </div>
          <p className="text-muted-foreground text-xs font-mono">{projects.length} registros</p>
        </div>

        {/* ── Grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-32 border border-dashed border-border rounded-xl bg-card">
            <p className="text-3xl mb-3">📄</p>
            <h2 className="text-lg font-medium">Lienzo en blanco</h2>
            <p className="text-muted-foreground text-sm mb-6 mt-1">Comienza tu primer proyecto literario.</p>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-4 py-2 rounded-md transition-colors text-sm font-medium"
            >
              Crear Archivo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Nuevo Proyecto */}
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="group border border-dashed border-border bg-card hover:bg-muted hover:border-foreground/30 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all h-[200px]"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
              <span className="text-sm font-medium">Nuevo Proyecto</span>
            </button>

            {filtered.map((project) => (
              <div key={project.id} className="relative group">
                {/* Rename inline */}
                {renamingId === project.id ? (
                  <div className="border border-ring bg-card rounded-xl overflow-hidden shadow-sm h-[200px] flex flex-col">
                    <div className="h-20 bg-muted flex items-center justify-center border-b border-border">
                      <span className="text-2xl">{GENRE_EMOJIS[project.genre]}</span>
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(project.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => confirmRename(project.id)}
                          className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground rounded px-2 py-1 text-xs font-medium"
                        >
                          <CheckIcon className="w-3 h-3" /> Guardar
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="flex-1 flex items-center justify-center gap-1 bg-muted text-muted-foreground rounded px-2 py-1 text-xs font-medium"
                        >
                          <XIcon className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : deleteConfirmId === project.id ? (
                  /* Delete confirm overlay */
                  <div className="border border-destructive/50 bg-card rounded-xl overflow-hidden shadow-sm h-[200px] flex flex-col items-center justify-center gap-4 p-6">
                    <TrashIcon className="w-8 h-8 text-destructive opacity-60" />
                    <p className="text-sm text-center text-muted-foreground">
                      ¿Eliminar <strong className="text-foreground">{project.title}</strong>?
                    </p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => confirmDelete(project.id)}
                        className="flex-1 bg-destructive text-destructive-foreground rounded px-2 py-1.5 text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 bg-muted text-muted-foreground rounded px-2 py-1.5 text-xs font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal card — Link wraps ONLY the content area, not the menu button */
                  <div className="relative border border-border bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-foreground/30 transition-all h-[200px] flex flex-col">
                    {/* Clickable area → navigate */}
                    <Link
                      href={`/dashboard/${project.id}/editor`}
                      className="flex flex-col flex-1 min-h-0"
                    >
                      <div className="h-20 bg-muted flex items-center justify-center border-b border-border">
                        <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">
                          {GENRE_EMOJIS[project.genre]}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col flex-1 justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-sm text-foreground truncate">{project.title}</h3>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold ml-1 shrink-0 ${STATUS_COLORS[project.status]}`}>
                              {project.status}
                            </span>
                          </div>
                          {project.logline && (
                            <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-1">
                              {project.logline}
                            </p>
                          )}
                          <p className="text-muted-foreground text-xs">{project.genre} · {project.duration}m</p>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{timeAgo(project.lastModified)}</span>
                          <span className="font-mono bg-muted px-1 rounded border border-border">.fountain</span>
                        </div>
                      </div>
                    </Link>

                    {/* ⋮ Menu — outside Link, no gap between button and dropdown */}
                    <div
                      ref={(el) => { menuRefs.current.set(project.id, el); }}
                      className="absolute top-2 right-2 z-20"
                    >
                      <button
                        onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                        className={`p-1.5 rounded-md border transition-all ${
                          openMenuId === project.id
                            ? "opacity-100 bg-background border-border"
                            : "opacity-0 group-hover:opacity-100 bg-background/80 border-border hover:bg-background"
                        }`}
                        aria-label="Opciones del proyecto"
                      >
                        <MoreVerticalIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>

                      {/* Dropdown — top-full = pegado al botón, cero gap */}
                      {openMenuId === project.id && (
                        <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 w-44 animate-fade-in">
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => { handleRename(project.id, project.title); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          >
                            <PencilIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            Renombrar
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => { handleDelete(project.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <TrashIcon className="w-3.5 h-3.5 shrink-0" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── New Project Modal ── */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold">Nuevo Proyecto</h2>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <form id="new-project" onSubmit={handleCreateProject} className="space-y-4">
                {/* Título */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="ej. Las Hermanas del Norte"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Logline */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Logline
                  </label>
                  <textarea
                    value={form.logline}
                    onChange={(e) => setForm({ ...form, logline: e.target.value })}
                    placeholder="Una frase que capture la esencia del conflicto central. Quién necesita qué y qué se opone."
                    rows={2}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>

                {/* Género + Duración */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Género
                    </label>
                    <select
                      value={form.genre}
                      onChange={(e) => setForm({ ...form, genre: e.target.value as ProjectGenre })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {GENRE_EMOJIS[g]} {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Minutos
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 10 })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Fuente de la historia */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Borrador Inicial <span className="text-muted-foreground/50 normal-case font-normal">— opcional</span>
                  </label>

                  {/* Tabs */}
                  <div className="flex gap-1 mb-3 bg-muted p-1 rounded-lg">
                    {INPUT_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInputTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          inputTab === tab.id
                            ? "bg-card text-foreground shadow-sm border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {inputTab === "text" && (
                    <textarea
                      value={form.transcription}
                      onChange={(e) => setForm({ ...form, transcription: e.target.value })}
                      placeholder="Pega el resumen de tu historia, diálogos clave o la idea base. La IA estructurará el guion completo."
                      rows={5}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  )}

                  {inputTab === "file" && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.fountain,.fdx,.pdf"
                        onChange={(e) => handleFileUpload(e, "file")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <UploadIcon className="w-6 h-6" />
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {form.uploadedFileName && inputTab === "file"
                              ? form.uploadedFileName
                              : "Sube un archivo de texto"}
                          </p>
                          <p className="text-xs mt-0.5">.txt · .md · .fountain · .fdx · .pdf</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {inputTab === "audio" && (
                    <div>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg"
                        onChange={(e) => handleFileUpload(e, "audio")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="w-full border border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <MicIcon className="w-6 h-6" />
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {form.uploadedFileName && inputTab === "audio"
                              ? form.uploadedFileName
                              : "Sube una grabación de audio"}
                          </p>
                          <p className="text-xs mt-0.5">.mp3 · .wav · .m4a — La IA transcribirá automáticamente</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {inputTab === "image" && (
                    <div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "image")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="w-full border border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <FilmIcon className="w-6 h-6" />
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {form.uploadedFileName && inputTab === "image"
                              ? form.uploadedFileName
                              : "Sube una imagen de referencia"}
                          </p>
                          <p className="text-xs mt-0.5">.jpg · .png · .webp — Sirve de base visual para la narrativa</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">ESC para cancelar</span>
              <button
                type="submit"
                form="new-project"
                disabled={isCreating || !form.title}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-medium px-4 py-2 rounded-md text-sm transition-colors"
              >
                {isCreating ? "Procesando..." : "Crear Proyecto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
