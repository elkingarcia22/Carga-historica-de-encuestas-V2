/**
 * Parametrización del ciclo — la lógica del primer paso en su versión de
 * cuatro bloques.
 *
 *   identity     nombre, duración y fechas
 *   methodology  el modelo de medición (qué)
 *   governance   quién redacta los objetivos (quién)
 *   structure    a qué nivel se asignan (cómo)
 *
 * Van de lo general a lo operativo y cada uno manda sobre el siguiente: el
 * gobierno decide qué niveles se pueden elegir, y los cuatro juntos deciden
 * qué pasos existen después (ver `getCicloStepperOrder`). Aquí no hay React:
 * son las reglas que el editor pinta y el stepper exige, escritas una vez.
 */

import { Building2, Shuffle, UserCog, UserRound, Users2, UsersRound, SlidersHorizontal, type LucideIcon } from "lucide-react";
import {
  CICLO_PERIOD_LABELS,
  type CicloDraft,
  type CicloObjectiveCreator,
  type CicloPeriod,
} from "./cicloBuilderTypes";
import { formatDateRange } from "./cicloDates";
import { OBJECTIVE_MODEL_META, type ObjectiveModelId } from "./objectiveModel";

export type SetupBlockId = "identity" | "methodology" | "governance" | "permissions";

export const SETUP_BLOCK_ORDER: readonly SetupBlockId[] = [
  "identity",
  "methodology",
  "governance",
  "permissions",
];

/**
 * Las duraciones del selector rápido. Bimestre no está: la parametrización
 * ofrece los cinco cortes que la gente nombra —mes, trimestre, semestre, año
 * y a medida—. Un borrador que ya venga en bimestre lo conserva y lo muestra;
 * ver `setupPeriodOptions`.
 */
export const SETUP_PERIOD_OPTIONS: readonly CicloPeriod[] = [
  "mes",
  "trimestre",
  "semestre",
  "anio",
  "personalizado",
];

export function setupPeriodOptions(current: CicloPeriod | null): readonly CicloPeriod[] {
  if (current === null || SETUP_PERIOD_OPTIONS.includes(current)) return SETUP_PERIOD_OPTIONS;
  return [...SETUP_PERIOD_OPTIONS.slice(0, 1), current, ...SETUP_PERIOD_OPTIONS.slice(1)];
}

/**
 * Los modelos del selector. NCT queda fuera de la tarjeta: sin su narrativa
 * por equipo se separa de SMART por poco, y cinco tarjetas se leen de un
 * vistazo. Un ciclo que ya venga en NCT lo conserva (`setupModelOptions`).
 */
export const SETUP_MODEL_OPTIONS: readonly ObjectiveModelId[] = [
  "okr",
  "kpi",
  "smart",
  "mbo",
  "custom",
];

export function setupModelOptions(current: ObjectiveModelId | null): readonly ObjectiveModelId[] {
  if (current === null || SETUP_MODEL_OPTIONS.includes(current)) return SETUP_MODEL_OPTIONS;
  return [...SETUP_MODEL_OPTIONS.slice(0, -1), current, "custom"];
}

// ── Gobierno ───────────────────────────────────────────────────────────────

export interface GovernanceMeta {
  icon: LucideIcon;
  label: string;
  /** Centralizado, descentralizado o de abajo hacia arriba. */
  mode: string;
  /** Qué pasa con los objetivos en este gobierno. */
  description: string;
  /** Lo que le toca al creador del ciclo — dónde termina su flujo. */
  yourPart: string;
  /** Cómo se llama el último botón del recorrido. */
  finishLabel: string;
}

export const GOVERNANCE_ORDER: readonly CicloObjectiveCreator[] = ["hr", "leader", "collaborator", "custom"];

