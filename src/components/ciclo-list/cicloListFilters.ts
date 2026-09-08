/**
 * The ciclo list's column filters, and the rules that apply them.
 *
 * Shared rather than private to the table because the home alert buttons are
 * shortcuts *to these filters*: a button's number is `rows.filter(matchesFilters)`
 * over the very same predicate the table runs, so the count on the button and
 * the rows its click reveals cannot disagree.
 */

import { parseSpanishDate } from "@/components/ciclo-detail";

export interface CicloFilterableRow {
  periodo: string;
  estado: string;
  /** "24 agosto 2026" — the same long form the table prints. */
  fechaInicio: string;
  fechaCierre: string;
  /** Avance of the ciclo, 0–100 (a ciclo can overshoot; the top bucket keeps it). */
  progreso: number;
}

/** The estado a launched-but-unfinished ciclo carries in the list. */
export const OPEN_ESTADO = "En curso";
export const CLOSED_ESTADO = "Finalizado";
export const PENDING_ESTADO = "Por iniciar";

/** Buckets offered by the "Fecha cierre" column, in menu order. */
export const CLOSE_BUCKETS = [
  "Cierra en 7 días o menos",
  "Cierra en más de 7 días",
  "Ya cerró",
] as const;

/** Buckets offered by the "% Avance" column, in menu order. */
export const PROGRESS_BUCKETS = ["Menos de 50%", "50% a 79%", "80% o más"] as const;

/**
 * The avance a running ciclo is expected to reach. Same line the "% Avance"
 * column draws between "50% a 79%" and "80% o más".
 */
export const PROGRESS_TARGET = 80;

export type CloseBucket = (typeof CLOSE_BUCKETS)[number];
export type ProgressBucket = (typeof PROGRESS_BUCKETS)[number];

/** How near the close counts as "7 días o menos". */
export const CLOSING_SOON_DAYS = 7;

export interface CicloListFilters {
  periodo: readonly string[];
  estado: readonly string[];
  close: readonly string[];
  progress: readonly string[];
}

export const NO_FILTERS: CicloListFilters = {
  periodo: [],
  estado: [],
  close: [],
  progress: [],
};

/** Days from `today` to a long Spanish date ("24 agosto 2026"). */
export function daysUntil(raw: string, today: Date): number {
  const due = new Date(`${parseSpanishDate(raw)}T00:00:00`);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - midnight.getTime()) / 86_400_000);
}

export function closeBucketOf(row: CicloFilterableRow, today: Date): CloseBucket {
  const days = daysUntil(row.fechaCierre, today);
  if (days < 0) return "Ya cerró";
  return days <= CLOSING_SOON_DAYS ? "Cierra en 7 días o menos" : "Cierra en más de 7 días";
}

export function progressBucketOf(row: CicloFilterableRow): ProgressBucket {
  if (row.progreso < 50) return "Menos de 50%";
  return row.progreso < PROGRESS_TARGET ? "50% a 79%" : "80% o más";
}

/** An empty list for a column means "no narrowing on that column". */
export function matchesFilters(
  row: CicloFilterableRow,
  filters: CicloListFilters,
  today: Date
): boolean {
  if (filters.periodo.length > 0 && !filters.periodo.includes(row.periodo)) return false;
  if (filters.estado.length > 0 && !filters.estado.includes(row.estado)) return false;
  if (filters.close.length > 0 && !filters.close.includes(closeBucketOf(row, today))) return false;
  if (filters.progress.length > 0 && !filters.progress.includes(progressBucketOf(row))) return false;
  return true;
}

export const hasAnyFilter = (filters: CicloListFilters): boolean =>
  filters.periodo.length > 0 ||
  filters.estado.length > 0 ||
  filters.close.length > 0 ||
  filters.progress.length > 0;

const sameValues = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
};

/** Used by the alert buttons to tell whether they are the narrowing in force. */
export const filtersEqual = (a: CicloListFilters, b: CicloListFilters): boolean =>
  sameValues(a.periodo, b.periodo) &&
  sameValues(a.estado, b.estado) &&
  sameValues(a.close, b.close) &&
  sameValues(a.progress, b.progress);

/** Adds or removes one value from one column, leaving the others alone. */
export function toggleFilterValue(
  filters: CicloListFilters,
  column: keyof CicloListFilters,
  value: string
): CicloListFilters {
  const current = filters[column];
  return {
    ...filters,
    [column]: current.includes(value)
      ? current.filter((candidate) => candidate !== value)
      : [...current, value],
  };
}
