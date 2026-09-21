/**
 * Qué pregunta el Agente IA: depende de para quién escribe y con qué modelo.
 *
 * Antes el chat hacía las mismas cuatro preguntas siempre. Pero escribir el
 * norte de la empresa y escribir lo que carga un colaborador no son la misma
 * conversación: la primera parte de cero y la segunda parte de algo que ya
 * está escrito arriba —los objetivos de la empresa—, así que preguntarle a un
 * grupo "¿en qué frentes se juega el ciclo?" es volver a abrir una decisión
 * que la compañía ya tomó. Y el modelo del ciclo cambia qué hay que saber
 * antes de escribir: OKR necesita cuántos resultados clave cuelgan de cada
 * objetivo, KPI no tiene nada debajo pero sí un umbral que sostener.
 *
 * Aquí vive todo eso —el orden de las preguntas, su texto y sus opciones— en
 * un solo sitio, leyendo `ObjectiveModelRules` y nunca el id del modelo, que
 * es lo que deja que "Personalizado" y un preset recorran el mismo código.
 */

import type { Objective } from "./cicloBuilderTypes";
import {
  objectiveChildrenVocab,
  objectiveModelVocab,
  type ObjectiveModelId,
  type ObjectiveModelRules,
  type ObjectiveModelVocab,
} from "./objectiveModel";
import {
  AMBITION_META,
  AMBITION_ORDER,
  FOCUS_META,
  FOCUS_ORDER,
  MAX_AI_OBJECTIVES,
} from "./aiObjectiveBrief";
import type { ParsedBrief } from "./aiChatParser";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

/** Para quién escribe la IA. Cambia qué se pregunta y en qué orden. */
export type ObjectiveScope = "empresa" | "grupo" | "colaborador";

export type CriterionId =
  | "focuses"
  | "alignment"
  | "lever"
  | "count"
  | "ambition"
  | "children"
  | "baseline";

export interface ChatChip {
  label: string;
  value: string;
  /** La línea gris bajo el título: de qué trata la opción, en pocas
   *  palabras. Sin ella la fila queda como el badge numerado de siempre. */
  description?: string;
  /** Solo en la fila "Otro": qué dice su campo de texto mientras está vacío. */
  placeholder?: string;
  /** Solo para las acciones de revisión: conserva el acento de marca en
   *  "conservar" y el rojo de peligro en "descartar" aunque vivan como
   *  chips normales dentro del flujo, no como botones aparte. */
  tone?: "primary" | "danger";
}

/** Todo lo que el chat sabe del ciclo antes de abrir la boca. */
export interface ChatContext {
  scope: ObjectiveScope;
  rules: ObjectiveModelRules;
  model: ObjectiveModelId | null;
  /** El norte ya escrito. Es el contexto que convierte la conversación de
   *  un grupo en una alineación y no en un ciclo paralelo. */
  companyObjectives: readonly Objective[];
  /** De quién son estos objetivos, dicho como se diría en voz alta:
   *  "Marketing", "Ana Pérez", "la empresa". */
  audienceLabel: string;
  maxCount: number;
}

/* ------------------------------------------------------------------ *
 * Valores especiales de las opciones
 * ------------------------------------------------------------------ */

/** Abre el campo de escribir dentro de la propia lista de opciones. */
export const WRITE_OWN_VALUE = "__write__";
/** Cierra una ronda de selección múltiple con lo ya elegido. */
export const CONTINUE_VALUE = "__continue__";
export const SKIP_BASELINE_VALUE = "__sin_restricciones__";
export const SKIP_LEVER_VALUE = "__sin_palanca__";
/** "Estos objetivos no cuelgan de ninguno de la empresa". */
export const NO_ALIGNMENT_VALUE = "__sin_norte__";
/** "No les pongas nada debajo" — solo existe si el modelo no los exige. */
export const NO_CHILDREN_VALUE = "__sin_hijos__";

