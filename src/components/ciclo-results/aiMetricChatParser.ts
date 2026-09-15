import {
  METRIC_SHAPES,
  METRIC_TOPICS,
  type MetricShape,
  type MetricTopic,
} from "./metricDefinition";
import {
  EMPTY_BRIEF,
  METRIC_QUESTIONS,
  questionById,
  type MetricBrief,
} from "./metricQuestions";

/**
 * Lo que la IA entiende de una frase suelta sobre métricas.
 *
 * El compositor pregunta en pasos porque el formulario necesita respuestas
 * completas. El chat no: alguien escribe "quiero ver quién va más atrasado
 * por área en barras" y ahí ya están las tres decisiones. Este módulo las
 * saca, dice cuáles faltan —y solo esas se preguntan—, y entiende también el
 * segundo turno: "dale tipo anillo", "mejor por líder", "ponlo tipo riesgo y
 * alertas" son cambios sobre una métrica que ya está dibujada, no una
 * conversación nueva.
 *
 * No hay modelo detrás: son listas de palabras. Da igual para lo que esto
 * tiene que probar —que preguntar es mejor que configurar— y hace que el
 * prototipo responda igual en cada demo.
 */

/** Sin tildes, en minúsculas y con los espacios colapsados. */
export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const has = (text: string, words: readonly string[]): boolean =>
  words.some((word) => text.includes(normalize(word)));

/* ------------------------------------------------------------------ *
 * Diccionarios
 * ------------------------------------------------------------------ */

/** Cómo se pide cada pregunta cuando no se usa su enunciado exacto. */
const QUESTION_WORDS: Readonly<Record<string, readonly string[]>> = {
  atrasados: [
    "atrasad", "atraso", "retraso", "retrasad", "quien va mal", "van mal",
    "demora", "quieto", "sin mover", "rezagad", "colgad",
  ],
  cumplimiento: [
    "cumplimiento", "avance", "como va", "como vamos", "progreso",
    "que tan cerca", "contra la meta", "desempeno",
  ],
  "sin-reportar": [
    "no ha reportado", "no han reportado", "sin reportar", "no reportan",
    "participacion", "sin avance", "no actualizan", "quien falta",
    "no registran",
  ],
  peso: [
    "peso", "pesos", "ponderacion", "ponderad", "reparto", "se reparte",
    "en que nos jugamos", "prioridad",
  ],
  evolucion: [
    "mes a mes", "evolucion", "tendencia", "en el tiempo", "historico",
    "linea de tiempo", "como venimos",
  ],
  comparacion: [
    "ciclo pasado", "ciclo anterior", "comparar", "comparacion", "contra el",
    "ano pasado", "trimestre pasado", "versus", " vs ",
  ],
};

/** El tema del reporte, para cuando lo piden por su nombre: "ponlo tipo
 *  riesgo y alertas" no nombra una pregunta, nombra una familia. */
const TOPIC_WORDS: Readonly<Record<MetricTopic, readonly string[]>> = {
  riesgo: ["riesgo", "alerta", "alertas", "en rojo", "peligro"],
  avance: ["avance", "cumplimiento", "como va"],
  personas: ["personas", "participacion", "gente", "adopcion"],
  calidad: ["calidad", "como estan escritos", "peso"],
  comparacion: ["comparacion", "comparativo", "contra otro ciclo"],
  otro: [],
};

/** La pregunta con la que se responde cada tema. */
const TOPIC_QUESTION: Readonly<Record<MetricTopic, string>> = {
  riesgo: "atrasados",
  avance: "cumplimiento",
  personas: "sin-reportar",
  calidad: "peso",
  comparacion: "comparacion",
  otro: "cumplimiento",
};

/** Cómo se nombra cada corte en voz alta. */
const CUT_WORDS: Readonly<Record<string, readonly string[]>> = {
  area: ["area", "areas", "departamento", "departamentos"],
  grupo: ["grupo", "grupos", "equipo", "equipos"],
  lider: ["lider", "lideres", "jefe", "jefes", "manager"],
  persona: ["persona", "personas", "colaborador", "colaboradores", "uno por uno", "individual"],
  objetivo: ["objetivo de empresa", "objetivos de empresa", "objetivo estrategico", "por objetivo"],
  medida: ["tipo de medida", "tipo de medidas", "unidad", "dinero", "porcentaje"],
  mes: ["mes", "meses", "mensual", "mes a mes"],
  ciclo: ["ciclo", "ciclos", "trimestre", "trimestres", "ano pasado"],
};

/** Cómo se pide cada forma. "Torta" no existe en el vocabulario del reporte,
 *  pero es lo que la gente dice, así que se entiende y se devuelve anillo. */
const SHAPE_WORDS: Readonly<Record<MetricShape, readonly string[]>> = {
  anillo: ["anillo", "dona", "donut", "torta", "pastel", "circular", "pie"],
  barras: ["barra", "barras", "ranking", "de mayor a menor"],
  linea: ["linea", "lineas", "curva", "serie", "en el tiempo", "mes a mes"],
  tabla: ["tabla", "listado", "fila por fila", "excel", "detalle completo"],
  kpi: ["un numero", "numero grande", "kpi", "una cifra", "solo el dato", "indicador"],
  mapa: ["mapa de calor", "heatmap", "mapa", "calor", "cruce", "matriz"],
};

/* ------------------------------------------------------------------ *
 * Lectura de una frase
 * ------------------------------------------------------------------ */

export interface MetricParse {
  brief: MetricBrief;
  /** Qué reconoció esta frase — con esto la IA contesta "entendido: …" en vez
   *  de repetir la pregunta que el usuario acaba de responder. */
  found: {
    question: boolean;
    cut: boolean;
    shape: boolean;
    title: boolean;
  };
}

