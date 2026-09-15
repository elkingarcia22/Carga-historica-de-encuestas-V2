/**
 * El borrador con el que se reabre un ciclo que ya existe.
 *
 * Editar un ciclo en curso no es empezar uno nuevo: la gente ya está dentro,
 * los objetivos ya están escritos y el reparto de pesos ya está cerrado. El
 * constructor tiene que abrir con todo eso puesto, así que este archivo lee
 * la configuración del mismo ciclo que muestra la vista de resultados
 * (`buildCicloSetup`) y la traduce a la forma que el constructor edita
 * (`CicloDraft`).
 *
 * Leer de ahí y no de otra fuente es lo que evita el problema de fondo: si el
 * constructor inventara su propia versión del ciclo, editar y mirar
 * resultados enseñarían dos ciclos distintos con el mismo nombre.
 */

import { buildCicloSetup } from "@/components/ciclo-detail";
import { DEFAULT_PARTICIPANTS } from "@/components/survey-builder";
import { groupMemberIds } from "@/components/survey-builder/participants";
import {
  OBJECTIVE_MODEL_PRESETS,
  DEFAULT_CICLO_RESULTS_POLICY,
  type CicloDraft,
  type ObjectiveSet,
} from "@/components/ciclo-builder";
import type { CicloRow } from "@/mocks/ciclos";
import { createBlankCicloDraft } from "./CicloBuilder";

const unique = (values: readonly string[]): readonly string[] => [...new Set(values)];

/**
 * Saca de los repartos por grupo a quien además lleva objetivos propios.
 *
 * Sin esto el constructor vería a esas personas con dos asignaciones enteras
 * encima —el 100 % de su grupo y el 100 % suyo— y abriría el conflicto de
 * pesos nada más entrar, por un choque que el ciclo real no tiene: en el
 * seguimiento esas personas solo cargan sus objetivos individuales.
 */
function withoutIndividuallyAssigned(
  sets: readonly ObjectiveSet[],
  segmentBy: CicloDraft["assignment"]["groupSegmentBy"]
): readonly ObjectiveSet[] {
  const individualIds = new Set(
    sets.filter((set) => set.kind !== "grupal").flatMap((set) => set.targetIds)
  );
  if (individualIds.size === 0) return sets;

  return sets.map((set) => {
    if (set.kind !== "grupal") return set;
    const members = groupMemberIds(segmentBy, set.targetIds);
    const excluded = [...individualIds].filter((id) => members.has(id));
    if (excluded.length === 0) return set;
    return { ...set, excludedIds: unique([...(set.excludedIds ?? []), ...excluded]) };
  });
}

/**
 * El ciclo de una fila de la lista, tal como el constructor lo edita.
 *
 * Un ciclo que nació en esta sesión ya trae su borrador literal (`_draft`) y
 * se devuelve tal cual: es el que su autor escribió, no una reconstrucción.
 */
export function cicloRowToDraft(row: CicloRow): CicloDraft {
  if (row._draft) return row._draft;

  const setup = buildCicloSetup(row);
  const sets = withoutIndividuallyAssigned(setup.sets, setup.segmentBy);
  const groupSets = sets.filter((set) => set.kind === "grupal");
  const individualSets = sets.filter((set) => set.kind === "individual");
  // Los sets grupales apuntan a valores del segmento (áreas, grupos), los
  // individuales a ids de personas: son las dos mitades de la audiencia.
  const selectedGroups = unique(groupSets.flatMap((set) => set.targetIds));
  const selectedIds = unique(individualSets.flatMap((set) => set.targetIds));

  return {
    ...createBlankCicloDraft(),
    name: row.nombre,
    status: setup.status,
    period: setup.period,
    startDate: setup.startDate,
    endDate: setup.endDate,
    description: setup.description,
    // Un ciclo que ya corre se escribió con el constructor de siempre: métrica
    // propia, acciones clave opcionales y alineación opcional. Eso es SMART,
    // y es el único preset bajo el que sus objetivos ya están completos.
    objectiveModel: "smart",
    modelRules: OBJECTIVE_MODEL_PRESETS.smart,
    // Mixto, aunque el reparto sea de un solo tipo: es el único gobierno —con
    // RH— que conserva el paso de objetivos asignados, y un ciclo que ya
    // reparte metas no puede reabrirse por un camino donde ese paso no existe.
    objectiveCreator: "custom",
    participants: {
      ...DEFAULT_PARTICIPANTS,
      mode: groupSets.length > 0 ? "groups" : "individual",
      groupSegmentBy: setup.segmentBy,
      selectedGroups,
      selectedIds,
    },
    useCompanyObjectives: setup.companyObjectives.length > 0,
    companyObjectives: setup.companyObjectives,
    useGroupObjectives: groupSets.length > 0,
    useIndividualObjectives: individualSets.length > 0,
    assignment: { groupSegmentBy: setup.segmentBy, groupsAutoInclude: true },
    resultsPolicy: DEFAULT_CICLO_RESULTS_POLICY,
    objectiveSets: sets,
    // Un ciclo terminado no se "retoma" en el paso donde alguien lo dejó: se
    // abre por el principio, que es desde donde se revisa lo que ya está —y
    // con el primer bloque de la parametrización desplegado, no en blanco.
    _lastStep: "general",
    _lastSetupBlock: "identity",
    _id: row.id,
  };
}
