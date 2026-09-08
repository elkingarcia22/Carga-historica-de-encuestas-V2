/**
 * El agregado que lee toda la vista de resultados.
 *
 * Seguimiento responde "¿quién falta por reportar?"; resultados responde
 * "¿cómo nos fue?". Son preguntas distintas y por eso este archivo existe
 * aparte de `cicloProgress`: reusa sus cálculos de cumplimiento —no hay dos
 * fórmulas para el mismo número— y encima construye lo que solo la lectura de
 * resultados necesita: el ciclo de vida de cada objetivo, el riesgo derivado
 * del calendario, la serie en el tiempo y el árbol de secciones.
 *
 * Todo es puro: entra el ciclo y la configuración, salen números. Ningún
 * componente vuelve a calcular nada.
 */

import { COLLABORATORS } from "@/mocks/collaborators";
import type { Collaborator } from "@/mocks/collaborators";
import {
  MEASURE_META,
  MEASURE_ORDER,
  type MeasureType,
  type Objective,
} from "@/components/ciclo-builder";
import {
  average,
  complianceForValue,
  elapsedShare,
  hasReportedProgress,
  objectiveCompliance,
  personCompliance,
  personLastUpdate,
  resolveEstado,
  resolveNivel,
  roundPercent,
  type CicloDetailData,
  type ObjectiveUpdate,
  type TrackedObjective,
  type TrackedPerson,
} from "@/components/ciclo-detail";
import type {
  EstadoParticipanteConfig,
  NivelDesempenoConfig,
  ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import { countLifecycles, lifecycleOf, type ObjectiveLifecycle } from "./objectiveLifecycle";

// ── Configuración ──────────────────────────────────────────────────────────

export interface ResultsConfig {
  estados: readonly ObjetivoEstadoConfig[];
  niveles: readonly NivelDesempenoConfig[];
  estadosParticipante: readonly EstadoParticipanteConfig[];
  allowNegative: boolean;
}

// ── Riesgo ─────────────────────────────────────────────────────────────────

/**
 * El riesgo no se configura: se deriva.
 *
 * Un 40 % a mitad de ciclo y un 40 % a tres días del cierre son el mismo
 * número y dos situaciones opuestas, así que el riesgo compara el avance con
 * el calendario ya corrido. Configurarlo a mano sería pedirle a alguien que
 * mantenga sincronizada una tabla con una resta que la plataforma ya sabe
 * hacer.
 */
export type RiskLevel = "sin-riesgo" | "bajo" | "medio" | "alto";

export interface RiskMeta {
  id: RiskLevel;
  label: string;
  description: string;
  colorHex: string;
  text: string;
  bg: string;
  border: string;
}

export const RISK_ORDER: readonly RiskLevel[] = ["alto", "medio", "bajo", "sin-riesgo"];

export const RISK_META: Readonly<Record<RiskLevel, RiskMeta>> = {
  alto: {
    id: "alto",
    label: "Riesgo alto",
    description: "El avance va 25 puntos o más por debajo del calendario corrido.",
    colorHex: "#EF4444",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-100/60 dark:bg-red-500/15",
    border: "border-red-200/60 dark:border-red-700/40",
  },
  medio: {
    id: "medio",
    label: "Riesgo medio",
    description: "El avance va entre 12 y 25 puntos por debajo del calendario corrido.",
    colorHex: "#F59E0B",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100/60 dark:bg-amber-500/15",
    border: "border-amber-200/60 dark:border-amber-700/40",
  },
  bajo: {
    id: "bajo",
    label: "Riesgo bajo",
    description: "El avance va apenas por debajo del calendario corrido.",
    colorHex: "#3B82F6",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100/60 dark:bg-blue-500/15",
    border: "border-blue-200/60 dark:border-blue-700/40",
  },
  "sin-riesgo": {
    id: "sin-riesgo",
    label: "Sin riesgo",
    description: "El avance va al día o por delante del calendario.",
    colorHex: "#22C55E",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100/60 dark:bg-emerald-500/15",
    border: "border-emerald-200/60 dark:border-emerald-700/40",
  },
};

const RISK_HIGH_GAP = 25;
const RISK_MEDIUM_GAP = 12;

/**
 * El riesgo de un avance dado el calendario ya corrido.
 *
 * `elapsed` negativo apaga el cálculo: es la señal de "aquí el riesgo no
 * aplica". Un ciclo cerrado es justo ese caso —el riesgo es un pronóstico, y
 * sobre algo que ya terminó no hay nada que pronosticar; con el calendario en
 * 100 % todo el que no llegó a la meta saldría "en riesgo alto", que es una
 * forma rebuscada de repetir lo que la banda de resultado ya dijo.
 */
export function riskFor(percent: number, elapsed: number): RiskLevel {
  if (elapsed < 0) return "sin-riesgo";
  if (percent >= 100) return "sin-riesgo";
  const gap = elapsed - percent;
  if (gap >= RISK_HIGH_GAP) return "alto";
  if (gap >= RISK_MEDIUM_GAP) return "medio";
  if (gap > 0) return "bajo";
  return "sin-riesgo";
}

// ── Entradas ───────────────────────────────────────────────────────────────

/**
 * Un objetivo en manos de una persona, ya resuelto. Es la unidad mínima de
 * toda la vista: cada nodo del árbol, cada distribución y cada fila del
 * ranking sale de agrupar estas entradas de otra manera.
 */
export interface ResultEntry {
  personId: string;
  person: TrackedPerson;
  tracked: TrackedObjective;
  objective: Objective;
  percent: number;
  hasProgress: boolean;
  lifecycle: ObjectiveLifecycle;
  estado: ObjetivoEstadoConfig | null;
  lastUpdate: ObjectiveUpdate | null;
  commentCount: number;
}

export interface PersonResultRow {
  person: TrackedPerson;
  collaborator: Collaborator;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  nivel: NivelDesempenoConfig | null;
  estadoParticipante: EstadoParticipanteConfig | null;
  /** Cuenta en promedios, rankings y distribuciones. */
  counts: boolean;
  risk: RiskLevel;
  entries: readonly ResultEntry[];
  lifecycleCounts: Map<ObjectiveLifecycle, number>;
  reportedCount: number;
  lastUpdate: ObjectiveUpdate | null;
  groupLabel: string;
  area: string;
  leader: string;
}

// ── Árbol ──────────────────────────────────────────────────────────────────

export type ResultsAxis = "objetivos" | "organizacion" | "medida";

export const AXIS_LABELS: Readonly<Record<ResultsAxis, string>> = {
  objetivos: "Objetivos de empresa",
  organizacion: "Organización",
  medida: "Tipo de medida",
};

export type ResultNodeKind =
  | "empresa"
  | "grupo"
  | "area"
  | "lider"
  | "medida"
  | "objetivo"
  | "persona";

export interface ResultNode {
  id: string;
  kind: ResultNodeKind;
  title: string;
  /** La línea gris bajo el título. */
  subtitle: string;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  /** Solo en nodos de objetivo o de persona-objetivo. */
  lifecycle: ObjectiveLifecycle | null;
  /** Peso dentro del ciclo de quien lo carga, cuando aplica. */
  weight: number | null;
  peopleCount: number;
  objectiveCount: number;
  reportedCount: number;
  lifecycleCounts: Map<ObjectiveLifecycle, number>;
  risk: RiskLevel;
  personIds: readonly string[];
  children: readonly ResultNode[];
}

/** Cuántos objetivos cuelgan de un nodo, contando todo lo que hay debajo. */
export function countNodeObjectives(node: ResultNode): number {
  return node.children.length === 0
    ? node.objectiveCount
    : node.children.reduce((sum, child) => sum + countNodeObjectives(child), 0);
}

// ── Agregado completo ──────────────────────────────────────────────────────

export interface TimelinePoint {
  /** "ago", "sep"… */
  label: string;
  /** ISO del último día del tramo. */
  date: string;
  percent: number;
  /** Cuánto del calendario había corrido en ese punto. */
  elapsed: number;
}

export interface MeasureShare {
  measure: MeasureType;
  label: string;
  symbol: string;
  count: number;
}

export interface CicloResults {
  data: CicloDetailData;
  /** Todas las personas del ciclo, cuenten o no en los promedios. */
  rows: readonly PersonResultRow[];
  /** Solo las que cuentan. Es la base de todo promedio y de todo ranking. */
  scored: readonly PersonResultRow[];
  /** Todos los objetivos del ciclo, cuente o no quien los lleva. */
  entries: readonly ResultEntry[];
  /**
   * Los objetivos de quienes sí cuentan. Es la población de la que salen
   * todas las cifras de esta vista, y también la de las listas de pendientes:
   * si la franja del resumen dice 113, la lista que abre tiene que traer 113.
   * Recordarle un pendiente a alguien que ya se retiró tampoco tendría a
   * quién llegarle.
   */
  scoredEntries: readonly ResultEntry[];
  overallPercent: number;
  overallEstado: ObjetivoEstadoConfig | null;
  overallNivel: NivelDesempenoConfig | null;
  /** Qué tanto del calendario del ciclo ha corrido, 0–100. */
  elapsed: number;
  daysLeft: number;
  risk: RiskLevel;
  /** Si el riesgo tiene sentido en este ciclo. Falso cuando ya cerró. */
  showsRisk: boolean;
  lifecycleCounts: Map<ObjectiveLifecycle, number>;
  nivelCounts: Map<string, number>;
  estadoParticipanteCounts: Map<string, number>;
  riskCounts: Map<RiskLevel, number>;
  measureMix: readonly MeasureShare[];
  objectiveCount: number;
  /** Objetivos con al menos un comentario en su historial. */
  commentedCount: number;
  peopleCount: number;
  peopleWithProgress: number;
  groupCount: number;
  timeline: readonly TimelinePoint[];
  /** Gente de las áreas del ciclo que se quedó sin ningún objetivo. */
  withoutObjectives: readonly Collaborator[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_LABEL = new Intl.DateTimeFormat("es-CO", { month: "short" });

/** Cierres de mes entre dos fechas, incluido el del cierre del ciclo. */
function monthEnds(startISO: string, endISO: string): Date[] {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T23:59:59`);
  const points: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
  while (cursor <= end && points.length < 24) {
    points.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 2, 0);
  }
  if (points.length === 0 || points[points.length - 1].getTime() < end.getTime()) {
    points.push(end);
  }
  return points;
}

/** El valor que una persona llevaba reportado en un objetivo hasta una fecha. */
function valueAt(tracked: TrackedObjective, cutoff: number): string | null {
  let value: string | null = null;
  for (const update of tracked.updates) {
    if (new Date(update.date).getTime() > cutoff) break;
    if (update.value !== null) value = update.value;
  }
  return value;
}

export function buildCicloResults(
  data: CicloDetailData,
  config: ResultsConfig,
  now: Date = new Date()
): CicloResults {
  const elapsed = roundPercent(elapsedShare(data.startDate, data.endDate, now));
  const daysLeft = Math.ceil(
    (new Date(`${data.endDate}T23:59:59`).getTime() - now.getTime()) / DAY_MS
  );
  // El eje con el que se mide el riesgo. En un ciclo cerrado no hay ninguno.
  const showsRisk = data.status !== "closed";
  const riskElapsed = showsRisk ? elapsed : -1;

  const entries: ResultEntry[] = [];
  const rows: PersonResultRow[] = data.people.map((person) => {
    const personEntries = person.objectives.map((tracked) => {
      const percent = objectiveCompliance(tracked, config.allowNegative);
      const hasProgress = hasReportedProgress(tracked);
      const entry: ResultEntry = {
        personId: person.id,
        person,
        tracked,
        objective: tracked.objective,
        percent,
        hasProgress,
        lifecycle: lifecycleOf(tracked, percent, hasProgress),
        estado: resolveEstado(config.estados, percent, data.status),
        lastUpdate: tracked.updates.length === 0 ? null : tracked.updates[tracked.updates.length - 1],
        commentCount: tracked.updates.filter((update) => update.comment.trim() !== "").length,
      };
      entries.push(entry);
      return entry;
    });

    const percent = personCompliance(person, config.allowNegative);
    // El estado del participante viaja con el colaborador en producción; aquí
    // lo trae el mock ya resuelto en `person.collaborator`.
    const estadoParticipante =
      config.estadosParticipante.find(
        (estado) => estado.id === participantStateId(person, config.estadosParticipante)
      ) ?? null;

    return {
      person,
      collaborator: person.collaborator,
      percent,
      estado: resolveEstado(config.estados, percent, data.status),
      nivel: resolveNivel(config.niveles, percent),
      estadoParticipante,
      counts: estadoParticipante?.cuentaEnResultados ?? true,
      risk: riskFor(percent, riskElapsed),
      entries: personEntries,
      lifecycleCounts: countLifecycles(personEntries.map((entry) => entry.lifecycle)),
      reportedCount: personEntries.filter((entry) => entry.hasProgress).length,
      lastUpdate: personLastUpdate(person),
      groupLabel: person.groupId ?? "Individual",
      area: person.collaborator.area,
      leader: person.collaborator.leader ?? "Sin líder",
    };
  });

  const scored = rows.filter((row) => row.counts);
  const overallPercent = average(scored.map((row) => row.percent));

  const scoredEntries = entries.filter((entry) => {
    const row = rows.find((candidate) => candidate.person.id === entry.personId);
    return row?.counts ?? true;
  });

  const nivelCounts = new Map<string, number>(config.niveles.map((nivel) => [nivel.id, 0]));
  scored.forEach((row) => {
    if (row.nivel) nivelCounts.set(row.nivel.id, (nivelCounts.get(row.nivel.id) ?? 0) + 1);
  });

  const estadoParticipanteCounts = new Map<string, number>(
    config.estadosParticipante.map((estado) => [estado.id, 0])
  );
  rows.forEach((row) => {
    if (!row.estadoParticipante) return;
    const id = row.estadoParticipante.id;
    estadoParticipanteCounts.set(id, (estadoParticipanteCounts.get(id) ?? 0) + 1);
  });

  const riskCounts = new Map<RiskLevel, number>(RISK_ORDER.map((level) => [level, 0]));
  scored.forEach((row) => riskCounts.set(row.risk, (riskCounts.get(row.risk) ?? 0) + 1));

  const measureMix: MeasureShare[] = MEASURE_ORDER.map((measure) => ({
    measure,
    label: MEASURE_META[measure].label,
    symbol: MEASURE_META[measure].symbol,
    count: scoredEntries.filter((entry) => entry.objective.measure === measure).length,
  })).filter((share) => share.count > 0);

  /*
   * Quién se quedó sin objetivos.
   *
   * El corte no es "su área participa" sino "su grupo participa", con el
   * mismo `segmentBy` con el que el ciclo repartió las asignaciones. La
   * diferencia no es un matiz: un área tiene miles de personas y casi
   * ninguna tenía por qué estar en este ciclo, así que contarlas a todas
   * produce una alerta enorme y falsa. Un grupo que sí recibió objetivos es
   * la única población de la que se puede decir, con razón, que a estos les
   * faltó.
   */
  const participantIds = new Set(data.people.map((person) => person.id));
  const groupsInCiclo = new Set(
    data.people
      .map((person) => person.collaborator[data.segmentBy])
      .filter((value): value is string => Boolean(value))
  );
  const withoutObjectives = COLLABORATORS.filter(
    (collaborator) =>
      !participantIds.has(collaborator.id) &&
      groupsInCiclo.has(collaborator[data.segmentBy] ?? "")
  );

  return {
    data,
    rows,
    scored,
    entries,
    scoredEntries,
    overallPercent,
    overallEstado: resolveEstado(config.estados, overallPercent, data.status),
    overallNivel: resolveNivel(config.niveles, overallPercent),
    elapsed,
    daysLeft,
    risk: riskFor(overallPercent, riskElapsed),
    showsRisk,
    lifecycleCounts: countLifecycles(scoredEntries.map((entry) => entry.lifecycle)),
    nivelCounts,
    estadoParticipanteCounts,
    riskCounts,
    measureMix,
    objectiveCount: scoredEntries.length,
    commentedCount: scoredEntries.filter((entry) => entry.commentCount > 0).length,
    peopleCount: rows.length,
    peopleWithProgress: scored.filter((row) => row.reportedCount > 0).length,
    groupCount: new Set(
      data.people.map((person) => person.groupId).filter((id): id is string => id !== null)
    ).size,
    timeline: buildTimeline(data, rows, config, now),
    withoutObjectives,
  };
}

/**
 * A qué estado de participante pertenece alguien.
 *
 * En producción es un campo del colaborador. Mientras el directorio no lo
 * traiga, se reparte de forma determinista: la enorme mayoría queda activa y
 * unos pocos caen en los estados que no cuentan, que es justo el caso que la
 * vista tiene que saber manejar.
 */
function participantStateId(
  person: TrackedPerson,
  estados: readonly EstadoParticipanteConfig[]
): string {
  if (estados.length === 0) return "";
  let hash = 0x811c9dc5;
  const seed = `estado-participante:${person.id}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const roll = hash / 0x100000000;
  if (roll < 0.86) return estados[0].id;
  const rest = estados.slice(1);
  if (rest.length === 0) return estados[0].id;
  return rest[Math.floor(((roll - 0.86) / 0.14) * rest.length)]?.id ?? estados[0].id;
}

function buildTimeline(
  data: CicloDetailData,
  rows: readonly PersonResultRow[],
  config: ResultsConfig,
  now: Date
): TimelinePoint[] {
  const scored = rows.filter((row) => row.counts);

  /*
   * Los cierres de mes ya pasados, más el arranque y el hoy.
   *
   * Un ciclo que lleva tres semanas solo tiene un cierre de mes detrás, y con
   * un punto no hay línea que dibujar. Pero sí hay historia: el ciclo empezó
   * en cero y hoy va donde va. Esos dos son puntos legítimos —el más honesto
   * de todos es el de hoy— y con ellos la curva existe desde el primer día.
   */
  const start = new Date(`${data.startDate}T00:00:00`);
  const passed = monthEnds(data.startDate, data.endDate).filter(
    (point) => point.getTime() <= now.getTime()
  );
  const end = new Date(`${data.endDate}T23:59:59`);
  const last = now.getTime() < end.getTime() ? now : end;
  const points = [start, ...passed];
  if (points[points.length - 1].getTime() < last.getTime() - DAY_MS) points.push(last);

  return points.map((point) => {
      const cutoff = point.getTime();
      const percents = scored.map((row) =>
        roundPercent(
          row.person.objectives.reduce((sum, tracked) => {
            const raw = valueAt(tracked, cutoff);
            if (raw === null) return sum;
            const percent = complianceForValue(tracked.objective, raw, config.allowNegative) ?? 0;
            return sum + (tracked.objective.weight / 100) * percent;
          }, 0)
        )
      );
      return {
        label:
          point.getTime() === start.getTime()
            ? "inicio"
            : MONTH_LABEL.format(point).replace(".", ""),
        date: point.toISOString().slice(0, 10),
        percent: average(percents),
        elapsed: roundPercent(
          elapsedShare(data.startDate, data.endDate, point)
        ),
      };
    });
}