/** El nombre, cuando viene entrecomillado: `llámala "Semáforo de áreas"`. */
const readQuotedTitle = (raw: string): string | null => {
  const match = raw.match(/["“”'']([^"“”'']{3,60})["“”'']/);
  return match ? match[1].trim() : null;
};

const readQuestion = (text: string): string | null => {
  // El enunciado exacto de la pregunta gana sobre cualquier palabra suelta:
  // es lo que devuelven los chips.
  const exact = METRIC_QUESTIONS.find((item) => text.includes(normalize(item.question)));
  if (exact) return exact.id;
  const byId = METRIC_QUESTIONS.find((item) => text === item.id);
  if (byId) return byId.id;
  const byWords = METRIC_QUESTIONS.find((item) => has(text, QUESTION_WORDS[item.id] ?? []));
  if (byWords) return byWords.id;
  const topic = METRIC_TOPICS.find(
    (item) => item.id !== "otro" && (text.includes(normalize(item.label)) || has(text, TOPIC_WORDS[item.id]))
  );
  return topic ? TOPIC_QUESTION[topic.id] : null;
};

const readShape = (text: string): MetricShape | null => {
  const byLabel = METRIC_SHAPES.find((item) => text.includes(normalize(item.label)));
  if (byLabel) return byLabel.id;
  const entry = (Object.keys(SHAPE_WORDS) as MetricShape[]).find((shape) =>
    has(text, SHAPE_WORDS[shape])
  );
  return entry ?? null;
};

const readCut = (text: string): string | null => {
  const entry = Object.keys(CUT_WORDS).find((cutId) => has(text, CUT_WORDS[cutId]));
  return entry ?? null;
};

/**
 * Lee una frase sobre la métrica que ya se lleva armada.
 *
 * Nunca borra lo que ya estaba: un mensaje que solo dice "mejor por líder"
 * cambia el corte y deja la pregunta donde estaba.
 */
export function parseMetricMessage(raw: string, current: MetricBrief = EMPTY_BRIEF): MetricParse {
  const text = normalize(raw);
  const brief: MetricBrief = { ...current };
  const found = { question: false, cut: false, shape: false, title: false };

  const questionId = readQuestion(text);
  if (questionId !== null && questionId !== current.questionId) {
    brief.questionId = questionId;
    found.question = true;
    // El corte anterior solo sobrevive si la pregunta nueva lo ofrece:
    // "días de retraso por tipo de medida" no responde nada.
    if (brief.cutId !== null && !questionById(questionId).cutIds.includes(brief.cutId)) {
      brief.cutId = null;
    }
    // Lo mismo con la forma: se vuelve a dejar en manos de la IA salvo que
    // este mismo mensaje pida una.
    brief.shape = null;
  }

  const cutId = readCut(text);
  if (cutId !== null) {
    const question = brief.questionId ? questionById(brief.questionId) : null;
    if (question === null || question.cutIds.includes(cutId)) {
      if (cutId !== current.cutId) found.cut = true;
      brief.cutId = cutId;
    }
  }

  const shape = readShape(text);
  if (shape !== null) {
    // La forma solo se toma cuando se pide de verdad. "Mes a mes" también es
    // una pregunta, y ahí la línea la elige la IA, no esta regla.
    const asksForShape =
      has(text, [
        "tipo", "forma", "ponlo", "dale", "muestra", "grafica", "grafico",
        "quiero", "hazlo", "mejor", "prefiero", "cambia",
      ]) ||
      METRIC_SHAPES.some((item) => text.includes(normalize(item.label)));
    if (asksForShape && shape !== current.shape) {
      brief.shape = shape;
      found.shape = true;
    }
  }

  const title = readQuotedTitle(raw);
  if (title !== null) {
    brief.title = title;
    found.title = true;
  }

  // Todo lo que escribió queda como contexto: es lo único que la IA no puede
  // deducir de las opciones, y es lo que se le muestra de vuelta.
  const detail = raw.trim();
  if (detail !== "" && !brief.detail.includes(detail)) {
    brief.detail = brief.detail === "" ? detail : `${brief.detail} · ${detail}`;
  }

  return { brief, found };
}

/* ------------------------------------------------------------------ *
 * Qué falta
 * ------------------------------------------------------------------ */

export type MetricCriterionId = "question" | "cut";

export const missingMetricCriteria = (brief: MetricBrief): MetricCriterionId[] => {
  const missing: MetricCriterionId[] = [];
  if (brief.questionId === null) missing.push("question");
  else if (brief.cutId === null) missing.push("cut");
  return missing;
};

export const isMetricBriefReady = (brief: MetricBrief): boolean =>
  missingMetricCriteria(brief).length === 0;

/* ------------------------------------------------------------------ *
 * Segundo turno: qué quiere hacer con la métrica ya dibujada
 * ------------------------------------------------------------------ */

export type MetricIntent = "keep" | "another" | "discard";

/**
 * Lo que pide una frase que llega cuando la métrica ya está en el resumen.
 *
 * Devuelve `null` cuando no es ninguna de las tres: entonces la frase se lee
 * como un ajuste —otra forma, otro corte, otra pregunta— y no como una orden.
 */
export function parseMetricIntent(raw: string): MetricIntent | null {
  const text = normalize(raw);
  if (has(text, ["descarta", "descartar", "borra", "borrala", "elimina", "quitala", "no la quiero", "cancelar"]))
    return "discard";
  if (has(text, ["otra propuesta", "otra opcion", "otra forma", "regenera", "prueba otra", "sorprendeme"]))
    return "another";
  if (has(text, ["listo", "asi esta bien", "asi queda", "perfecto", "dejala", "gracias", "ya esta", "me sirve"]))
    return "keep";
  return null;
}
