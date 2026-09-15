import {
  AlignLeft,
  BarChart3,
  CalendarClock,
  CircleDot,
  Grid3x3,
  Hash,
  Table2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";

/**
 * El vocabulario con el que se arma una métrica que todavía no existe.
 *
 * "Cuéntanos qué te falta" en una caja de texto vacía devuelve frases como
 * "quisiera ver mejor el avance", que no se puede construir. Aquí la métrica
 * se descompone en las cuatro decisiones que sí la definen —qué se mide, por
 * qué se agrupa, con qué forma se dibuja y dónde vive—, cada una con opciones
 * cerradas. El texto libre sigue estando, pero ya no carga solo con todo.
 *
 * Es el mismo par de ejes con el que se arma cualquier gráfico: una medida y
 * una dimensión. Nombrarlos así en el formulario hace que la definición quede
 * lista para construir, no para interpretar.
 */

// ── Tema del reporte ───────────────────────────────────────────────────────

export type MetricTopic = "avance" | "personas" | "calidad" | "riesgo" | "comparacion" | "otro";

export interface MetricTopicMeta {
  id: MetricTopic;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}

export const METRIC_TOPICS: readonly MetricTopicMeta[] = [
  {
    id: "avance",
    label: "Avance y cumplimiento",
    hint: "Cómo va el ciclo contra sus metas.",
    icon: TrendingUp,
    tone: "brand",
  },
  {
    id: "personas",
    label: "Personas y participación",
    hint: "Quién reporta, quién no, quién quedó fuera.",
    icon: Users,
    tone: "neutral",
  },
  {
    id: "calidad",
    label: "Calidad de los objetivos",
    hint: "Cómo están escritos, medidos y ponderados.",
    icon: AlignLeft,
    tone: "positive",
  },
  {
    id: "riesgo",
    label: "Riesgo y alertas",
    hint: "Qué se va a caer si nadie hace nada.",
    icon: CalendarClock,
    tone: "warning",
  },
  {
    id: "comparacion",
    label: "Comparación entre ciclos",
    hint: "Este ciclo contra el anterior, o contra el año pasado.",
    icon: BarChart3,
    tone: "ai",
  },
  {
    id: "otro",
    label: "Otra cosa",
    hint: "No entra en ninguno de los anteriores.",
    icon: Hash,
    tone: "neutral",
  },
];

// ── Qué se mide (el eje de los valores) ────────────────────────────────────

export interface MetricOption {
  id: string;
  label: string;
  /** Cómo se lee un valor de ejemplo en la vista previa. */
  sample: (index: number) => string;
}

export const METRIC_MEASURES: readonly MetricOption[] = [
  { id: "cumplimiento", label: "% de cumplimiento", sample: (i) => `${[38, 62, 77, 91][i % 4]} %` },
  { id: "objetivos", label: "Cantidad de objetivos", sample: (i) => `${[112, 240, 318, 405][i % 4]}` },
  { id: "personas", label: "Cantidad de personas", sample: (i) => `${[18, 47, 96, 143][i % 4]}` },
  { id: "nivel", label: "Nivel de cumplimiento", sample: (i) => ["Por mejorar", "Bueno", "Bueno", "Excelente"][i % 4] },
  { id: "retraso", label: "Días de retraso", sample: (i) => `${[24, 12, 6, 2][i % 4]} d` },
  { id: "comentarios", label: "Objetivos con conversación", sample: (i) => `${[41, 128, 260, 377][i % 4]}` },
  { id: "peso", label: "Peso asignado", sample: (i) => `${[15, 25, 30, 40][i % 4]} %` },
];

// ── Cómo se agrupa (el eje de las categorías) ──────────────────────────────

export interface MetricDimension extends MetricOption {
  /** Cuatro nombres reales del ciclo, para que la vista previa no diga
   *  "Categoría 1". */
  examples: readonly string[];
}

export const METRIC_DIMENSIONS: readonly MetricDimension[] = [
  { id: "area", label: "Área", examples: ["Comercial", "Tecnología", "Operaciones", "Marketing"], sample: () => "" },
  { id: "grupo", label: "Grupo del ciclo", examples: ["Líderes", "Comercial LATAM", "Soporte", "Producto"], sample: () => "" },
  { id: "lider", label: "Líder", examples: ["A. Rojas", "M. Sierra", "J. Peña", "L. Castro"], sample: () => "" },
  { id: "persona", label: "Persona", examples: ["Ana G.", "Bruno M.", "Carla T.", "Diego R."], sample: () => "" },
  { id: "objetivo", label: "Objetivo de empresa", examples: ["Crecer ingresos", "Retener clientes", "Bajar costos", "Cultura"], sample: () => "" },
  { id: "medida", label: "Tipo de medida", examples: ["Dinero", "Porcentaje", "Numérico", "Se cumple"], sample: () => "" },
  { id: "mes", label: "Mes", examples: ["Ago", "Sep", "Oct", "Nov"], sample: () => "" },
  { id: "ciclo", label: "Ciclo", examples: ["Q1", "Q2", "Q3", "Q4"], sample: () => "" },
];

// ── Con qué forma se dibuja ────────────────────────────────────────────────

export type MetricShape = "kpi" | "barras" | "anillo" | "linea" | "tabla" | "mapa";

export interface MetricShapeMeta {
  id: MetricShape;
  label: string;
  /** Para qué sirve — lo que evita que todo el mundo pida "una torta". */
  hint: string;
  icon: LucideIcon;
  /** Si la forma necesita una dimensión por la que agrupar. Un número grande
   *  no agrupa nada: es una sola cifra. */
  needsDimension: boolean;
}

export const METRIC_SHAPES: readonly MetricShapeMeta[] = [
  { id: "kpi", label: "Un número", hint: "Una sola cifra que se mira de reojo.", icon: Hash, needsDimension: false },
  { id: "barras", label: "Barras", hint: "Comparar el mismo dato entre varias cosas.", icon: BarChart3, needsDimension: true },
  { id: "anillo", label: "Anillo", hint: "De qué está hecho un total.", icon: CircleDot, needsDimension: true },
  { id: "linea", label: "Línea en el tiempo", hint: "Cómo cambia mes a mes.", icon: TrendingUp, needsDimension: true },
  { id: "tabla", label: "Tabla", hint: "Ver el detalle fila por fila y exportarlo.", icon: Table2, needsDimension: true },
  { id: "mapa", label: "Mapa de calor", hint: "Cruzar dos ejes y buscar el punto rojo.", icon: Grid3x3, needsDimension: true },
];

// ── Dónde debería vivir ────────────────────────────────────────────────────

export const METRIC_PLACES: readonly { id: string; label: string }[] = [
  { id: "resumen", label: "En el resumen del ciclo" },
  { id: "pestana", label: "En una pestaña nueva" },
  { id: "descarga", label: "En la descarga de Excel" },
  { id: "correo", label: "En un correo periódico" },
];

// ── La métrica completa ────────────────────────────────────────────────────

export interface MetricDefinition {
  topic: MetricTopic;
  measureId: string;
  dimensionId: string;
  shape: MetricShape;
  places: readonly string[];
  title: string;
  detail: string;
}

export const EMPTY_METRIC: MetricDefinition = {
  topic: "avance",
  measureId: "cumplimiento",
  dimensionId: "area",
  shape: "barras",
  places: ["resumen"],
  title: "",
  detail: "",
};

const byId = <T extends { id: string }>(list: readonly T[], id: string): T =>
  list.find((item) => item.id === id) ?? list[0];

export const measureOf = (metric: MetricDefinition): MetricOption =>
  byId(METRIC_MEASURES, metric.measureId);

export const dimensionOf = (metric: MetricDefinition): MetricDimension =>
  byId(METRIC_DIMENSIONS, metric.dimensionId);

export const shapeOf = (metric: MetricDefinition): MetricShapeMeta =>
  byId(METRIC_SHAPES, metric.shape);

export const topicOf = (metric: MetricDefinition): MetricTopicMeta =>
  byId(METRIC_TOPICS, metric.topic);

/**
 * La métrica en una frase. Es lo que se le muestra de vuelta a quien la está
 * armando: si la frase no dice lo que quería, se ve aquí y no tres semanas
 * después de haberla creado.
 */
export function describeMetric(metric: MetricDefinition): string {
  const measure = measureOf(metric).label.toLowerCase();
  const shape = shapeOf(metric);
  if (!shape.needsDimension) return `${measure} como una sola cifra`;
  const dimension = dimensionOf(metric).label.toLowerCase();
  const form = shape.id === "linea" ? "en el tiempo" : `en ${shape.label.toLowerCase()}`;
  return `${measure} por ${dimension}, ${form}`;
}

/** Tres métricas ya armadas. Un formulario en blanco no enseña qué se puede
 *  construir; estas tres enseñan el vocabulario en un clic. */
export const METRIC_PRESETS: readonly { label: string; metric: MetricDefinition }[] = [
  {
    label: "Avance por líder",
    metric: {
      ...EMPTY_METRIC,
      topic: "avance",
      measureId: "cumplimiento",
      dimensionId: "lider",
      shape: "barras",
      title: "Avance promedio por líder",
    },
  },
  {
    label: "Este ciclo vs. el anterior",
    metric: {
      ...EMPTY_METRIC,
      topic: "comparacion",
      measureId: "cumplimiento",
      dimensionId: "ciclo",
      shape: "linea",
      title: "Cumplimiento de este ciclo contra el anterior",
    },
  },
  {
    label: "Peso de los objetivos",
    metric: {
      ...EMPTY_METRIC,
      topic: "calidad",
      measureId: "peso",
      dimensionId: "objetivo",
      shape: "anillo",
      title: "Cómo se reparte el peso entre objetivos de empresa",
    },
  },
];
