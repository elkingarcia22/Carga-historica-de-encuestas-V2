import {
  type AiObjectiveBrief,
  createBlankBrief,
  FOCUS_ORDER,
  FOCUS_META,
  type BriefFocus,
  MIN_AI_OBJECTIVES,
  MAX_AI_OBJECTIVES,
} from "./aiObjectiveBrief";
import type { AmbitionLevel } from "./aiObjectiveGenerator";
import type { Objective } from "./cicloBuilderTypes";

/** What the parser managed to extract from the user's message. */
export interface ParsedBrief {
  count: number | null;
  focuses: readonly BriefFocus[];
  ambition: AmbitionLevel | null;
  context: string;
  notes: string;
  /**
   * Si ya se preguntó por el punto de partida y las restricciones —
   * independiente de si contestó algo o lo saltó. `notes` vacío no alcanza
   * para distinguir "todavía no se preguntó" de "no tenía nada que agregar",
   * la misma razón por la que el norte y los recordatorios del ciclo llevan
   * su propio `*Picked` en vez de leer el valor a secas.
   */
  baselineAsked: boolean;
  /**
   * Los objetivos de la empresa de los que cuelga esta tanda. Solo se llena
   * fuera del norte: los objetivos de la empresa no cuelgan de nada.
   */
  alignedTo: readonly string[];
  alignmentAsked: boolean;
  /** Lo que el grupo o la persona controla de verdad, en sus palabras. */
  lever: string;
  leverAsked: boolean;
  /**
   * Cuántos resultados clave, acciones, tareas o hitos cuelgan de cada
   * objetivo. `0` es una respuesta —"ninguno"— y `null` es "todavía no se
   * preguntó", que es la misma distinción que hace `baselineAsked`.
   */
  childrenCount: number | null;
  childrenAsked: boolean;
}

const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

/**
 * Parses a free-text message from the user and extracts as many brief
 * criteria as possible.
 *
 * The context is always the full message text (cleaned). The parser tries
 * to detect:
 * - Count: numbers followed by "objetivo(s)" or standalone small numbers (1-10)
 * - Focuses: mentions of the 6 preset focus labels or their tagline keywords
 * - Ambition: words like "exigente", "agresivo", "conservador", "retador", "realista"
 */
export function parseBriefFromMessage(text: string): ParsedBrief {
  const normText = normalize(text);

  // Count detection
  let count: number | null = null;
  const countRegexes = [
    /(\d+)\s*objetivos?/,
    /(?:quiero|crear|generar|necesito)\s+(\d+)/,
    /\b(10|[1-9])\b/
  ];
  
  for (const regex of countRegexes) {
    const match = normText.match(regex);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) {
        count = Math.max(MIN_AI_OBJECTIVES, Math.min(MAX_AI_OBJECTIVES, parsed));
        break;
      }
    }
  }

  const focuses = detectFocuses(normText);

  // Ambition detection. Los plurales cuentan igual que el singular —
  // "objetivos retadores" es tan válido como "un objetivo retador"— así que
  // el sufijo va opcional en vez de exigir un límite de palabra justo
  // después de la raíz.
  let ambition: AmbitionLevel | null = null;
  if (normText.match(/\b(agresivos?|muy exigentes?|de ruptura|stretch)\b/)) {
    ambition = "agresivo";
  } else if (
    normText.match(/\b(retador(?:es)?|ambiciosos?)\b/) ||
    (normText.includes("exigente") && !normText.includes("muy exigente"))
  ) {
    ambition = "retador";
  } else if (normText.match(/\b(conservador(?:es)?|facil(?:es)?|realistas?|alcanzables?|seguros?)\b/)) {
    ambition = "conservador";
  }

  return {
    count,
    focuses,
    ambition,
    context: text.trim(),
    notes: "",
    // Parsear un mensaje nunca "pregunta" nada — eso lo decide el flujo del
    // chat, que conserva su propio `baselineAsked` al fusionar esta lectura
    // con lo que ya sabía.
    baselineAsked: false,
    alignedTo: [],
    alignmentAsked: false,
    lever: "",
    leverAsked: false,
    childrenCount: null,
    childrenAsked: false,
  };
}

/** Un brief vacío: lo que sabe el chat antes del primer mensaje. */
export const createEmptyBrief = (count: number | null = null): ParsedBrief => ({
  count,
  focuses: [],
  ambition: null,
  context: "",
  notes: "",
  baselineAsked: false,
  alignedTo: [],
  alignmentAsked: false,
  lever: "",
  leverAsked: false,
  childrenCount: null,
  childrenAsked: false,
});

/** Qué frentes menciona un texto, con la misma lectura que un mensaje. */
function detectFocuses(normText: string): BriefFocus[] {
  const focuses: BriefFocus[] = [];
  for (const focus of FOCUS_ORDER) {
    const meta = FOCUS_META[focus];
    const labelTokens = normalize(meta.label).match(/[a-z0-9]+/g) || [];
    const taglineTokens = normalize(meta.tagline).match(/[a-z0-9]+/g) || [];
    const keywords = [...labelTokens, ...taglineTokens].filter((w) => w.length > 3);

    let hasMatch = keywords.some((kw) => normText.includes(kw));

    if (
      (focus === "crecimiento" && normText.includes("ventas")) ||
      (focus === "rentabilidad" && normText.includes("costos")) ||
      (focus === "clientes" && normText.includes("satisfaccion")) ||
      (focus === "personas" && (normText.includes("rotacion") || normText.includes("clima"))) ||
      (focus === "operacion" && (normText.includes("procesos") || normText.includes("entregas"))) ||
      (focus === "producto" && (normText.includes("producto") || normText.includes("tecnologia")))
    ) {
      hasMatch = true;
    }

    if (hasMatch) focuses.push(focus);
  }
  return focuses;
}

/**
 * Los frentes que ya están en juego según los objetivos de la empresa
 * elegidos.
 *
 * Es lo que evita la pregunta de más: quien ya dijo que su grupo apunta al
 * objetivo de retención de clientes ya dijo en qué frente juega, y volvérselo
 * a preguntar convierte el norte en decoración. Si ninguno de los títulos deja
 * leer un frente, la lista vuelve vacía y el chat sí pregunta.
 */
export function focusesFromObjectives(objectives: readonly Objective[]): BriefFocus[] {
  const text = objectives
    .map((objective) => `${objective.title} ${objective.description}`)
    .join(" ");
  return text.trim() === "" ? [] : detectFocuses(normalize(text));
}

/**
 * Merges a partial brief from a follow-up answer into the existing one.
 * Used when the user answers a clarifying question (e.g., picks ambition chips).
 */
export function mergeBriefUpdate(
  current: ParsedBrief,
  update: Partial<ParsedBrief>
): ParsedBrief {
  return {
    ...current,
    ...update,
  };
}

/**
 * Converts a ParsedBrief into the AiObjectiveBrief that generateObjectiveSet expects.
 */
export function toAiObjectiveBrief(parsed: ParsedBrief): AiObjectiveBrief {
  return {
    ...createBlankBrief(),
    count: parsed.count,
    focuses: parsed.focuses,
    ambition: parsed.ambition,
    context: parsed.context,
    // La palanca entra como nota y no como contexto: es lo que el grupo
    // controla, así que orienta qué se mide sin llegar a titular un objetivo.
    notes: [parsed.notes, parsed.lever].map((part) => part.trim()).filter(Boolean).join(". "),
  };
}
