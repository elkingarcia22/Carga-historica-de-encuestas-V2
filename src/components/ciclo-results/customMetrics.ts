import type { MetricDefinition } from "./metricDefinition";
import type { MetricBrief } from "./metricQuestions";

/**
 * Una métrica que alguien pidió en el chat y que ya vive en el resumen.
 *
 * El chat no dibuja la métrica dentro de sí mismo y luego la "agrega": la
 * publica en el resumen desde el primer intento y sigue hablando. Por eso
 * lleva `id`: el segundo turno —"dale tipo anillo", "mejor por líder"— no
 * crea otra tarjeta, reescribe esta.
 */
export interface CustomMetric {
  id: string;
  definition: MetricDefinition;
  /**
   * Los criterios con los que se armó.
   *
   * Se guardan con la métrica para que volver a abrir el chat sobre ella
   * continúe la conversación —"ahora por líder"— en vez de empezar de cero:
   * de la definición sola no se puede recuperar qué pregunta la originó.
   */
  brief: MetricBrief;
  /** Por qué esa forma y no otra. Es lo que la IA dijo al dibujarla, y se
   *  queda en la tarjeta: sin esa línea la forma se lee como un capricho. */
  reason: string;
}

let _metricId = 0;

export const nextCustomMetricId = (): string => `metric-${++_metricId}-${Date.now()}`;

/** Reemplaza la métrica con ese id, o la pone de primera si es nueva. */
export function upsertCustomMetric(
  list: readonly CustomMetric[],
  metric: CustomMetric
): CustomMetric[] {
  const exists = list.some((item) => item.id === metric.id);
  if (!exists) return [metric, ...list];
  return list.map((item) => (item.id === metric.id ? metric : item));
}

/**
 * La IA trabajando, mirada desde el tablero.
 *
 * Es el mismo contrato que el chat de objetivos le pasa a su lista
 * (`onWorkingStateChange`): progreso, la línea de lo que está haciendo y el
 * rótulo de lo que produce. Lo que agrega es `metricId` — sin él, el hueco
 * de trabajo no sabría en qué fila abrirse, y el trabajo se vería en algún
 * lugar en vez de verse *donde va a caer lo que está armando*.
 */
export interface MetricWorkingState {
  /** `null` mientras es una métrica nueva; el id de la que se está rehaciendo. */
  metricId: string | null;
  /** 0–100. */
  progress: number;
  caption: string;
  detail: string;
}
