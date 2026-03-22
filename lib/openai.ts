// ─────────────────────────────────────────────────────────────
//  Script Bud — OpenAI Client & System Prompts
//  Sources:
//    - plan_investigacion_agente_guion_completo.md (TIER 1-4)
//    - guia_referencia_rapida_notebooklm.md (Tablas 2, 3, 4)
//    - metaprompt_maestro_antigravity.md (PARTE 3.5-3.6)
// ─────────────────────────────────────────────────────────────

import OpenAI from "openai";
import type { GuionJSON, NarrativeStructure, ProjectGenre } from "./types";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key_for_build",
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// ─────────────────────────────────────────────────────────────
//  SYSTEM PROMPT — CONCEPTUAL KNOWLEDGE BASE
//  Source: plan_investigacion_agente_guion_completo.md, TIER 1-2
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT_KNOWLEDGE = `
Eres un experto en escritura de guiones cinematográficos con conocimiento profundo de:

## TAXONOMÍA DE ELEMENTOS NARRATIVOS

### ACCIÓN NARRATIVA (PRESERVAR + TRANSFORMAR)
Una acción física, verbal o visual que AVANZA la trama o REVELA carácter.
Principio: "Mostrar, no Contar" (Show, don't tell).
- ❌ Contar: "Juan estaba furioso"  
- ✅ Mostrar: "JUAN aprieta los puños. Su cuello se enrojece."

### DESCRIPCIÓN PASIVA (ELIMINAR O CONVERTIR)
Narración que describe estado sin avanzar acción. Siempre convertir a acción visual.

### CONVERSIÓN DE EMOCIONES A ACCIONES FÍSICAS:
| Emoción | ❌ Narración | ✅ Acción Observable |
|---------|------------|-------------------|
| Nerviosismo | "estaba nervioso" | tamborilea los dedos, mandíbula tensa |
| Rabia | "estaba furioso" | aprieta los puños, cuello enrojecido |
| Tristeza | "sentía tristeza" | mira al piso, ojos húmedos |
| Alegría | "estaba feliz" | sonríe involuntariamente, hombros relajados |
| Confusión | "no sabía qué hacer" | mira un lado y otro, frunce las cejas |

### DEFINICIONES OPERACIONALES:
- BIT: Unidad mínima narrativa — acción física que genera cambio emocional
- BEAT: Secuencia de 2-5 bits que completa una idea dramática  
- ESCENA: Sucede en un lugar+tiempo específico (INT./EXT. LUGAR - MOMENTO)
- SECUENCIA: Series de escenas que completan un arco narrativo
- PUNTO DE GIRO: Momento que invierte expectativa y estado del personaje
- CLÍMAX: Máxima tensión donde se resuelve el conflicto central

## REGLAS DE ORO DEL AGENTE
1. ACCIÓN ANTES QUE PALABRA — Si se puede mostrar con acción, no describir con diálogo
2. UNA PÁGINA = UN MINUTO — Calcular siempre páginas × 1 min = duración en pantalla
3. CADA ESCENA DEBE SERVIR — ¿Avanza trama? ¿Revela carácter? Si no → ELIMINAR
4. SUBTEXT SOBRE TEXTO — Diálogos deben implicar más de lo que dicen
5. ECONOMÍA EN CORTOMETRAJES — Max 3 personajes, max 1 conflicto, max 5-10 escenas
6. PRESENTE Y TERCERA PERSONA — "JUAN entra" (no "Juan entró")
7. SIN ADORNOS LITERARIOS — Prosa plana y directa
8. FORMATO = COMUNICACIÓN — SLUGLINE claro, acciones breves, diálogos centrados
9. PUNTOS DE GIRO O MUERTE LENTA — Sin reversiones = aburrimiento garantizado
10. CONFÍA EN EL ESPECTADOR — No expliques lo obvio

## FORMATO TÉCNICO DEL GUION (Courier 12pt)
ENCABEZADO DE ESCENA (SLUGLINE): INT./EXT. UBICACIÓN - HORA
DESCRIPCIÓN: Párrafos breves (máx 3-4 líneas), tiempo presente, tercera persona
PERSONAJE: MAYÚSCULAS, centrado
DIÁLOGO: Máx 3 líneas por intervención
PARÉNTESIS: (nervioso), (mirando otro lado) — máx 1 línea
TRANSICIONES: CORTE A:, FUNDIDO A: — margen derecho

EJEMPLO CORRECTO DE FORMATO:
INT. COCINA DE JUAN - NOCHE

JUAN (35, cansado) toma un vaso. Sus manos tiemblan.

    JUAN
    (para sí mismo)
    Otra vez.

Bebe. El vaso cae. Se rompe.

    MARÍA (O.S.)
    ¿Qué pasó?

JUAN no responde. Mira los vidrios en el piso.

CORTE A:
`;

