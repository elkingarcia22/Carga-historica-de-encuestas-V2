/**
 * Los filtros de columna de la tabla de colaboradores.
 *
 * La tabla de ciclos del home ya resolvió el gesto: cada encabezado ordena y,
 * al lado, un embudo recorta esa columna a los valores que interesan. Aquí se
 * repite el mismo gesto con `FilterSortHeader`, no una segunda forma de
 * filtrar una tabla.
 *
 * Lo que sí cambia es de dónde sale el estado. Líder, asignación y nivel de
 * cumplimiento ya son filtros de la vista entera —viven en `useResultsFilters`
 * y se pintan como fichas—, así que el embudo de esas columnas mueve ese mismo
 * estado en vez de abrir un segundo recorte paralelo que discreparía con las
 * fichas. Solo lo que nadie más filtra —cuántos objetivos lleva, en qué tramo
 * de avance va, hace cuánto reportó, en qué estado está como participante—
 * vive aquí, y por eso son tramos y no valores sueltos: "¿quién va por debajo
 * de la mitad?" es una pregunta real y "¿quién va en 63 %?" no lo es.
 */

import type { PersonResultRow } from "./resultsModel";

/** Tramos de la columna "Objetivos", en orden de menú. */
export const OBJETIVOS_BUCKETS = ["Sin objetivos", "1 a 3", "4 a 6", "7 o más"] as const;

/** Tramos de la columna "Avance". Los mismos cortes que usa el home. */
export const AVANCE_BUCKETS = ["Menos de 50 %", "50 % a 79 %", "80 % o más"] as const;

/** Tramos de la columna "Última actualización". */
export const ACTUALIZACION_BUCKETS = [
  "Sin reportes",
  "En los últimos 7 días",
  "Hace más de 7 días",
] as const;

/** Cuántos días atrás sigue contando como reporte reciente. */
export const RECENT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ObjetivosBucket = (typeof OBJETIVOS_BUCKETS)[number];
export type AvanceBucket = (typeof AVANCE_BUCKETS)[number];
export type ActualizacionBucket = (typeof ACTUALIZACION_BUCKETS)[number];

/** Las columnas que filtra la tabla por su cuenta. */
export interface ColumnFilters {
  objetivos: ReadonlySet<string>;
  avance: ReadonlySet<string>;
  actualizacion: ReadonlySet<string>;
}

export type ColumnFilterKey = keyof ColumnFilters;

export const NO_COLUMN_FILTERS: ColumnFilters = {
  objetivos: new Set(),
  avance: new Set(),
  actualizacion: new Set(),
};

export function objetivosBucketOf(row: PersonResultRow): ObjetivosBucket {
  const count = row.entries.length;
  if (count === 0) return "Sin objetivos";
  if (count <= 3) return "1 a 3";
  if (count <= 6) return "4 a 6";
  return "7 o más";
}

export function avanceBucketOf(row: PersonResultRow): AvanceBucket {
  if (row.percent < 50) return "Menos de 50 %";
  return row.percent < 80 ? "50 % a 79 %" : "80 % o más";
}

export function actualizacionBucketOf(row: PersonResultRow, now: Date): ActualizacionBucket {
  if (!row.lastUpdate) return "Sin reportes";
  const days = (now.getTime() - new Date(row.lastUpdate.date).getTime()) / DAY_MS;
  return days <= RECENT_DAYS ? "En los últimos 7 días" : "Hace más de 7 días";
}

/** Un conjunto vacío no recorta nada: es "todos", no "ninguno". */
const passes = (set: ReadonlySet<string>, value: string): boolean =>
  set.size === 0 || set.has(value);

export function matchesColumnFilters(
  row: PersonResultRow,
  filters: ColumnFilters,
  now: Date
): boolean {
  return (
    passes(filters.objetivos, objetivosBucketOf(row)) &&
    passes(filters.avance, avanceBucketOf(row)) &&
    passes(filters.actualizacion, actualizacionBucketOf(row, now))
  );
}

export const countColumnFilters = (filters: ColumnFilters): number =>
  (Object.keys(NO_COLUMN_FILTERS) as ColumnFilterKey[]).reduce(
    (sum, key) => sum + filters[key].size,
    0
  );

/** Añade o quita un valor de una columna, sin tocar las demás. Copia siempre. */
export function toggleColumnFilter(
  filters: ColumnFilters,
  column: ColumnFilterKey,
  value: string
): ColumnFilters {
  const next = new Set(filters[column]);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return { ...filters, [column]: next };
}

export const clearColumnFilter = (
  filters: ColumnFilters,
  column: ColumnFilterKey
): ColumnFilters => ({ ...filters, [column]: new Set() });
