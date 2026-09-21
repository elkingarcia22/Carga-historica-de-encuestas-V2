/**
 * El brief: lo mínimo que la IA necesita saber para proponer objetivos que
 * suenen a esta empresa y no a un ejemplo de manual.
 *
 * Son cinco preguntas y ninguna es un campo técnico: cuántos objetivos, en
 * qué se juega el ciclo, qué momento vive la empresa, qué tan exigentes deben
 * ser las metas y qué más hay que tener en cuenta. El resto —tipo de medida,
 * dirección, salida y meta— lo deduce el generador, que es justamente el
 * trabajo que el autor no debería tener que hacer campo por campo.
 *
 * Todo lo que se puede dejar sin responder está declarado como tal: `count` y
 * `ambition` nacen en null porque la tarjeta las va revelando de a una y una
 * respuesta preseleccionada sería una respuesta que nadie dio.
 */

import {
  generateObjectiveFromContext,
  type AmbitionLevel,
} from "./aiObjectiveGenerator";
import type { Objective } from "./cicloBuilderTypes";
import { buildObjectiveChildren } from "./aiObjectiveChildren";
import {
  DEFAULT_OBJECTIVE_MODEL_RULES,
  type ObjectiveModelRules,
} from "./objectiveModel";

export type { AmbitionLevel } from "./aiObjectiveGenerator";
export { AMBITION_META, AMBITION_ORDER } from "./aiObjectiveGenerator";

/** Los frentes en los que se suele jugar un ciclo. */
export type ObjectiveFocus =
  | "crecimiento"
  | "rentabilidad"
  | "clientes"
  | "personas"
  | "operacion"
  | "producto";

export interface FocusMeta {
  label: string;
  /** Qué cae dentro de este frente, en tres palabras. */
  tagline: string;
  /** Nombre del icono de lucide que lo representa. */
  icon: "trending-up" | "wallet" | "heart-handshake" | "users" | "settings-2" | "rocket";
  /** Objetivos reales de los que tira el generador para este frente. */
  seeds: readonly string[];
}

export const FOCUS_ORDER: readonly ObjectiveFocus[] = [
  "crecimiento",
  "rentabilidad",
  "clientes",
  "personas",
  "operacion",
  "producto",
];

export const FOCUS_META: Readonly<Record<ObjectiveFocus, FocusMeta>> = {
  crecimiento: {
    label: "Crecimiento",
    tagline: "Ventas, mercado, clientes nuevos",
    icon: "trending-up",
    seeds: [
      "Aumentar las ventas de la empresa",
      "Aumentar los clientes nuevos de la empresa",
      "Aumentar los ingresos totales de la empresa",
    ],
  },
  rentabilidad: {
    label: "Rentabilidad",
    tagline: "Margen, costos, presupuesto",
    icon: "wallet",
    seeds: [
      "Reducir los costos operativos de la empresa",
      "Aumentar el margen de rentabilidad de la empresa",
      "Reducir el gasto general de la empresa",
    ],
  },
  clientes: {
    label: "Clientes",
    tagline: "Satisfacción, retención, servicio",
    icon: "heart-handshake",
    seeds: [
      "Subir la satisfacción de los clientes",
      "Aumentar la retención de los clientes",
      "Reducir los tickets de soporte sin resolver",
    ],
  },
  personas: {
    label: "Personas",
    tagline: "Clima, rotación, desarrollo",
    icon: "users",
    seeds: [
      "Reducir la rotación de los colaboradores",
      "Subir la cobertura de formación de los colaboradores",
      "Mejorar el clima organizacional de la empresa",
    ],
  },
  operacion: {
    label: "Operación",
    tagline: "Procesos, calidad, entregas",
    icon: "settings-2",
    seeds: [
      "Reducir los incidentes operativos de la empresa",
      "Subir el cumplimiento de entregas a tiempo",
      "Automatizar los procesos internos de la empresa",
    ],
  },
  producto: {
    label: "Producto",
    tagline: "Lanzamientos, adopción, tecnología",
    icon: "rocket",
    seeds: [
      "Lanzar nuevos productos al mercado",
      "Aumentar la adopción de nuevas funcionalidades",
      "Modernizar la tecnología de la empresa",
    ],
  },
};

/**
 * Un frente es o uno de los seis de arriba, o lo que el autor haya escrito.
 *
 * Se guardan mezclados en la misma lista, como texto, porque para el resto
 * del flujo son la misma cosa: un frente elegido. Los seis de la lista traen
 * objetivos reales debajo; los propios traen los que se derivan del nombre.
 */
export type BriefFocus = string;

export const isPresetFocus = (focus: BriefFocus): focus is ObjectiveFocus =>
  (FOCUS_ORDER as readonly string[]).includes(focus);

export const focusLabel = (focus: BriefFocus): string =>
  isPresetFocus(focus) ? FOCUS_META[focus].label : focus;

