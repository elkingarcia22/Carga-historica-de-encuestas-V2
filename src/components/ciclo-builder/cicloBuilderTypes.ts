/**
 * Ciclo builder — domain types.
 *
 * A ciclo groups objectives under one time window. It is created through the
 * same wizard shape the survey builder uses, but its content is different:
 *
 *   general      name, period and dates of the ciclo
 *   participants who is in the ciclo (identical to the survey step)
 *   company      the company-level objectives everything else hangs from
 *   groups       objective sets handed to whole groups
 *   individuals  objective sets handed to specific people
 *
 * The objective itself is the hard part of this domain, not because it holds
 * many fields but because none of its field names mean anything to the person
 * filling them in: "tipo de medida", "aumentar/reducir" and "mínimos y máximos
 * de avance" are internal vocabulary. Every one of them therefore carries its
 * own copy here — what it is, when to use it, and a worked example — so the
 * editor can explain itself instead of asking the author to already know.
 */

import type { ParticipantMode, ParticipantsSelection, SegmentKey } from "@/components/survey-builder";
import { trackBlockingIssue } from "./complianceRules";
import {
  DEFAULT_OBJECTIVE_MODEL_RULES,
  objectiveModelVocab,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";

/** How an objective's result is expressed. */
export type MeasureType = "money" | "percentage" | "numeric" | "boolean";

/** Which way the number has to move for the objective to be met. */
export type ObjectiveDirection = "increase" | "decrease";

/**
 * Who will actually be writing this ciclo's objectives.
 *
 * This decides more than a label: when RH writes them directly, nobody needs
 * to be picked as an audience beforehand, so the whole participants step
 * drops out of the path. When a leader or a collaborator writes them, the
 * step stays — but which participant method makes sense to see first is
 * different for each: a leader starts from their team (grupos, agrupados por
 * líder), a collaborator starts from the widest net (toda la empresa).
 */
export type CicloObjectiveCreator = "leader" | "collaborator" | "hr" | "custom";

export const CICLO_OBJECTIVE_CREATOR_LABELS: Readonly<Record<CicloObjectiveCreator, string>> = {
  leader: "Líder",
  collaborator: "Colaboradores",
  hr: "Recursos Humanos",
  custom: "Personalizado",
};

/** One line under each option, so the choice reads as a real consequence and
 * not just a role name. */
export const CICLO_OBJECTIVE_CREATOR_TAGLINES: Readonly<Record<CicloObjectiveCreator, string>> = {
  leader: "El líder define los objetivos de su equipo",
  collaborator: "Cada colaborador propone los suyos",
  hr: "Tú los defines; no hace falta elegir participantes",
  custom: "Eliges puntualmente quién los crea",
};

/**
 * Menu order for "Por grupos", "Por colaborador", "Toda la empresa" e
 * "Importar archivo" once it is known who is writing the objectives. RH has
 * no entry here — that creator skips the participants step entirely, so no
 * order is ever needed for it. Otros funciona igual que colaboradores (gente
 * elegida a mano que crea lo suyo fuera de este constructor), así que
 * comparte su mismo orden.
 */
export const PARTICIPANT_MODES_BY_CREATOR: Readonly<
  Record<Exclude<CicloObjectiveCreator, "hr">, readonly ParticipantMode[]>
> = {
  leader: ["groups", "individual", "company", "import"],
  collaborator: ["individual", "company", "groups", "import"],
  custom: ["individual", "company", "groups", "import"],
};

/**
 * La frase bajo el título del paso de participantes. Con líder se eligen las
 * personas que van a redactar los objetivos de su equipo; con colaborador u
 * Otros, las que van a redactar los suyos —Otros es el mismo flujo que
 * colaborador, solo que la gente se elige puntualmente en vez de venir dada
 * por el rol—. RH no llega a este paso.
 */
export const CICLO_PARTICIPANTS_DESCRIPTIONS: Readonly<
  Record<Exclude<CicloObjectiveCreator, "hr">, string>
> = {
  leader: "Elige los líderes que van a crear los objetivos de sus equipos.",
  collaborator: "Elige los colaboradores que van a crear sus propios objetivos.",
  custom: "Elige las personas que van a crear sus propios objetivos.",
};

/** Whether a set of objectives is handed to groups or to individual people. */
export type ObjectiveSetKind = "grupal" | "individual" | "custom";

/** Length of the ciclo. Presets derive the closing date from the start. */
export type CicloPeriod =
  | "mes"
  | "bimestre"
  | "trimestre"
  | "semestre"
  | "anio"
  | "personalizado";

export const CICLO_PERIOD_LABELS: Readonly<Record<CicloPeriod, string>> = {
  mes: "Mes",
  bimestre: "Bimestre",
  trimestre: "Trimestre",
  semestre: "Semestre",
  anio: "Año",
  personalizado: "Personalizado",
};

/** Months each preset adds to the start date. Custom adds nothing. */
export const CICLO_PERIOD_MONTHS: Readonly<Record<CicloPeriod, number | null>> = {
  mes: 1,
  bimestre: 2,
  trimestre: 3,
  semestre: 6,
  anio: 12,
  personalizado: null,
};

/**
 * Everything the editor needs to say about one measure type.
 *
 * `when` is the sentence that answers "which one do I pick", and `examples`
 * are real objectives rather than field names — someone who doesn't recognise
 * "porcentaje" as a category still recognises "rotación del equipo".
 */
export interface MeasureMeta {
  label: string;
  /** Short glyph shown inside value inputs. */
  symbol: string;
  /** One-liner under the card title. */
  tagline: string;
  /** What the measure does, in the author's terms. */
  what: string;
  /** Which situation calls for it. */
  when: string;
  examples: readonly string[];
}

export const MEASURE_ORDER: readonly MeasureType[] = [
  "money",
  "percentage",
  "numeric",
  "boolean",
];

export const MEASURE_META: Readonly<Record<MeasureType, MeasureMeta>> = {
  money: {
    label: "Dinero",
    symbol: "$",
    tagline: "Ventas, gastos, presupuesto",
    what: "Financiero.",
    when: "Ventas, costos o presupuesto.",
    examples: ["Ventas trimestrales", "Ahorro"],
  },
  percentage: {
    label: "Porcentaje",
    symbol: "%",
    tagline: "Una parte sobre un total",
    what: "Proporciones.",
    when: "Márgenes, satisfacción o rotación.",
    examples: ["Satisfacción", "Cobertura"],
  },
  numeric: {
    label: "Numérico",
    symbol: "#",
    tagline: "Cantidad de cosas",
    what: "Cantidades.",
    when: "Elementos físicos o eventos.",
    examples: ["Clientes nuevos", "Visitas"],
  },
  boolean: {
    label: "Se cumple / No se cumple",
    symbol: "✓",
    tagline: "Sin cifras: se logra o no",
    what: "Logros.",
    when: "Hitos que se cumplen o no.",
    examples: ["Lanzar CRM", "Certificación ISO"],
  },
};

export interface DirectionMeta {
  label: string;
  /** What picking this actually means for the number. */
  headline: string;
  /** How the platform will read progress once the ciclo is running. */
  note: string;
}

export const DIRECTION_META: Readonly<Record<ObjectiveDirection, DirectionMeta>> = {
  increase: {
    label: "Aumentar",
    headline: "Quieres que el número suba",
    note: "El avance se calcula según cuánto sube desde el valor inicial hacia la meta.",
    },
  decrease: {
    label: "Reducir",
    headline: "Quieres que el número baje",
    note: "El avance se calcula según cuánto baja desde el valor inicial hacia la meta.",
  },
};

/**
 * A worked example per combination, so the pair of choices lands as a real
 * objective instead of two abstract settings. Boolean has no direction, so it
 * is absent from this table on purpose.
 */
export const DIRECTION_EXAMPLES: Readonly<
  Record<Exclude<MeasureType, "boolean">, Record<ObjectiveDirection, string>>
> = {
  money: {
    increase: "Aumentar las ventas del área de $50.000.000 a $80.000.000.",
    decrease: "Reducir los costos operativos de $15.000.000 a $10.000.000.",
  },
  percentage: {
    increase: "Subir la satisfacción del cliente del 78 % al 90 %.",
    decrease: "Bajar la tasa de cancelación de clientes del 15 % al 5 %.",
  },
  numeric: {
    increase: "Pasar de 12 a 20 clientes nuevos al mes.",
    decrease: "Reducir de 30 a 10 las quejas recibidas al mes.",
  },
};

/** Cómo se verifica una acción clave. */
export type KeyActionKind = "hito" | "cantidad";

export interface KeyActionKindMeta {
  label: string;
  /** Qué significa marcarla como cumplida. */
  tagline: string;
}

export const KEY_ACTION_KIND_META: Readonly<Record<KeyActionKind, KeyActionKindMeta>> = {
  hito: {
    label: "Hito",
    tagline: "Se marca hecha una sola vez",
  },
  cantidad: {
    label: "Cantidad",
    tagline: "Se cuenta cuántas veces se hizo",
  },
};

/**
 * Una acción clave: el trabajo concreto que lleva a la meta.
 *
 * Existe porque una cifra sola no dice qué hay que hacer para moverla — y
 * porque el avance de muchos objetivos se sigue por entregas, no por un
 * número que alguien reporta al final. `contribution` es cuánto de la meta
 * del objetivo cubre esta acción: entre todas las acciones de un objetivo
 * suman su 100 %, igual que los pesos de los objetivos suman el del ciclo.
 */
export interface KeyAction {
  id: string;
  title: string;
  kind: KeyActionKind;
  /** Cuánto del objetivo cubre esta acción, 1–100. */
  contribution: number;
  /** Solo con `kind: "cantidad"`: cuántas veces hay que hacerla. Texto por
   *  la misma razón que los valores del objetivo — una cifra a medio escribir
   *  no es todavía un número. */
  targetCount: string;
  /** ISO `yyyy-mm-dd`, o "" cuando no se le puso fecha. */
  dueDate: string;
}

/**
 * One objective.
 *
 * Values live as strings rather than numbers so a half-typed figure survives
 * the keystroke that produced it — "8" on the way to "80.000" is not the same
 * thing as the number eight, and coercing it would fight the author's typing.
 */
export interface Objective {
  id: string;
  title: string;
  description: string;
  /** Null until the author picks one — the first decision of the card. */
  measure: MeasureType | null;
  /** Always null while `measure` is "boolean": there is nothing to move. */
  direction: ObjectiveDirection | null;
  initialValue: string;
  targetValue: string;
  /** Whether the floor/ceiling pair is in play. Off by default: it is an
   * advanced rule, and most objectives never need it. */
  rangeEnabled: boolean;
  minValue: string;
  maxValue: string;
  /** Share of the ciclo this objective carries, 1–100. */
  weight: number;
  /** Company objective this one contributes to, or null when standalone. */
  alignedTo: string | null;
  /** La IA escribió esta tarjeta: qué se mide, hacia dónde y hasta dónde. Se
   * queda puesto aunque el autor después la retoque —lo que marca es de dónde
   * salió, no si sigue intacta— y solo se pierde si el objetivo se borra. Pulir
   * la redacción de uno escrito a mano no cuenta: ahí la meta la puso el
   * autor. */
  createdByAI: boolean;
  /**
   * Las acciones clave que llevan a la meta. Vacío por defecto: la mayoría de
   * los objetivos se siguen solo por su cifra, y pedir un plan de acción a
   * todos convertiría cada tarjeta en un proyecto.
   */
  keyActions: readonly KeyAction[];
  /**
   * Con `true`, el avance del objetivo se calcula sumando el aporte de las
   * acciones cumplidas en vez de leerlo de la cifra. Es lo que hace que las
   * acciones "cuenten para la meta" y no sean solo una lista de recordatorios,
   * y es también lo que obliga a que sus aportes sumen 100 %.
   */
  keyActionsDriveProgress: boolean;
}

/** A group an objective set can be handed to. */
export interface ObjectiveGroup {
  id: string;
  name: string;
  /** Who the group covers, in one line. */
  description: string;
  memberCount: number;
}

/**
 * One handout: who carries a set of objectives, and which ones.
 *
 * This is the unit the two assignment steps work in, and the reason they are
 * two steps. Weight is a share of *one person's* ciclo, so a single flat list
 * of objectives shared by every group and every person could never add up to
 * 100 % for anybody in particular. A set owns its own 100 %.
 *
 * `targetIds` holds segment values ("Marketing", "Finanzas") when the set is
 * `grupal`, and collaborator ids when it is `individual` — in both cases,
 * whatever identifies the people the set reaches.
 */
export interface ObjectiveSet {
  id: string;
  kind: ObjectiveSetKind;
  targetIds: readonly string[];
  objectives: readonly Objective[];
  /**
   * Qué parte del 100 % de una persona ocupa esta asignación. Ausente —el
   * caso normal— significa el ciclo entero.
   *
   * Existe porque alguien puede recibir objetivos por dos vías a la vez: los
   * de su grupo y los suyos propios. Cada asignación sigue siendo un reparto
   * cerrado, pero ya no siempre sobre 100: sobre el cupo que le tocó. Lo
   * escribe el modal de conflictos de peso, que es donde se decide cómo se
   * parte ese 100 entre las asignaciones que alcanzan a una misma persona.
   */
  weightShare?: number;
  /**
   * Gente que este set grupal *no* alcanza, aunque pertenezca a sus grupos.
   *
   * La pertenencia a un grupo se deduce del directorio, así que sin esta lista
   * no habría forma de decir "todo Servicio al cliente menos Andrés" — y esa
   * frase es justo la salida limpia cuando una sola persona del grupo lleva
   * además objetivos propios: en vez de encogerle el cupo al grupo entero por
   * culpa de uno, se le saca a él y los demás se quedan con su 100 %.
   */
  excludedIds?: readonly string[];
}

/**
 * Objetivos que una plantilla dejó escritos para un alcance de asignación,
 * todavía sin destinatario — el constructor los ofrece en cuanto se llega al
 * paso de ese `kind`, abriendo directo el mismo drawer de elegir grupos o
 * personas. Vive fuera de `objectiveSets` porque un set sin destinatarios no
 * es un handout real todavía, solo la promesa de uno.
 */
export interface CicloBuilderAssignmentSeed {
  kind: ObjectiveSetKind;
  objectives: readonly Objective[];
}

/**
 * Settings every group set shares: how the directory is bucketed into groups,
 * and whether group membership follows the org chart live — someone who
 * joins a group later (a transfer, a new hire) inherits its objectives
 * automatically, and someone who leaves one (changes area, changes leader,
 * is offboarded) has them withdrawn automatically. They sit outside the sets
 * because changing the bucketing re-defines what a "group" even is, so it
 * cannot belong to one set and not the next.
 */
export interface CicloAssignment {
  groupSegmentBy: SegmentKey;
  groupsAutoInclude: boolean;
}

/**
 * Qué pasa con el avance de alguien cuando el paso de Participantes lo
 * sincroniza en vivo con el organigrama y detecta que salió de la empresa o
 * que cambió de área/grupo a mitad del ciclo. Solo importa mientras esa
 * sincronización está activa (`companyAutoInclude`/`groupsAutoInclude` en
 * `ParticipantsSelection`) — con la lista congelada no hay evento que dispare
 * ninguna de las dos.
 *
 * Vive aparte de `ParticipantsSelection` a propósito: esa selección es
 * compartida con la encuesta, que no tiene avance que contar o no contar.
 */
export interface CicloResultsPolicy {
  /** Se desvincula de la empresa: ¿su avance hasta ese momento se retira de
   *  los promedios (false), o sigue contando igual (true)? */
  onCompanyLeaveCounts: boolean;
  /** Cambia de área o de grupo ("Por grupos" solamente): en el grupo
   *  anterior queda marcado inactivo siempre — eso no se elige—; esto decide
   *  si ese avance sigue contando ahí o no. En el grupo nuevo entra activo,
   *  sin relación con esta bandera. */
  onGroupChangeCounts: boolean;
}

/** Igual que "Retirado" en los estados de participante hoy: alguien que se va
 *  deja de contar por defecto, pero un traslado de área sí conserva lo
 *  avanzado en el equipo anterior. */
export const DEFAULT_CICLO_RESULTS_POLICY: CicloResultsPolicy = {
  onCompanyLeaveCounts: false,
  onGroupChangeCounts: true,
};

/** Lifecycle of a ciclo. Mirrors the survey's own states. */
export type CicloStatus = "draft" | "scheduled" | "live" | "closed";

export const CICLO_STATUS_LABELS: Readonly<Record<CicloStatus, string>> = {
  draft: "Borrador",
  scheduled: "Por iniciar",
  live: "En curso",
  closed: "Finalizado",
};

export interface CicloDraft {
  name: string;
  status: CicloStatus;
  period: CicloPeriod | null;
  /** ISO `yyyy-mm-dd`, the format the native date input reads and writes. */
  startDate: string;
  endDate: string;
  description: string;
  /** Con qué gramática se escriben los objetivos (OKR, KPI, SMART…). Solo
   * pone nombre, icono y vocabulario; las consecuencias viven en `modelRules`.
   * `null` mientras el autor no ha elegido. */
  objectiveModel: ObjectiveModelId | null;
  /** Las reglas resueltas del modelo. Todo lo que sigue a Datos generales lee
   * esto y nunca `objectiveModel`, así "Personalizado" y un preset recorren
   * el mismo código. */
  modelRules: ObjectiveModelRules;
  /** Who writes the objectives — decides whether the participants step even
   * applies, and in what order it offers its methods. */
  objectiveCreator: CicloObjectiveCreator | null;
  participants: ParticipantsSelection;
  /** Qué pasa con el avance de alguien a quien la sincronización automática
   *  del paso de Participantes le detecta una salida de la empresa o un
   *  cambio de área/grupo. Ver `CicloResultsPolicy`. */
  resultsPolicy: CicloResultsPolicy;
  /** Whether the company has top-level objectives for this ciclo. */
  useCompanyObjectives: boolean;
  /** Company-level objectives. Carry no weight: they frame the ciclo, they
   * are not something a single person is scored on. */
  companyObjectives: readonly Objective[];
  /** Whether this ciclo hands out objectives by group at all. Off hides the
   * step's content and drops its "at least one assignment" requirement —
   * a ciclo can run on individual assignments alone, or on none. */
  useGroupObjectives: boolean;
  /** Same switch as `useGroupObjectives`, for the individual step. */
  useIndividualObjectives: boolean;
  /** Whether this ciclo has custom assignment levels. */
  useCustomObjectives: boolean;
  assignment: CicloAssignment;
  /** The handouts. Both kinds live in one array — they are the same shape and
   * obey the same rules; the step each belongs to is `kind`. */
  objectiveSets: readonly ObjectiveSet[];
  /** El paso donde el autor dejó el borrador. Al reabrirlo se retoma ahí. */
  _lastStep?: import("./cicloStepper").CicloStepId;
  /** El bloque de la parametrización que estaba abierto al guardar. Retomar
   *  en el paso correcto pero con el acordeón plegado desde el principio
   *  sigue siendo empezar de nuevo. */
  _lastSetupBlock?: import("./cicloSetup").SetupBlockId | null;
  _id?: string;
}

/** Longest description accepted anywhere in the ciclo forms. */
export const MAX_CICLO_DESCRIPTION_LENGTH = 450;

/** Below 1 % an objective contributes nothing, so the form refuses it. */
export const MIN_OBJECTIVE_WEIGHT = 1;

/** Assigned objectives must add up to exactly this. */
export const TOTAL_WEIGHT = 100;

export const createObjectiveId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 15);

