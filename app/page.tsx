"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn } from "next-auth/react";
import {
  ArrowRightIcon, SparklesIcon, FilmIcon, LayersIcon,
  StarIcon, ZapIcon, BarChart3Icon, DownloadIcon,
} from "lucide-react";

const FEATURES = [
  {
    icon: <SparklesIcon className="w-5 h-5" />,
    title: "Estructura Fractal 27-Bits",
    desc: "El motor de IA genera guiones usando una arquitectura narrativa de 3 actos → 9 escenas → 27 beats. No templates genéricos.",
    accent: "from-violet-500/20 to-transparent",
    border: "border-violet-500/30",
  },
  {
    icon: <FilmIcon className="w-5 h-5" />,
    title: "Editor Fountain Nativo",
    desc: "Monaco Editor configurado con Fountain como primer lenguaje. Syntax highlighting, autocompletado y exportación PDF lista para producción.",
    accent: "from-blue-500/20 to-transparent",
    border: "border-blue-500/30",
  },
  {
    icon: <LayersIcon className="w-5 h-5" />,
    title: "Tablero Visual de Beats",
    desc: "Kanban arrastrable organizado por actos y escenas. Reordena, edita y visualiza la arquitectura narrativa en una sola pantalla.",
    accent: "from-emerald-500/20 to-transparent",
    border: "border-emerald-500/30",
  },
  {
    icon: <StarIcon className="w-5 h-5" />,
    title: "Evaluación Automática",
    desc: "Análisis objetivo del guion contra 25 checkpoints narrativos. Score por dimensión: estructura, diálogo, tensión y arco de personaje.",
    accent: "from-amber-500/20 to-transparent",
    border: "border-amber-500/30",
  },
  {
    icon: <ZapIcon className="w-5 h-5" />,
    title: "Sync con Notion",
    desc: "Cada cambio en el editor se sincroniza automáticamente con tu base de datos Notion. Acceso desde cualquier dispositivo.",
    accent: "from-pink-500/20 to-transparent",
    border: "border-pink-500/30",
  },
  {
    icon: <DownloadIcon className="w-5 h-5" />,
    title: "Exportación Profesional",
    desc: "PDF con portada, Fountain puro, JSON estructurado o Markdown. Formato listo para enviar a producción o festivales.",
    accent: "from-cyan-500/20 to-transparent",
    border: "border-cyan-500/30",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Ingresa tu idea",
    detail: "Texto, audio o imagen. Pega un borrador, sube un archivo o deja que la IA trabaje desde cero con tu logline.",
  },
  {
    n: "02",
    title: "El agente estructura",
    detail: "GPT-4o aplica la Estructura Fractal de 27 bits. Genera escenas, sluglines, personajes y turning points automaticamente.",
  },
  {
    n: "03",
    title: "Edita en el lienzo",
    detail: "El editor Fountain y el tablero Kanban operan en sincronía. Drag-and-drop para reordenar beats, edición directa en el editor.",
  },
  {
    n: "04",
    title: "Exporta y produce",
    detail: "PDF cinematográfico con portada lista para imprimir. También Fountain, JSON o Markdown para flujos de trabajo digitales.",
  },
];

const TICKER_ITEMS = [
  "Estructura 27-bits", "Editor Fountain", "Tablero Kanban", "Evaluación IA",
  "Sync Notion", "Arte de Escena", "Exportación PDF", "GPT-4o", "Drag & Drop",
];