export interface AiObjectiveBrief {
  /** Cuántos objetivos se piden de una vez. Null hasta que lo eligen. */
  count: number | null;
  /** Frentes elegidos: los seis de la lista, los propios, o ambos. */
  focuses: readonly BriefFocus[];
  /** Null hasta que lo eligen: es una decisión, no un valor por defecto. */
  ambition: AmbitionLevel | null;
  /** El momento de la empresa, con las palabras del autor. */
  context: string;
  /** Lo que hay que tener en cuenta y no cabía en lo anterior:
   * restricciones, presupuesto, lo que no se puede tocar. */
  notes: string;
}

/** Cuántos objetivos puede pedir de golpe: menos de uno no es nada, y más
 * de seis deja de ser un ciclo con foco. */
export const MIN_AI_OBJECTIVES = 1;
export const MAX_AI_OBJECTIVES = 10;

export const createBlankBrief = (count: number | null = null): AiObjectiveBrief => ({
  count,
  focuses: [],
  ambition: null,
  context: "",
  notes: "",
});

/** Arranques de un clic para el campo de contexto. */
export const AI_BRIEF_STARTERS: readonly string[] = [
  "Somos una empresa de servicios y este trimestre el foco es crecer sin subir costos",
  "Venimos de un año difícil: hay que retener clientes y estabilizar a los colaboradores",
  "Estamos lanzando un producto nuevo y necesitamos adopción rápida",
];

/** Todo lo que el autor escribió, junto: el generador lee las dos cajas por
 * igual para decidir qué se mide y hacia dónde. */
export const briefText = (brief: AiObjectiveBrief): string =>
  [brief.context, brief.notes].map((part) => part.trim()).filter(Boolean).join(". ");

/** Si ya se puede generar: falta responder lo que la tarjeta va revelando. */
export function isBriefReady(brief: AiObjectiveBrief): boolean {
  return (
    brief.count !== null &&
    brief.focuses.length > 0 &&
    brief.context.trim() !== "" &&
    brief.ambition !== null
  );
}

/** Objetivos de los que tirar para un frente escrito a mano. Salen del propio
 * nombre para que el generador pueda leerlos igual que a los de la lista. */
function customSeeds(label: string): readonly string[] {
  const subject = label.trim().toLowerCase();
  return [
    `Mejorar ${subject}`,
    `Aumentar el resultado de ${subject}`,
    `Reducir los problemas de ${subject}`,
  ];
}

const seedsFor = (focus: BriefFocus): readonly string[] =>
  isPresetFocus(focus) ? FOCUS_META[focus].seeds : customSeeds(focus);

/** Palabras demasiado comunes para contar como una coincidencia real entre
 * lo escrito y una semilla — sin filtrarlas, "de la empresa" haría que todo
 * pareciera relevante a todo. */
const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "y", "o", "que", "para",
  "con", "sin", "del", "al", "en", "a", "su", "sus", "este", "esta",
  "estamos", "somos", "es", "más", "muy", "sobre", "por",
]);

function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9]+/g) ?? []
  ).filter((word) => !STOPWORDS.has(word));
}

/** Cuántas palabras con peso comparten la semilla y lo que el autor escribió. */
function relevance(seed: string, contextWords: readonly string[]): number {
  const seedWords = new Set(tokenize(seed));
  return contextWords.reduce((sum, word) => sum + (seedWords.has(word) ? 1 : 0), 0);
}

/**
 * Las semillas de un frente, con las más cercanas a lo que el autor escribió
 * primero.
 *
 * Cada frente trae un puñado de objetivos ya redactados — no hay forma de
 * generar texto libre en un mock — pero cuál de ellos sale primero sí puede
 * responder a lo que la persona contó: si escribió "retener clientes", que
 * sea el de retención el que aparezca antes que el de ventas, aunque ambos
 * vivan bajo el mismo frente "Clientes".
 */
function rankedSeedsFor(focus: BriefFocus, contextWords: readonly string[]): readonly string[] {
  const seeds = seedsFor(focus);
  if (contextWords.length === 0) return seeds;
  return [...seeds].sort((a, b) => relevance(b, contextWords) - relevance(a, contextWords));
}

/**
 * Reparte `count` semillas entre los frentes en juego, tomando una de cada
 * frente antes de repetir. Así tres objetivos sobre dos frentes salen 2 + 1
 * y no 3 + 0: el ciclo queda cubierto en vez de concentrado.
 */
function pickSeeds(focuses: readonly BriefFocus[], count: number, text: string): string[] {
  const contextWords = tokenize(text);
  const seedsByFocus = new Map(focuses.map((focus) => [focus, rankedSeedsFor(focus, contextWords)]));
  const picked: string[] = [];
  let round = 0;

  while (picked.length < count && round < 15) {
    for (const focus of focuses) {
      const seeds = seedsByFocus.get(focus)!;
      const seed = seeds[round % seeds.length];
      if (!picked.includes(seed)) picked.push(seed);
      if (picked.length === count) break;
    }
    round += 1;
  }

  // Si con los frentes elegidos no alcanzó para llegar a 'count'
  // (por ejemplo, piden 5 pero solo eligieron 1 frente, que tiene 3 semillas),
  // rellenamos con las semillas de los demás frentes disponibles.
  if (picked.length < count) {
    for (const fallbackFocus of FOCUS_ORDER) {
      if (picked.length === count) break;
      if (focuses.includes(fallbackFocus)) continue;
      
      const fallbackSeeds = rankedSeedsFor(fallbackFocus, contextWords);
      for (const seed of fallbackSeeds) {
        if (!picked.includes(seed)) {
          picked.push(seed);
          if (picked.length === count) break;
        }
      }
    }
  }

  return picked;
}