export const createBlankObjective = (weight = 0): Objective => ({
  id: `objective-${createObjectiveId()}`,
  title: "",
  description: "",
  measure: null,
  direction: null,
  initialValue: "",
  targetValue: "",
  rangeEnabled: false,
  minValue: "",
  maxValue: "",
  weight,
  alignedTo: null,
  createdByAI: false,
  keyActions: [],
  keyActionsDriveProgress: false,
});

export const createKeyAction = (contribution = 0): KeyAction => ({
  id: `action-${createObjectiveId()}`,
  title: "",
  kind: "hito",
  contribution,
  targetCount: "",
  dueDate: "",
});

/** Cuánto de la meta cubren, entre todas, las acciones ya escritas. */
export const keyActionsTotal = (actions: readonly KeyAction[]): number =>
  actions.reduce((sum, action) => sum + action.contribution, 0);

/**
 * Por qué la lista de acciones todavía no cierra, o null cuando sí.
 *
 * Mismo contrato de mensaje-y-no-booleano que `objectiveIssue`: la tarjeta, el
 * resumen del set y el aviso de finalizar tienen que nombrar el mismo hueco.
 * Los aportes solo son obligatorios cuando las acciones mandan el avance —si
 * son un plan de apoyo, no reparten nada y no hay 100 % que cuadrar.
 */
