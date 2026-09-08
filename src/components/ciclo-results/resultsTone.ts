import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import type { MetricTone } from "@/components/survey-results/favorabilityScale";

/**
 * Cómo se traduce una banda de resultado a los tres tonos con los que el
 * reporte de encuestas pinta sus lecturas ("Favorable", "Neutral",
 * "Desfavorable"). El acento es la barrita de color junto al título de la
 * tarjeta de métrica.
 */
export function toneForEstado(estado: ObjetivoEstadoConfig | null): {
  tone: MetricTone;
  accent: string;
} {
  if (!estado) return { tone: "warning", accent: "bg-primary" };
  if (estado.variant === "positive") return { tone: "positive", accent: "bg-status-positive" };
  if (estado.variant === "negative") return { tone: "negative", accent: "bg-status-negative" };
  return { tone: "warning", accent: "bg-status-warning" };
}
