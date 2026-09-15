import {
  BarChart3,
  CalendarClock,
  GitCompareArrows,
  Scale,
  TrendingUp,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";
import {
  EMPTY_METRIC,
  METRIC_DIMENSIONS,
  measureOf,
  type MetricDefinition,
  type MetricShape,
  type MetricTopic,
} from "./metricDefinition";

/**
 * El vocabulario del compositor de métricas.
 *
 * El formulario clásico pregunta por medida, dimensión y forma — las tres
 * piezas con las que se construye un gráfico. Son las correctas para quien
 * construye, pero nadie llega al reporte pensando "quiero cumplimiento por
 * líder en barras": llega pensando "¿quién va más atrasado?".
 *
 * Aquí se pregunta eso y nada más. Cada pregunta ya trae por debajo su
 * medida, su tema y las formas que la responden; lo único que queda por
 * decidir es contra qué se compara y dónde vive. La forma la elige la IA, y
 * dice por qué — que es la parte que el formulario dejaba en manos de quien
 * muchas veces solo quería "una torta".
 */

export interface MetricQuestion {
  id: string;
  /** La pregunta tal cual se diría en voz alta. */
  question: string;
  /** Qué se resuelve con la respuesta, en una línea. */
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  topic: MetricTopic;
  measureId: string;
  /** Los cortes que tienen sentido para esta pregunta; el primero es el que
   *  viene propuesto. Comparar días de retraso por "tipo de medida" no
   *  responde nada, así que esa opción no se ofrece aquí. */
  cutIds: readonly string[];
  /** Formas ordenadas por qué tan bien responden. La primera es la que la IA
   *  propone; las siguientes son lo que sale al pedir otra propuesta. */
  shapes: readonly MetricShape[];
  /** Cómo queda nombrada la métrica, ya con el corte elegido. */
  title: (cutLabel: string) => string;
}

export const METRIC_QUESTIONS: readonly MetricQuestion[] = [
  {
    id: "atrasados",
    question: "¿Quién va más atrasado?",
    hint: "Los que llevan más días sin mover su avance.",
    icon: CalendarClock,
    tone: "warning",
    topic: "riesgo",
    measureId: "retraso",
    cutIds: ["area", "lider", "grupo", "persona"],
    shapes: ["barras", "tabla", "mapa"],
    title: (cut) => `Días de retraso por ${cut}`,
  },
  {
    id: "cumplimiento",
    question: "¿Cómo va el cumplimiento?",
    hint: "El avance contra la meta, comparado entre unos y otros.",
    icon: TrendingUp,
    tone: "brand",
    topic: "avance",
    measureId: "cumplimiento",
    cutIds: ["area", "grupo", "lider", "persona"],
    shapes: ["barras", "mapa", "kpi"],
    title: (cut) => `Cumplimiento por ${cut}`,
  },
  {
    id: "sin-reportar",
    question: "¿Quién no ha reportado nada?",
    hint: "Cuánta gente sigue sin tocar sus objetivos.",
    icon: UserX,
    tone: "negative",
    topic: "personas",
    measureId: "personas",
    cutIds: ["area", "lider", "grupo"],
    shapes: ["barras", "tabla", "anillo"],
    title: (cut) => `Personas sin reportar por ${cut}`,
  },
  {
    id: "peso",
    question: "¿Cómo se reparte el peso?",
    hint: "En qué se está jugando de verdad el ciclo.",
    icon: Scale,
    tone: "positive",
    topic: "calidad",
    measureId: "peso",
    cutIds: ["objetivo", "area", "medida"],
    shapes: ["anillo", "barras", "tabla"],
    title: (cut) => `Reparto del peso por ${cut}`,
  },
  {
    id: "evolucion",
    question: "¿Cómo venimos mes a mes?",
    hint: "Si el ciclo se está moviendo o lleva semanas quieto.",
    icon: BarChart3,
    tone: "ai",
    topic: "avance",
    measureId: "cumplimiento",
    cutIds: ["mes"],
    shapes: ["linea", "barras"],
    title: () => "Evolución del cumplimiento mes a mes",
  },
  {
    id: "comparacion",
    question: "¿Cómo vamos contra el ciclo pasado?",
    hint: "Este ciclo mirado al lado del anterior.",
    icon: GitCompareArrows,
    tone: "neutral",
    topic: "comparacion",
    measureId: "cumplimiento",
    cutIds: ["ciclo", "area"],
    shapes: ["linea", "barras", "tabla"],
    title: (cut) => `Cumplimiento comparado por ${cut}`,
  },
];

export const questionById = (id: string): MetricQuestion =>
  METRIC_QUESTIONS.find((item) => item.id === id) ?? METRIC_QUESTIONS[0];

export const cutLabel = (cutId: string): string =>
  METRIC_DIMENSIONS.find((dimension) => dimension.id === cutId)?.label ?? cutId;

/**
 * Por qué la IA dibujó eso y no otra cosa.
 *
 * Es la línea que convierte la propuesta en una recomendación: sin ella, la
 * forma elegida se lee como un capricho del sistema y lo primero que hace
 * cualquiera es cambiarla.
 */
const SHAPE_REASON: Readonly<Record<MetricShape, string>> = {
  kpi: "Una sola cifra, porque la pregunta se responde con un número y no con una comparación.",
  barras: "Barras ordenadas, porque lo que buscas es quién está arriba y quién abajo.",
  anillo: "Un anillo, porque la pregunta es de qué está hecho el total y no cuál es más grande.",
  linea: "Una línea en el tiempo, porque lo que importa es cómo cambia y no cuánto es hoy.",
  tabla: "Una tabla, porque la respuesta se mira fila por fila y suele terminar exportada.",
  mapa: "Un mapa de calor, porque cruza dos ejes y lo que buscas es dónde está el punto rojo.",
};

export const shapeReason = (shape: MetricShape): string => SHAPE_REASON[shape];

/**
 * Los criterios elegidos, antes de que la IA los convierta en métrica.
 *
 * No lleva "dónde vive": una métrica de este reporte se crea en el resumen
 * del ciclo y en ningún otro sitio, así que preguntarlo era ofrecer una
 * decisión que no existe.
 *
 * Sí lleva el nombre y el contexto en texto libre, que son lo que las
 * opciones cerradas no pueden dar: cómo lo llama quien lo pide, y para qué
 * lo quiere. El segundo es lo único que le dice a la IA algo que no puede
 * deducir de la pregunta.
 */
export interface MetricBrief {
  questionId: string | null;
  cutId: string | null;
  title: string;
  detail: string;
  /**
   * La forma pedida a mano, cuando alguien la pidió.
   *
   * Por defecto es `null` y la elige la IA entre las que responden esa
   * pregunta. El chat la usa para atender "dale tipo anillo" sin tener que
   * volver a preguntarlo todo: es la única decisión del compositor que quien
   * mira una métrica ya dibujada quiere cambiar por su cuenta.
   */
  shape: MetricShape | null;
}

export const EMPTY_BRIEF: MetricBrief = {
  questionId: null,
  cutId: null,
  title: "",
  detail: "",
  shape: null,
};

/** El sitio único donde vive cualquier métrica creada desde este reporte. */
export const METRIC_HOME = "En el resumen del ciclo";

export const isBriefReady = (brief: MetricBrief): boolean =>
  brief.questionId !== null && brief.cutId !== null && brief.title.trim() !== "";

/** El nombre que la métrica tendría si nadie lo tocara. Se ofrece escrito en
 *  el campo, no como marca de agua: un campo vacío obliga a inventar un
 *  nombre para algo que todavía no se ha visto. */
export const suggestedTitle = (brief: MetricBrief): string => {
  if (!brief.questionId || !brief.cutId) return "";
  return questionById(brief.questionId).title(cutLabel(brief.cutId).toLowerCase());
};

/**
 * Los criterios, convertidos en la métrica que se va a crear.
 *
 * `attempt` es cuántas veces se pidió otra propuesta: recorre las formas de
 * la pregunta en orden, así que la segunda opinión siempre es una forma que
 * también responde y no una al azar.
 */
export function composeMetric(brief: MetricBrief, attempt = 0): MetricDefinition {
  const question = questionById(brief.questionId ?? "");
  const cutId = brief.cutId ?? question.cutIds[0];
  // La forma pedida a mano manda sobre la que propondría la IA: si alguien
  // dijo "anillo", pedir otra propuesta no debería devolverle barras.
  const shape = brief.shape ?? question.shapes[attempt % question.shapes.length];
  return {
    ...EMPTY_METRIC,
    topic: question.topic,
    measureId: question.measureId,
    dimensionId: cutId,
    shape,
    // Siempre el resumen: es el único sitio donde este reporte puede montar
    // una métrica nueva.
    places: ["resumen"],
    title: brief.title.trim() || question.title(cutLabel(cutId).toLowerCase()),
    detail: brief.detail.trim() || question.question,
  };
}

/**
 * Lo que la IA dice estar haciendo mientras trabaja.
 *
 * No es relleno: son las decisiones que quien pregunta se está ahorrando, y
 * la tercera línea nombra la que de verdad importa —la forma—, que es la que
 * después se explica en el resultado.
 */
export function composerStages(brief: MetricBrief): readonly string[] {
  const question = questionById(brief.questionId ?? "");
  const measure = measureOf(composeMetric(brief)).label.toLowerCase();
  return [
    // Si escribió para qué la quiere, la primera línea lo reconoce: es el
    // dato que acaba de dar y el único que no sale de las opciones.
    brief.detail.trim() ? "Leyendo lo que nos contaste…" : "Leyendo los objetivos del ciclo…",
    `Cruzando ${measure} por ${cutLabel(brief.cutId ?? question.cutIds[0]).toLowerCase()}…`,
    "Eligiendo la forma que mejor responde…",
    "Armando la métrica…",
  ];
}

export function stageCopy(brief: MetricBrief, progress: number): string {
  const stages = composerStages(brief);
  const index = Math.floor((progress / 100) * stages.length);
  return stages[Math.min(stages.length - 1, Math.max(0, index))];
}
