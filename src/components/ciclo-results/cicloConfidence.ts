import {
  CONFIDENCE_ORDER,
  CONFIDENCE_STYLES,
  type InsightConfidence,
} from "@/components/survey-results/insightConfidence";
import type { ScaleLegendItem } from "@/components/survey-results/favorabilityScale";

/**
 * Qué significa cada banda de confiabilidad *en un ciclo de objetivos*.
 *
 * Los colores se heredan del reporte de encuestas a propósito —quien aprendió
 * dos pestañas atrás que el verde es "sólido" no debería tener que
 * reaprenderlo aquí—, pero el texto no puede heredarse: en una encuesta la
 * confiabilidad depende de cuánta gente respondió, y aquí de cuánta gente hay
 * detrás del corte. Un 12 % de atraso sobre sesenta personas y sobre tres son
 * el mismo número y dos cosas distintas.
 */
export const CICLO_CONFIDENCE_MEANING: Readonly<Record<InsightConfidence, string>> = {
  high: "Cifra directa del ciclo, sobre 30 personas o más",
  medium: "Comparación razonable, entre 10 y 29 personas",
  low: "Indicio sobre un corte pequeño; confírmalo en las demás pestañas",
};

export const CICLO_CONFIDENCE_LEGEND: readonly ScaleLegendItem[] = CONFIDENCE_ORDER.map((id) => {
  const style = CONFIDENCE_STYLES[id];
  return {
    id,
    label: style.label,
    range: CICLO_CONFIDENCE_MEANING[id],
    color: style.color,
    background: style.background,
    border: style.border,
    foreground: style.foreground,
  };
});
