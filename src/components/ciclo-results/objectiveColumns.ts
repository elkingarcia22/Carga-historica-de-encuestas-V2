/**
 * Los filtros de columna de la tabla de objetivos de una persona.
 *
 * Mismo gesto que la tabla de colaboradores y que la lista de ciclos del home:
 * cada encabezado ordena y, al lado, un embudo recorta esa columna. Aquí no
 * hay filtros globales detrás —esta tabla vive dentro de la ficha de alguien y
 * no la comparte con nadie—, así que las cuatro columnas filtrables guardan su
 * estado en el mismo sitio.
 *
 * "Empuja a" y "Estado" filtran por valores sueltos porque lo son —un objetivo
 * de la empresa, una banda configurada—; "Avance" y "Última actividad" filtran
 * por tramos, porque "¿cuáles van por debajo de la mitad?" es una pregunta
 * real y "¿cuál va en 63 %?" no lo es.
 */

import type { ResultEntry } from "./resultsModel";

/** Cómo se llama en la tabla un objetivo que no apunta a la estrategia. */
export const SIN_OBJETIVO_EMPRESA = "Sin objetivo de empresa";

/** Cómo se llama en el embudo de "Estado" un objetivo fuera de juego. */
export const ESTADO_INACTIVO = "Inactivo";

/** Tramos de la columna "Avance". Los mismos cortes que usa el home. */
export const AVANCE_BUCKETS = ["Menos de 50 %", "50 % a 79 %", "80 % o más"] as const;

/**
 * Qué fue lo último que pasó en el objetivo.
 *
 * Un avance reportado y un comentario son dos cosas distintas y se leen
 * distinto: uno mueve el número, el otro mueve la conversación. Un objetivo
 * que solo tiene preguntas del líder encima lleva un mes sin avanzar aunque su
 * hilo esté lleno, y esta columna es la que lo dice.
 */
export const ACTIVIDAD_BUCKETS = ["Actualización", "Comentario", "Sin actividad"] as const;

export type AvanceBucket = (typeof AVANCE_BUCKETS)[number];
export type ActividadBucket = (typeof ACTIVIDAD_BUCKETS)[number];

/** Las columnas que esta tabla filtra por su cuenta. */
export interface ObjectiveColumnFilters {
  empuja: ReadonlySet<string>;
  estado: ReadonlySet<string>;
  avance: ReadonlySet<string>;
  actividad: ReadonlySet<string>;
}

export type ObjectiveColumnKey = keyof ObjectiveColumnFilters;

export const NO_OBJECTIVE_FILTERS: ObjectiveColumnFilters = {
  empuja: new Set(),
  estado: new Set(),
  avance: new Set(),
  actividad: new Set(),
};

export function avanceBucketOf(entry: ResultEntry): AvanceBucket {
  if (entry.percent < 50) return "Menos de 50 %";
  return entry.percent < 80 ? "50 % a 79 %" : "80 % o más";
}

export function actividadBucketOf(entry: ResultEntry): ActividadBucket {
  const last = lastActivityOf(entry);
  if (!last) return "Sin actividad";
  return last.value === null ? "Comentario" : "Actualización";
}

/**
 * El último mensaje del hilo, sea del tipo que sea.
 *
 * `entry.lastUpdate` solo mira los que traen valor —es el que sostiene el
 * avance—, y esta columna habla de actividad: una pregunta del líder de ayer
 * es lo último que pasó aquí aunque el número lleve un mes quieto.
 */
export function lastActivityOf(entry: ResultEntry) {
  return entry.tracked.updates.reduce<(typeof entry.tracked.updates)[number] | null>(
    (latest, update) => (latest === null || update.date > latest.date ? update : latest),
    null
  );
}

/** A qué objetivo de la empresa empuja, tal como lo lista el embudo. */
export function empujaLabelOf(
  entry: ResultEntry,
  companyTitleById: ReadonlyMap<string, string>
): string {
  const target = entry.objective.alignedTo;
  if (!target) return SIN_OBJETIVO_EMPRESA;
  return companyTitleById.get(target) ?? SIN_OBJETIVO_EMPRESA;
}

/** En qué banda está, o "Inactivo" cuando quedó fuera del ponderado. */
export function estadoLabelOf(entry: ResultEntry): string {
  if (entry.inactivation) return ESTADO_INACTIVO;
  return entry.estado?.nombre ?? "Sin estado";
}

/** Un conjunto vacío no recorta nada: es "todos", no "ninguno". */
const passes = (set: ReadonlySet<string>, value: string): boolean =>
  set.size === 0 || set.has(value);

export function matchesObjectiveFilters(
  entry: ResultEntry,
  filters: ObjectiveColumnFilters,
  companyTitleById: ReadonlyMap<string, string>
): boolean {
  return (
    passes(filters.empuja, empujaLabelOf(entry, companyTitleById)) &&
    passes(filters.estado, estadoLabelOf(entry)) &&
    passes(filters.avance, avanceBucketOf(entry)) &&
    passes(filters.actividad, actividadBucketOf(entry))
  );
}

export function toggleObjectiveFilter(
  filters: ObjectiveColumnFilters,
  column: ObjectiveColumnKey,
  value: string
): ObjectiveColumnFilters {
  const next = new Set(filters[column]);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return { ...filters, [column]: next };
}

export const clearObjectiveFilter = (
  filters: ObjectiveColumnFilters,
  column: ObjectiveColumnKey
): ObjectiveColumnFilters => ({ ...filters, [column]: new Set<string>() });

export const countObjectiveFilters = (filters: ObjectiveColumnFilters): number =>
  Object.values(filters).reduce((sum, set) => sum + set.size, 0);