export function keyActionsIssue(
  objective: Objective,
  rules: ObjectiveModelRules = DEFAULT_OBJECTIVE_MODEL_RULES
): string | null {
  // El modelo decide si debajo del objetivo cuelga algo. Con "nada" —KPI—
  // no hay lista que revisar, aunque el objetivo arrastre acciones de un
  // modelo anterior: no se le piden, así que tampoco se le exigen.
  if (rules.children === "none") return null;

  const vocab = objectiveModelVocab(null, rules);
  const child = vocab.child?.toLowerCase() ?? "acción clave";
  const children = vocab.children?.toLowerCase() ?? "acciones clave";
  const isMasculine = vocab.childrenGender === "m";
  // Los resultados clave siempre miden el objetivo; las acciones solo si el
  // modelo —o el propio objetivo— dice que mueven el avance.
  const drivesProgress = rules.children === "results" || objective.keyActionsDriveProgress;

  const actions = objective.keyActions;
  if (actions.length === 0) {
    if (rules.childrenRequired) {
      return `Añade al menos ${isMasculine ? "un" : "una"} ${child}`;
    }
    return drivesProgress
      ? `Añade al menos ${isMasculine ? "un" : "una"} ${child} o desactiva el avance por ${children}`
      : null;
  }

  const unnamed = actions.filter((action) => action.title.trim() === "").length;
  if (unnamed > 0) {
    return `Ponle nombre a ${unnamed} ${unnamed === 1 ? child : children}`;
  }

  const countless = actions.filter(
    (action) => action.kind === "cantidad" && parseAmount(action.targetCount) === null
  ).length;
  if (countless > 0) {
    return `Dile cuántas veces se hace ${countless === 1 ? `1 ${child}` : `${countless} ${children}`}`;
  }

  if (!drivesProgress) return null;

  const total = keyActionsTotal(actions);
  if (total !== TOTAL_WEIGHT) {
    return total < TOTAL_WEIGHT
      ? `Falta repartir ${TOTAL_WEIGHT - total} % entre ${isMasculine ? "los" : "las"} ${children}`
      : `${isMasculine ? "Los" : "Las"} ${children} se pasan ${total - TOTAL_WEIGHT} % de la meta`;
  }
  return null;
}

