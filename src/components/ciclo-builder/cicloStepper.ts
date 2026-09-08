/**
 * Ciclo builder stepper — the left panel as a sequence of steps.
 *
 * Same contract as the survey builder's stepper: a numbered path where step N
 * unlocks once every earlier step is complete. General and participants are
 * mandatory; company, group and individual objectives can each be switched
 * off from their own step, so a step being reachable never means its content
 * is required — only that whatever is on it, if anything, has to be sound.
 *
 * The path is dynamic: which steps appear and in what order depends on who
 * is writing the objectives (`objectiveCreator`):
 *
 *   hr          general → company → objectives → alignment
 *   leader      general → participants → company → objectives → alignment
 *   collaborator general → participants → company → objectives → alignment
 *
 * El último paso es siempre la alineación: es el único que mira el ciclo
 * entero de una vez, así que no puede existir antes de que el ciclo esté
 * repartido.
 */

import { totalParticipantCount } from "@/components/survey-builder";
import {
  isObjectiveComplete,
  objectiveSetIssue,
  setsOfKind,
  type CicloDraft,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";

const PENDING_SEED_ISSUE: Readonly<Record<ObjectiveSetKind, string>> = {
  grupal: "Elige a qué grupo pertenecen los objetivos de la plantilla",
  individual: "Elige a quién pertenecen los objetivos individuales de la plantilla",
};

export type CicloStepId =
  | "general"
  | "participants"
  | "company"
  | "objectives"
  | "alignment";

export const CICLO_STEP_LABELS: Readonly<Record<CicloStepId, string>> = {
  general: "Datos generales",
  participants: "Participantes",
  company: "Objetivos de la empresa",
  objectives: "Objetivos asignados",
  alignment: "Alineación",
};

/** One line under each step title, so the menu says what the step is for. */
export const CICLO_STEP_HINTS: Readonly<Record<CicloStepId, string>> = {
  general: "Nombre, periodo y fechas",
  participants: "Quiénes entran al ciclo",
  company: "El norte del que cuelga todo",
  objectives: "Metas por grupo o persona",
  alignment: "El mapa de quién aporta a qué",
};

export type CicloStepState = "complete" | "active" | "locked" | "available";

export interface CicloStepperStatusInput {
  draft: CicloDraft;
  /** Step ids the author has already opened. */
  visitedSteps: ReadonlySet<CicloStepId>;
  /** Alcances con objetivos de plantilla que todavía no tienen destinatario.
   *  Un paso de asignación no está listo mientras el suyo siga aquí, aunque
   *  no tenga ningún set a medio armar que lo delate. */
  pendingSeedKinds?: ReadonlySet<ObjectiveSetKind>;
}

/**
 * Menu order for this particular draft. The base order depends on who is
 * writing the objectives:
 *
 * - HR: skips "participants".
 * - Leader / Collaborator: standard order.
 */
export function getCicloStepperOrder(draft: CicloDraft): readonly CicloStepId[] {
  if (draft.objectiveCreator === "hr") {
    return ["general", "company", "objectives", "alignment"];
  }

  return ["general", "participants", "company", "objectives", "alignment"];
}

export function cicloStepNumber(step: CicloStepId, order: readonly CicloStepId[]): number {
  return order.indexOf(step) + 1;
}

/**
 * Why a step isn't done yet, or null when it is. Message rather than boolean
 * for the same reason `objectiveIssue` is: the rail, the toast and the step
 * marker all want to name the gap, and they must name it the same way.
 */
export function cicloStepIssue(
  step: CicloStepId,
  { draft, pendingSeedKinds }: CicloStepperStatusInput
): string | null {
  switch (step) {
    case "general": {
      if (draft.name.trim() === "") return "Ponle nombre al ciclo";
      if (draft.period === null) return "Elige el periodo de tiempo";
      if (draft.startDate === "" || draft.endDate === "") return "Define las fechas del ciclo";
      if (draft.endDate < draft.startDate) return "El cierre no puede ser antes del inicio";
      return null;
    }

    case "participants":
      // RH nunca llega a este paso —se salta del recorrido—, pero si algo lo
      // consulta de todos modos (el finalize revisa todos los pasos), no debe
      // pedir una audiencia que ese flujo no necesita.
      if (draft.objectiveCreator === "hr") return null;
      return totalParticipantCount(draft.participants) > 0
        ? null
        : "Selecciona al menos un participante";

    case "company": {
      if (!draft.useCompanyObjectives) return null;
      if (draft.companyObjectives.length === 0) {
        return "Define al menos un objetivo de la empresa";
      }
      const incomplete = draft.companyObjectives.filter(
        (objective) => !isObjectiveComplete(objective, { requireWeight: false })
      );
      return incomplete.length === 0
        ? null
        : `Completa ${incomplete.length} objetivo${incomplete.length === 1 ? "" : "s"} de la empresa`;
    }

    case "objectives": {
      if (draft.useGroupObjectives) {
        if (pendingSeedKinds?.has("grupal")) return PENDING_SEED_ISSUE.grupal;
        const groupIssue = objectiveStepIssue(draft, "grupal");
        if (groupIssue !== null) return groupIssue;
      }

      if (draft.useIndividualObjectives) {
        if (pendingSeedKinds?.has("individual")) return PENDING_SEED_ISSUE.individual;
        const indIssue = objectiveStepIssue(draft, "individual");
        if (indIssue !== null) return indIssue;
      }

      // La regla "al menos una asignación" vive aquí.
      // Si ambos están apagados, el ciclo se sostiene solo con objetivos de empresa.
      if (!draft.useGroupObjectives && !draft.useIndividualObjectives) {
          // HR can have both off if they explicitly didn't select anything, or haven't yet.
          // In the unified step, if neither is selected, it's valid if they chose so.
          // We will let the step be valid if both are off.
          return null;
      }

      return draft.objectiveSets.length === 0
        ? "Crea al menos una asignación de objetivos"
        : null;
    }

    // Alinear es opcional a propósito: un ciclo puede repartir metas que no
    // cuelgan de ningún objetivo de empresa, y el mapa está para verlo, no
    // para exigirlo. El paso nunca bloquea el "Finalizar".
    case "alignment":
      return null;
  }
}

/**
 * Why one of the two assignment steps isn't done, or null when it is.
 *
 * An empty step is fine — not every ciclo hands objectives to groups, and not
 * every ciclo hands them to individuals. What is never fine is a half-built
 * set: an assignment with nobody in it, without objectives, or whose weights
 * don't close at 100 %.
 */
function objectiveStepIssue(draft: CicloDraft, kind: ObjectiveSetKind): string | null {
  const sets = setsOfKind(draft.objectiveSets, kind);
  if (sets.length === 0) return null;

  const broken = sets.filter((set) => objectiveSetIssue(set) !== null);
  if (broken.length === 0) return null;

  const first = objectiveSetIssue(broken[0])!;
  return broken.length === 1
    ? first
    : `${first} · ${broken.length - 1} ${broken.length - 1 === 1 ? "asignación más" : "asignaciones más"} sin terminar`;
}

export const isCicloStepComplete = (
  step: CicloStepId,
  input: CicloStepperStatusInput
): boolean => cicloStepIssue(step, input) === null;

/** A step opens once every earlier step in the path is complete. */
export function isCicloStepReachable(
  step: CicloStepId,
  input: CicloStepperStatusInput
): boolean {
  const order = getCicloStepperOrder(input.draft);
  const index = order.indexOf(step);
  return order.slice(0, index).every((previous) =>
    isCicloStepComplete(previous, input)
  );
}

/** Visual state for a single step. */
export function getCicloStepState(
  step: CicloStepId,
  input: CicloStepperStatusInput,
  activeStep: CicloStepId
): CicloStepState {
  if (step === activeStep) return "active";
  if (!isCicloStepReachable(step, input)) return "locked";
  // A step the author hasn't opened yet shouldn't wear a check, even when its
  // defaults happen to satisfy the gate.
  if (!input.visitedSteps.has(step)) return "available";
  return isCicloStepComplete(step, input) ? "complete" : "available";
}