/* ------------------------------------------------------------------ *
 * Ayudas
 * ------------------------------------------------------------------ */

export const chatVocab = (ctx: ChatContext): ObjectiveModelVocab =>
  objectiveModelVocab(ctx.model, ctx.rules);

/** Cómo se llama lo que cuelga, incluidas las tareas de seguimiento de los
 *  modelos que no llevan nada que mida. */
export const chatChildrenVocab = (ctx: ChatContext): ObjectiveModelVocab =>
  objectiveChildrenVocab(ctx.model, ctx.rules);

/** Con el modelo sin hijos, lo que se ofrece es un plan, no una medida. */
export const isFollowUpPlan = (ctx: ChatContext): boolean => ctx.rules.children === "none";

/** Si hay norte del que colgar: el modelo lo permite y alguien lo escribió. */
export const canAlign = (ctx: ChatContext): boolean =>
  ctx.scope !== "empresa" &&
  ctx.rules.companyObjectives !== "off" &&
  ctx.companyObjectives.length > 0;

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** El título de un objetivo de la empresa, o un relleno si todavía no tiene. */
export const companyObjectiveLabel = (objective: Objective, index: number): string =>
  objective.title.trim() === "" ? `Objetivo ${index + 1} de la empresa` : objective.title.trim();

/* ------------------------------------------------------------------ *
 * Orden de las preguntas
 * ------------------------------------------------------------------ */

/**
 * Qué falta por preguntar, en el orden en que se pregunta.
 *
 * Para la empresa el orden es el de siempre: primero dónde se juega el ciclo,
 * después cuántos y qué tan exigentes. Para un grupo o una persona la primera
 * pregunta es otra —de qué objetivo de la empresa cuelga esto— porque de esa
 * respuesta salen los frentes: si ya se sabe que el grupo apunta al objetivo
 * de retención, preguntarle en qué frentes juega es hacerle repetir algo que
 * ya dijo.
 */
export function missingCriteria(brief: ParsedBrief, ctx: ChatContext): CriterionId[] {
  const missing: CriterionId[] = [];
  if (canAlign(ctx) && !brief.alignmentAsked) missing.push("alignment");
  // La palanca solo tiene sentido frente a un objetivo de la empresa: es "de
  // ese resultado, ¿qué te toca a ti?". En un ciclo sin norte se convierte en
  // otra forma de preguntar lo que el saludo ya preguntó.
  if (canAlign(ctx) && !brief.leverAsked) missing.push("lever");
  if (brief.focuses.length === 0) missing.push("focuses");
  if (brief.count === null) missing.push("count");
  if (brief.ambition === null) missing.push("ambition");
  // También cuando el modelo no cuelga nada que mida: ahí lo que se ofrece
  // son tareas de seguimiento, opcionales y sin tocar el avance.
  if (ctx.scope !== "empresa" && !brief.childrenAsked) missing.push("children");
  if (!brief.baselineAsked) missing.push("baseline");
  return missing;
}

/* ------------------------------------------------------------------ *
 * Saludo
 * ------------------------------------------------------------------ */

/**
 * El saludo dice para quién se escribe y con qué reglas, y nada más: la
 * primera respuesta tiene que ser el contexto real de quien escribe, así que
 * no lleva opciones ni ejemplos que le pongan palabras en la boca.
 */
export function chatGreeting(ctx: ChatContext, mode: "single" | "set"): string {
  const vocab = chatVocab(ctx);
  const objetivos = lower(mode === "single" ? vocab.objective : vocab.objectives);

  // Una sola pregunta, no tres encadenadas: el saludo pide el contexto y ya.
  const opening =
    ctx.scope === "empresa"
      ? `¡Hola! 👋 Vamos con los ${objetivos} de la empresa. Cuéntame qué se juega la compañía en este ciclo.`
      : `¡Hola! 👋 Vamos con los ${objetivos} de ${ctx.audienceLabel}. Cuéntame qué tiene que sacar adelante en este ciclo.`;

  return [opening, modelLine(ctx)].filter(Boolean).join(" ");
}