// ── Numbers ────────────────────────────────────────────────────────────────

/**
 * Reads a typed figure. Accepts the separators a Spanish-speaking author will
 * actually use — "80.000", "80,5" — by treating a dot as a thousands mark and
 * a comma as the decimal point, which is how the number was written to begin
 * with. Returns null for anything that isn't a number yet.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/** Renders a figure the way its measure is read aloud. */
export function formatMeasureValue(value: number, measure: MeasureType | null): string {
  const amount = AMOUNT_FORMAT.format(value);
  // El signo va delante del símbolo, no entre él y las cifras: una pérdida se
  // escribe "-$1.000.000", nunca "$-1.000.000".
  if (measure === "money") {
    return value < 0 ? `-$${AMOUNT_FORMAT.format(Math.abs(value))}` : `$${amount}`;
  }
  if (measure === "percentage") return `${amount} %`;
  return amount;
}

/** Same, straight from the raw input, or null while it isn't a number yet. */
export function formatRawValue(raw: string, measure: MeasureType | null): string | null {
  const parsed = parseAmount(raw);
  return parsed === null ? null : formatMeasureValue(parsed, measure);
}

// ── Completeness ───────────────────────────────────────────────────────────

/**
 * Why an objective isn't finished yet, or null when it is.
 *
 * Returned as a message rather than a boolean because every caller — the card
 * header, the step gate, the finalize toast — wants to say *what* is missing,
 * and re-deriving that three times would let the three answers drift apart.
 */
