/**
 * Turns one free-text sentence — "quiero subir la satisfacción del cliente
 * este trimestre" — into a fully answered `Objective`: measure, direction,
 * initial value and target already filled in, the same fields the guided
 * card would otherwise ask for one at a time.
 *
 * There is no model behind this: the "understanding" is a keyword read of
 * the author's own words, the same vocabulary `MEASURE_META` already uses to
 * describe each measure to a human. That is enough to make the mocked
 * generation feel like it read the sentence rather than ignored it, without
 * pretending to reason about numbers it was never given.
 */

import {
  createBlankObjective,
  formatMeasureValue,
  type MeasureType,
  type Objective,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";

const INCREASE_HINTS =
  /\b(aumentar|subir|incrementar|mejorar|crecer|elevar|potenciar|impulsar|ampliar|fortalecer)\b/i;
const DECREASE_HINTS =
  /\b(reducir|bajar|disminuir|minimizar|recortar|controlar|contener|frenar)\b/i;

const MONEY_HINTS =
  /(\$|peso|ventas?|ingreso|facturaci[oó]n|costo|gasto|presupuesto|cartera|utilidad|rentabilidad|margen)/i;
const PERCENTAGE_HINTS =
  /(%|porcentaje|satisfacci[oó]n|rotaci[oó]n|cobertura|cumplimiento|retenci[oó]n|engagement|nps|clima|adopci[oó]n)/i;
const BOOLEAN_HINTS =
  /\b(implementar|lanzar|certificar|publicar|migrar|automatizar|desplegar|adoptar)\b/i;
const NUMERIC_HINTS =
  /(client(e|es)|ticket|unidad(es)?|visita|proyecto|contrato|lead|usuario|colaborador|solicitud|incidente|producto)/i;

/**
 * How hard the proposed metas push.
 *
 * The author never sees a number for this — they answer "qué tan exigente
 * quieres que sea", and the level scales the distance between the salida and
 * the meta. It is the one lever that changes what the generated objective
 * demands, so it is asked as a question rather than assumed.
 */
export type AmbitionLevel = "conservador" | "retador" | "agresivo";

export interface AmbitionMeta {
  label: string;
  /** Una línea bajo el título de la tarjeta. */
  tagline: string;
  /** What picking this does to the meta, in the author's terms. */
  headline: string;
}

export const AMBITION_ORDER: readonly AmbitionLevel[] = [
  "conservador",
  "retador",
  "agresivo",
];

export const AMBITION_META: Readonly<Record<AmbitionLevel, AmbitionMeta>> = {
  conservador: {
    label: "Conservador",
    tagline: "Metas que se cumplen",
    headline:
      "La meta queda cerca de donde ya estás. Úsalo cuando el ciclo tiene que salir sí o sí.",
  },
  retador: {
    label: "Retador",
    tagline: "Exige mejorar",
    headline:
      "La meta obliga a moverse, pero sigue siendo alcanzable. Es el punto medio y el más común.",
  },
  agresivo: {
    label: "Agresivo",
    tagline: "Metas de ruptura",
    headline:
      "La meta está lejos a propósito. Solo se cumple si todo sale bien, y no pasa nada si no.",
  },
};

/** Cuánto se estira el tramo salida → meta según el nivel elegido. */
export const AMBITION_FACTOR: Readonly<Record<AmbitionLevel, number>> = {
  conservador: 0.55,
  retador: 1,
  agresivo: 1.7,
};

function matchMeasure(text: string): MeasureType | null {
  if (BOOLEAN_HINTS.test(text)) return "boolean";
  if (MONEY_HINTS.test(text)) return "money";
  if (PERCENTAGE_HINTS.test(text)) return "percentage";
  if (NUMERIC_HINTS.test(text)) return "numeric";
  return null;
}

/**
 * El objetivo manda sobre el contexto de fondo.
 *
 * Las notas del brief hablan de toda la empresa —"el presupuesto sigue
 * igual"— y si se leyeran a la vez que el objetivo, esa sola palabra
 * convertiría "mejorar sostenibilidad" en una cifra de pesos. Solo se
 * consultan cuando el propio objetivo no dice nada.
 */
function inferMeasure(context: string, hints: string): MeasureType {
  // Most company-level results ("subir la satisfacción", "mejorar el clima")
  // read as a share of something even without one of the words above.
  return matchMeasure(context) ?? matchMeasure(hints) ?? "percentage";
}

function matchDirection(text: string): ObjectiveDirection | null {
  if (DECREASE_HINTS.test(text)) return "decrease";
  if (INCREASE_HINTS.test(text)) return "increase";
  return null;
}

function inferDirection(
  context: string,
  hints: string,
  measure: MeasureType
): ObjectiveDirection | null {
  if (measure === "boolean") return null;
  // A goal stated without a verb ("satisfacción del cliente") is still
  // overwhelmingly something the author wants to go up.
  return matchDirection(context) ?? matchDirection(hints) ?? "increase";
}

/** A believable round number for the measure, so it reads like a real target
 * rather than an obviously random one. The gap between salida and meta is
 * what `ambition` stretches — the starting point stays where it is, because
 * that is a fact about the company, not a choice. */
function rollValues(
  measure: MeasureType,
  direction: ObjectiveDirection | null,
  ambition: AmbitionLevel
): { initial: number; target: number } {
  const stretch = AMBITION_FACTOR[ambition];

  if (measure === "money") {
    const initial = 20_000_000 + Math.round(Math.random() * 6) * 10_000_000;
    const move = initial * (0.18 + Math.random() * 0.22) * stretch;
    const raw = direction === "decrease" ? initial - move : initial + move;
    const target = Math.max(1_000_000, Math.round(raw / 1_000_000) * 1_000_000);
    return { initial, target };
  }

  if (measure === "percentage") {
    const initial =
      direction === "decrease"
        ? 15 + Math.round(Math.random() * 15)
        : 60 + Math.round(Math.random() * 20);
    const move = Math.max(1, Math.round((6 + Math.random() * 9) * stretch));
    const target =
      direction === "decrease" ? Math.max(0, initial - move) : Math.min(100, initial + move);
    return { initial, target };
  }

  if (measure === "numeric") {
    const initial = 10 + Math.round(Math.random() * 40);
    const move = Math.max(1, Math.round(initial * (0.25 + Math.random() * 0.35) * stretch));
    const target = direction === "decrease" ? Math.max(0, initial - move) : initial + move;
    return { initial, target };
  }

  return { initial: 0, target: 0 };
}

/**
 * Los arranques con los que la gente dicta un objetivo en voz alta —"quiero
 * que subamos…", "hay que reducir…"—. No son parte del objetivo, son la
 * persona presentándolo, así que salen de la frase antes de nada más.
 */
const FILLER_OPENERS =
  /^(?:\s*(?:y|pues|bueno)\s+)?\s*(?:quiero|queremos|quisiera|quisi[eé]ramos|necesito|necesitamos|me\s+gustar[ií]a|nos\s+gustar[ií]a|hay\s+que|tenemos\s+que|debemos|deber[ií]amos|la\s+idea\s+es|el\s+objetivo\s+es|la\s+meta\s+es|se\s+trata\s+de|busco|buscamos)\s+(?:que\s+)?/i;

/**
 * Las raíces de los verbos con los que se enuncia un objetivo. Si la frase
 * empieza por una de ellas ya trae el verbo y no hay que ponerle otro
 * delante, venga conjugada o venga como sustantivo del mismo palo ("Mejora
 * continua del proceso"), que también se lee bien tal cual.
 *
 * Es deliberadamente permisiva: pasarse de ancha solo hace que no toquemos
 * un título que ya estaba bien, mientras que quedarse corta produce el
 * "Aumentar subamos las ventas" que esto viene a evitar.
 */
const STARTS_WITH_ACTION =
  /^\s*(?:aument|sub|increment|mejor|crec|crezc|elev|potenci|impuls|ampli|fortalec|fortalezc|reduc|reduzc|baj|disminu|minimic|minimiz|recort|control|conten|conteng|fren|lanc|lanz|implement|certific|certifiqu|public|publiqu|migr|automatic|automatiz|despleg|despliegu|adopt|manten|manteng|sosten|sosteng|alcanc|alcanz|logr|duplic|dupliqu|garantic|garantiz)\w*\b/i;

/**
 * Las formas en "nosotros" con las que se dicta un objetivo —"subamos",
 * "mejoremos", "reduzcamos"— y el infinitivo en el que hay que dejarlas.
 *
 * Solo estas: una palabra que abre una frase en español y acaba en
 * -amos/-emos/-imos es un verbo sin ambigüedad, así que normalizarla no
 * puede estropear un título que ya estaba bien escrito.
 */
const NOSOTROS_TO_INFINITIVE: readonly (readonly [RegExp, string])[] = [
  [/^aumentemos\b/i, "Aumentar"],
  [/^sub[ai]mos\b/i, "Subir"],
  [/^incrementemos\b/i, "Incrementar"],
  [/^mejoremos\b/i, "Mejorar"],
  [/^(?:crezcamos|crecemos)\b/i, "Crecer"],
  [/^elevemos\b/i, "Elevar"],
  [/^potenciemos\b/i, "Potenciar"],
  [/^impulsemos\b/i, "Impulsar"],
  [/^ampliemos\b/i, "Ampliar"],
  [/^(?:fortalezcamos|fortalecemos)\b/i, "Fortalecer"],
  [/^(?:reduzcamos|reducimos)\b/i, "Reducir"],
  [/^bajemos\b/i, "Bajar"],
  [/^(?:disminuyamos|disminuimos)\b/i, "Disminuir"],
  [/^minimicemos\b/i, "Minimizar"],
  [/^recortemos\b/i, "Recortar"],
  [/^controlemos\b/i, "Controlar"],
  [/^(?:contengamos|contenemos)\b/i, "Contener"],
  [/^frenemos\b/i, "Frenar"],
  [/^lancemos\b/i, "Lanzar"],
  [/^implementemos\b/i, "Implementar"],
  [/^certifiquemos\b/i, "Certificar"],
  [/^publiquemos\b/i, "Publicar"],
  [/^migremos\b/i, "Migrar"],
  [/^automaticemos\b/i, "Automatizar"],
  [/^despleguemos\b/i, "Desplegar"],
  [/^adoptemos\b/i, "Adoptar"],
  [/^(?:mantengamos|mantenemos)\b/i, "Mantener"],
  [/^(?:sostengamos|sostenemos)\b/i, "Sostener"],
  [/^alcancemos\b/i, "Alcanzar"],
  [/^logremos\b/i, "Lograr"],
  [/^dupliquemos\b/i, "Duplicar"],
  [/^garanticemos\b/i, "Garantizar"],
];

/** Lo que queda de "quiero que" cuando no había nada detrás: un conector
 * suelto no es un objetivo, así que la frase se deja como estaba. */
const DANGLING_CONNECTOR = /^(?:que|de|del|al?|los?|las?|una?|en|para|con)$/i;

const MAX_WORDING_LENGTH = 140;

/**
 * Con qué verbo debería empezar el objetivo, según lo que ya se sabe de él.
 * Es lo único que hace falta añadir cuando el autor escribió el sujeto
 * ("satisfacción del cliente") sin decir qué quiere que le pase.
 */
function leadingVerb(
  measure: MeasureType | null,
  direction: ObjectiveDirection | null
): string {
  if (measure === "boolean") return "Lograr";
  if (direction === "decrease") return "Reducir";
  return "Aumentar";
}

function cleanSentence(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").replace(FILLER_OPENERS, "").trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Deja el verbo de arranque en infinitivo, que es como se lee un objetivo. */
function toInfinitiveLead(text: string): string {
  for (const [pattern, infinitive] of NOSOTROS_TO_INFINITIVE) {
    if (pattern.test(text)) return text.replace(pattern, infinitive);
  }
  return text;
}

/**
 * La frase del autor convertida en el título del objetivo: sin el "quiero
 * que" con el que la dictó, empezando por el verbo que dice qué tiene que
 * pasar, y con la primera en mayúscula.
 *
 * Devuelve cadena vacía si no quedaba nada; quien llama decide qué hacer con
 * eso, porque no es lo mismo generar de cero que mejorar lo ya escrito.
 */
function toTitle(
  context: string,
  measure: MeasureType | null = null,
  direction: ObjectiveDirection | null = null
): string {
  const cleaned = toInfinitiveLead(cleanSentence(context).replace(/[.!?,;:]+$/, ""));
  if (cleaned === "" || DANGLING_CONNECTOR.test(cleaned)) return "";

  const withVerb = STARTS_WITH_ACTION.test(cleaned)
    ? cleaned
    : `${leadingVerb(measure, direction)} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;

  const titled = capitalize(withVerb);
  return titled.length > MAX_WORDING_LENGTH
    ? `${titled.slice(0, MAX_WORDING_LENGTH - 1)}…`
    : titled;
}

function toDescription(
  measure: MeasureType,
  direction: ObjectiveDirection | null,
  initial: number,
  target: number
): string {
  if (measure === "boolean") {
    return "Se considera cumplido una vez quede entregado dentro del ciclo.";
  }
  const verb = direction === "decrease" ? "Bajar" : "Subir";
  return `${verb} de ${formatMeasureValue(initial, measure)} a ${formatMeasureValue(target, measure)} durante el ciclo.`;
}

/**
 * Builds a complete objective from one sentence of context. Deterministic in
 * shape (measure and direction always follow the same keyword read), random
 * only in the specific numbers rolled, so two runs from the same prompt agree
 * on what the objective is about even if the target isn't identical.
 */
export function generateObjectiveFromContext(
  context: string,
  ambition: AmbitionLevel = "retador",
  /** Texto extra que solo alimenta la lectura de palabras clave, sin entrar
   * en el título: las notas del brief dicen cómo se mide algo sin ser, ellas
   * mismas, el objetivo. */
  hints: string = ""
): Objective {
  // La frase se normaliza *antes* de leerla: "quiero que reduzcamos…" trae el
  // verbo conjugado, y las pistas de dirección solo conocen el infinitivo. Sin
  // esto el objetivo saldría titulado "Reducir…" pero midiendo hacia arriba.
  const normalized = toInfinitiveLead(cleanSentence(context));
  const measure = inferMeasure(normalized, hints);
  const direction = inferDirection(normalized, hints, measure);
  const { initial, target } = rollValues(measure, direction, ambition);

  return {
    ...createBlankObjective(),
    title: toTitle(normalized, measure, direction),
    description: toDescription(measure, direction, initial, target),
    measure,
    direction,
    initialValue: measure === "boolean" ? "" : String(initial),
    targetValue: measure === "boolean" ? "" : String(target),
    // Todo lo que sale de aquí lo escribió la IA de punta a punta: es el único
    // sitio del que salen objetivos completos sin que nadie los teclee.
    createdByAI: true,
  };
}

/** Prompts shown as one-click starting points in the AI modal. */
export const AI_OBJECTIVE_SUGGESTIONS: readonly string[] = [
  "Subir la satisfacción de los clientes este trimestre",
  "Aumentar las ventas de la empresa este trimestre",
  "Reducir la rotación de los colaboradores",
  "Lanzar el nuevo programa de bienestar para los colaboradores",
];

/* ------------------------------------------------------------------ *
 * Editar una propuesta con palabras
 * ------------------------------------------------------------------ */

/**
 * Retocar un objetivo ya propuesto, diciéndolo en una frase.
 *
 * "Otra versión" tira el objetivo entero y trae uno nuevo; esto es lo
 * contrario: conserva lo que ya estaba bien y solo mueve lo que la frase
 * pide. Lee la instrucción con el mismo criterio con el que se leyó el
 * contexto —qué medida, hacia dónde, cuánto exige— y solo cuando la frase
 * no pide nada reconocible la trata como un objetivo nuevo escrito de cero.
 */

/** "Hazlo más exigente": mueve la meta, no lo que se mide. */
const HARDER_HINTS =
  /(m[aá]s\s+(exigente|ambicios\w*|retador\w*|agresiv\w*|alt[oa]|dif[ií]cil|arriesgad\w*)|sub[ei]r?\s+la\s+meta|estira\w*\s+la\s+meta|m[aá]s\s+reto)/i;
const EASIER_HINTS =
  /(m[aá]s\s+(f[aá]cil|realista|alcanzable|conservador\w*|suave|baj[oa])|menos\s+exigente|baj[ae]r?\s+la\s+meta|reduc\w+\s+la\s+meta)/i;

/** Cambiar la unidad: "mídelo en porcentaje", "que sea en pesos". */
const MEASURE_OVERRIDES: readonly (readonly [RegExp, MeasureType])[] = [
  [/(en\s+(pesos|d[oó]lares|dinero|plata)|monetari\w*|en\s+\$|facturaci[oó]n)/i, "money"],
  [/(en\s+porcentaje|porcentual|en\s+%|como\s+porcentaje)/i, "percentage"],
  [/(en\s+(cantidad|n[uú]mero|unidades)|num[eé]ric\w*|contar|conteo)/i, "numeric"],
  [/(se\s+cumple|s[ií]\s+o\s+no|binari\w*|sin\s+(cifras|n[uú]meros)|hito)/i, "boolean"],
];

/** "Que sea sobre retención": el objetivo pasa a ser otro, no se retoca. */
const REFOCUS_HINTS =
  /(?:enf[oó]cal[oa]\s+(?:en|hacia)|que\s+sea\s+sobre|c[aá]mbial[oa]\s+(?:a|por)|or[ií][eé]ntal[oa]\s+(?:a|hacia)|h[aá]zl[oa]\s+sobre|que\s+hable\s+de)\s+(.+)/i;

/**
 * Frases que solo modifican lo que ya hay.
 *
 * Sin esto, "que sea de reducir" acabaría titulando el objetivo, porque
 * lleva un verbo de objetivo dentro. Una instrucción que empieza así nunca
 * es el objetivo nuevo: es una corrección sobre el que ya existe.
 */
const MODIFIER_OPENERS =
  /^\s*(que|h[aá]z\w*|ponl?[oa]?|pon|m[aá]s|menos|c[aá]mbi\w*|ajust\w*|s[uú]bel[oa]|b[aá]jal[oa]|d[eé]jal[oa]|qu[ií]tal\w*|mejora\s+la|corrig\w*|reescrib\w*)\b/i;

/** Un verbo de objetivo: si la frase lo trae y no es una corrección, es un
 * objetivo nuevo dicho con palabras del autor. */
const OBJECTIVE_VERBS =
  /\b(aumentar|subir|incrementar|mejorar|crecer|elevar|reducir|bajar|disminuir|minimizar|lanzar|implementar|certificar|publicar|migrar|automatizar|alcanzar|lograr|duplicar|mantener)\b/i;

/** Cuánto se estira o se encoge el tramo salida → meta al pedir más o menos
 * exigencia. Es un retoque, no un salto de nivel de ambición. */
const HARDER_FACTOR = 1.5;
const EASIER_FACTOR = 0.6;

function parseStoredValue(value: string): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Números escritos en la instrucción: "de 60 a 85", "llegar a 95%",
 * "40 millones". El primero es la salida cuando vienen dos; si viene uno
 * solo, es la meta —que es lo que la gente escribe cuando escribe uno solo. */
function readNumbers(text: string): number[] {
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)*)\s*(millones?|mill|mil|k)?/gi)];
  return matches
    .map((match) => {
      const base = Number(match[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
      if (!Number.isFinite(base)) return null;
      const unit = (match[2] ?? "").toLowerCase();
      if (unit.startsWith("mill")) return base * 1_000_000;
      if (unit === "mil" || unit === "k") return base * 1_000;
      return base;
    })
    .filter((value): value is number => value !== null);
}

function clampValue(value: number, measure: MeasureType): number {
  if (measure === "money") return Math.max(0, Math.round(value / 1_000_000) * 1_000_000);
  if (measure === "percentage") return Math.min(100, Math.max(0, Math.round(value)));
  return Math.max(0, Math.round(value));
}

/** Aleja o acerca la meta de la salida, sin mover la salida: dónde está hoy
 * la empresa es un hecho, no una preferencia. */
function stretchTarget(
  initial: number,
  target: number,
  measure: MeasureType,
  factor: number
): number {
  const stretched = initial + (target - initial) * factor;
  const next = clampValue(stretched, measure);
  // Un retoque que no mueve nada se lee como que el botón no funcionó.
  return next === target ? clampValue(stretched + (factor > 1 ? 1 : -1), measure) : next;
}

/**
 * Aplica la instrucción sobre el objetivo, conservando su identidad.
 *
 * El `id` no se toca a propósito: para la lista de revisión sigue siendo la
 * misma tarjeta, en el mismo sitio, con la misma casilla marcada o no.
 */
export function applyObjectiveEdit(
  objective: Objective,
  instruction: string,
  ambition: AmbitionLevel = "retador"
): Objective {
  const text = instruction.trim();
  if (text === "") return objective;

  // La exigencia se lee primero y se saca del texto: "bajar la meta" no es
  // un objetivo que baje, es una meta más suave.
  const wantsHarder = HARDER_HINTS.test(text);
  const wantsEasier = !wantsHarder && EASIER_HINTS.test(text);
  const withoutAmbition = text.replace(HARDER_HINTS, " ").replace(EASIER_HINTS, " ");

  const measureOverride =
    MEASURE_OVERRIDES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const directionOverride = matchDirection(withoutAmbition);
  const refocus = REFOCUS_HINTS.exec(text)?.[1]?.trim() ?? null;
  const numbers = readNumbers(withoutAmbition);

  const touchesSomething =
    wantsHarder ||
    wantsEasier ||
    measureOverride !== null ||
    directionOverride !== null ||
    refocus !== null ||
    numbers.length > 0;

  // Nada reconocible dentro y una frase que no empieza corrigiendo: el autor
  // está reescribiendo el objetivo, no ajustándolo.
  if (!touchesSomething) {
    const isRewrite = !MODIFIER_OPENERS.test(text) && OBJECTIVE_VERBS.test(text);
    const source = isRewrite ? text : objective.title;
    return { ...generateObjectiveFromContext(source, ambition), id: objective.id };
  }

  // Un cambio de tema arrastra todo lo demás: se genera de nuevo desde la
  // frase y solo después se le aplican los otros retoques de la instrucción.
  const base = refocus
    ? { ...generateObjectiveFromContext(refocus, ambition), id: objective.id }
    : objective;

  const measure = measureOverride ?? base.measure ?? "percentage";
  const direction =
    measure === "boolean" ? null : (directionOverride ?? base.direction ?? "increase");

  if (measure === "boolean") {
    return {
      ...base,
      measure,
      direction: null,
      initialValue: "",
      targetValue: "",
      description: toDescription(measure, null, 0, 0),
    };
  }

  // Si cambió la unidad o se dio la vuelta la dirección, los números de antes
  // ya no significan nada: se tiran de nuevo. Si no, se conservan.
  const changedShape =
    measure !== base.measure || (base.direction !== null && direction !== base.direction);
  const rolled = changedShape ? rollValues(measure, direction, ambition) : null;

  let initial = rolled ? rolled.initial : parseStoredValue(base.initialValue);
  let target = rolled ? rolled.target : parseStoredValue(base.targetValue);

  if (wantsHarder) target = stretchTarget(initial, target, measure, HARDER_FACTOR);
  if (wantsEasier) target = stretchTarget(initial, target, measure, EASIER_FACTOR);

  // Los números dichos a mano mandan sobre todo lo anterior.
  if (numbers.length >= 2) {
    initial = clampValue(numbers[0], measure);
    target = clampValue(numbers[1], measure);
  } else if (numbers.length === 1) {
    target = clampValue(numbers[0], measure);
  }

  return {
    ...base,
    measure,
    direction,
    initialValue: String(initial),
    targetValue: String(target),
    description: toDescription(measure, direction, initial, target),
  };
}

/** Retoques de un clic bajo el campo de edición: los cuatro cambios que se
 * piden siempre, escritos como los escribiría el autor. */
export const OBJECTIVE_EDIT_SHORTCUTS: readonly string[] = [
  "Hazlo más exigente",
  "Hazlo más realista",
  "Mídelo en porcentaje",
  "Que sea de reducir",
];

/* ------------------------------------------------------------------ *
 * Mejorar la redacción de lo que ya está escrito
 * ------------------------------------------------------------------ */

function refineTitle(objective: Objective): string {
  // Se lee la frase ya normalizada, por lo mismo que en la generación: las
  // pistas de medida y dirección solo reconocen el verbo en infinitivo.
  const normalized = toInfinitiveLead(cleanSentence(objective.title));
  // Lo que la tarjeta ya tiene decidido manda; si todavía no hay medida ni
  // dirección, se deducen de las palabras del propio título.
  const measure = objective.measure ?? matchMeasure(normalized);
  const direction = objective.direction ?? matchDirection(normalized);

  const refined = toTitle(normalized, measure, direction);
  // Una frase que se queda en nada al limpiarla se deja tal cual: mejorar no
  // puede ser vaciar el campo.
  return refined === "" ? objective.title : refined;
}

function refineDescription(objective: Objective): string {
  const cleaned = cleanSentence(objective.description);
  if (cleaned === "") return objective.description;

  let text = capitalize(cleaned);
  if (!/[.!?…]$/.test(text)) text += ".";

  // Cierra la descripción diciendo cómo se va a leer el resultado, que es
  // justo lo que suele faltarle a una escrita a mano. Solo si el objetivo ya
  // tiene con qué, y solo si no lo dice ya.
  const { measure, direction } = objective;
  if (measure !== null && measure !== "boolean" && objective.targetValue.trim() !== "") {
    const initial = parseStoredValue(objective.initialValue);
    const target = parseStoredValue(objective.targetValue);
    if (!text.includes(formatMeasureValue(target, measure))) {
      text = `${text} ${toDescription(measure, direction, initial, target)}`;
    }
  }

  return text;
}

export interface ObjectiveWording {
  title: string;
  description: string;
}

/**
 * Reescribe lo que el autor ya escribió, sin preguntarle nada.
 *
 * No cambia qué se mide ni cuánto se exige — eso ya lo decidió él en los
 * pasos de abajo, y reescribirlo de paso sería mover la meta a espaldas de
 * quien la puso. Solo arregla la redacción: quita el "quiero que", pone el
 * verbo que falta, y remata la descripción con la cifra si la hay.
 *
 * La descripción vacía se deja vacía: mejorar no es inventar.
 */
export function refineObjectiveWording(objective: Objective): ObjectiveWording {
  return {
    title: refineTitle(objective),
    description:
      objective.description.trim() === ""
        ? objective.description
        : refineDescription(objective),
  };
}
