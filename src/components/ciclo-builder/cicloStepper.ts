/**
 * Ciclo builder stepper — the left panel as a sequence of steps.
 *
 * Same contract as the survey builder's stepper: a numbered path where step N
 * unlocks once every earlier step is complete. General and participants are
 * mandatory; company, group and individual objectives can each be switched
 * off from their own step, so a step being reachable never means its content
 * is required — only that whatever is on it, if anything, has to be sound.
 *
 * The path is dynamic. In the guided flow it depends only on who writes the
 * objectives (`objectiveCreator`):
 *
 *   hr          general → company → objectives → alignment
 *   leader      general → participants → company → objectives → alignment
 *   collaborator general → participants → company → objectives → alignment
 *
 * En el flujo parametrizado el primer paso manda sobre todo lo demás. El
 * gobierno decide dónde termina el administrador —RH escribe y reparte; con
 * líderes o colaboradores solo lanza el ciclo— y el modelo decide si existe
 * el norte de la empresa:
 *
 *   hr           general → [company] → objectives → [alignment]
 *   leader       general → participants → [company]
 *   collaborator general → participants → [company]
 *
 * `[company]` existe cuando el modelo no apaga el norte y el autor lo quiere
 * —lo decide en la parametrización, no en el propio paso—, y la alineación
 * va siempre pegada a esa misma respuesta.
 *
 * El último paso, cuando existe, es la alineación: es el único que mira el
 * ciclo entero de una vez, así que no puede existir antes de que el ciclo
 * esté repartido.
 */