export const GOVERNANCE_META: Readonly<Record<CicloObjectiveCreator, GovernanceMeta>> = {
  custom: {
    icon: SlidersHorizontal,
    label: "Otros",
    mode: "Otros",
    description: "Eliges puntualmente a las personas que van a poder crear los objetivos.",
    yourPart: "Tu flujo termina al lanzar el ciclo; cada persona que elijas registra lo suyo.",
    finishLabel: "Lanzar ciclo",
  },
  hr: {
    icon: Building2,
    label: "Administrador / RRHH",
    mode: "Centralizado",
    description: "Quien crea el ciclo escribe y reparte todas las metas.",
    yourPart: "Tu flujo sigue hasta dejar los objetivos asignados y alineados.",
    finishLabel: "Finalizar",
  },
  leader: {
    icon: UserCog,
    label: "Líderes",
    mode: "Descentralizado",
    description:
      "Cada líder recibe una notificación para crear las metas de su equipo directo.",
    yourPart: "Tu flujo termina al lanzar el ciclo; los líderes escriben lo demás.",
    finishLabel: "Lanzar ciclo",
  },
  collaborator: {
    icon: UsersRound,
    label: "Colaboradores",
    mode: "Bottom-up",
    description: "Cada persona entra a la plataforma a proponer y registrar sus propias métricas.",
    yourPart: "Tu flujo termina al lanzar el ciclo; cada persona registra lo suyo.",
    finishLabel: "Lanzar ciclo",
  },
};

// ── Estructura de asignación ───────────────────────────────────────────────

type LevelFlags = Pick<CicloDraft, "useGroupObjectives" | "useIndividualObjectives" | "useCustomObjectives">;

/** A qué nivel se reparten los objetivos del ciclo. */
export type AssignmentLevel = "grupos" | "individual" | "mixto";

export const ASSIGNMENT_LEVEL_ORDER: readonly AssignmentLevel[] = [
  "grupos",
  "individual",
  "mixto",
];

export const ASSIGNMENT_LEVEL_META: Readonly<
  Record<AssignmentLevel, { icon: LucideIcon; label: string; tagline: string }>
> = {
  grupos: {
    icon: Users2,
    label: "Por grupos",
    tagline: "Un mismo set de objetivos para cada área, equipo o grupo.",
  },
  individual: {
    icon: UserRound,
    label: "Individualmente",
    tagline: "Cada persona recibe sus propios objetivos.",
  },
  mixto: {
    icon: Shuffle,
    label: "Mixto",
    tagline: "Los dos niveles conviven: unos objetivos por grupo y otros por persona.",
  },
};

/**
 * Solo RH reparte desde el constructor. Con líderes, colaboradores u Otros
 * (que funciona igual que colaboradores, solo que con gente elegida a mano)
 * el administrador lanza el ciclo y el reparto lo hace cada quien en su
 * propia bandeja, así que el nivel no es su pregunta.
 */
export const creatorAssignsObjectives = (creator: CicloObjectiveCreator | null): boolean =>
  creator === "hr";

/** El nivel que llevan puesto las banderas del borrador. */
export function assignmentLevelOf(draft: CicloDraft): AssignmentLevel | null {
  if (draft.useGroupObjectives && draft.useIndividualObjectives) return "mixto";
  if (draft.useGroupObjectives) return "grupos";
  if (draft.useIndividualObjectives) return "individual";
  return null;
}

/** Las banderas que deja elegir un nivel. */
export function levelsForAssignment(level: AssignmentLevel): LevelFlags {
  return {
    useGroupObjectives: level !== "individual",
    useIndividualObjectives: level !== "grupos",
    useCustomObjectives: false,
  };
}

/**
 * Colaboradores y Otros reparten fuera del constructor, cada quien lo suyo:
 * fijan individual y no dejan elegir. RH y Líderes arrancan sin nada marcado
 * —RH porque sí pregunta el nivel, Líderes porque hoy hereda el default de
 * los dos niveles— y una tarjeta ya elegida no distingue "todavía no se
 * preguntó" de "ya contestó", así que este bloque es una pregunta de verdad
 * donde aplica.
 */
const hasFixedIndividualLevel = (creator: CicloObjectiveCreator): boolean =>
  creator === "collaborator" || creator === "custom";