export default function LandingPage() {
  const [tickerPos, setTickerPos] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerPos((p) => p - 1);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const tickerString = [...TICKER_ITEMS, ...TICKER_ITEMS].join("  ·  ");

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">S</span>
            </div>
            <span className="font-bold tracking-tight">Script Bud</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="bg-foreground text-background hover:bg-foreground/90 text-sm font-medium px-4 py-2 rounded-md transition-all"
            >
              Comenzar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-28 pb-20">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-foreground/5 dark:bg-foreground/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-foreground/5 border border-border rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-8 text-muted-foreground"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Método Fractal · 27-Bits · GPT-4o
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-[0.95]"
          >
            Del concepto<br />
            <span className="text-muted-foreground">al guion.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            El estudio de guion que combina un editor Fountain técnico, lienzo visual Kanban y estructura narrativa IA para producción cinematográfica independiente.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="group bg-foreground text-background hover:bg-foreground/90 font-semibold px-8 py-3.5 rounded-lg transition-all active:scale-95 flex items-center gap-2"
            >
              Abrir mi Lienzo
              <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <Link
              href="#features"
              className="bg-transparent border border-border text-foreground hover:bg-muted font-medium px-8 py-3.5 rounded-lg transition-all active:scale-95"
            >
              Ver Capacidades
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-8 mt-16 text-sm text-muted-foreground"
          >
            {[
              ["27", "Beats Narrativos"],
              ["3", "Formatos de Exportación"],
              ["25", "Checkpoints de Evaluación"],
            ].map(([num, label]) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-foreground tabular-nums">{num}</div>
                <div className="text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <div className="border-y border-border py-3 overflow-hidden bg-muted/30">
        <div
          className="whitespace-nowrap font-mono text-xs text-muted-foreground"
          style={{ transform: `translateX(${tickerPos % (tickerString.length * 8)}px)` }}
        >
          {tickerString}
        </div>
      </div>

      {/* ── Dashboard Preview ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="rounded-2xl border border-border bg-card p-1.5 shadow-2xl"
        >
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden h-[480px] flex">
            {/* Sidebar */}
            <div className="w-52 border-r border-border bg-card p-4 flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded bg-foreground/10" />
                <div className="h-2.5 w-20 bg-muted rounded" />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold px-1 mt-2">
                Proyectos
              </div>
              {[
                { color: "bg-violet-400/60", w: "w-28", active: true },
                { color: "bg-emerald-400/60", w: "w-24", active: false },
                { color: "bg-amber-400/60", w: "w-20", active: false },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`h-9 w-full rounded-lg flex items-center px-3 gap-2.5 ${item.active ? "bg-foreground/5 border border-border" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                  <div className={`h-2 ${item.w} bg-muted-foreground/20 rounded`} />
                </div>
              ))}
              <div className="mt-auto pt-4 border-t border-border">
                <div className="h-2 w-16 bg-muted rounded mb-2" />
                <div className="h-2 w-12 bg-muted rounded" />
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="border-b border-border px-6 py-3 flex items-center gap-3">
                <div className="h-2 w-32 bg-muted rounded" />
                <div className="h-2 w-20 bg-muted/60 rounded" />
                <div className="ml-auto flex gap-2">
                  <div className="h-6 w-16 bg-muted rounded-md" />
                  <div className="h-6 w-16 bg-foreground/10 rounded-md" />
                </div>
              </div>

              {/* Editor area */}
              <div className="flex-1 p-8 font-mono text-sm leading-loose overflow-hidden">
                <div className="text-blue-500/70 dark:text-blue-400/70 font-semibold mb-4 text-xs tracking-wider">
                  INT. SALA DE MONTAJE — NOCHE
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-2 w-3/4 bg-muted rounded" />
                  <div className="h-2 w-2/3 bg-muted rounded" />
                  <div className="h-2 w-1/2 bg-muted/60 rounded" />
                </div>
                <div className="flex flex-col items-center mb-6">
                  <div className="text-foreground font-bold text-xs tracking-widest mb-2">CAMILA</div>
                  <div className="h-2 w-48 bg-muted rounded mb-1.5" />
                  <div className="h-2 w-36 bg-muted/80 rounded mb-1.5" />
                  <div className="h-2 w-28 bg-muted/60 rounded" />
                </div>
                <div className="text-violet-500/60 dark:text-violet-400/60 text-xs font-semibold text-right mr-24 mb-6">
                  CORTE A:
                </div>
                <div className="text-blue-500/70 dark:text-blue-400/70 font-semibold mb-4 text-xs tracking-wider">
                  EXT. AZOTEA — AMANECER
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-4/5 bg-muted rounded" />
                  <div className="h-2 w-3/5 bg-muted/70 rounded" />
                </div>
              </div>

              {/* Status bar */}
              <div className="border-t border-border px-6 py-2 flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Auto-guardado
                </span>
                <span>Beat 14/27</span>
                <span>Acto II · Escena 5</span>
                <span className="ml-auto">Fountain · UTF-8</span>
              </div>
            </div>

            {/* Beat panel */}
            <div className="w-64 border-l border-border bg-card p-4 flex flex-col gap-3 shrink-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                Beats — Acto II
              </div>
              {[
                { label: "Punto de Giro", color: "bg-red-400/40 border-red-400/30", tag: "Turning" },
                { label: "Confrontación", color: "bg-blue-400/40 border-blue-400/30", tag: "Action" },
                { label: "Revelación", color: "bg-violet-400/40 border-violet-400/30", tag: "Dialogue" },
                { label: "Consecuencia", color: "bg-emerald-400/40 border-emerald-400/30", tag: "Action" },
              ].map((beat, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${beat.color} flex items-center justify-between`}
                >
                  <div>
                    <div className="h-2 w-20 bg-muted-foreground/30 rounded mb-1" />
                    <div className="text-[10px] text-muted-foreground/60">{beat.tag}</div>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/40">{i + 10}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 border-t border-border">
        <div className="mb-16 max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Capacidades del Sistema</h2>
          <p className="text-muted-foreground">
            Una suite integrada para producción cinematográfica independiente. Sin herramientas dispersas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={`relative p-6 rounded-xl border ${f.border} bg-card overflow-hidden group hover:border-foreground/30 transition-all`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} pointer-events-none`} />
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-foreground/5 border border-border flex items-center justify-center mb-4 text-muted-foreground group-hover:text-foreground transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-3">De la Idea al Set</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Cuatro fases. Desde el impulso creativo inicial hasta el PDF listo para producción.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-border -translate-x-6 z-0" />
                )}
                <div className="relative bg-card border border-border rounded-xl p-6">
                  <div className="text-xs font-mono text-muted-foreground/50 mb-4 font-semibold">{step.n}</div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / quote ── */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-28 text-center">
          <motion.blockquote
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl md:text-3xl font-medium text-foreground/80 leading-relaxed mb-8"
          >
            "La narrativa cinematográfica tiene estructura. La IA puede aprenderla.<br className="hidden md:block" />
            <span className="text-foreground"> Script Bud la aplica."</span>
          </motion.blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold">
              SB
            </div>
            <div className="text-sm text-muted-foreground">Script Bud · Método Fractal 27-Bits</div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="max-w-5xl mx-auto px-6 py-24 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">La pantalla en blanco terminó.</h2>
            <p className="text-background/60 text-lg">Tu próximo guion empieza con una idea, no con horas de setup.</p>
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="shrink-0 bg-background text-foreground hover:bg-background/90 font-semibold px-8 py-4 rounded-xl transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            Iniciar Aplicación
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-border/30 bg-foreground py-6 text-center text-xs text-background/30">
        <p>Script Bud · Estructura y control cinematográfico con IA</p>
      </footer>
    </main>
  );
}
