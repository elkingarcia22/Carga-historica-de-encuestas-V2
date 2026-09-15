import type { SegmentKey } from "@/components/survey-builder";
import {
  objectiveSetIssue,
  setWeightBudget,
  totalWeight,
  type ObjectiveSet,
} from "./cicloBuilderTypes";
import { objectiveSetMemberIds, targetHint, targetLabel } from "./objectiveSets";
import type { ObjectiveModelRules } from "./objectiveModel";

/**
 * Lo repartido, leído de dos formas a la vez.
 *
 * El paso enseña lo mismo por dos caminos —agrupado por quién comparte
 * objetivos, o de corrido como lista de todos los grupos (o de todas las
 * personas)—, y las dos vistas tienen que contar exactamente lo mismo: el
 * peso, el cupo, cuántos comparten, por qué una agrupación no está lista.
 * Calcularlo dos veces es la forma más rápida de que una diga "Lista" y la
 * otra "Falta repartir 20 %" sobre la misma fila, así que sale de aquí.
 */

/** Cómo se nombra una fila entre el paso y la barra flotante. */
export const assignmentRowId = (setId: string, targetId: string) => `${setId}::${targetId}`;

export const splitAssignmentRowId = (rowId: string) => {
  const [setId = "", targetId = ""] = rowId.split("::");
  return { setId, targetId };
};

export interface AssignmentIssueOptions {
  rules?: ObjectiveModelRules;
  requireAlignment?: boolean;
}

/** Una agrupación, con todo lo que las dos vistas dicen de ella. */
export interface AssignmentSetSummary {
  set: ObjectiveSet;
  /** Su lugar en la lista, que es como se la nombra: "Agrupación 2". */
  position: number;
  /** El título de la agrupación: el nombre del único destinatario, o cuántos
   *  comparten estos objetivos. */
  title: string;
  /** Más de un destinatario: editar aquí le cambia el objetivo a todos. */
  isShared: boolean;
  /** A cuánta gente llega de verdad, ya descontadas las excepciones. */
  reach: number;
  excludedCount: number;
  weight: number;
  budget: number;
  issue: string | null;
}

/** Un destinatario —un grupo o una persona— dentro de su agrupación. */
export interface AssignmentRow {
  id: string;
  setId: string;
  targetId: string;
  label: string;
  hint: string;
  summary: AssignmentSetSummary;
}

export function assignmentSetSummaries(
  sets: readonly ObjectiveSet[],
  segmentBy: SegmentKey,
  options: AssignmentIssueOptions = {}
): readonly AssignmentSetSummary[] {
  return sets.map((set, index) => {
    const isShared = set.targetIds.length > 1;
    const isGroup = set.kind === "grupal";
    return {
      set,
      position: index + 1,
      title: isShared
        ? `${set.targetIds.length} ${isGroup ? "grupos" : "personas"} con los mismos objetivos`
        : targetLabel(set, set.targetIds[0] ?? ""),
      isShared,
      // La cuenta es de gente alcanzada, no de gente en los grupos: quien se
      // separó a mano sigue en el grupo y ya no recibe esto.
      reach: objectiveSetMemberIds(set, segmentBy).size,
      excludedCount: set.excludedIds?.length ?? 0,
      weight: totalWeight(set.objectives),
      budget: setWeightBudget(set),
      issue: objectiveSetIssue(set, options),
    };
  });
}

export function assignmentRows(
  summaries: readonly AssignmentSetSummary[],
  segmentBy: SegmentKey
): readonly AssignmentRow[] {
  return summaries.flatMap((summary) =>
    summary.set.targetIds.map((targetId) => ({
      id: assignmentRowId(summary.set.id, targetId),
      setId: summary.set.id,
      targetId,
      label: targetLabel(summary.set, targetId),
      hint: targetHint(summary.set, targetId, segmentBy),
      summary,
    }))
  );
}