/** Una línea sobre cómo pide escribir este modelo, cuando pide algo especial. */
function modelLine(ctx: ChatContext): string | null {
  const vocab = chatVocab(ctx);
  const parts: string[] = [];

  if (ctx.rules.children !== "none" && vocab.children) {
    const children = lower(vocab.children);
    parts.push(
      ctx.rules.childrenRequired
        ? `cada ${lower(vocab.objective)} lleva sus ${children}`
        : `${children} opcionales debajo`
    );
  }
  if (ctx.rules.closing === "threshold") {
    parts.push(`un ${lower(vocab.target)} que sostener en vez de una meta a la que llegar`);
  }
  if (canAlign(ctx) && ctx.rules.alignment === "required") {
    parts.push("y todo cuelga del norte de la empresa");
  }

  if (parts.length === 0) return null;
  return `Este ciclo corre con ${modelName(ctx)}: ${parts.join(", ")}.`;
}

const modelName = (ctx: ChatContext): string => {
  const vocab = chatVocab(ctx);
  return ctx.model !== null && ctx.model !== "custom"
    ? ctx.model.toUpperCase()
    : `${lower(vocab.objectives)} a tu medida`;
};

/* ------------------------------------------------------------------ *
 * Enunciado de cada pregunta
 * ------------------------------------------------------------------ */

export function criterionQuestion(
  criterion: CriterionId,
  ctx: ChatContext,
  brief: ParsedBrief
): string {
  const vocab = chatVocab(ctx);
  const who = ctx.audienceLabel;

  switch (criterion) {
    // Sin la coletilla de "elige al menos uno": que la alineación sea
    // obligatoria ya se dice quitando la fila "Ninguno", no repitiéndolo.
    case "alignment":
      return `¿A qué objetivos de la empresa le aporta el trabajo de ${who}?`;

    // "Depende de X" y no "X puede hacer" porque el destinatario tanto puede
    // ser una persona como diez grupos, y la frase tiene que leerse igual de
    // bien con las dos.
    case "lever":
      // Sin alineación no hay "ese resultado" del que hablar todavía.
      return brief.alignedTo.length > 0
        ? `¿Qué depende de ${who} para mover ese resultado?`
        : `¿Qué resultado depende de ${who} en este ciclo?`;

    case "focuses":
      return ctx.scope === "empresa"
        ? "¿En qué frentes se juega este ciclo?"
        : `¿En qué temas trabaja ${who}?`;

    case "count":
      return ctx.scope === "empresa"
        ? `¿Cuántos ${lower(vocab.objectives)} de empresa quieres?`
        : `¿Cuántos ${lower(vocab.objectives)} quieres para ${who}?`;

    case "ambition":
      return ctx.rules.closing === "threshold"
        ? `¿Qué tan exigente debe ser el ${lower(vocab.target)}?`
        : `¿Qué tan exigentes deben ser ${vocab.target === "Meta" ? "las metas" : `los ${lower(vocab.target)}s`}?`;

    case "children": {
      const children = lower(chatChildrenVocab(ctx).children ?? "acciones clave");
      const objetivo = lower(vocab.objective);
      // Lo de "es opcional" lo dice la fila "Sin …", no el enunciado.
      return ctx.rules.childrenRequired && !isFollowUpPlan(ctx)
        ? `¿Cuántos ${children} le pongo a cada ${objetivo}?`
        : `¿Quieres que le ponga ${children} a cada ${objetivo}?`;
    }

    // Una sola pregunta en vez de dos encadenadas —punto de partida y
    // restricciones—: las dos buscaban lo mismo, que las metas no salgan de
    // la nada, y preguntarlas juntas obligaba a contestar dos cosas de golpe.
    case "baseline":
      return "¿Hay algo más que deba tener en cuenta para que las metas sean realistas?";
  }

  return "";
}