/**
 * Construye el conjunto completo a partir del brief.
 *
 * Si el autor escribió contexto, el primer objetivo sale de esa frase — es
 * lo que él mismo dijo que quería, y verlo de primero es la prueba de que se
 * leyó. Los demás salen de las semillas de los frentes en juego.
 */
export function generateObjectiveSet(
  brief: AiObjectiveBrief,
  options: {
    useContextAsObjective: boolean;
    /** Las reglas del ciclo: qué cuelga de cada objetivo y si mueve el avance. */
    rules?: ObjectiveModelRules;
    /** Los objetivos de la empresa de los que cuelga esta tanda, en orden. */
    alignTo?: readonly string[];
    /** Cuántos hijos por objetivo. `0` es "ninguno" y `null` deja decidir al modelo. */
    childrenCount?: number | null;
  }
): Objective[] {
  const ambition = brief.ambition ?? "retador";
  const total = brief.count ?? 1;
  const hints = briefText(brief);
  const focuses = brief.focuses.length > 0 ? brief.focuses : FOCUS_ORDER.slice(0, 3);

  // Cuando el autor pidió un objetivo, lo que escribió *es* el objetivo y su
  // frase se convierte en el título. Cuando pidió varios, lo que escribió es
  // el momento de la empresa: orienta la lectura, pero titular un objetivo
  // con "venimos perdiendo margen" sería confundir el diagnóstico con la meta.
  const context = brief.context.trim();
  const fromContext =
    options.useContextAsObjective && context !== ""
      ? [generateObjectiveFromContext(context, ambition, hints)]
      : [];
  const remaining = Math.max(0, total - fromContext.length);

  // `hints` solo entra aquí para ordenar qué semilla sale primero dentro de
  // cada frente — nunca para decidir su medida o dirección. Esas dos ya
  // vienen fijas en el texto de la semilla, así que una palabra suelta como
  // "presupuesto" no puede convertir "mejorar el clima" en una cifra de
  // pesos: como mucho hace que un objetivo de costos se cuele antes que uno
  // de clima, que es justamente lo que se busca.
  const fromSeeds = pickSeeds(focuses, remaining, hints).map((seed) =>
    generateObjectiveFromContext(seed, ambition)
  );

  return [...fromContext, ...fromSeeds].map((objective, index) =>
    dressForModel(objective, index, options)
  );
}

/**
 * Le pone al objetivo lo que su modelo exige: de qué cuelga y qué cuelga de él.
 *
 * Se hace aquí y no en el generador porque son dos preguntas distintas: el
 * generador decide qué se mide y hasta dónde —eso no cambia entre modelos—,
 * y esto decide la forma que el ciclo pide. Sin este paso un OKR nace inválido.
 */
function dressForModel(
  objective: Objective,
  index: number,
  options: {
    rules?: ObjectiveModelRules;
    alignTo?: readonly string[];
    childrenCount?: number | null;
  }
): Objective {
  const rules = options.rules ?? DEFAULT_OBJECTIVE_MODEL_RULES;
  const alignTo = options.alignTo ?? [];

  // Con varios objetivos de la empresa elegidos se reparten en orden: el
  // primero al primero, y vuelta a empezar. Repartir es lo que hace que la
  // tanda cubra el norte entero en vez de amontonarse en su primera línea.
  const alignedTo = alignTo.length === 0 ? null : alignTo[index % alignTo.length];

  // Un modelo que no cuelga nada que mida —KPI— igual admite un plan de
  // seguimiento: se escribe como acciones y nunca toca el avance, que sigue
  // saliendo de la cifra del indicador.
  const isFollowUpPlan = rules.children === "none";
  const kind = isFollowUpPlan ? "actions" : rules.children;
  const driveProgress =
    !isFollowUpPlan && (rules.children === "results" || rules.childrenDriveProgress);
  const count =
    options.childrenCount ??
    (rules.childrenRequired && !isFollowUpPlan ? (rules.children === "results" ? 3 : 2) : 0);
  const keyActions = buildObjectiveChildren(objective, count, kind, driveProgress);

  return {
    ...objective,
    alignedTo,
    keyActions,
    // Solo se marca cuando de verdad hay hijos repartiendo la meta: dejarlo
    // encendido con la lista vacía hace que la tarjeta pida lo que no tiene.
    keyActionsDriveProgress: keyActions.length > 0 && driveProgress,
  };
}

/** Una línea que resume el brief, para la cabecera de la revisión. */
export function describeBrief(brief: AiObjectiveBrief): string {
  const count = brief.count ?? 1;
  const countLabel = count === 1 ? "1 objetivo" : `${count} objetivos`;
  const focusLabels = brief.focuses.map(focusLabel).join(" · ");
  return focusLabels === "" ? countLabel : `${countLabel} · ${focusLabels}`;
}
