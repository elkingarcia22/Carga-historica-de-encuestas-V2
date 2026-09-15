/**
 * Modelo de objetivos — qué "gramática" usa un ciclo para escribir sus metas.
 *
 * OKR, KPI, SMART, NCT y MBO no son cinco flujos distintos: son cinco formas
 * de combinar las mismas piezas que el constructor ya tiene —norte de
 * empresa, sets por grupo e individual, alineación, acciones clave, tipo de
 * cierre, ambición—. Por eso un modelo aquí es un *preset de reglas*
 * (`ObjectiveModelRules`), y "Personalizado" es el mismo panel de reglas con
 * los candados abiertos. Todo lo que viene después de Datos generales lee las
 * reglas resueltas, nunca el id del modelo: el id solo pone el nombre, el
 * icono y el vocabulario.
 *
 * BHAG queda fuera a propósito: un horizonte de 10 a 25 años no cabe en un
 * ciclo de mes a año. Su lugar es el norte de la empresa, no este selector.
 */

import {
  BookOpenText,
  Gauge,
  ListChecks,
  Network,
  SlidersHorizontal,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";
import type { CicloObjectiveCreator, CicloPeriod } from "./cicloBuilderTypes";

/**
 * Interruptor general. Apagado, el selector no aparece, el paso general no lo
 * exige y el borrador corre con las reglas de SMART —que son exactamente el
 * comportamiento que el constructor tenía antes de existir este módulo—.
 */
export const OBJECTIVE_MODELS_ENABLED = true;

export type ObjectiveModelId = "okr" | "kpi" | "smart" | "nct" | "mbo" | "custom";

/** Orden de la grilla: los tres más conocidos primero, el personalizado al final. */
export const OBJECTIVE_MODEL_ORDER: readonly ObjectiveModelId[] = [
  "okr",
  "kpi",
  "smart",
  "nct",
  "mbo",
  "custom",
];

/** Qué cuelga debajo de un objetivo. */
export type ObjectiveChildrenKind = "none" | "actions" | "results";

/** Si una pieza se apaga, se ofrece o se exige. */
export type RuleRequirement = "off" | "optional" | "required";

/** Cómo se decide si el objetivo se cumplió. */
export type ObjectiveClosing = "cumulative" | "threshold" | "binary";

/** Cada cuánto se espera que alguien actualice el avance. */
export type UpdateCadence = "free" | "weekly" | "monthly";

export interface ObjectiveModelRules {
  /** `results` = resultados clave con métrica propia (el objetivo se mide
   *  por ellos); `actions` = acciones clave, el plan; `none` = nada debajo. */
  children: ObjectiveChildrenKind;
  /** Solo aplica cuando `children !== "none"`. */
  childrenRequired: boolean;
  /** Solo aplica a `actions`: los resultados clave siempre mueven el avance. */
  childrenDriveProgress: boolean;
  companyObjectives: RuleRequirement;
  /** Solo aplica cuando hay norte de empresa. */
  alignment: "optional" | "required";
  closing: ObjectiveClosing;
  cadence: UpdateCadence;
  /** Cada objetivo lleva su propia fecha límite dentro del ciclo (SMART). */
  dueDatePerObjective: boolean;
}

/**
 * Los presets. SMART reproduce el constructor tal como era antes del
 * selector: métrica propia, acciones clave opcionales que no mueven el
 * avance, norte y alineación opcionales, cierre acumulativo.
 */
export const OBJECTIVE_MODEL_PRESETS: Readonly<
  Record<Exclude<ObjectiveModelId, "custom">, ObjectiveModelRules>
> = {
  okr: {
    children: "results",
    childrenRequired: true,
    childrenDriveProgress: true,
    companyObjectives: "required",
    alignment: "required",
    closing: "cumulative",
    cadence: "weekly",
    dueDatePerObjective: false,
  },
  kpi: {
    children: "none",
    childrenRequired: false,
    childrenDriveProgress: false,
    companyObjectives: "optional",
    alignment: "optional",
    closing: "threshold",
    cadence: "monthly",
    dueDatePerObjective: false,
  },
  smart: {
    children: "actions",
    childrenRequired: false,
    childrenDriveProgress: false,
    companyObjectives: "optional",
    alignment: "optional",
    closing: "cumulative",
    cadence: "free",
    dueDatePerObjective: true,
  },
  nct: {
    children: "actions",
    childrenRequired: true,
    childrenDriveProgress: false,
    companyObjectives: "required",
    alignment: "optional",
    closing: "cumulative",
    cadence: "weekly",
    dueDatePerObjective: false,
  },
  mbo: {
    children: "actions",
    childrenRequired: false,
    childrenDriveProgress: false,
    companyObjectives: "required",
    alignment: "required",
    closing: "binary",
    cadence: "free",
    dueDatePerObjective: false,
  },
};

/** Las reglas con las que corre un ciclo que no eligió modelo. */
export const DEFAULT_OBJECTIVE_MODEL_RULES: ObjectiveModelRules = OBJECTIVE_MODEL_PRESETS.smart;

export interface ObjectiveModelMeta {
  icon: LucideIcon;
  /** Sin tono, la tarjeta cae al gris/marca de las opciones planas. */
  tone?: Tone;
  label: string;
  /** El nombre largo, para la ayuda. */
  fullName: string;
  /** Una línea bajo el nombre: para qué sirve, en palabras del autor. */
  tagline: string;
  /** Cuándo elegirlo. Una frase. */
  help: string;
  /** Cómo se arma un objetivo en este modelo. Para el hover y el drawer,
   *  donde sí hay sitio para explicarlo entero. */
  structure: string;
  /** Un objetivo de ejemplo escrito en este modelo — lo que de verdad
   *  resuelve la duda de "¿y esto en qué se traduce?". */
  example: string;
  /**
   * Lo que el modelo *recomienda*, no lo que impone. Vive aquí y no en
   * `ObjectiveModelRules` porque no es una regla que el autor ajuste en el
   * drawer: es parte de lo que ese modelo es. Ninguna de las dos se aplica
   * sola — la duración solo se sugiere en su pregunta, y el creador es un
   * valor de partida que la pregunta siguiente deja cambiar.
   */
  suggestedPeriod: CicloPeriod;
  /** El creador que el modelo da por sentado, o `null` si no opina. */
  creator: CicloObjectiveCreator | null;
}

/**
 * Cada modelo es un *tipo* de cosa distinto —no seis sabores de lo mismo—,
 * así que cada uno lleva su acento: OKR crece (marca), KPI cuida la salud
 * (verde), SMART no dice nada por sí solo (índigo), NCT viene de equipos de
 * producto (IA), MBO se ata a bonos y por eso expone (ámbar). Personalizado
 * no es una categoría sino la puerta a las reglas, y va sin tono.
 */
export const OBJECTIVE_MODEL_META: Readonly<Record<ObjectiveModelId, ObjectiveModelMeta>> = {
  okr: {
    icon: Target,
    tone: "brand",
    label: "OKR",
    fullName: "Objectives and Key Results",
    suggestedPeriod: "trimestre",
    creator: null,
    tagline: "Crecer y alinear equipos",
    help: "Para ciclos trimestrales con metas ambiciosas que cuelgan del norte de la empresa.",
    structure:
      "Un objetivo cualitativo e inspirador que dice a dónde vas, y de 2 a 5 resultados clave con métrica propia que demuestran sin discusión si llegaste. El avance del objetivo sale del promedio de sus resultados.",
    example:
      "Convertirnos en la plataforma más rápida del mercado · Bajar el tiempo de carga de 4 s a 1,5 s · Reducir los bugs críticos un 40 %",
  },
  kpi: {
    icon: Gauge,
    tone: "positive",
    label: "KPI",
    fullName: "Key Performance Indicators",
    suggestedPeriod: "mes",
    creator: null,
    tagline: "Salud del negocio",
    help: "Para la operación de siempre: retención, costo, tiempos de respuesta.",
    structure:
      "Un indicador por objetivo, con un umbral que hay que mantener en vez de una meta a la que llegar. No lleva nada debajo y se revisa con una frecuencia fija.",
    example: "Mantener la retención mensual por encima del 85 %, revisado cada mes",
  },
  smart: {
    icon: ListChecks,
    tone: "neutral",
    label: "SMART",
    fullName: "Específico, Medible, Alcanzable, Relevante, Temporal",
    suggestedPeriod: "trimestre",
    creator: null,
    tagline: "Metas claras y concretas",
    help: "El modelo de siempre: sirve para casi todo y no exige norte ni alineación.",
    structure:
      "Un objetivo con su métrica, su valor inicial, su meta y su fecha límite. Las acciones clave son opcionales y funcionan como plan: no mueven el avance.",
    example: "Subir la satisfacción del cliente de 7,8 a 8,5 antes del 31 de marzo",
  },
  nct: {
    icon: BookOpenText,
    tone: "ai",
    label: "NCT",
    fullName: "Narrative, Commitments, Tasks",
    suggestedPeriod: "trimestre",
    creator: null,
    tagline: "Contexto y compromisos",
    help: "Para equipos ágiles que quieren ver la estrategia y la ejecución juntas.",
    structure:
      "Una narrativa corta por equipo que explica por qué importa este ciclo, de 3 a 5 compromisos medibles que el equipo sí se compromete a cumplir, y las tareas concretas que los sostienen.",
    example:
      "Narrativa: el onboarding es donde perdemos clientes · Compromiso: bajar el abandono del registro del 40 % al 25 % · Tareas: rediseñar el paso 2, quitar el correo de verificación",
  },
  mbo: {
    icon: Network,
    tone: "warning",
    label: "MBO",
    fullName: "Management by Objectives",
    suggestedPeriod: "anio",
    creator: "leader",
    tagline: "Cascada anual",
    help: "Para ciclos anuales en cascada, atados a la evaluación de desempeño.",
    structure:
      "Metas que bajan en cascada de la dirección al área y de ahí a cada persona, acordadas entre líder y colaborador, y cerradas en cumplió o no cumplió, sin grados intermedios.",
    example: "Cerrar el año con el presupuesto de operación dentro de lo aprobado: cumplió / no cumplió",
  },
  custom: {
    icon: SlidersHorizontal,
    label: "Personalizado",
    fullName: "Modelo propio",
    suggestedPeriod: "trimestre",
    creator: null,
    tagline: "Tus propias reglas",
    help: "Parte del modelo que tenías y ajusta cada regla a tu manera.",
    structure:
      "Las mismas reglas de los demás modelos, abiertas una a una: qué cuelga de un objetivo, cómo se cierra, si el norte de la empresa es obligatorio, entre quiénes se reparte.",
    example: "Por ejemplo, OKR pero sin obligar a alinearse al norte de la empresa",
  },
};

/** Cómo llama cada modelo a sus piezas. El constructor habla en estos términos. */
export interface ObjectiveModelVocab {
  objective: string;
  objectives: string;
  /** Los hijos, en plural; `null` cuando el modelo no tiene. */
  children: string | null;
  child: string | null;
  /** Género de los hijos, para concordar artículos y adjetivos: "los hitos
   *  son obligatorios" frente a "las tareas son obligatorias". */
  childrenGender: "m" | "f";
  /** Cómo se llama el valor al que hay que llegar. */
  target: string;
}

const VOCAB_BY_MODEL: Readonly<Record<Exclude<ObjectiveModelId, "custom">, ObjectiveModelVocab>> =
  {
    okr: {
      objective: "Objetivo",
      objectives: "Objetivos",
      children: "Resultados clave",
      child: "Resultado clave",
      childrenGender: "m",
      target: "Meta",
    },
    kpi: {
      objective: "Indicador",
      objectives: "Indicadores",
      children: null,
      child: null,
      childrenGender: "f",
      target: "Umbral",
    },
    smart: {
      objective: "Objetivo",
      objectives: "Objetivos",
      children: "Acciones clave",
      child: "Acción clave",
      childrenGender: "f",
      target: "Meta",
    },
    nct: {
      objective: "Compromiso",
      objectives: "Compromisos",
      children: "Tareas",
      child: "Tarea",
      childrenGender: "f",
      target: "Meta",
    },
    mbo: {
      objective: "Meta",
      objectives: "Metas",
      children: "Hitos",
      child: "Hito",
      childrenGender: "m",
      target: "Meta",
    },
  };

const CHILDREN_VOCAB: Readonly<
  Record<ObjectiveChildrenKind, Pick<ObjectiveModelVocab, "children" | "child" | "childrenGender">>
> = {
  none: { children: null, child: null, childrenGender: "f" },
  actions: { children: "Acciones clave", child: "Acción clave", childrenGender: "f" },
  results: { children: "Resultados clave", child: "Resultado clave", childrenGender: "m" },
};

/**
 * El vocabulario de un ciclo. Los presets tienen el suyo; el personalizado
 * habla en genérico y toma el nombre de los hijos de la regla que eligió.
 */
export function objectiveModelVocab(
  model: ObjectiveModelId | null,
  rules: ObjectiveModelRules
): ObjectiveModelVocab {
  if (model !== null && model !== "custom") return VOCAB_BY_MODEL[model];
  return {
    objective: "Objetivo",
    objectives: "Objetivos",
    ...CHILDREN_VOCAB[rules.children],
    target: rules.closing === "threshold" ? "Umbral" : "Meta",
  };
}

/** Las reglas de un preset, o `null` para personalizado (que conserva las suyas). */
export function objectiveModelPreset(model: ObjectiveModelId): ObjectiveModelRules | null {
  return model === "custom" ? null : OBJECTIVE_MODEL_PRESETS[model];
}

/**
 * Reglas equivalentes, campo a campo. Sirve para saber si un ciclo
 * "personalizado" en realidad sigue siendo un preset intacto.
 */
export function areObjectiveModelRulesEqual(
  a: ObjectiveModelRules,
  b: ObjectiveModelRules
): boolean {
  return (
    a.children === b.children &&
    a.childrenRequired === b.childrenRequired &&
    a.childrenDriveProgress === b.childrenDriveProgress &&
    a.companyObjectives === b.companyObjectives &&
    a.alignment === b.alignment &&
    a.closing === b.closing &&
    a.cadence === b.cadence &&
    a.dueDatePerObjective === b.dueDatePerObjective
  );
}

/** Qué preset reproduce exactamente estas reglas, si alguno. */
export function matchingObjectiveModel(
  rules: ObjectiveModelRules
): Exclude<ObjectiveModelId, "custom"> | null {
  for (const id of OBJECTIVE_MODEL_ORDER) {
    if (id === "custom") continue;
    if (areObjectiveModelRulesEqual(OBJECTIVE_MODEL_PRESETS[id], rules)) return id;
  }
  return null;
}

/**
 * El núcleo de cada modelo: las reglas sin las cuales deja de ser ese modelo.
 *
 * No todas las reglas pesan igual. Un ciclo de OKR que se revisa cada mes en
 * vez de cada semana sigue siendo OKR para cualquiera que lo lea; uno cuyos
 * objetivos ya no cuelgan de resultados clave, no. Por eso el núcleo se
 * declara por modelo y todo lo demás se puede afinar sin perder el nombre.
 *
 * Se guardan las *claves* y no los valores: los valores los pone el preset,
 * así no hay dos sitios que puedan decir cosas distintas sobre lo mismo.
 */
export const OBJECTIVE_MODEL_CORE: Readonly<
  Record<Exclude<ObjectiveModelId, "custom">, readonly (keyof ObjectiveModelRules)[]>
> = {
  // El O y los KR: un objetivo cualitativo medido por sus resultados clave.
  okr: ["children", "childrenDriveProgress"],
  // Un indicador solo, contra un umbral que se mantiene.
  kpi: ["children", "closing"],
  // La T de SMART —su fecha— y una meta a la que se llega acumulando.
  smart: ["closing", "dueDatePerObjective"],
  // Compromisos que se cumplen, tareas que los sostienen sin marcar el
  // avance, y un porqué del que cuelgan.
  nct: ["children", "childrenRequired", "childrenDriveProgress", "companyObjectives"],
  // Cumplió o no cumplió, en cascada desde el norte.
  mbo: ["closing", "companyObjectives", "alignment"],
};

/** Cómo se llama cada regla cuando hay que nombrarla en una frase. */
const RULE_LABELS: Readonly<Record<keyof ObjectiveModelRules, string>> = {
  children: "qué cuelga de cada objetivo",
  childrenRequired: "si lo que cuelga es obligatorio",
  childrenDriveProgress: "si lo que cuelga mueve el avance",
  closing: "cómo se cierra",
  cadence: "cada cuánto se actualiza",
  dueDatePerObjective: "la fecha límite por objetivo",
  companyObjectives: "los objetivos de la empresa",
  alignment: "la alineación al norte",
};

/** Si estas reglas todavía son las de ese modelo, aunque estén afinadas. */
export function matchesObjectiveModelCore(
  model: Exclude<ObjectiveModelId, "custom">,
  rules: ObjectiveModelRules
): boolean {
  const preset = OBJECTIVE_MODEL_PRESETS[model];
  return OBJECTIVE_MODEL_CORE[model].every((key) => preset[key] === rules[key]);
}

/** Qué reglas del núcleo se cambiaron, nombradas para decirlo en una frase. */
export function brokenObjectiveModelCore(
  model: Exclude<ObjectiveModelId, "custom">,
  rules: ObjectiveModelRules
): readonly string[] {
  const preset = OBJECTIVE_MODEL_PRESETS[model];
  return OBJECTIVE_MODEL_CORE[model]
    .filter((key) => preset[key] !== rules[key])
    .map((key) => RULE_LABELS[key]);
}

/** Reglas afinadas respecto de su preset, sin que eso signifique romperlo. */
export function isObjectiveModelAdjusted(
  model: ObjectiveModelId,
  rules: ObjectiveModelRules
): boolean {
  const preset = objectiveModelPreset(model);
  return preset !== null && !areObjectiveModelRulesEqual(preset, rules);
}

/**
 * Cómo se llama el ciclo tras tocar las reglas.
 *
 * Partiendo de un preset, mientras el núcleo aguante sigue siendo ese
 * modelo; en cuanto se rompe, pasa a personalizado y no se renombra solo a
 * otro preset —que un OKR retocado amaneciera llamándose MBO sería una
 * sorpresa, no una ayuda—. Partiendo de personalizado sí puede ganarse un
 * nombre, pero solo reproduciendo un preset entero, no su núcleo: ahí el
 * autor no eligió ningún modelo, así que la coincidencia tiene que ser
 * exacta para afirmar que es ese.
 */
export function resolveObjectiveModel(
  opened: ObjectiveModelId,
  rules: ObjectiveModelRules
): ObjectiveModelId {
  if (opened === "custom") return matchingObjectiveModel(rules) ?? "custom";
  return matchesObjectiveModelCore(opened, rules) ? opened : "custom";
}

/** Etiquetas de cada valor de regla, para el panel de lectura y el editor. */
export const CHILDREN_KIND_LABELS: Readonly<Record<ObjectiveChildrenKind, string>> = {
  none: "Nada",
  actions: "Acciones clave",
  results: "Resultados clave",
};

export const REQUIREMENT_LABELS: Readonly<Record<RuleRequirement, string>> = {
  off: "No se usa",
  optional: "Opcional",
  required: "Obligatorio",
};

export const CLOSING_LABELS: Readonly<Record<ObjectiveClosing, string>> = {
  cumulative: "Acumulado",
  threshold: "Umbral",
  binary: "Cumplió / no",
};

export const CLOSING_HELP: Readonly<Record<ObjectiveClosing, string>> = {
  cumulative: "El avance va de un valor inicial a una meta.",
  threshold: "Se cumple mientras el indicador se mantenga dentro del umbral.",
  binary: "Se cierra en cumplió o no cumplió, sin grados.",
};

export const CADENCE_LABELS: Readonly<Record<UpdateCadence, string>> = {
  free: "Libre",
  weekly: "Semanal",
  monthly: "Mensual",
};

/** Un dato del modelo: el nombre de la regla y lo que vale en este preset. */
export interface ObjectiveModelFact {
  label: string;
  value: string;
}

/**
 * Lo que trae el modelo, como cuatro a seis datos cortos en vez de una lista
 * de frases.
 *
 * Se lee de un vistazo y en una fila —un selector que empuja las fechas
 * fuera de la pantalla deja de ser una ayuda—, y cada dato dice cuál de las
 * reglas es: al abrir "Ajustar el modelo" el autor reconoce las mismas
 * etiquetas en el panel de reglas.
 */
export function summarizeObjectiveModelRules(
  rules: ObjectiveModelRules,
  vocab: ObjectiveModelVocab
): readonly ObjectiveModelFact[] {
  const facts: ObjectiveModelFact[] = [];

  facts.push({
    label: "Debajo",
    value:
      rules.children === "results"
        ? `2 a 5 ${vocab.children!.toLowerCase()}`
        : rules.children === "actions"
          ? `${vocab.children} ${rules.childrenRequired ? "obligatorias" : "opcionales"}`
          : "Solo la métrica",
  });

  if (rules.children !== "none") {
    const drives = rules.children === "results" || rules.childrenDriveProgress;
    facts.push({
      label: "Avance",
      value: drives ? `Lo mueven ${vocab.children!.toLowerCase()}` : "Lo mueve la métrica",
    });
  }

  facts.push({ label: "Cierre", value: CLOSING_LABELS[rules.closing] });

  facts.push({
    label: "Norte",
    value:
      rules.companyObjectives === "off"
        ? "No se usa"
        : rules.companyObjectives === "required"
          ? rules.alignment === "required"
            ? "Obligatorio y alineado"
            : "Obligatorio"
          : "Opcional",
  });

  if (rules.cadence !== "free") {
    facts.push({ label: "Actualiza", value: CADENCE_LABELS[rules.cadence] });
  }

  if (rules.dueDatePerObjective) {
    facts.push({ label: "Además", value: "Fecha límite por objetivo" });
  }

  return facts;
}

/**
 * Las reglas fijas del modelo, dichas como lo que el sistema va a exigir.
 *
 * `summarizeObjectiveModelRules` las da como datos cortos para una fila; esto
 * las da como frases para el momento de elegir: "este modelo requiere un
 * objetivo padre", "usa umbrales y no metas fijas". Se calculan de las reglas
 * resueltas y no del id, así un modelo personalizado también explica lo suyo.
 */
export function objectiveModelRuleSentences(
  rules: ObjectiveModelRules,
  vocab: ObjectiveModelVocab
): readonly string[] {
  const objective = vocab.objective.toLowerCase();
  const children = vocab.children?.toLowerCase() ?? "acciones";
  const isMasculine = vocab.childrenGender === "m";
  const requiredWord = isMasculine ? "obligatorios" : "obligatorias";
  const sentences: string[] = [];

  if (rules.children === "results") {
    sentences.push(
      `Cada ${objective} se mide por sus ${children}: de 2 a 5, cada uno con métrica propia.`
    );
  } else if (rules.children === "actions") {
    if (rules.childrenRequired && rules.childrenDriveProgress) {
      sentences.push(
        `Cada ${objective} lleva ${children} ${requiredWord}, y el avance sale de cuánt${isMasculine ? "os" : "as"} se completan.`
      );
    } else if (rules.childrenRequired) {
      sentences.push(
        `Cada ${objective} lleva ${children} ${requiredWord}: son el plan, no el marcador.`
      );
    } else if (rules.childrenDriveProgress) {
      sentences.push(
        `${vocab.children ?? "Acciones"} opcionales bajo cada ${objective}; si las hay, mueven el avance.`
      );
    } else {
      sentences.push(
        `${vocab.children ?? "Acciones"} opcionales bajo cada ${objective}, como plan de apoyo.`
      );
    }
  } else {
    sentences.push(`Cada ${objective} es una sola métrica, sin nada debajo.`);
  }

  if (rules.closing === "threshold") {
    sentences.push("Usa umbrales que hay que mantener, no metas fijas a las que llegar.");
  } else if (rules.closing === "binary") {
    sentences.push("Se cierra en cumplió / no cumplió, sin grados intermedios.");
  } else {
    sentences.push("El avance va del valor inicial a la meta.");
  }

  if (rules.companyObjectives === "required") {
    sentences.push(
      rules.alignment === "required"
        ? `Requiere objetivos de la empresa, y cada ${objective} asignado debe colgar de uno: tiene objetivo padre.`
        : "Requiere al menos un objetivo de la empresa; alinearse a él es opcional."
    );
  } else if (rules.companyObjectives === "optional") {
    sentences.push(
      rules.alignment === "required"
        ? "Los objetivos de la empresa son opcionales; si los defines, todo lo asignado debe alinearse a ellos."
        : "Los objetivos de la empresa son opcionales."
    );
  } else {
    sentences.push("No usa objetivos de la empresa: el ciclo se sostiene con lo que se asigna.");
  }

  if (rules.cadence !== "free") {
    sentences.push(
      `Recuerda actualizar el avance cada ${rules.cadence === "weekly" ? "semana" : "mes"}.`
    );
  }

  if (rules.dueDatePerObjective) {
    sentences.push(`Cada ${objective} lleva su propia fecha límite dentro del ciclo.`);
  }

  return sentences;
}