export function levelsForCreator(creator: CicloObjectiveCreator): LevelFlags {
  return hasFixedIndividualLevel(creator)
    ? { useGroupObjectives: false, useIndividualObjectives: true, useCustomObjectives: false }
    : { useGroupObjectives: true, useIndividualObjectives: true, useCustomObjectives: false };
}

/** Si cambiar de gobierno obliga a volver a preguntar el nivel. */
export function shouldResetLevels(
  previous: CicloObjectiveCreator,
  next: CicloObjectiveCreator
): boolean {
  return hasFixedIndividualLevel(previous) || hasFixedIndividualLevel(next);
}

// ── Incidencias y resúmenes ────────────────────────────────────────────────

/**
 * Por qué un bloque no está listo, o null cuando sí. Mismo contrato que
 * `objectiveIssue`: el editor, el stepper y el aviso de continuar nombran el
 * mismo hueco con las mismas palabras.
 *
 * Gobierno nunca devuelve incidencia: `objectiveCreator` siempre tiene valor,
 * así que "todavía no eligió" es un estado del editor, no del borrador.
 */
export function setupBlockIssue(block: SetupBlockId, draft: CicloDraft): string | null {
  switch (block) {
    case "identity":
      if (draft.name.trim() === "") return "Ponle nombre al ciclo";
      if (draft.period === null) return "Elige la duración del ciclo";
      if (draft.startDate === "" || draft.endDate === "") return "Define las fechas del ciclo";
      if (draft.endDate < draft.startDate) return "El cierre no puede ser antes del inicio";
      return null;
    case "methodology":
      return draft.objectiveModel === null ? "Elige el modelo de medición" : null;
    case "governance":
      return draft.objectiveCreator === null ? "Elige quién redacta los objetivos" : null;
    case "permissions":
      return null;
  }
}

/** La primera incidencia del paso, en el orden de los bloques. */
export function setupIssue(draft: CicloDraft): string | null {
  for (const block of SETUP_BLOCK_ORDER) {
    const issue = setupBlockIssue(block, draft);
    if (issue !== null) return issue;
  }
  return null;
}

export const isSetupBlockAnswered = (block: SetupBlockId, draft: CicloDraft): boolean =>
  setupBlockIssue(block, draft) === null;

/**
 * Lo que dice un bloque plegado: la decisión tomada, en una línea. Null
 * mientras no haya nada que resumir.
 */
export function setupBlockSummary(block: SetupBlockId, draft: CicloDraft): string | null {
  switch (block) {
    case "identity": {
      const parts: string[] = [];
      if (draft.name.trim() !== "") parts.push(draft.name.trim());
      if (draft.period !== null) parts.push(CICLO_PERIOD_LABELS[draft.period]);
      const range = formatDateRange(draft.startDate, draft.endDate);
      if (range !== null) parts.push(range);
      return parts.length === 0 ? null : parts.join(" · ");
    }
    case "methodology": {
      if (draft.objectiveModel === null) return null;
      const meta = OBJECTIVE_MODEL_META[draft.objectiveModel];
      const name =
        draft.objectiveModel === "custom"
          ? "Modelo personalizado"
          : `${meta.label} · ${meta.fullName}`;
      // Solo se dice cuando el autor pudo elegirlo: con el norte apagado o
      // exigido por el modelo, la frase la manda el modelo y ya está dicha.
      if (draft.modelRules.companyObjectives !== "optional") return name;
      return draft.useCompanyObjectives
        ? `${name} · Con objetivos de la empresa`
        : `${name} · Sin objetivos de la empresa`;
    }
    case "governance": {
      if (draft.objectiveCreator === null) return null;
      const meta = GOVERNANCE_META[draft.objectiveCreator];
      const base = `${meta.label} · ${meta.mode}`;
      // El nivel solo se dice donde se pregunta: con líderes o colaboradores
      // el reparto no pasa por este constructor.
      if (!creatorAssignsObjectives(draft.objectiveCreator)) return base;
      const level = assignmentLevelOf(draft);
      return level === null ? base : `${base} · ${ASSIGNMENT_LEVEL_META[level].label}`;
    }
    case "permissions": {
      return "Configurados por defecto";
    }
  }
}