export interface ObjectiveIssueOptions {
  requireWeight: boolean;
  /** Las reglas del ciclo. Sin ellas se corre con las de SMART, que son el
   *  constructor de siempre. */
  rules?: ObjectiveModelRules;
  /**
   * Si este objetivo tiene que colgar de uno de la empresa. Lo decide quien
   * llama y no las reglas por su cuenta: los objetivos de la empresa son el
   * norte, no cuelgan de nada, y con ellos esto siempre va apagado.
   */
  requireAlignment?: boolean;
}

export function objectiveIssue(
  objective: Objective,
  options: ObjectiveIssueOptions
): string | null {
  if (
    objective.title.trim() === "" ||
    objective.measure === null ||
    (objective.measure !== "boolean" && objective.direction === null) ||
    (objective.measure !== "boolean" && parseAmount(objective.targetValue) === null)
  ) {
    return "Faltan campos obligatorios";
  }

  if (objective.measure !== "boolean") {
    const target = parseAmount(objective.targetValue);
    const initial = parseAmount(objective.initialValue);
    const blocking = trackBlockingIssue(objective.direction, target!, initial);
    if (blocking !== null) return blocking;
  }

  if (options.requireWeight && objective.weight < MIN_OBJECTIVE_WEIGHT) {
    return `El peso no puede ser inferior al ${MIN_OBJECTIVE_WEIGHT} %`;
  }

  if (options.requireAlignment && objective.alignedTo === null) {
    return "Alinéalo a un objetivo de la empresa";
  }

  return keyActionsIssue(objective, options.rules);
}

