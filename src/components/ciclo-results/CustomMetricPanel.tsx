import { motion } from "framer-motion";
import { Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip } from "@/lib/tone";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiGeneratedBadge } from "@/components/ai-interaction";
import { MetricChart } from "./MetricSketch";
import { describeMetric, topicOf } from "./metricDefinition";
import type { CustomMetric } from "./customMetrics";

/**
 * La métrica pedida en el chat, ya montada en el resumen.
 *
 * Tiene la misma anatomía que las tarjetas de al lado —título, la línea que
 * dice qué se está mirando, el gráfico debajo— y solo dos cosas que las
 * demás no tienen: la chispa que dice de dónde salió, y el botón de quitarla.
 * Una métrica que alguien acaba de inventar tiene que poder desaparecer con
 * un clic; las del reporte no, porque no las puso nadie.
 *
 * Mientras se conversa, esta tarjeta es la que cambia: pedir "dale tipo
 * anillo" en el panel de la izquierda redibuja esto sin recargar nada, y el
 * anillo de resalte marca cuál es la que se está tocando.
 */
export function CustomMetricPanel({
  metric,
  highlighted,
  onRemove,
  onAdjust,
}: {
  metric: CustomMetric;
  /** La que el agente está tocando ahora mismo: se marca con el anillo
   *  degradado mientras el panel de la IA siga abierto sobre ella. */
  highlighted?: boolean;
  onRemove: () => void;
  /** Vuelve a abrir el chat para seguir ajustándola. */
  onAdjust?: () => void;
}) {
  const { definition, reason } = metric;
  const topic = topicOf(definition);

  return (
    <motion.article
      layout
      data-metric-id={metric.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-card transition-colors",
        // Mientras el agente está trabajando sobre ella, la tarjeta lleva el
        // anillo degradado de la IA: es la misma marca que el panel de la
        // izquierda, y dice sin texto cuál de todas es la que se está
        // tocando. El anillo va enmascarado sobre el fondo de la tarjeta, no
        // como borde, para no comerse su superficie.
        highlighted
          ? "ai-gradient-ring border-transparent shadow-ai-premium"
          : "border-border/60"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-lg"
              style={toneChip(topic.tone)}
            >
              <topic.icon className="size-3.5" strokeWidth={2.2} />
            </span>
            <h3 className="min-w-0 truncate text-[13px] font-bold text-text-primary">
              {definition.title.trim() || topic.label}
            </h3>
            <AiGeneratedBadge />
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-text-muted">
            {describeMetric(definition)} · datos de ejemplo
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onAdjust && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAdjust}
                  className="flex size-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="Ajustar esta métrica con IA"
                >
                  <Sparkles className="size-4" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Ajustar con IA</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRemove}
                className="flex size-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-negative/10 hover:text-status-negative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Quitar esta métrica del resumen"
              >
                <Trash2 className="size-4" strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Quitar del resumen</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <MetricChart metric={definition} />
      </div>

      {reason && (
        <p className="border-t border-border/50 pt-2.5 text-[11px] leading-relaxed text-text-muted">
          {reason}
        </p>
      )}
    </motion.article>
  );
}
