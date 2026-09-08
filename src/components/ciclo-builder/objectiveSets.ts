/**
 * Operations on the list of objective sets.
 *
 * Everything here is a pure `sets -> sets` transform, so the builder screen
 * stays a thin wiring layer and the rules that matter — a set's 100 %, who a
 * set reaches, what happens when a group is dropped — live in one file that
 * can be read (and tested) without a component around it.
 */

import { COLLABORATORS } from "@/mocks/collaborators";
import type { SegmentKey } from "@/components/survey-builder";
import { groupMemberIds } from "@/components/survey-builder/participants";
import {
  MIN_OBJECTIVE_WEIGHT,
  TOTAL_WEIGHT,
  createObjectiveId,
  createObjectiveSet,
  distributeWeights,
  setWeightBudget,
  totalWeight,
  type Objective,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";

// ── Reach ──────────────────────────────────────────────────────────────────

const PERSON_BY_ID = new Map(COLLABORATORS.map((person) => [person.id, person]));

/** Who a single set reaches. */
export function objectiveSetMemberIds(
  set: ObjectiveSet,
  segmentBy: SegmentKey
): ReadonlySet<string> {
  if (set.kind !== "grupal") return new Set(set.targetIds);
  const members = groupMemberIds(segmentBy, set.targetIds);
  if (!set.excludedIds || set.excludedIds.length === 0) return members;
  const excluded = new Set(set.excludedIds);
  return new Set([...members].filter((id) => !excluded.has(id)));
}

/**
 * Saca a una persona de un set grupal sin tocar a nadie más de su grupo.
 *
 * La alternativa —encogerle el cupo al set— le cambia el reparto a todo el
 * grupo por culpa de una persona; esto deja al grupo exactamente como estaba
 * y convierte a esa persona en una excepción con nombre.
 */
export const excludeFromSet = (
  sets: readonly ObjectiveSet[],
  setId: string,
  personId: string
): readonly ObjectiveSet[] =>
  sets.map((set) =>
    set.id === setId && set.kind === "grupal"
      ? { ...set, excludedIds: [...new Set([...(set.excludedIds ?? []), personId])] }
      : set
  );

export const objectiveSetReach = (set: ObjectiveSet, segmentBy: SegmentKey): number =>
  objectiveSetMemberIds(set, segmentBy).size;

/**
 * Who the whole list reaches, counted once each. A person picked individually
 * on top of their group is still one person, and a summary that said otherwise
 * would inflate the number the author checks the ciclo against.
 */
export function objectiveSetsReach(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey
): number {
  const ids = new Set<string>();
  sets.forEach((set) => {
    objectiveSetMemberIds(set, segmentBy).forEach((id) => ids.add(id));
  });
  return ids.size;
}

/** How a target reads on screen: the group's own name, or the person's. */
export function targetLabel(
  set: ObjectiveSet,
  targetId: string
): string {
  if (set.kind === "grupal") return targetId;
  return PERSON_BY_ID.get(targetId)?.name ?? "Colaborador";
}

/** How many people a single target covers: the group's size, or one. */
export function targetMemberCount(
  set: ObjectiveSet,
  targetId: string,
  segmentBy: SegmentKey
): number {
  return set.kind === "grupal" ? groupMemberIds(segmentBy, [targetId]).size : 1;
}

/** Secondary line for a target: its size, or the person's area. */
export function targetHint(
  set: ObjectiveSet,
  targetId: string,
  segmentBy: SegmentKey
): string {
  if (set.kind === "grupal") {
    const size = targetMemberCount(set, targetId, segmentBy);
    return `${size} ${size === 1 ? "persona" : "personas"}`;
  }
  return PERSON_BY_ID.get(targetId)?.area ?? "Sin área";
}

/** Everyone already covered by a set, used to warn about overlaps. */
export function coveredMemberIds(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey
): ReadonlySet<string> {
  const ids = new Set<string>();
  sets.forEach((set) => {
    objectiveSetMemberIds(set, segmentBy).forEach((id) => ids.add(id));
  });
  return ids;
}

// ── Sets ───────────────────────────────────────────────────────────────────

/** Adds one set covering every target picked in the same pass. */
export function addSet(
  sets: readonly ObjectiveSet[],
  kind: ObjectiveSetKind,
  targetIds: readonly string[]
): { sets: readonly ObjectiveSet[]; created: ObjectiveSet } {
  const created = createObjectiveSet(kind, targetIds);
  return { sets: [...sets, created], created };
}

/**
 * Drops a group (or person) from its assignment. An assignment left with
 * nobody goes with it: a set of objectives addressed to no one is not a
 * smaller assignment, it is none.
 */
export function removeTargets(
  sets: readonly ObjectiveSet[],
  targets: readonly { setId: string; targetId: string }[]
): readonly ObjectiveSet[] {
  const dropped = new Map<string, Set<string>>();
  targets.forEach(({ setId, targetId }) => {
    const current = dropped.get(setId) ?? new Set<string>();
    current.add(targetId);
    dropped.set(setId, current);
  });

  return sets
    .map((set) => {
      const drop = dropped.get(set.id);
      if (!drop) return set;
      return { ...set, targetIds: set.targetIds.filter((id) => !drop.has(id)) };
    })
    .filter((set) => set.targetIds.length > 0);
}

export const removeSet = (
  sets: readonly ObjectiveSet[],
  setId: string
): readonly ObjectiveSet[] => sets.filter((set) => set.id !== setId);

/**
 * Una copia independiente de un objetivo: ids nuevos arriba y en sus acciones
 * clave, para que editar la copia no toque al original ni al revés.
 */
export const cloneObjective = (objective: Objective): Objective => ({
  ...objective,
  id: `objective-${createObjectiveId()}`,
  keyActions: objective.keyActions.map((action) => ({
    ...action,
    id: `action-${createObjectiveId()}`,
  })),
});

/**
 * Saca a un solo destinatario de una asignación compartida y lo deja en la
 * suya, con una copia de los mismos objetivos.
 *
 * Es lo que hace "editar solo este grupo": mientras los objetivos son los
 * mismos para todos, la asignación es una sola; en cuanto uno se separa para
 * llevar los suyos, deja de pertenecer a esa agrupación —y editarlo ya no
 * puede cambiarles el objetivo a los demás sin avisar.
 */
export function detachTarget(
  sets: readonly ObjectiveSet[],
  setId: string,
  targetId: string
): { sets: readonly ObjectiveSet[]; created: ObjectiveSet | null } {
  const source = sets.find((set) => set.id === setId);
  if (!source || !source.targetIds.includes(targetId)) return { sets, created: null };
  // Ya está sola: separarla no crearía nada, solo movería la fila de sitio.
  if (source.targetIds.length < 2) return { sets, created: source };

  const created: ObjectiveSet = {
    ...createObjectiveSet(source.kind, [targetId]),
    weightShare: source.weightShare,
    objectives: source.objectives.map(cloneObjective),
  };

  return {
    sets: [
      ...sets.map((set) =>
        set.id === setId
          ? { ...set, targetIds: set.targetIds.filter((id) => id !== targetId) }
          : set
      ),
      created,
    ],
    created,
  };
}

/**
 * Le da a una asignación un cupo distinto del 100 % y reparte ese cupo entre
 * los objetivos que ya tiene, en la misma proporción en la que estaban.
 *
 * Es la operación que resuelve un conflicto de peso sin obligar a reescribir
 * la asignación: si alguien lleva objetivos por dos vías, cada vía se encoge
 * a su parte y el reparto interno se mantiene reconocible.
 */
export function setWeightShare(
  sets: readonly ObjectiveSet[],
  setId: string,
  share: number
): readonly ObjectiveSet[] {
  const safeShare = Math.max(0, Math.min(TOTAL_WEIGHT, Math.round(share)));
  return mapSet(sets, setId, (set) => ({
    ...set,
    weightShare: safeShare === TOTAL_WEIGHT ? undefined : safeShare,
    objectives: rescaleObjectives(set.objectives, safeShare),
  }));
}

/**
 * Estira o encoge un reparto para que sume exactamente `budget`, conservando
 * las proporciones y sin dejar a nadie por debajo del mínimo.
 *
 * El resto del redondeo se entrega de a un punto a los objetivos con la parte
 * decimal más grande, así la suma cae clavada en el presupuesto en vez de
 * quedarse a uno o dos puntos por errores de redondeo.
 */
export function rescaleObjectives(
  objectives: readonly Objective[],
  budget: number
): readonly Objective[] {
  if (objectives.length === 0) return objectives;
  const floor = Math.min(MIN_OBJECTIVE_WEIGHT, Math.floor(budget / objectives.length));
  const current = totalWeight(objectives);

  // Sin nada repartido todavía no hay proporción que conservar: se parte igual.
  if (current <= 0) {
    const shares = distributeWeights(objectives.length, budget);
    return objectives.map((objective, index) => ({ ...objective, weight: shares[index] }));
  }

  const exact = objectives.map((objective) => (objective.weight / current) * budget);
  const floored = exact.map((value) => Math.max(floor, Math.floor(value)));
  let remainder = budget - floored.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const weights = [...floored];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    weights[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  // Pasarse es posible cuando el piso mínimo no cabe en el presupuesto: se le
  // quita al más grande, que es el que menos nota la diferencia.
  while (remainder < 0) {
    const largest = weights.indexOf(Math.max(...weights));
    if (weights[largest] <= 0) break;
    weights[largest] -= 1;
    remainder += 1;
  }

  return objectives.map((objective, index) => ({ ...objective, weight: weights[index] }));
}

/** Aplica de una vez los pesos que el modal de ajuste dejó decididos. */
export const applyObjectiveWeights = (
  sets: readonly ObjectiveSet[],
  setId: string,
  weights: Readonly<Record<string, number>>
): readonly ObjectiveSet[] =>
  mapSet(sets, setId, (set) => ({
    ...set,
    objectives: set.objectives.map((objective) =>
      objective.id in weights ? { ...objective, weight: weights[objective.id] } : objective
    ),
  }));

/**
 * Turns a shared set into one set per target, each keeping a copy of the
 * objectives. The escape hatch for "these three groups start the same but
 * Ventas needs its own number" — without it the author would have to delete
 * the set and retype everything.
 */
export function splitSet(
  sets: readonly ObjectiveSet[],
  setId: string
): readonly ObjectiveSet[] {
  const target = sets.find((set) => set.id === setId);
  if (!target || target.targetIds.length < 2) return sets;

  const clones = target.targetIds.map((targetId) => ({
    ...createObjectiveSet(target.kind, [targetId]),
    weightShare: target.weightShare,
    objectives: target.objectives.map(cloneObjective),
  }));

  return sets.flatMap((set) => (set.id === setId ? clones : [set]));
}

export const setTargets = (
  sets: readonly ObjectiveSet[],
  setId: string,
  targetIds: readonly string[]
): readonly ObjectiveSet[] =>
  sets.map((set) => (set.id === setId ? { ...set, targetIds } : set));

/** Copies one set's objectives into another, fresh ids and all. */
export function copyObjectives(
  sets: readonly ObjectiveSet[],
  fromSetId: string,
  toSetId: string
): readonly ObjectiveSet[] {
  const source = sets.find((set) => set.id === fromSetId);
  if (!source) return sets;
  return sets.map((set) =>
    set.id === toSetId
      ? {
          ...set,
          objectives: source.objectives.map(cloneObjective),
        }
      : set
  );
}

// ── Objectives inside a set ────────────────────────────────────────────────

const mapSet = (
  sets: readonly ObjectiveSet[],
  setId: string,
  update: (set: ObjectiveSet) => ObjectiveSet
): readonly ObjectiveSet[] => sets.map((set) => (set.id === setId ? update(set) : set));

/** Weight still unclaimed inside a set — what a new objective takes. */
export function freeWeight(set: ObjectiveSet | undefined): number {
  if (!set) return TOTAL_WEIGHT;
  return Math.max(0, setWeightBudget(set) - totalWeight(set.objectives));
}

export const insertObjective = (
  sets: readonly ObjectiveSet[],
  setId: string,
  objective: Objective
): readonly ObjectiveSet[] =>
  mapSet(sets, setId, (set) => ({ ...set, objectives: [...set.objectives, objective] }));

/**
 * AI proposals share whatever weight was still free between them. The
 * objectives already on screen keep the share their author gave them: adding
 * a proposal is not a reason to rewrite a decision nobody asked to change.
 */
export function insertObjectivesFromAI(
  sets: readonly ObjectiveSet[],
  setId: string,
  incoming: readonly Objective[]
): readonly ObjectiveSet[] {
  if (incoming.length === 0) return sets;
  return mapSet(sets, setId, (set) => {
    const shares = distributeWeights(incoming.length, freeWeight(set));
    return {
      ...set,
      objectives: [
        ...set.objectives,
        ...incoming.map((objective, index) => ({ ...objective, weight: shares[index] })),
      ],
    };
  });
}

export const changeObjective = (
  sets: readonly ObjectiveSet[],
  setId: string,
  objectiveId: string,
  patch: Partial<Objective>
): readonly ObjectiveSet[] =>
  mapSet(sets, setId, (set) => ({
    ...set,
    objectives: set.objectives.map((objective) =>
      objective.id === objectiveId ? { ...objective, ...patch } : objective
    ),
  }));

export const removeObjective = (
  sets: readonly ObjectiveSet[],
  setId: string,
  objectiveId: string
): readonly ObjectiveSet[] =>
  mapSet(sets, setId, (set) => ({
    ...set,
    objectives: set.objectives.filter((objective) => objective.id !== objectiveId),
  }));

export const distributeSetWeights = (
  sets: readonly ObjectiveSet[],
  setId: string
): readonly ObjectiveSet[] =>
  mapSet(sets, setId, (set) => {
    const weights = distributeWeights(set.objectives.length, setWeightBudget(set));
    return {
      ...set,
      objectives: set.objectives.map((objective, index) => ({
        ...objective,
        weight: weights[index],
      })),
    };
  });

/**
 * How many assigned objectives point at a company objective, and how many
 * were left standalone. Company objectives themselves don't count — they are
 * what the others align *to*, not something that aligns.
 */
export function alignmentCounts(
  sets: readonly ObjectiveSet[]
): { aligned: number; unaligned: number } {
  let aligned = 0;
  let unaligned = 0;
  sets.forEach((set) => {
    set.objectives.forEach((objective) => {
      if (objective.alignedTo !== null) aligned += 1;
      else unaligned += 1;
    });
  });
  return { aligned, unaligned };
}

/** One assigned objective, addressed by the set that holds it. */
export interface ObjectiveAddress {
  setId: string;
  objectiveId: string;
}

/**
 * Points a batch of assigned objectives at one company objective — or lets
 * them go, with `null`.
 *
 * Takes a batch rather than a single objective because that is how the
 * alignment map asks: dropping an arrow on a whole group aligns everything
 * that group carries, and doing it one call per objective would have each
 * call read the same pre-update list, so only the last one would stick.
 */
export function alignObjectives(
  sets: readonly ObjectiveSet[],
  addresses: readonly ObjectiveAddress[],
  companyObjectiveId: string | null
): readonly ObjectiveSet[] {
  if (addresses.length === 0) return sets;

  const bySet = new Map<string, Set<string>>();
  addresses.forEach(({ setId, objectiveId }) => {
    const current = bySet.get(setId) ?? new Set<string>();
    current.add(objectiveId);
    bySet.set(setId, current);
  });

  return sets.map((set) => {
    const wanted = bySet.get(set.id);
    if (!wanted) return set;
    return {
      ...set,
      objectives: set.objectives.map((objective) =>
        wanted.has(objective.id) ? { ...objective, alignedTo: companyObjectiveId } : objective
      ),
    };
  });
}

/** Drops a company objective's alignment everywhere it was pointed at. */
export const unalignFromCompanyObjective = (
  sets: readonly ObjectiveSet[],
  companyObjectiveId: string
): readonly ObjectiveSet[] =>
  sets.map((set) => ({
    ...set,
    objectives: set.objectives.map((objective) =>
      objective.alignedTo === companyObjectiveId ? { ...objective, alignedTo: null } : objective
    ),
  }));