import { totalParticipantCount } from "@/components/survey-builder";
import {
  isObjectiveComplete,
  objectiveSetIssue,
  setsOfKind,
  type CicloDraft,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";
import { setupIssue } from "./cicloSetup";
import type { CicloSetupFlow } from "./cicloSetupFlow";
import { OBJECTIVE_MODELS_ENABLED } from "./objectiveModel";
import { alignmentCounts } from "./objectiveSets";

const PENDING_SEED_ISSUE: Readonly<Record<ObjectiveSetKind, string>> = {
  grupal: "Elige a qué grupo pertenecen los objetivos de la plantilla",
  individual: "Elige a quién pertenecen los objetivos individuales de la plantilla",
  custom: "Elige a quién pertenecen los objetivos personalizados de la plantilla",
};

/** Un nivel elegido en la parametrización que todavía no reparte nada. */
const EMPTY_LEVEL_ISSUE: Readonly<Record<ObjectiveSetKind, string>> = {
  grupal: "Crea al menos una asignación por grupos",
  individual: "Crea al menos una asignación individual",
  custom: "Crea al menos una asignación personalizada",
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
  general: "Nombre, modelo, periodo y fechas",
  participants: "Quiénes entran al ciclo",
  company: "El norte del que cuelga todo",
  objectives: "Metas por grupo o persona",
  alignment: "El mapa de quién aporta a qué",
};

/** El primer paso cambia de nombre con el flujo: ya no son datos, son decisiones. */
export function cicloStepLabel(step: CicloStepId, flow: CicloSetupFlow = "guided"): string {
  if (step === "general" && flow === "parametrizado") return "Parametrización";
  return CICLO_STEP_LABELS[step];
}

export function cicloStepHint(step: CicloStepId, flow: CicloSetupFlow = "guided"): string {
  if (step === "general" && flow === "parametrizado") {
    return "Identidad, metodología, gobierno y asignación";
  }
  return CICLO_STEP_HINTS[step];
}

export type CicloStepState = "complete" | "active" | "locked" | "available";

export interface CicloStepperStatusInput {
  draft: CicloDraft;
  /** Step ids the author has already opened. */
  visitedSteps: ReadonlySet<CicloStepId>;
  /** Alcances con objetivos de plantilla que todavía no tienen destinatario.
   *  Un paso de asignación no está listo mientras el suyo siga aquí, aunque
   *  no tenga ningún set a medio armar que lo delate. */
  pendingSeedKinds?: ReadonlySet<ObjectiveSetKind>;
  /** Con qué versión del primer paso corre el constructor. Decide el
   *  recorrido y qué exige cada paso. Guiado si no se dice. */
  flow?: CicloSetupFlow;
}

/**
 * Menu order for this particular draft.
 *
 * Guided: HR skips "participants"; leader and collaborator walk the whole
 * path. Parametrizado: see the module comment — the first step decides which
 * of the other four exist at all.
 */
export function getCicloStepperOrder(
  draft: CicloDraft,
  flow: CicloSetupFlow = "guided"
): readonly CicloStepId[] {
  if (flow === "guided") {
    if (draft.objectiveCreator === "hr") {
      return ["general", "company", "objectives", "alignment"];
    }
    return ["general", "participants", "company", "objectives", "alignment"];
  }

  const isHr = draft.objectiveCreator === "hr";

  // El norte lo deciden dos cosas, y las dos en el primer paso: el modelo
  // —que puede apagarlo o exigirlo— y, cuando lo deja opcional, el autor.
  // Sin norte no hay paso de empresa, y sin paso de empresa no hay mapa de
  // alineación: un mapa de objetivos que no cuelgan de nada no es un paso.
  const hasCompany =
    draft.modelRules.companyObjectives !== "off" && draft.useCompanyObjectives;
  const order: CicloStepId[] = ["general"];
  // hr doesn't get participants; Otros, líderes y colaboradores sí — los tres
  // eligen a mano quién entra, y quien entra crea lo suyo fuera de este
  // constructor.
  if (!isHr) order.push("participants");
  if (hasCompany) order.push("company");

  // Solo RH construye los objetivos dentro de este mismo paso a paso. Otros
  // funciona como colaboradores: elige a la gente y su flujo termina ahí, sin
  // paso de "Objetivos asignados" ni de alineación.
  if (isHr) {
    order.push("objectives");
    if (hasCompany) order.push("alignment");
  }
  return order;
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
  { draft, pendingSeedKinds, flow = "guided" }: CicloStepperStatusInput
): string | null {
  const isParametrizado = flow === "parametrizado";

  switch (step) {
    case "general": {
      if (isParametrizado) return setupIssue(draft);
      if (draft.name.trim() === "") return "Ponle nombre al ciclo";
      if (OBJECTIVE_MODELS_ENABLED && draft.objectiveModel === null) {
        return "Elige el modelo de objetivos";
      }
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
        // En la parametrización el nivel se eligió a propósito: un nivel que
        // no reparte nada es una decisión sin cumplir, no un paso vacío.
        if (isParametrizado && setsOfKind(draft.objectiveSets, "grupal").length === 0) {
          return EMPTY_LEVEL_ISSUE.grupal;
        }
      }

      if (draft.useIndividualObjectives) {
        if (pendingSeedKinds?.has("individual")) return PENDING_SEED_ISSUE.individual;
        const indIssue = objectiveStepIssue(draft, "individual");
        if (indIssue !== null) return indIssue;
        if (isParametrizado && setsOfKind(draft.objectiveSets, "individual").length === 0) {
          return EMPTY_LEVEL_ISSUE.individual;
        }
      }

      // La regla "al menos una asignación" vive aquí.
      // Si todos están apagados, el ciclo se sostiene solo con objetivos de empresa.
      if (!draft.useGroupObjectives && !draft.useIndividualObjectives) {
        return null;
      }
      return draft.objectiveSets.length === 0
        ? "Crea al menos una asignación de objetivos"
        : null;
    }

    // Alinear es opcional a propósito: un ciclo puede repartir metas que no
    // cuelgan de ningún objetivo de empresa, y el mapa está para verlo, no
    // para exigirlo. Salvo que el modelo lo exija: en la parametrización, un
    // OKR o un MBO con objetivos sueltos no está terminado.
    case "alignment": {
      if (!isParametrizado) return null;
      if (draft.modelRules.alignment !== "required" || !draft.useCompanyObjectives) return null;
      const { unaligned } = alignmentCounts(draft.objectiveSets);
      if (unaligned === 0) return null;
      return `Alinea ${unaligned} ${unaligned === 1 ? "objetivo" : "objetivos"} a los de la empresa`;
    }
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

  const setOptions = {
    rules: draft.modelRules,
    requireAlignment:
      draft.modelRules.alignment === "required" &&
      draft.modelRules.companyObjectives !== "off" &&
      draft.useCompanyObjectives &&
      draft.companyObjectives.length > 0,
  };
  const broken = sets.filter((set) => objectiveSetIssue(set, setOptions) !== null);
  if (broken.length === 0) return null;

  const first = objectiveSetIssue(broken[0], setOptions)!;
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
  const order = getCicloStepperOrder(input.draft, input.flow);
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

/**
 * Dónde retomar un borrador que se vuelve a abrir.
 *
 * Manda el paso donde el autor lo dejó (`_lastStep`): retomar es volver a la
 * silla que se dejó caliente, no al principio ni al final del camino. Solo se
 * corrige cuando ese paso ya no se puede abrir —el recorrido cambió, o algo
 * anterior quedó a medias— y entonces se cae al primero que falta, que es el
 * que hay que resolver para volver allí.
 */
export function resumeCicloStep(
  savedStep: CicloStepId | undefined,
  input: CicloStepperStatusInput
): CicloStepId {
  const order = getCicloStepperOrder(input.draft, input.flow);
  if (order.length === 0) return "general";
  if (savedStep && order.includes(savedStep) && isCicloStepReachable(savedStep, input)) {
    return savedStep;
  }
  return order.find((step) => !isCicloStepComplete(step, input)) ?? order[order.length - 1];
}

/**
 * Los pasos que hay que dar por recorridos al retomar en `step`.
 *
 * Llegar a un paso significa haber pasado por los anteriores, así que el
 * stepper los marca como visitados y cada uno enseña su chulito si está
 * completo. Sin esto un borrador a medio camino reaparece con el camino
 * entero en blanco, como si nunca se hubiera trabajado.
 */
export function visitedStepsUpTo(
  step: CicloStepId,
  input: CicloStepperStatusInput
): ReadonlySet<CicloStepId> {
  const order = getCicloStepperOrder(input.draft, input.flow);
  const index = order.indexOf(step);
  if (index < 0) return new Set([step]);
  return new Set(order.slice(0, index + 1));
}
