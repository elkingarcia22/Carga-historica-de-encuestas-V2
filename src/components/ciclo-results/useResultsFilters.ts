/**
 * Los filtros de la vista de resultados, en un solo estado.
 *
 * Viven arriba de las pestañas, no dentro de cada una: pasar de "el área
 * Comercial en el resumen" a "el área Comercial en el árbol" es un solo
 * pensamiento, y tener que volver a elegirla al cambiar de pestaña lo rompe.
 * Es la misma decisión que toma el reporte de encuestas con su segmento.
 *
 * De aquí sale también el gesto que la referencia no tiene: cada tramo de cada
 * distribución del resumen es un filtro. Un donut que no se puede pulsar es
 * decoración.
 */

import * as React from "react";
import type { MeasureType } from "@/components/ciclo-builder";
import type { ObjectiveLifecycle } from "./objectiveLifecycle";
import type { CicloResults, PersonResultRow, ResultEntry, RiskLevel } from "./resultsModel";

export interface ResultsFilters {
  areas: ReadonlySet<string>;
  leaders: ReadonlySet<string>;
  groups: ReadonlySet<string>;
  lifecycles: ReadonlySet<ObjectiveLifecycle>;
  niveles: ReadonlySet<string>;
  estadosParticipante: ReadonlySet<string>;
  risks: ReadonlySet<RiskLevel>;
  measures: ReadonlySet<MeasureType>;
  search: string;
}

export type FilterKey = Exclude<keyof ResultsFilters, "search">;

export const NO_RESULTS_FILTERS: ResultsFilters = {
  areas: new Set(),
  leaders: new Set(),
  groups: new Set(),
  lifecycles: new Set(),
  niveles: new Set(),
  estadosParticipante: new Set(),
  risks: new Set(),
  measures: new Set(),
  search: "",
};

export const FILTER_LABELS: Readonly<Record<FilterKey, string>> = {
  areas: "Área",
  leaders: "Líder",
  groups: "Grupo",
  lifecycles: "Estado del objetivo",
  niveles: "Nivel de desempeño",
  estadosParticipante: "Estado del participante",
  risks: "Riesgo",
  measures: "Tipo de medida",
};

const FILTER_KEYS = Object.keys(FILTER_LABELS) as FilterKey[];

export const countActiveFilters = (filters: ResultsFilters): number =>
  FILTER_KEYS.reduce((sum, key) => sum + (filters[key] as ReadonlySet<string>).size, 0) +
  (filters.search.trim() === "" ? 0 : 1);

/** Añade o quita un valor de un filtro. Copia siempre, nunca muta. */
function toggleIn<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export interface ResultsFiltersState {
  filters: ResultsFilters;
  activeCount: number;
  toggle: (key: FilterKey, value: string) => void;
  setSearch: (value: string) => void;
  clearKey: (key: FilterKey) => void;
  clearAll: () => void;
  isOn: (key: FilterKey, value: string) => boolean;
}

export function useResultsFilters(): ResultsFiltersState {
  const [filters, setFilters] = React.useState<ResultsFilters>(NO_RESULTS_FILTERS);

  const toggle = React.useCallback((key: FilterKey, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: toggleIn(current[key] as ReadonlySet<string>, value),
    }));
  }, []);

  const setSearch = React.useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const clearKey = React.useCallback((key: FilterKey) => {
    setFilters((current) => ({ ...current, [key]: new Set() }));
  }, []);

  const clearAll = React.useCallback(() => setFilters(NO_RESULTS_FILTERS), []);

  const isOn = React.useCallback(
    (key: FilterKey, value: string) => (filters[key] as ReadonlySet<string>).has(value),
    [filters]
  );

  return {
    filters,
    activeCount: countActiveFilters(filters),
    toggle,
    setSearch,
    clearKey,
    clearAll,
    isOn,
  };
}

/** Un set vacío no filtra nada: es "todos", no "ninguno". */
const passes = <T,>(set: ReadonlySet<T>, value: T): boolean => set.size === 0 || set.has(value);

const matchesSearch = (row: PersonResultRow, term: string): boolean => {
  if (term === "") return true;
  const haystack = [
    row.collaborator.name,
    row.collaborator.area,
    row.collaborator.leader ?? "",
    row.groupLabel,
    ...row.entries.map((entry) => entry.objective.title),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
};

export interface FilteredResults {
  rows: readonly PersonResultRow[];
  entries: readonly ResultEntry[];
  /** Los filtros dejaron algo fuera. */
  isNarrowed: boolean;
}

/**
 * Aplica los filtros. Las personas se filtran por lo que las describe a ellas
 * y los objetivos por lo que los describe a ellos, así que una persona puede
 * quedar en pie con solo parte de sus objetivos — que es lo correcto: filtrar
 * "objetivos por aprobar" no debería esconder a quien tiene uno aprobado y
 * otro pendiente, debería mostrar solo el pendiente.
 */
export function filterResults(
  results: CicloResults,
  filters: ResultsFilters
): FilteredResults {
  const term = filters.search.trim().toLowerCase();

  const rows = results.rows.filter(
    (row) =>
      passes(filters.areas, row.area) &&
      passes(filters.leaders, row.leader) &&
      passes(filters.groups, row.groupLabel) &&
      passes(filters.niveles, row.nivel?.id ?? "") &&
      passes(filters.estadosParticipante, row.estadoParticipante?.id ?? "") &&
      passes(filters.risks, row.risk) &&
      matchesSearch(row, term)
  );

  const keptIds = new Set(rows.map((row) => row.person.id));
  const entries = results.entries.filter(
    (entry) =>
      keptIds.has(entry.personId) &&
      passes(filters.lifecycles, entry.lifecycle) &&
      passes(filters.measures, (entry.objective.measure ?? "numeric") as MeasureType)
  );

  const survivingIds = new Set(entries.map((entry) => entry.personId));

  return {
    rows: rows.filter((row) => survivingIds.has(row.person.id)),
    entries,
    isNarrowed:
      rows.length !== results.rows.length || entries.length !== results.entries.length,
  };
}
