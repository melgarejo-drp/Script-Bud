// ─────────────────────────────────────────────────────────────
//  Script Bud — TypeScript Type Definitions
//  Source: metaprompt_maestro_antigravity.md, PARTE 4.1
// ─────────────────────────────────────────────────────────────

// ── Project ──────────────────────────────────────────────────
export type ProjectStatus = "Draft" | "Review" | "Final";
export type ProjectGenre =
  | "Drama"
  | "Thriller"
  | "Comedia"
  | "Ciencia Ficción"
  | "Terror"
  | "Documental"
  | "Romance"
  | "Acción"
  | "Otro";
export type ProjectFormat =
  | "Cortometraje (< 15 min)"
  | "Medometraje (15-45 min)"
  | "Largometraje (> 45 min)"
  | "Webisodio"
  | "Piloto de Serie";

export interface Project {
  id: string; // Notion page ID
  title: string;
  description?: string;
  genre: ProjectGenre;
  format: ProjectFormat;
  duration: number; // minutes estimated
  status: ProjectStatus;
  createdAt: string; // ISO date
  lastModified: string;
  guionText?: string; // raw screenplay text
  guionJSON?: GuionJSON; // structured JSON
  thumbnail?: string; // URL of last generated image
  collaborators?: Collaborator[];
  notionPageId?: string;
}

// ── Scene & Beat ──────────────────────────────────────────────
export type ActName = "Acto 1 (Inicio)" | "Acto 2 (Nudo)" | "Acto 3 (Desenlace)";
export type BeatType = "Acción" | "Diálogo" | "Transición" | "Punto de Giro";

// Source: plan_investigacion_agente_guion_completo.md, TIER 1
export type NarrativeFunction =
  | "Imagen de Apertura"
  | "Tema Planteado"
  | "Inciting Incident"
  | "Rechazo de la Llamada"
  | "Cruzar el Umbral"
  | "Pruebas y Aliados"
  | "Punto Medio"
  | "Complicación"
  | "Todo Está Perdido"
  | "Noche Oscura del Alma"
  | "Ataque Final"
  | "Clímax"
  | "Imagen de Cierre"
  | "Desarrollo"
  | "Resolución";

export interface Scene {
  id: string; // e.g. "SCN_001"
  notionPageId?: string;
  sceneNumber: number;
  beatNumber: number;
  act: ActName;
  beatType: BeatType;
  narrativeFunction: NarrativeFunction;
  slugline: string; // e.g. "INT. COCINA - NOCHE"
  action: string; // action/description text
  characters: string[];
  dialogue?: DialogueLine[];
  durationSeconds: number;
  imageUrl?: string;
  imagePrompt?: string;
  cinematography?: CinematographyDetails;
  notes?: string; // private writer notes
}

export interface DialogueLine {
  character: string;
  parenthetical?: string; // e.g. "(nervioso)"
  text: string;
}

// ── Cinematography ─────────────────────────────────────────────
// Source: metaprompt_maestro_antigravity.md, PARTE 3.3
export type ShotType =
  | "Plano General"
  | "Plano Medio"
  | "Primer Plano"
  | "Gran Primer Plano"
  | "Plano Detalle"
  | "Plano Americano"
  | "Plano Secuencia";

export type CameraAngle =
  | "Normal (altura del ojo)"
  | "Picado (desde arriba)"
  | "Contrapicado (desde abajo)"
  | "Holandés (diagonal)";

export type CameraMovement =
  | "Estática"
  | "Paneo"
  | "Travelling"
  | "Zoom"
  | "Steadicam"
  | "Drone"
  | "Grúa";

export interface CinematographyDetails {
  shotType?: ShotType;
  cameraAngle?: CameraAngle;
  cameraMovement?: CameraMovement;
  description?: string; // Free text technical description
  artisticNotes?: string; // Private inspiration notes
}