export const isObjectiveComplete = (
  objective: Objective,
  options: ObjectiveIssueOptions
): boolean => objectiveIssue(objective, options) === null;

export const totalWeight = (objectives: readonly Objective[]): number =>
  objectives.reduce((sum, objective) => sum + objective.weight, 0);

/**
 * Splits a budget across `count` objectives without losing a point to
 * rounding: the remainder is handed out one unit at a time to the first
 * objectives, so three objectives get 34/33/33 rather than three 33s and a
 * missing point.
 *
 * `budget` defaults to the full 100 — the "repartir en partes iguales"
 * button — but the AI insert passes only the weight still unassigned, so the
 * objectives already on screen keep the share their author gave them.
 */
export function distributeWeights(count: number, budget: number = TOTAL_WEIGHT): number[] {
  if (count <= 0) return [];
  const safeBudget = Math.max(0, budget);
  const base = Math.floor(safeBudget / count);
  const remainder = safeBudget - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

// ── Objective sets ─────────────────────────────────────────────────────────

export const createObjectiveSet = (
  kind: ObjectiveSetKind,
  targetIds: readonly string[]
): ObjectiveSet => ({
  id: `set-${createObjectiveId()}`,
  kind,
  targetIds,
  objectives: [],
});

/**
 * Cuánto peso tiene que repartir esta asignación: el ciclo entero, o el cupo
 * que le dejaron las otras asignaciones que alcanzan a la misma persona.
 */
export const setWeightBudget = (set: ObjectiveSet): number =>
  set.weightShare ?? TOTAL_WEIGHT;

export const setsOfKind = (
  sets: readonly ObjectiveSet[],
  kind: ObjectiveSetKind
): readonly ObjectiveSet[] => sets.filter((set) => set.kind === kind);

/**
 * Why a set isn't ready, or null when it is. Same message-not-boolean contract
 * as `objectiveIssue`: the set card's badge, the step gate and the finalize
 * toast all name the gap, and they must name it identically.
 */
export function objectiveSetIssue(
  set: ObjectiveSet,
  options: { rules?: ObjectiveModelRules; requireAlignment?: boolean } = {}
): string | null {
  if (set.targetIds.length === 0) return "Esta asignación se quedó sin destinatarios";
  if (set.objectives.length === 0) return "Crea al menos un objetivo";

  const incomplete = set.objectives.filter(
    (objective) =>
      !isObjectiveComplete(objective, {
        requireWeight: true,
        rules: options.rules,
        requireAlignment: options.requireAlignment,
      })
  );
  if (incomplete.length > 0) {
    return `Completa ${incomplete.length} objetivo${incomplete.length === 1 ? "" : "s"}`;
  }

  const budget = setWeightBudget(set);
  const total = totalWeight(set.objectives);
  if (total !== budget) {
    return total < budget
      ? `Falta repartir ${budget - total} % de peso`
      : `Te pasaste ${total - budget} % de peso`;
  }
  return null;
}

export const isObjectiveSetComplete = (set: ObjectiveSet): boolean =>
  objectiveSetIssue(set) === null;

/** Every objective handed out across a list of sets. */
export const assignedObjectiveCount = (sets: readonly ObjectiveSet[]): number =>
  sets.reduce((sum, set) => sum + set.objectives.length, 0);
