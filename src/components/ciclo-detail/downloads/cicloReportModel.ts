import type { NivelDesempenoConfig, ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import { parseAmount, type Objective } from "@/components/ciclo-builder";
import { lifecycleOf, type ObjectiveLifecycle } from "@/components/ciclo-results/objectiveLifecycle";
import type { CicloDetailData, TrackedObjective, TrackedPerson } from "../cicloDetailTypes";
import {
  complianceForValue,
  hasReportedProgress,
  objectiveCompliance,
  type CicloSummaryStats,
  type GroupRow,
  type PersonRow,
} from "../cicloProgress";
import type { CicloDemographicKey, CicloReportRequest } from "./cicloDownloadTypes";

/**
 * Lo que un reporte del ciclo lee, y cómo se recorta.
 *
 * Los cuatro archivos salen del mismo agregado que pinta la pantalla, pasado
 * por los mismos filtros. Es deliberado: si el papel y la tabla pudieran
 * discrepar sobre un número, la primera persona que cruce una celda concluye
 * que uno de los dos miente.
 */
export interface CicloReportSource {
  data: CicloDetailData;
  rows: readonly PersonRow[];
  groups: readonly GroupRow[];
  stats: CicloSummaryStats;
  estados: readonly ObjetivoEstadoConfig[];
  niveles: readonly NivelDesempenoConfig[];
  allowNegative: boolean;
  /** Los colaboradores marcados en la tabla cuando se pidió el reporte. */
  selectedIds: ReadonlySet<string>;
}

/** La población que sobrevivió a los filtros, con la frase que la nombra. */
export interface CicloReportScope {
  rows: readonly PersonRow[];
  /** "Área: Tecnología · nivel Excelente", o null sin filtros. */
  label: string | null;
}

// ── A quién cubre el reporte ────────────────────────────────────────────────

export interface CicloDemographic {
  key: CicloDemographicKey;
  label: string;
  /** Cómo se lee el valor de una persona para este corte. */
  valueOf: (row: PersonRow) => string;
}

const SIN_DATO = "Sin dato";

export const CICLO_DEMOGRAPHICS: readonly CicloDemographic[] = [
  { key: "grupo", label: "Grupo del ciclo", valueOf: (row) => row.groupLabel },
  { key: "area", label: "Área", valueOf: (row) => row.person.collaborator.area },
  {
    key: "leader",
    label: "Líder directo",
    valueOf: (row) => row.person.collaborator.leader ?? "Sin líder asignado",
  },
  { key: "country", label: "País", valueOf: (row) => row.person.collaborator.country },
  { key: "age", label: "Rango de edad", valueOf: (row) => row.person.collaborator.age },
  { key: "gender", label: "Género", valueOf: (row) => row.person.collaborator.gender },
  {
    key: "customGroup",
    label: "Grupo personalizado",
    valueOf: (row) => row.person.collaborator.customGroup ?? SIN_DATO,
  },
];

export const demographicFor = (key: CicloDemographicKey): CicloDemographic =>
  CICLO_DEMOGRAPHICS.find((candidate) => candidate.key === key) ?? CICLO_DEMOGRAPHICS[0];

/** Los valores que ese corte tiene de verdad en el ciclo, en orden alfabético. */
export const demographicValues = (
  rows: readonly PersonRow[],
  key: CicloDemographicKey
): readonly string[] => {
  const demographic = demographicFor(key);
  return [...new Set(rows.map((row) => demographic.valueOf(row)))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
};

/**
 * Recorta la población del reporte.
 *
 * Primero la audiencia —quiénes— y después los filtros de estado y nivel
 * —cuáles de ellos—. En ese orden: los filtros afinan la audiencia elegida,
 * nunca la amplían, así que un reporte nunca puede traer a alguien que no
 * estaba en el corte.
 *
 * Una audiencia vacía significa "todo el ciclo", no "nadie": es el estado en
 * que abre el drawer, y ahí lo que se espera es el reporte completo.
 */
export function scopeFor(source: CicloReportSource, request: CicloReportRequest): CicloReportScope {
  const { audience } = request;
  const estadoFilter = new Set(request.estadoFilter);
  const nivelFilter = new Set(request.nivelFilter);
  const chosen = audience.mode === "individual" ? new Set(audience.personIds) : null;
  const demographic = audience.mode === "masivo" ? demographicFor(audience.key) : null;
  const values = audience.mode === "masivo" ? new Set(audience.values) : null;

  const rows = source.rows.filter((row) => {
    if (chosen !== null && chosen.size > 0 && !chosen.has(row.person.id)) return false;
    if (
      demographic !== null &&
      values !== null &&
      values.size > 0 &&
      !values.has(demographic.valueOf(row))
    ) {
      return false;
    }
    if (estadoFilter.size > 0 && !estadoFilter.has(row.estado?.id ?? "")) return false;
    if (nivelFilter.size > 0 && !nivelFilter.has(row.nivel?.id ?? "")) return false;
    return true;
  });

  const parts: string[] = [];
  if (audience.mode === "individual" && audience.personIds.length > 0) {
    parts.push(
      audience.personIds.length === 1
        ? "1 colaborador elegido"
        : `${audience.personIds.length} colaboradores elegidos`
    );
  }
  if (audience.mode === "masivo" && audience.values.length > 0) {
    parts.push(`${demographicFor(audience.key).label}: ${audience.values.join(", ")}`);
  }
  if (request.estadoFilter.length > 0) {
    parts.push(
      `estado ${request.estadoFilter
        .map((id) => source.estados.find((estado) => estado.id === id)?.nombre ?? id)
        .join(", ")}`
    );
  }
  if (request.nivelFilter.length > 0) {
    parts.push(
      `nivel ${request.nivelFilter
        .map((id) => source.niveles.find((nivel) => nivel.id === id)?.nombre ?? id)
        .join(", ")}`
    );
  }

  return { rows, label: parts.length > 0 ? parts.join(" · ") : null };
}

/** Las personas del ciclo como opciones de un selector: id y nombre con su área. */
export const personOptions = (
  rows: readonly PersonRow[]
): readonly { id: string; label: string }[] =>
  [...rows]
    .sort((a, b) => a.person.collaborator.name.localeCompare(b.person.collaborator.name, "es"))
    .map((row) => ({
      id: row.person.id,
      label: `${row.person.collaborator.name} · ${row.person.collaborator.area}`,
    }));

// ── Detalle: una fila por objetivo de cada persona ──────────────────────────

/**
 * Una fila del detalle, con las mismas trece columnas que produce el módulo
 * hoy. Los números viajan crudos —sin separador de miles, con punto decimal—
 * porque una celda de CSV es para calcular, no para leer.
 */
export interface ObjectiveDetailRow {
  username: string;
  fullName: string;
  objectiveTitle: string;
  description: string;
  weight: number;
  target: number | null;
  initial: number | null;
  current: number | null;
  min: number | null;
  max: number | null;
  percent: number;
  /** ISO `yyyy-mm-dd`: el ciclo no guarda fecha por objetivo, así que es la suya. */
  createdAt: string;
  /** El día en que el avance llegó al 100 %, o vacío si todavía no llegó. */
  finishedAt: string;
}

/**
 * El día en que un objetivo se cumplió: la primera actualización cuyo valor
 * alcanzó el 100 %.
 *
 * Se busca en el historial y no en el valor actual porque un objetivo que
 * llegó a la meta y después bajó igual tuvo una fecha de cumplimiento, y un
 * reporte que la borra deja el logro sin registro.
 */
function finishedDate(
  tracked: TrackedObjective,
  allowNegative: boolean
): string {
  for (const update of [...tracked.updates].sort((a, b) => a.date.localeCompare(b.date))) {
    if (update.value === null) continue;
    // Un valor que todavía no es un número —o un objetivo sin meta— no dice
    // nada sobre cumplimiento: se salta en vez de contarse como 0 %.
    const compliance = complianceForValue(tracked.objective, update.value, allowNegative);
    if (compliance !== null && compliance >= 100) return update.date.slice(0, 10);
  }
  return "";
}

export function objectiveDetailRows(
  source: CicloReportSource,
  scope: CicloReportScope
): readonly ObjectiveDetailRow[] {
  const { allowNegative, data } = source;
  return scope.rows.flatMap((row) =>
    row.person.objectives.map((tracked) => {
      const objective = tracked.objective;
      // Un objetivo de "se cumple / no se cumple" no tiene cifras que parsear,
      // y dejar sus tres columnas en blanco borra del archivo justo lo que se
      // quería saber. Viaja como 1 y 0 —la columna es numérica— y su
      // porcentaje ya dice lo mismo en la que sigue.
      const isBoolean = objective.measure === "boolean";
      const booleanValue = (raw: string): number | null =>
        raw === "true" ? 1 : raw === "false" ? 0 : null;

      return {
        username: row.person.collaborator.email,
        fullName: row.person.collaborator.name,
        objectiveTitle: objective.title,
        description: objective.description,
        weight: objective.weight,
        target: isBoolean ? 1 : parseAmount(objective.targetValue),
        initial: isBoolean ? 0 : parseAmount(objective.initialValue),
        current: isBoolean ? booleanValue(tracked.currentValue) : parseAmount(tracked.currentValue),
        min: objective.rangeEnabled ? parseAmount(objective.minValue) : null,
        max: objective.rangeEnabled ? parseAmount(objective.maxValue) : null,
        percent: objectiveCompliance(tracked, allowNegative),
        createdAt: data.startDate,
        finishedAt: finishedDate(tracked, allowNegative),
      };
    })
  );
}

// ── Progreso y estado: una fila por persona ─────────────────────────────────

export interface PersonProgressRow {
  userId: string;
  username: string;
  fullName: string;
  area: string;
  leader: string;
  groupLabel: string;
  objectiveCount: number;
  reportedCount: number;
  achievedCount: number;
  percent: number;
  estado: string;
  nivel: string;
  /** ISO con hora de la última actualización, o vacío si nunca reportó. */
  lastUpdate: string;
  lastUpdateAuthor: string;
}

export function personProgressRows(
  source: CicloReportSource,
  scope: CicloReportScope
): readonly PersonProgressRow[] {
  const { allowNegative } = source;
  return scope.rows.map((row) => ({
    userId: row.person.collaborator.id,
    username: row.person.collaborator.email,
    fullName: row.person.collaborator.name,
    area: row.person.collaborator.area,
    leader: row.person.collaborator.leader ?? "",
    groupLabel: row.groupLabel,
    objectiveCount: row.person.objectives.length,
    reportedCount: row.reportedCount,
    achievedCount: row.person.objectives.filter(
      (tracked) => objectiveCompliance(tracked, allowNegative) >= 100
    ).length,
    percent: row.percent,
    estado: row.estado?.nombre ?? "",
    nivel: row.nivel?.nombre ?? "",
    lastUpdate: row.lastUpdate?.date ?? "",
    lastUpdateAuthor: row.lastUpdate?.authorName ?? "",
  }));
}

// ── La carta individual ─────────────────────────────────────────────────────

export interface IndividualObjectiveLine {
  objective: Objective;
  /** El valor reportado tal como se escribió, o vacío si nadie reportó. */
  currentValue: string;
  percent: number;
  /**
   * En qué punto del flujo está este objetivo: por aprobar, por ajustar, por
   * iniciar, en progreso o completado. No es la banda de cumplimiento de
   * "Estados de los objetivos" —esa depende del porcentaje alcanzado— sino la
   * misma máquina de estados de la vista de seguimiento, para que la carta y
   * la pantalla nunca discrepen.
   */
  lifecycle: ObjectiveLifecycle;
}

export interface IndividualLetter {
  person: TrackedPerson;
  groupLabel: string;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  nivel: NivelDesempenoConfig | null;
  objectives: readonly IndividualObjectiveLine[];
}

/** Una carta por persona de la población, en el orden en que las trae la tabla. */
export function individualLetters(
  source: CicloReportSource,
  scope: CicloReportScope
): readonly IndividualLetter[] {
  const { allowNegative } = source;

  return scope.rows.map((row) => ({
    person: row.person,
    groupLabel: row.groupLabel,
    percent: row.percent,
    estado: row.estado,
    nivel: row.nivel,
    objectives: row.person.objectives.map((tracked) => {
      const percent = objectiveCompliance(tracked, allowNegative);
      return {
        objective: tracked.objective,
        currentValue: tracked.currentValue,
        percent,
        lifecycle: lifecycleOf(tracked, percent, hasReportedProgress(tracked)),
      };
    }),
  }));
}

// ── Formato compartido ──────────────────────────────────────────────────────

const NUMBER = new Intl.NumberFormat("es-CO");
const DECIMAL = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const count = (value: number): string => NUMBER.format(value);
export const percent = (value: number): string => `${DECIMAL.format(value)} %`;

/**
 * Un número para una celda de CSV: punto decimal, sin separador de miles y sin
 * decimales de relleno.
 *
 * `toFixed` acota la precisión pero no se queda: un avance de 106,1 impreso
 * como "106.10" sugiere una precisión de centésimas que el dato no tiene, así
 * que los ceros de la cola se caen.
 */
const trimZeros = (text: string): string =>
  text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;

export const csvNumber = (value: number | null, decimals = 2): string =>
  value === null ? "" : trimZeros(value.toFixed(decimals));

export const csvPercent = (value: number): string => trimZeros((Math.round(value * 100) / 100).toFixed(2));
