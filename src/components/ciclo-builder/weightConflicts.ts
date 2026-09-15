/**
 * Conflictos de peso vistos desde la persona, no desde la asignación.
 *
 * Una asignación cierra en su propio cupo, pero quien la recibe puede estar
 * en más de una: la persona que ya lleva objetivos individuales y además
 * entra en un grupo al que se le acaban de repartir objetivos suma dos veces.
 * El 100 % que importa al final del ciclo es el suyo, así que la cuenta hay
 * que hacerla por persona — y por eso vive aquí y no dentro de un componente:
 * el aviso del paso, el del drawer y el modal que lo arregla tienen que estar
 * mirando exactamente el mismo número.
 */

import { COLLABORATORS } from "@/mocks/collaborators";
import type { SegmentKey } from "@/components/survey-builder";
import {
  TOTAL_WEIGHT,
  totalWeight,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";
import { objectiveSetMemberIds, targetLabel } from "./objectiveSets";

const PERSON_BY_ID = new Map(COLLABORATORS.map((person) => [person.id, person]));

/** Una de las vías por las que a alguien le llegan objetivos. */
export interface LoadSource {
  setId: string;
  kind: ObjectiveSetKind;
  /** Por dónde le llega: el nombre del grupo, o "Objetivos individuales". */
  label: string;
  /** Cuánto pesa hoy esa vía para esta persona. */
  weight: number;
  objectiveCount: number;
  /** A cuánta gente más le cambiaría la vida tocar esta asignación. */
  sharedWith: number;
}

export interface PersonLoad {
  personId: string;
  name: string;
  area: string;
  /** La suma de todas sus vías. 100 es lo que debería dar. */
  total: number;
  sources: readonly LoadSource[];
}

/** Cuánto carga cada persona alcanzada por alguna asignación. */
export function personLoads(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey
): readonly PersonLoad[] {
  const byPerson = new Map<string, LoadSource[]>();

  sets.forEach((set) => {
    const weight = totalWeight(set.objectives);
    const members = objectiveSetMemberIds(set, segmentBy);
    members.forEach((personId) => {
      const source: LoadSource = {
        setId: set.id,
        kind: set.kind,
        label:
          set.kind === "grupal"
            ? set.targetIds.map((id) => targetLabel(set, id)).join(", ")
            : "Objetivos individuales",
        weight,
        objectiveCount: set.objectives.length,
        sharedWith: Math.max(0, members.size - 1),
      };
      const current = byPerson.get(personId);
      if (current) current.push(source);
      else byPerson.set(personId, [source]);
    });
  });

  return [...byPerson.entries()].map(([personId, sources]) => {
    const person = PERSON_BY_ID.get(personId);
    return {
      personId,
      name: person?.name ?? "Colaborador",
      area: person?.area ?? "Sin área",
      total: sources.reduce((sum, source) => sum + source.weight, 0),
      sources,
    };
  });
}

/**
 * Solo a quienes les llega por más de una vía y no cuadran en 100.
 *
 * Alguien con una sola asignación a medio repartir no sale aquí: eso ya lo
 * dice el estado de su propia asignación, y repetirlo como "conflicto" haría
 * pasar por choque entre dos cosas lo que es una sola sin terminar.
 */
export function conflictedLoads(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey
): readonly PersonLoad[] {
  return personLoads(sets, segmentBy)
    .filter((load) => load.sources.length > 1 && load.total !== TOTAL_WEIGHT)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * Las personas de estos destinatarios que ya cargan objetivos por otra vía.
 *
 * Es la pregunta que hace el drawer antes de guardar una asignación nueva:
 * "de la gente a la que le voy a poner esto, ¿quién ya tenía algo?". Se
 * responde ignorando la asignación que se está editando, porque su peso aún
 * no está decidido.
 */
export function loadsForTargets(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey,
  kind: ObjectiveSetKind,
  targetIds: readonly string[],
  options: { excludeSetId?: string } = {}
): readonly PersonLoad[] {
  if (targetIds.length === 0) return [];
  const reached = objectiveSetMemberIds(
    { id: "draft", kind, targetIds, objectives: [] },
    segmentBy
  );
  const others = sets.filter((set) => set.id !== options.excludeSetId);
  return personLoads(others, segmentBy)
    .filter((load) => reached.has(load.personId) && load.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * Las personas que están exactamente en el mismo enredo: les llegan objetivos
 * por las mismas asignaciones y con los mismos pesos.
 *
 * Existe porque el cupo pertenece a la asignación y no a la persona: cuando
 * 750 personas comparten las mismas dos vías, hay *un* reparto que decidir, no
 * 750. Listarlas de a una repetía el mismo par de campos cientos de veces y
 * mentía sobre lo que hacía editarlos —movían el cupo de todo el mundo—.
 */
export interface ConflictGroup {
  key: string;
  /** Las vías que comparten. Los pesos son los mismos para todas ellas. */
  sources: readonly LoadSource[];
  people: readonly PersonLoad[];
}

export function groupLoadsBySources(loads: readonly PersonLoad[]): readonly ConflictGroup[] {
  const groups = new Map<string, PersonLoad[]>();

  loads.forEach((load) => {
    const key = [...load.sources.map((source) => source.setId)].sort().join("|");
    const current = groups.get(key);
    if (current) current.push(load);
    else groups.set(key, [load]);
  });

  return [...groups.entries()].map(([key, people]) => ({
    key,
    sources: people[0].sources,
    people,
  }));
}

/** Los nombres de las asignaciones por las que ya les llegan objetivos. */
export function sourceLabels(loads: readonly PersonLoad[]): readonly string[] {
  const labels = new Set<string>();
  loads.forEach((load) => load.sources.forEach((source) => labels.add(source.label)));
  return [...labels];
}

/** El cupo que le queda libre a la persona más cargada del grupo destino. */
export function tightestFreeShare(loads: readonly PersonLoad[]): number {
  if (loads.length === 0) return TOTAL_WEIGHT;
  const worst = Math.max(...loads.map((load) => load.total));
  return Math.max(0, TOTAL_WEIGHT - worst);
}

/**
 * Cómo quedaría el reparto si se ajustara solo: el 100 % de cada persona
 * partido entre sus vías, en la misma proporción que tienen hoy.
 *
 * Una asignación puede alcanzar a varias personas con conflictos distintos,
 * así que de todas las propuestas que le tocan se queda con la más estricta —
 * la que deja a todos sus destinatarios dentro de 100 y no solo al primero.
 */
export function autoBalancedShares(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey
): ReadonlyMap<string, number> {
  const proposal = new Map<string, number>();

  conflictedLoads(sets, segmentBy).forEach((load) => {
    const shares = splitAcrossSources(load.sources);
    shares.forEach((share, setId) => {
      const previous = proposal.get(setId);
      proposal.set(setId, previous === undefined ? share : Math.min(previous, share));
    });
  });

  return proposal;
}

/**
 * Reparte los 100 puntos de una persona entre sus vías, proporcionalmente a
 * lo que pesan hoy.
 *
 * Una vía sin peso todavía —la asignación que se está creando ahora mismo—
 * no reclama cero: reclama lo que reclama una media de las que ya existen. Si
 * no fuera así, la propuesta automática le daría un 1 % a lo que el autor
 * acaba de decidir crear, que es justo lo contrario de lo que quiere.
 */
export function splitAcrossSources(
  sources: readonly LoadSource[]
): ReadonlyMap<string, number> {
  const shares = new Map<string, number>();
  if (sources.length === 0) return shares;

  const weighted = sources.filter((source) => source.weight > 0);
  const newcomerClaim =
    weighted.length > 0
      ? weighted.reduce((sum, source) => sum + source.weight, 0) / weighted.length
      : 1;
  const claims = sources.map((source) => (source.weight > 0 ? source.weight : newcomerClaim));
  const total = claims.reduce((sum, claim) => sum + claim, 0);
  const exact =
    total > 0
      ? claims.map((claim) => (claim / total) * TOTAL_WEIGHT)
      : claims.map(() => TOTAL_WEIGHT / claims.length);

  const floored = exact.map((value) => Math.max(1, Math.floor(value)));
  let remainder = TOTAL_WEIGHT - floored.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    floored[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  while (remainder < 0) {
    const largest = floored.indexOf(Math.max(...floored));
    if (floored[largest] <= 1) break;
    floored[largest] -= 1;
    remainder += 1;
  }

  sources.forEach((source, index) => shares.set(source.setId, floored[index]));
  return shares;
}

/** Cómo se lee un desajuste, en una línea. */
export function loadIssue(load: PersonLoad): string {
  if (load.total > TOTAL_WEIGHT) return `Se pasa ${load.total - TOTAL_WEIGHT} %`;
  if (load.total < TOTAL_WEIGHT) return `Le faltan ${TOTAL_WEIGHT - load.total} %`;
  return "Cuadra en 100 %";
}