// ── Version History ───────────────────────────────────────────
export interface Version {
  id: string;
  notionPageId?: string;
  versionNumber: string; // e.g. "v1.5"
  timestamp: string;
  author: string;
  guionSnapshot: string; // full screenplay text at that point
  guionJSONSnapshot?: GuionJSON;
  summaryOfChanges: string;
  githubCommitHash?: string;
}

// ── Collaboration ─────────────────────────────────────────────
export type PermissionLevel = "View" | "Comment" | "Edit";

export interface Collaborator {
  email: string;
  name?: string;
  permission: PermissionLevel;
}

// ── Guion JSON (main data structure) ─────────────────────────
// Source: metaprompt_maestro_antigravity.md, PARTE 3.6
export type NarrativeStructure =
  | "Estructura Fractal (27 Bits)"
  | "3 Actos (Syd Field)"
  | "Save the Cat (15 beats)"
  | "Viaje del Héroe"
  | "2 Actos (Cortometraje)";

export interface GuionJSON {
  metadata: {
    title: string;
    genre: ProjectGenre;
    format: ProjectFormat;
    durationMinutes: number;
    structure: NarrativeStructure;
    protagonist: string;
    centralQuestion: string;
    totalScenes: number;
    totalPages: number;
    createdAt: string;
  };
  scenes: Scene[];
}

// ── AI Evaluation ─────────────────────────────────────────────
// Source: plan_investigacion_agente_guion_completo.md, TIER 4
export type EvaluationStatus =
  | "Listo para enviar"
  | "Necesita revisión menor"
  | "Necesita reescritura";

export interface EvaluationScore {
  estructura: EvaluationCheckResult;
  visualidad: EvaluationCheckResult;
  personaje: EvaluationCheckResult;
  economía: EvaluationCheckResult;
  ritmo: EvaluationCheckResult;
}

export interface EvaluationCheckResult {
  score: number; // out of 5
  passing: boolean;
  notes: string;
}

export type RecommendationType = "ESTRUCTURAL" | "VISUALIDAD" | "ECONOMÍA" | "PERSONAJE" | "RITMO";

export interface Recommendation {
  type: RecommendationType;
  priority: 1 | 2 | 3; // 1 = highest priority
  sceneId?: string;
  sceneNumber?: number;
  problem: string;
  solution: string;
  rewrittenExample?: string;
}

export interface FeedbackReport {
  projectId: string;
  generatedAt: string;
  scores: EvaluationScore;
  checklist: ChecklistItem[];
  recommendations: Recommendation[];
  totalScore: number; // out of 100
  status: EvaluationStatus;
}

export interface ChecklistItem {
  category: "ESTRUCTURA" | "VISUALIDAD" | "PERSONAJE" | "ECONOMÍA" | "RITMO";
  item: string;
  result: "SÍ" | "NO" | "NECESITA REVISIÓN";
}

// ── Export ────────────────────────────────────────────────────
// Source: metaprompt_maestro_antigravity.md, PARTE 3.7
export type ExportFormat = "pdf" | "fountain" | "json" | "markdown";

export interface ExportOptions {
  projectId: string;
  format: ExportFormat;
  includeImages: boolean;
  includeCinematography: boolean;
  includeMetadata: boolean;
  versionId?: string; // export a specific version
}

// ── API request/response types ────────────────────────────────
export interface GenerateGuionRequest {
  projectId: string;
  transcription: string;
  duration?: number; // minutes (estimated)
  genre?: ProjectGenre;
}

export interface GenerateGuionResponse {
  success: boolean;
  guionText?: string;
  guionJSON?: GuionJSON;
  error?: string;
}

export interface SyncNotionRequest {
  projectId: string;
  content: string;
  metadata?: {
    lastModified: string;
    author?: string;
  };
}

// ── UI State ──────────────────────────────────────────────────
export interface AppState {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  selectedScene: Scene | null;
  feedbackReport: FeedbackReport | null;
}