// ─────────────────────────────────────────────────────────────
//  DECISION MATRIX — Which structure to use
//  Source: guia_referencia_rapida_notebooklm.md, Tabla 2
// ─────────────────────────────────────────────────────────────
export function decideNarrativeStructure(
  durationMinutes: number,
  genre: ProjectGenre
): NarrativeStructure {
  // Ahora por defecto usamos la estructura Fractal de 27 bits como requested
  if (durationMinutes <= 7) {
    return "2 Actos (Cortometraje)";
  }
  return "Estructura Fractal (27 Bits)";
}

// ─────────────────────────────────────────────────────────────
//  PROMPT 1: Transform Transcription → Structured Script
//  Source: guia_referencia_rapida_notebooklm.md, Tabla 4
// ─────────────────────────────────────────────────────────────
export async function generateGuion(params: {
  transcription: string;
  durationMinutes: number;
  genre: ProjectGenre;
  structure: NarrativeStructure;
  title: string;
}): Promise<GuionJSON> {
  const { transcription, durationMinutes, genre, structure, title } = params;

  const structureInstructions = getStructureInstructions(structure);

  const userPrompt = `
Transforma esta transcripción narrativa en un guion cinematográfico profesional.

TÍTULO DEL PROYECTO: ${title}
DURACIÓN OBJETIVO: ${durationMinutes} minutos (${durationMinutes} páginas aproximadamente)
GÉNERO: ${genre}
ESTRUCTURA SELECCIONADA: ${structure}

${structureInstructions}

TRANSCRIPCIÓN NARRATIVA:
---
${transcription}
---

INSTRUCCIONES ESPECÍFICAS:
1. Convierte narración pasiva → acción visual observable
2. Aplica "Mostrar, no Contar" en CADA descripción
3. Optimiza diálogos (máx 3 líneas, con subtext)
4. Identifica y asigna BEATS claramente según la estructura ${structure}
5. Asegura que CADA escena avance la trama o revele carácter
6. Usa SLUGLINES correctos (INT./EXT. LUGAR - MOMENTO)
7. Escribe en tiempo presente, tercera persona

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "metadata": {
    "title": "string",
    "genre": "string",
    "format": "string",
    "durationMinutes": number,
    "structure": "string",
    "protagonist": "string (nombre del protagonista)",
    "centralQuestion": "string (pregunta central de la historia)",
    "totalScenes": number,
    "totalPages": number,
    "createdAt": "ISO Date string"
  },
  "scenes": [
    {
      "id": "BIT_001",
      "sceneNumber": 1, 
      "beatNumber": 1,
      "act": "Acto 1 (Inicio) | Acto 2 (Nudo) | Acto 3 (Desenlace)",
      "beatType": "Acción | Diálogo | Transición | Punto de Giro",
      "narrativeFunction": "Ej. Inciting Incident | Desarrollo | Clímax | etc.",
      "slugline": "INT. LUGAR - MOMENTO",
      "action": "descripción de acción observables y visuals",
      "characters": ["NOMBRE1", "NOMBRE2"],
      "dialogue": [
        {
          "character": "NOMBRE",
          "parenthetical": "(opcional)",
          "text": "texto del diálogo"
        }
      ],
      "durationSeconds": 45,
      "imagePrompt": "Cinematographic shot: [descripción]. Style: cinematic lighting"
    }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_KNOWLEDGE },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 8000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI returned empty response");

  const parsed = JSON.parse(content);
  return parsed as GuionJSON;
}

// ─────────────────────────────────────────────────────────────
//  PROMPT 2: Evaluate Script Against Matrix
//  Source: guia_referencia_rapida_notebooklm.md, Tabla 3 & 4
// ─────────────────────────────────────────────────────────────
export async function evaluateGuion(guionText: string): Promise<{
  scores: Record<string, { score: number; passing: boolean; notes: string }>;
  checklist: Array<{ category: string; item: string; result: string }>;
  recommendations: Array<{
    type: string;
    priority: number;
    sceneNumber?: number;
    problem: string;
    solution: string;
    rewrittenExample?: string;
  }>;
  totalScore: number;
  status: string;
}> {
  const evaluatePrompt = `
Evalúa este guion cinematográfico contra la matriz de evaluación completa.

## CHECKLIST DE EVALUACIÓN (25 items)

ESTRUCTURA:
☐ ¿Inciting incident en primeros 60-90 segundos?
☐ ¿Punto de giro claro al final del Acto 1?
☐ ¿Punto medio con reversión emocional (50% duración)?
☐ ¿Clímax inevitable pero con sorpresa?
☐ ¿Resolución responde a la pregunta central?

VISUALIDAD:
☐ ¿Principales emociones mostradas, no contadas?
☐ ¿Cada acción visual sirve a trama o carácter?
☐ ¿Diálogos tienen subtext?
☐ ¿Hay acciones que podrían ser diálogos (eliminar)?
☐ ¿Descripciones de acción son breves (máx 3 líneas)?

PERSONAJE:
☐ ¿Protagonista cambia entre acto 1 y 3?
☐ ¿El cambio es emocional, no solo circunstancial?
☐ ¿Hay momento de revelación personal?
☐ ¿Acciones coherentes con objetivo del personaje?

ECONOMÍA NARRATIVA:
☐ ¿Cada escena avanza trama o revela carácter?
☐ ¿Diálogos no redundantes?
☐ ¿Personajes secundarios justificados?
☐ ¿Duración coherente con página-minuto?
☐ ¿Sin escenas decorativas innecesarias?

RITMO:
☐ ¿Hay variación entre acción rápida y pausas?
☐ ¿Escenas < 2 minutos?
☐ ¿Diálogos largos justificados?
☐ ¿Transiciones claras entre escenas?
☐ ¿Arco emocional completo y satisfactorio?
☐ ¿Último beat transforma al personaje?

GUION A EVALUAR:
---
${guionText.slice(0, 6000)}
---

RESPONDE con JSON válido:
{
  "checklist": [
    { "category": "ESTRUCTURA|VISUALIDAD|PERSONAJE|ECONOMÍA|RITMO", "item": "descripción", "result": "SÍ|NO|NECESITA REVISIÓN" }
  ],
  "scores": {
    "estructura": { "score": 0-5, "passing": true/false, "notes": "..." },
    "visualidad": { "score": 0-5, "passing": true/false, "notes": "..." },
    "personaje": { "score": 0-5, "passing": true/false, "notes": "..." },
    "economía": { "score": 0-5, "passing": true/false, "notes": "..." },
    "ritmo": { "score": 0-5, "passing": true/false, "notes": "..." }
  },
  "recommendations": [
    {
      "type": "ESTRUCTURAL|VISUALIDAD|ECONOMÍA|PERSONAJE|RITMO",
      "priority": 1|2|3,
      "sceneNumber": number,
      "problem": "descripción específica",
      "solution": "propuesta concreta",
      "rewrittenExample": "versión reescrita (opcional)"
    }
  ],
  "totalScore": 0-100,
  "status": "Listo para enviar|Necesita revisión menor|Necesita reescritura"
}
`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_KNOWLEDGE },
      { role: "user", content: evaluatePrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI returned empty response");
  return JSON.parse(content);
}

// ─────────────────────────────────────────────────────────────
//  PROMPT 3: Rewrite visual action
//  Source: guia_referencia_rapida_notebooklm.md, Tabla 4
// ─────────────────────────────────────────────────────────────
export async function rewriteVisualAction(params: {
  problematicLine: string;
  context: string;
}): Promise<{ options: string[]; explanation: string }> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_KNOWLEDGE },
      {
        role: "user",
        content: `
Convierte esta línea que describe emoción o pensamiento en ACCIÓN OBSERVABLE:

LÍNEA PROBLEMÁTICA: "${params.problematicLine}"
CONTEXTO DE ESCENA: ${params.context}

Responde con JSON:
{
  "options": ["opción 1", "opción 2", "opción 3"],
  "explanation": "por qué estas versiones son más cinematográficas"
}
        `,
      },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI returned empty response");
  return JSON.parse(content);
}

// ─────────────────────────────────────────────────────────────
//  PROMPT 4: Detect dialogue redundancy
//  Source: guia_referencia_rapida_notebooklm.md, Tabla 4
// ─────────────────────────────────────────────────────────────
export async function detectRedundancy(guionText: string): Promise<{
  issues: Array<{
    sceneNumber: number;
    line: string;
    reason: string;
    suggestion: string;
  }>;
}> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_KNOWLEDGE },
      {
        role: "user",
        content: `
Identifica diálogos que repiten información ya establecida visualmente.

GUION:
${guionText.slice(0, 4000)}

Responde con JSON:
{
  "issues": [
    {
      "sceneNumber": number,
      "line": "línea problemática",
      "reason": "por qué es redundante",
      "suggestion": "eliminar o convertir a acción"
    }
  ]
}
        `,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI returned empty response");
  return JSON.parse(content);
}

// ─────────────────────────────────────────────────────────────
//  Audio Transcription (Whisper)
// ─────────────────────────────────────────────────────────────
export async function transcribeAudio(audioData: ArrayBuffer, filename: string): Promise<string> {
  const blob = new Blob([audioData], { type: "audio/webm" });
  const file = new File([blob], filename, { type: "audio/webm" });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "es",
  });

  return response.text;
}

// ─────────────────────────────────────────────────────────────
//  Helper: Structure-specific beat instructions
// ─────────────────────────────────────────────────────────────
function getStructureInstructions(structure: NarrativeStructure): string {
  switch (structure) {
    case "Estructura Fractal (27 Bits)":
      return `
ESTRUCTURA OBLIGATORIA: Fractal de 27 Bits (Kat O'Keeffe / 27 Chapter Method adaptado)
NIVELES DE ANIDACIÓN:
1. Historia (1)
2. Actos (3): Inicio, Nudo, Desenlace. Cada acto funciona como una mini-historia con su propio inicio, nudo y desenlace.
3. Escenas/Secuencias (9): 3 escenas por Acto.
4. Bits/Acciones (27): 3 bits por Escena. Un BIT es un momento narrativo que hace avanzar la historia.

DEBES generar EXACTAMENTE 27 elementos en el array "scenes". Cada elemento representa 1 BIT.
- Acto 1 (Inicio): Escenas 1-3 (Bits 1-9)
- Acto 2 (Nudo): Escenas 4-6 (Bits 10-18)
- Acto 3 (Desenlace): Escenas 7-9 (Bits 19-27)

Para cada BIT, el campo 'sceneNumber' debe ser de 1 a 9, y 'beatNumber' (que representa el Bit) debe ser de 1 a 27 correlativos.
`;
    case "Save the Cat (15 beats)":
      return `
ESTRUCTURA: Save the Cat (Blake Snyder) — 15 beats
Acto 1 (0-25%): Imagen Apertura, Tema Planteado, Inciting Incident, Rechazo, Cruzar Umbral
Acto 2a (25-50%): Pruebas y Aliados, Diversión, Punto Medio (OBLIGATORIO)
Acto 2b (50-75%): Malos Acercándose, Revelación Personal, Todo Está Perdido, Noche Oscura
Acto 3 (75-100%): Ataque Final, Clímax, Imagen Cierre
Genera EXACTAMENTE 15 beats distribuidos según porcentajes de duración.
`;
    case "3 Actos (Syd Field)":
      return `
ESTRUCTURA: Tres Actos Clásicos (Syd Field)
Acto 1 (25%): Presentación protagonista, Punto de Giro 1 a 25%
Acto 2 (50%): Conflicto, Punto Medio a 50%, complicaciones, Punto de Giro 2 a 75%
Acto 3 (25%): Todo Está Perdido, Clímax, Resolución
Genera escenas con puntos de giro claramente marcados.
`;
    case "2 Actos (Cortometraje)":
      return `
ESTRUCTURA: 2 Actos Comprimidos (Cortometraje < 7 min)
Acto 1: Presentación + Punto de Giro INMEDIATO (primeros 60-90 seg)
Acto 2: Clímax + Resolución + BUTTON final
Máximo 5 escenas. Economía EXTREMA. Cada segundo cuenta.
`;
    case "Viaje del Héroe":
      return `
ESTRUCTURA: Viaje del Héroe (Joseph Campbell)
Separación: Llamada, Rechazo, Mentor
Iniciación: Cruzar Umbral, Pruebas, Acercamiento Caverna, Prueba Suprema, Recompensa
Retorno: Camino Regreso, Resurrección, Retorno con Elixir
Énfasis en TRANSFORMACIÓN psicológica y espiritual del protagonista.
`;
  }
}