/* ------------------------------------------------------------------ *
 * Opciones de cada pregunta
 * ------------------------------------------------------------------ */

/**
 * La fila "Otro", con su propio campo de texto.
 *
 * Va en todas las preguntas sin excepción: la lista es una ayuda para no
 * teclear, nunca el catálogo completo de respuestas posibles, y una pregunta
 * que solo acepta lo que la IA se imaginó deja fuera al ciclo que no se
 * parece a ninguno. El campo vive en la propia fila para no mandar la vista
 * al cuadro de abajo.
 */
export function writeOwnChip(label: string, placeholder: string): ChatChip {
  return { label, value: WRITE_OWN_VALUE, placeholder };
}

export function criterionChips(
  criterion: CriterionId,
  ctx: ChatContext,
  brief: ParsedBrief
): readonly ChatChip[] {
  switch (criterion) {
    case "alignment":
      return alignmentChips(ctx, brief.alignedTo);
    case "lever":
      return [
        {
          label: "Decídelo tú",
          value: SKIP_LEVER_VALUE,
          description: "Con lo que ya te conté es suficiente",
        },
        writeOwnChip("Otro", "Escríbelo con tus palabras"),
      ];
    case "focuses":
      return focusChips(ctx, brief.focuses);
    case "count":
      return [...countChips(ctx), writeOwnChip("Otro", "Escribe cuántos quieres")];
    case "ambition":
      return [...ambitionChips(ctx), writeOwnChip("Otro", "Dime qué tan exigente")];
    case "children":
      return [...childrenChips(ctx), writeOwnChip("Otro", "Escribe cuántos por objetivo")];
    case "baseline":
      return [
        { label: "No, nada más", value: SKIP_BASELINE_VALUE },
        writeOwnChip("Sí, algo más", "Escribe lo que deba tener en cuenta"),
      ];
  }
}

/** Los objetivos de la empresa que todavía no se eligieron, uno por fila. */
export function alignmentChips(
  ctx: ChatContext,
  picked: readonly string[]
): readonly ChatChip[] {
  const options: ChatChip[] = ctx.companyObjectives
    .map((objective, index) => ({ objective, index }))
    .filter(({ objective }) => !picked.includes(objective.id))
    .map(({ objective, index }) => ({
      label: companyObjectiveLabel(objective, index),
      value: objective.id,
      description: objective.description.trim() || undefined,
    }));

  // "Ninguno" solo cuando el modelo deja objetivos sueltos: con alineación
  // obligatoria ofrecerlo sería ofrecer un ciclo que después no cierra.
  if (ctx.rules.alignment !== "required") {
    options.push({
      label: "Ninguno",
      value: NO_ALIGNMENT_VALUE,
      description: "No le aporta a ninguno en particular",
    });
  }
  options.push(writeOwnChip("Otro", "Escribe a cuál le aporta"));
  return options;
}

/** Cuántos objetivos de la empresa quedan sin elegir. Cierra la ronda. */
export const freeCompanyObjectives = (ctx: ChatContext, picked: readonly string[]): number =>
  ctx.companyObjectives.filter((objective) => !picked.includes(objective.id)).length;

/** Los frentes que faltan por elegir, más la fila para escribir uno propio. */
export function focusChips(ctx: ChatContext, picked: readonly string[]): readonly ChatChip[] {
  const label = ctx.scope === "empresa" ? "Otro frente" : "Otro tema";
  return [
    ...FOCUS_ORDER.filter((focus) => !picked.includes(focus)).map((focus) => ({
      label: FOCUS_META[focus].label,
      value: focus,
      description: FOCUS_META[focus].tagline,
    })),
    writeOwnChip(label, "Escríbelo con tus palabras"),
  ];
}

/**
 * Cuántos caben. El tope no es una constante: es lo que queda libre en la
 * asignación, así que pedir cinco donde solo caben dos no es una opción.
 */
