import {
  type AiObjectiveBrief,
  createBlankBrief,
  FOCUS_ORDER,
  FOCUS_META,
  type ObjectiveFocus,
  type BriefFocus,
  AMBITION_ORDER,
  MIN_AI_OBJECTIVES,
  MAX_AI_OBJECTIVES,
} from "./aiObjectiveBrief";
import type { AmbitionLevel } from "./aiObjectiveGenerator";

/** Which criteria the chat still needs to ask about. */
export type CriterionId = "focuses" | "count" | "ambition";

/** What the parser managed to extract from the user's message. */
export interface ParsedBrief {
  count: number | null;
  focuses: readonly BriefFocus[];
  ambition: AmbitionLevel | null;
  context: string;
  notes: string;
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

  // Focus detection
  const focuses: BriefFocus[] = [];
  for (const focus of FOCUS_ORDER) {
    const meta = FOCUS_META[focus];
    const labelTokens = normalize(meta.label).match(/[a-z0-9]+/g) || [];
    const taglineTokens = normalize(meta.tagline).match(/[a-z0-9]+/g) || [];
    
    // Check if label or tagline words are in normText
    const keywords = [...labelTokens, ...taglineTokens].filter(w => w.length > 3);
    
    let hasMatch = false;
    for (const kw of keywords) {
      if (normText.includes(kw)) {
        hasMatch = true;
        break;
      }
    }
    
    // Mappings mentioned in the prompt
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

    if (hasMatch) {
      focuses.push(focus);
    }
  }

  // Ambition detection
  let ambition: AmbitionLevel | null = null;
  if (normText.match(/\b(agresivo|muy exigente|de ruptura|stretch)\b/)) {
    ambition = "agresivo";
  } else if (normText.match(/\b(retador|ambicioso)\b/) || (normText.includes("exigente") && !normText.includes("muy exigente"))) {
    ambition = "retador";
  } else if (normText.match(/\b(conservador|facil|realista|alcanzable|seguro)\b/)) {
    ambition = "conservador";
  }

  return {
    count,
    focuses,
    ambition,
    context: text.trim(),
    notes: "",
  };
}

/**
 * Returns the criteria that are still missing from the brief, in the order
 * they should be asked: focuses → count → ambition.
 *
 * Context is never "missing" because the user's initial message IS the context.
 */
export function getMissingCriteria(brief: ParsedBrief): CriterionId[] {
  const missing: CriterionId[] = [];
  if (brief.focuses.length === 0) missing.push("focuses");
  if (brief.count === null) missing.push("count");
  if (brief.ambition === null) missing.push("ambition");
  return missing;
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
    notes: parsed.notes,
  };
}
