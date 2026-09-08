import type { Collaborator } from "@/mocks/collaborators";
import { buildCicloResults, type CicloResults, type ResultsConfig } from "./resultsModel";
import type { FilteredResults, ResultsFilters } from "./useResultsFilters";

/**
 * El mismo agregado, calculado solo sobre lo que dejaron los filtros.
 *
 * El resumen se leía sobre el ciclo entero pasara lo que pasara: se podía
 * poner "País: Colombia" y las once tarjetas seguían mostrando los mismos
 * 1.930 objetivos. Un filtro que no cambia lo que se está mirando no es un
 * filtro, es una decoración —el mismo pecado que un donut que no se puede
 * pulsar—, y "ver Comercial en específico" es justo lo que se le pide a esta
 * pantalla.
 *
 * En vez de volver a tallar cada cuenta a mano —doce mapas que se
 * desincronizarían con el primer cambio en `buildCicloResults`— se recorta el
 * ciclo y se vuelve a agregar con la misma función. Una sola fórmula para cada
 * número, se mire filtrado o completo.
 */

/** Lo que describe a la persona, no a sus objetivos. Es lo que decide si
 *  alguien sigue contando como participante del ciclo aunque ya no se esté
 *  mirando ninguno de sus objetivos. */
function passesDemographics(collaborator: Collaborator, filters: ResultsFilters): boolean {
  const passes = (set: ReadonlySet<string>, value: string) => set.size === 0 || set.has(value);
  return (
    passes(filters.areas, collaborator.area) &&
    passes(filters.leaders, collaborator.leader ?? "") &&
    passes(filters.countries, collaborator.country) &&
    passes(filters.ages, collaborator.age) &&
    passes(filters.genders, collaborator.gender) &&
    passes(filters.customGroups, collaborator.customGroup ?? "")
  );
}

export function narrowResults(
  base: CicloResults,
  filtered: FilteredResults,
  filters: ResultsFilters,
  config: ResultsConfig,
  now?: Date
): CicloResults {
  if (!filtered.isNarrowed) return base;

  const keptPeople = new Set(filtered.rows.map((row) => row.person.id));
  const keptObjectives = new Set(
    filtered.entries.map((entry) => `${entry.personId}::${entry.objective.id}`)
  );

  const people = base.data.people
    .filter((person) => keptPeople.has(person.id))
    .map((person) => ({
      ...person,
      objectives: person.objectives.filter((tracked) =>
        keptObjectives.has(`${person.id}::${tracked.objective.id}`)
      ),
    }));

  const narrowed = buildCicloResults({ ...base.data, people }, config, now);

  return {
    ...narrowed,
    /*
     * "Sin objetivos" se calcula por descarte —quien está en un grupo del
     * ciclo y no aparece entre sus participantes— así que recortar la lista de
     * participantes convertiría en "sin objetivos" a todo el que el filtro
     * acaba de esconder. Se toma la del ciclo completo y se le aplica solo el
     * corte demográfico, que es el único que de verdad habla de esa gente:
     * no tienen objetivos, así que ningún filtro de objetivo puede opinar.
     */
    withoutObjectives: base.withoutObjectives.filter((collaborator) =>
      passesDemographics(collaborator, filters)
    ),
  };
}
