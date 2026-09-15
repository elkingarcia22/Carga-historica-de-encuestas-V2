import type { InsightConfidence } from "@/components/survey-results/insightConfidence";
import type { PersonResultRow, ResultEntry } from "./resultsModel";
import type { FilterKey } from "./useResultsFilters";

/**
 * Lo que la IA puede leer de un ciclo de objetivos, como tipos.
 *
 * Una encuesta se analiza preguntando "¿qué respondió la gente?". Un ciclo no:
 * aquí nadie respondió nada, aquí alguien *se comprometió* a mover una cifra y
 * el ciclo lleva un tiempo corriendo. Eso cambia lo que hay que mirar, y las
 * cuatro preguntas propias de este reporte son las que dan forma a este
 * archivo:
 *
 *   1. ¿Va a llegar?           — avance contra el calendario ya corrido.
 *   2. ¿De qué depende?        — dónde está el *peso*, no dónde está el ruido.
 *   3. ¿Dónde se abre?         — la diferencia entre áreas, líderes y grupos.
 *   4. ¿Se está llevando bien? — aprobaciones, conversación y ritmo de reporte.
 */

export type InsightKind = "finding" | "risk" | "recommendation";

/** El atajo a la vista donde se puede hacer algo, con el filtro ya puesto. */
export interface InsightAction {
  label: string;
  tab: "cumplimiento" | "colaboradores" | "ranking";
  filter?: { key: FilterKey; value: string };
}

export interface CicloInsight {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  /** La cifra exacta sobre la que se apoya la afirmación. */
  evidence: string;
  confidence: InsightConfidence;
  action?: InsightAction;
}

/** Un foco del bloque "Dónde está el peso". */
export interface FocusRow {
  id: string;
  label: string;
  sublabel: string;
  people: number;
  objectives: number;
  /** Qué parte del peso total del ciclo carga este foco. */
  weightShare: number;
  percent: number;
  /** Puntos por debajo del calendario corrido (o del promedio, si ya cerró). */
  gap: number;
  /** Cuánto del peso de este foco está quieto. */
  stalledShare: number;
  severity: "alta" | "media" | "baja";
  confidence: InsightConfidence;
  filterValue: string;
}

/** Una fila del bloque "Lo que sostiene el ciclo". */
export interface StrengthRow {
  id: string;
  label: string;
  sublabel: string;
  people: number;
  percent: number;
  /** Puntos por encima del promedio del ciclo. */
  delta: number;
  confidence: InsightConfidence;
  filterKey: FilterKey;
  filterValue: string;
}

export interface GapGroup {
  label: string;
  percent: number;
  /** Cuántas unidades del corte sostienen la cifra —ver `GapCut.unit`. */
  size: number;
  /** Diferencia contra el promedio del corte. */
  diff: number;
}

/** Un corte del bloque "Brechas entre equipos". */
export interface GapCut {
  id: string;
  key: FilterKey;
  label: string;
  /** "áreas", "líderes", "objetivos de empresa" — el plural no siempre sale de
   *  añadirle una ese al rótulo de la columna. */
  pluralLabel: string;
  /**
   * Qué cuenta cada grupo del corte.
   *
   * Casi todos parten personas, pero la alineación parte objetivos: una misma
   * persona puede tener objetivos colgando de dos objetivos de empresa
   * distintos, así que ahí "180 personas" sería sencillamente falso.
   */
  unit: "personas" | "objetivos";
  /** Grupos con muestra suficiente. */
  covered: number;
  omitted: readonly { label: string; size: number }[];
  average: number;
  spread: number;
  best: GapGroup | null;
  worst: GapGroup | null;
  laggards: readonly GapGroup[];
  confidence: InsightConfidence;
}

/** El bloque "Cómo se está llevando el ciclo". */
export interface GovernanceReading {
  approval: { aprobados: number; porAprobar: number; porAjustar: number; total: number };
  conversation: {
    conComentario: number;
    mudos: number;
    conAvance: number;
    conEvidencia: number;
  };
  rhythm: {
    updates: number;
    peakHour: string;
    peakHourShare: number;
    peakWeekday: string;
    peakWeekdayShare: number;
    /** Qué parte de los reportes cae en los últimos cinco días del mes. */
    monthEndShare: number;
  };
  coverage: { sinObjetivos: number; noCuentan: number; inactivos: number };
}

export interface CicloAnalysis {
  summary: string;
  insights: readonly CicloInsight[];
  focus: readonly FocusRow[];
  strengths: readonly StrengthRow[];
  gaps: readonly GapCut[];
  governance: GovernanceReading;
}

// ── Umbrales ───────────────────────────────────────────────────────────────

/**
 * Por debajo de cinco personas un corte deja de ser una lectura y pasa a ser
 * una anécdota: un solo caso mueve el promedio veinte puntos. Es el mismo
 * mínimo con el que el reporte de encuestas protege sus cruces demográficos,
 * aquí por razón estadística y no de confidencialidad.
 */
export const MIN_CUT_SIZE = 5;

/** Puntos de diferencia a partir de los cuales una brecha vale nombrarla. */
export const GAP_WORTH_TELLING = 5;

/**
 * Para una fortaleza el listón es más bajo que para una brecha.
 *
 * Nombrar mal un rezago le cuesta a alguien una conversación que no tocaba;
 * nombrar mal un apoyo solo cuesta ir a preguntarle a un equipo cómo lo hizo.
 */
export const STRENGTH_WORTH_TELLING = 3;

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * Qué tan directa es la cifra que sostiene una lectura.
 *
 * En una encuesta la confiabilidad es cuestión de cuánta gente respondió.
 * Aquí es cuánta gente hay *detrás del corte*: el 12 % de atraso de un área de
 * sesenta personas y el de una de tres son el mismo número y dos cosas
 * distintas.
 */
export function confidenceForSample(people: number): InsightConfidence {
  if (people >= 30) return "high";
  if (people >= 10) return "medium";
  return "low";
}

// ── Agrupaciones ───────────────────────────────────────────────────────────

export interface Bucket {
  label: string;
  rows: PersonResultRow[];
}

export function groupRows(
  rows: readonly PersonResultRow[],
  pick: (row: PersonResultRow) => string
): Bucket[] {
  const buckets = new Map<string, Bucket>();
  rows.forEach((row) => {
    const label = pick(row);
    const bucket = buckets.get(label);
    if (bucket) bucket.rows.push(row);
    else buckets.set(label, { label, rows: [row] });
  });
  return [...buckets.values()];
}

/** El peso que carga un conjunto de entradas, y cuánto de ese peso está quieto. */
export function weightOf(entries: readonly ResultEntry[]) {
  let total = 0;
  let stalled = 0;
  entries.forEach((entry) => {
    total += entry.objective.weight;
    if (!entry.hasProgress) stalled += entry.objective.weight;
  });
  return { total, stalled };
}

