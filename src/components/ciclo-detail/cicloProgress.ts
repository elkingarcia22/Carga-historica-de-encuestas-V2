/**
 * Cálculos de la vista de seguimiento. Todo puro: recibe los datos del ciclo
 * y la configuración del módulo, devuelve números y estados. La pantalla solo
 * los pinta.
 */

import {
  computeCompliance,
  parseAmount,
  type CicloStatus,
  type Objective,
  type ObjectiveSet,
} from "@/components/ciclo-builder";
import {
  findEstadoForPercent,
  findNivelForPercent,
  type NivelDesempenoConfig,
  type ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import type {
  CicloDetailData,
  ObjectiveUpdate,
  TrackedObjective,
  TrackedPerson,
} from "./cicloDetailTypes";

// ── Cumplimiento ───────────────────────────────────────────────────────────

export const hasReportedProgress = (tracked: TrackedObjective): boolean =>
  tracked.currentValue.trim() !== "";

/** Redondeo a un decimal, el que muestra toda la vista. */
export const roundPercent = (value: number): number => Math.round(value * 10) / 10;

/**
 * Cumplimiento de un objetivo para el valor que lleva reportado, 0 mientras
 * no haya nada. Booleanos: "true" es 100 %, cualquier otra cosa 0 %.
 */
export function objectiveCompliance(tracked: TrackedObjective, allowNegative: boolean): number {
  const { objective, currentValue } = tracked;
  if (!hasReportedProgress(tracked)) return 0;
  if (objective.measure === "boolean") return currentValue === "true" ? 100 : 0;
  return complianceForValue(objective, currentValue, allowNegative) ?? 0;
}

/**
 * Cumplimiento que daría un valor cualquiera —el que la persona está
 * escribiendo en el drawer, por ejemplo—, o null si aún no es un número.
 */
export function complianceForValue(
  objective: Objective,
  rawValue: string,
  allowNegative: boolean
): number | null {
  if (objective.measure === "boolean") {
    if (rawValue === "true") return 100;
    if (rawValue === "false") return 0;
    return null;
  }
  const actual = parseAmount(rawValue);
  const target = parseAmount(objective.targetValue);
  if (actual === null || target === null || objective.direction === null) return null;
  const result = computeCompliance({
    direction: objective.direction,
    target,
    initial: parseAmount(objective.initialValue),
    min: objective.rangeEnabled ? parseAmount(objective.minValue) : null,
    max: objective.rangeEnabled ? parseAmount(objective.maxValue) : null,
    actual,
    allowNegative,
  });
  return roundPercent(result.percent);
}

/** Avance ponderado de una persona: Σ peso × cumplimiento. */
export function personCompliance(person: TrackedPerson, allowNegative: boolean): number {
  const total = person.objectives.reduce(
    (sum, tracked) =>
      sum + (tracked.objective.weight / 100) * objectiveCompliance(tracked, allowNegative),
    0
  );
  return roundPercent(total);
}

export const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : roundPercent(values.reduce((a, b) => a + b, 0) / values.length);

// ── Historial ──────────────────────────────────────────────────────────────

export const lastUpdate = (updates: readonly ObjectiveUpdate[]): ObjectiveUpdate | null =>
  updates.length === 0 ? null : updates[updates.length - 1];

/** La actualización más reciente entre todos los objetivos de una persona. */
export function personLastUpdate(person: TrackedPerson): ObjectiveUpdate | null {
  return person.objectives.reduce<ObjectiveUpdate | null>((latest, tracked) => {
    const candidate = lastUpdate(tracked.updates);
    if (!candidate) return latest;
    return latest === null || candidate.date > latest.date ? candidate : latest;
  }, null);
}

// ── Estados y niveles ──────────────────────────────────────────────────────

/**
 * Los estados de la configuración se solapan a propósito: "En progreso" y
 * "No cumplió parcialmente" cubren el mismo 1–69 %, porque uno describe un
 * ciclo abierto y el otro uno ya cerrado. Aquí se decide cuál mitad aplica.
 */
const LIVE_ONLY_ESTADOS = new Set(["por-iniciar", "en-progreso"]);
const CLOSED_ONLY_ESTADOS = new Set(["no-cumplio", "no-cumplio-parcialmente"]);

export function estadosForStatus(
  estados: readonly ObjetivoEstadoConfig[],
  status: CicloStatus
): readonly ObjetivoEstadoConfig[] {
  const excluded = status === "closed" ? LIVE_ONLY_ESTADOS : CLOSED_ONLY_ESTADOS;
  return estados.filter((estado) => !excluded.has(estado.id));
}

/**
 * El estado de un cumplimiento dado. Fuera de todo rango configurado se
 * redondea al extremo más cercano: un 180 % es "Sobrecumplió" aunque el rango
 * termine en 150, no "sin estado".
 */
export function resolveEstado(
  estados: readonly ObjetivoEstadoConfig[],
  percent: number,
  status: CicloStatus
): ObjetivoEstadoConfig | null {
  const applicable = estadosForStatus(estados, status);
  if (applicable.length === 0) return null;
  const rounded = Math.round(percent);
  const exact = findEstadoForPercent(applicable, rounded);
  if (exact) return exact;
  const sorted = [...applicable].sort((a, b) => a.maxPorcentaje - b.maxPorcentaje);
  if (rounded > sorted[sorted.length - 1].maxPorcentaje) return sorted[sorted.length - 1];
  const nonNegative = sorted.filter((estado) => estado.minPorcentaje >= 0);
  if (rounded < 0) return nonNegative[0] ?? sorted[0];
  return [...sorted].reverse().find((estado) => estado.maxPorcentaje <= rounded) ?? sorted[0];
}

export const resolveNivel = (
  niveles: readonly NivelDesempenoConfig[],
  percent: number
): NivelDesempenoConfig | null => findNivelForPercent(niveles, Math.round(percent));

/** Cuántas veces aparece cada estado / nivel en una lista de porcentajes. */
export function countBy<T extends { id: string }>(
  items: readonly T[],
  resolve: (percent: number) => T | null,
  percents: readonly number[]
): Map<string, number> {
  const counts = new Map<string, number>(items.map((item) => [item.id, 0]));
  percents.forEach((percent) => {
    const match = resolve(percent);
    if (match) counts.set(match.id, (counts.get(match.id) ?? 0) + 1);
  });
  return counts;
}

// ── Filas ──────────────────────────────────────────────────────────────────

export interface PersonRow {
  person: TrackedPerson;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  nivel: NivelDesempenoConfig | null;
  lastUpdate: ObjectiveUpdate | null;
  /** Objetivos con al menos un valor reportado. */
  reportedCount: number;
  /** El grupo que le dio la asignación, o "Individual". */
  groupLabel: string;
}

export interface ProgressConfig {
  estados: readonly ObjetivoEstadoConfig[];
  niveles: readonly NivelDesempenoConfig[];
  allowNegative: boolean;
}

export const INDIVIDUAL_GROUP_LABEL = "Individual";

export function buildPersonRows(data: CicloDetailData, config: ProgressConfig): PersonRow[] {
  return data.people.map((person) => {
    const percent = personCompliance(person, config.allowNegative);
    return {
      person,
      percent,
      estado: resolveEstado(config.estados, percent, data.status),
      nivel: resolveNivel(config.niveles, percent),
      lastUpdate: personLastUpdate(person),
      reportedCount: person.objectives.filter(hasReportedProgress).length,
      groupLabel: person.groupId ?? INDIVIDUAL_GROUP_LABEL,
    };
  });
}

/** Un objetivo visto desde un grupo: el promedio de todos los que lo llevan. */
export interface AggregatedObjective {
  objective: Objective;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  memberCount: number;
  reportedCount: number;
  /** Personas en 100 % o más. */
  achievedCount: number;
  /** Solo en asignaciones individuales: a quién le toca. */
  assigneeNames: readonly string[];
}

export interface GroupRow {
  id: string;
  kind: "grupal" | "individual";
  label: string;
  /** Otros grupos que comparten exactamente esta asignación. */
  sharedWith: readonly string[];
  set: ObjectiveSet;
  rows: readonly PersonRow[];
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  nivelCounts: Map<string, number>;
  objectives: readonly AggregatedObjective[];
}

function aggregateObjective(
  objective: Objective,
  members: readonly PersonRow[],
  data: CicloDetailData,
  config: ProgressConfig,
  assigneeNames: readonly string[]
): AggregatedObjective {
  const tracked = members
    .map((row) => row.person.objectives.find((item) => item.objective.id === objective.id))
    .filter((item): item is TrackedObjective => item !== undefined);
  const percents = tracked.map((item) => objectiveCompliance(item, config.allowNegative));
  const percent = average(percents);
  return {
    objective,
    percent,
    estado: resolveEstado(config.estados, percent, data.status),
    memberCount: tracked.length,
    reportedCount: tracked.filter(hasReportedProgress).length,
    achievedCount: percents.filter((value) => value >= 100).length,
    assigneeNames,
  };
}

/**
 * Una fila por grupo, más una sola fila para todas las asignaciones
 * individuales: en la pestaña de grupos la pregunta es "¿cómo va Marketing?",
 * y las personas con objetivos propios no son un grupo, son la excepción.
 */
export function buildGroupRows(
  data: CicloDetailData,
  rows: readonly PersonRow[],
  config: ProgressConfig
): GroupRow[] {
  const groupRows: GroupRow[] = data.sets
    .filter((set) => set.kind === "grupal")
    .flatMap((set) =>
      set.targetIds.map((groupId) => {
        const members = rows.filter((row) => row.person.groupId === groupId);
        const percent = average(members.map((row) => row.percent));
        return {
          id: groupId,
          kind: "grupal" as const,
          label: groupId,
          sharedWith: set.targetIds.filter((id) => id !== groupId),
          set,
          rows: members,
          percent,
          estado: resolveEstado(config.estados, percent, data.status),
          nivelCounts: countBy(
            config.niveles,
            (value) => resolveNivel(config.niveles, value),
            members.map((row) => row.percent)
          ),
          objectives: set.objectives.map((objective) =>
            aggregateObjective(objective, members, data, config, [])
          ),
        };
      })
    );

  const individualSets = data.sets.filter((set) => set.kind === "individual");
  if (individualSets.length === 0) return groupRows;

  const individualRows = rows.filter((row) => row.person.groupId === null);
  const percent = average(individualRows.map((row) => row.percent));
  const objectives = individualSets.flatMap((set) => {
    const members = individualRows.filter((row) => row.person.setId === set.id);
    const names = members.map((row) => row.person.collaborator.name);
    return set.objectives.map((objective) =>
      aggregateObjective(objective, members, data, config, names)
    );
  });

  return [
    ...groupRows,
    {
      id: "__individual__",
      kind: "individual",
      label: "Objetivos individuales",
      sharedWith: [],
      set: individualSets[0],
      rows: individualRows,
      percent,
      estado: resolveEstado(config.estados, percent, data.status),
      nivelCounts: countBy(
        config.niveles,
        (value) => resolveNivel(config.niveles, value),
        individualRows.map((row) => row.percent)
      ),
      objectives,
    },
  ];
}

// ── Resumen ────────────────────────────────────────────────────────────────

export interface CicloSummaryStats {
  overallPercent: number;
  overallEstado: ObjetivoEstadoConfig | null;
  overallNivel: NivelDesempenoConfig | null;
  peopleCount: number;
  peopleWithProgress: number;
  groupCount: number;
  individualCount: number;
  objectiveCount: number;
  achievedObjectives: number;
  estadoCounts: Map<string, number>;
  nivelCounts: Map<string, number>;
}

export function summarize(
  data: CicloDetailData,
  rows: readonly PersonRow[],
  config: ProgressConfig
): CicloSummaryStats {
  const percents = rows.map((row) => row.percent);
  const overallPercent = average(percents);
  const trackedAll = rows.flatMap((row) => row.person.objectives);
  return {
    overallPercent,
    overallEstado: resolveEstado(config.estados, overallPercent, data.status),
    overallNivel: resolveNivel(config.niveles, overallPercent),
    peopleCount: rows.length,
    peopleWithProgress: rows.filter((row) => row.reportedCount > 0).length,
    groupCount: data.sets.filter((set) => set.kind === "grupal").reduce(
      (sum, set) => sum + set.targetIds.length,
      0
    ),
    individualCount: rows.filter((row) => row.person.groupId === null).length,
    objectiveCount: trackedAll.length,
    achievedObjectives: trackedAll.filter(
      (item) => objectiveCompliance(item, config.allowNegative) >= 100
    ).length,
    estadoCounts: countBy(
      estadosForStatus(config.estados, data.status),
      (value) => resolveEstado(config.estados, value, data.status),
      percents
    ),
    nivelCounts: countBy(config.niveles, (value) => resolveNivel(config.niveles, value), percents),
  };
}

// ── Formato ────────────────────────────────────────────────────────────────

const PERCENT_FORMAT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const formatPercent = (value: number): string => `${PERCENT_FORMAT.format(value)} %`;

const SHORT_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

export const formatShortDate = (iso: string): string => SHORT_DATE.format(new Date(iso));
export const formatLongDate = (iso: string): string => LONG_DATE.format(new Date(iso));
export const formatDateTime = (iso: string): string =>
  `${SHORT_DATE.format(new Date(iso))} · ${TIME.format(new Date(iso))}`;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas"… */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

/** Días que faltan para el cierre (negativo si ya pasó). */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const end = new Date(`${isoDate}T23:59:59`);
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

/** Qué tanto del calendario del ciclo ha corrido, 0–100. */
export function elapsedShare(startDate: string, endDate: string, now: Date = new Date()): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59`).getTime();
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
}

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