function countChips(ctx: ChatContext): readonly ChatChip[] {
  const top = Math.max(1, Math.min(5, ctx.maxCount, MAX_AI_OBJECTIVES));
  return Array.from({ length: top }, (_, index) => {
    const count = index + 1;
    return {
      label: String(count),
      value: String(count),
      description: countHint(count, ctx),
    };
  });
}

/** Una nota solo donde cambia la decisión, no debajo de cada número. */
function countHint(count: number, ctx: ChatContext): string | undefined {
  if (count === 1) return ctx.scope === "empresa" ? "Un solo norte para todo el ciclo" : undefined;
  if (count === 3) return "Lo habitual: cubre el ciclo sin dispersarlo";
  if (count === 5 && count === ctx.maxCount) return "El tope que queda libre";
  return undefined;
}

function ambitionChips(ctx: ChatContext): readonly ChatChip[] {
  const isThreshold = ctx.rules.closing === "threshold";
  return AMBITION_ORDER.map((level) => ({
    label: AMBITION_META[level].label,
    value: level,
    description: isThreshold ? THRESHOLD_TAGLINE[level] : AMBITION_META[level].tagline,
  }));
}

/** Con umbral el nivel no habla de a dónde llegar sino de qué sostener. */
const THRESHOLD_TAGLINE: Record<string, string> = {
  conservador: "Un umbral que hoy ya se sostiene",
  retador: "Exige subir el estándar actual",
  agresivo: "Un umbral que hoy nadie alcanza",
};

/**
 * Cuántos hijos por objetivo — o ninguno.
 *
 * Los dos casos son la misma pregunta con distinto piso: cuando el modelo los
 * exige la respuesta es un número, y cuando no, "ninguno" es una respuesta
 * legítima que tiene que estar a la vista. Lo que nunca se hace es poner el
 * plan por defecto y esperar a que alguien lo quite.
 */
function childrenChips(ctx: ChatContext): readonly ChatChip[] {
  const vocab = chatVocab(ctx);
  const children = lower(chatChildrenVocab(ctx).children ?? "acciones clave");
  const isResults = ctx.rules.children === "results";
  const counts = isResults ? [2, 3, 4] : [2, 3];

  const options: ChatChip[] = counts.map((count) => ({
    label: `${count} por ${lower(vocab.objective)}`,
    value: String(count),
    description: countChildrenHint(count, isResults),
  }));

  // Un plan de seguimiento nunca es obligatorio, aunque el modelo exija lo
  // que sí mide: son cosas distintas.
  if (!ctx.rules.childrenRequired || isFollowUpPlan(ctx)) {
    options.push({
      label: `Sin ${children}`,
      value: NO_CHILDREN_VALUE,
      description: `Solo la cifra ${vocab.objective === "Indicador" ? "del indicador" : "del objetivo"}`,
    });
  }
  return options;
}

function countChildrenHint(count: number, isResults: boolean): string | undefined {
  if (count === 2) return isResults ? "Dos pruebas por objetivo" : "Un plan corto";
  if (count === 3) return "Lo habitual";
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Lo que la IA dice mientras trabaja
 * ------------------------------------------------------------------ */

export function workingPhases(ctx: ChatContext): readonly string[] {
  const vocab = chatVocab(ctx);
  const children = chatChildrenVocab(ctx).children;
  const phases = ["Leyendo tu contexto…"];

  if (canAlign(ctx)) phases.push("Colgándolos del norte de la empresa…");
  phases.push(
    ctx.rules.closing === "threshold"
      ? "Eligiendo el indicador de cada uno…"
      : "Eligiendo cómo medir cada objetivo…"
  );
  if (ctx.scope !== "empresa" && children) {
    phases.push(`Escribiendo ${lower(children)}…`);
  }
  phases.push(
    ctx.rules.closing === "threshold"
      ? `Fijando el ${lower(vocab.target)} de cada indicador…`
      : "Proponiendo metas para el ciclo…"
  );
  return phases;
}
