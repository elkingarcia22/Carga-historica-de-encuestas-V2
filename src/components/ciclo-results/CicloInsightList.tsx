import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CASCADE_CONTENT_GAP,
  cascadeContainer,
  cascadeItem,
  cascadeItemSettleTime,
} from "@/lib/cascadeAnimation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_RANK_CELL,
  AI_ROW,
  AI_TABLE,
  AI_TBODY,
  AI_THEAD,
  AI_THEAD_ROW,
  AI_TITLE_CELL,
  AiSectionCard,
  AiSectionMeta,
  type AiMetaDot,
} from "@/components/survey-results/AiSectionCard";
import {
  CONFIDENCE_STYLES,
  type InsightConfidence,
} from "@/components/survey-results/insightConfidence";
import type { CicloInsight, InsightAction } from "./cicloInsights";

/**
 * Las lecturas de la IA, leídas por el mismo camino que el resto del reporte.
 *
 * Un muro de tarjetas sueltas es la única forma que esta vista nunca usa:
 * Resumen, Cumplimiento, Colaboradores y Ranking ponen su contenido en un
 * bloque plegable con una tabla dentro. Así que un grupo de lecturas es un
 * bloque y una lectura es una fila que se abre para mostrar sobre qué se
 * apoya —y, aquí, el atajo a la vista donde se puede hacer algo, que es lo
 * que un ciclo de objetivos tiene y una encuesta no.
 */

export interface InsightGroup {
  id: string;
  heading: string;
  /** La línea bajo el título: qué pregunta responde el bloque. */
  question: string;
  items: readonly CicloInsight[];
}

interface CicloInsightListProps {
  groups: readonly InsightGroup[];
  isAnalyzing?: boolean;
  onAction: (action: InsightAction) => void;
}

export function CicloInsightList({ groups, isAnalyzing = false, onAction }: CicloInsightListProps) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, index) => {
        const numbering = index + 1;
        const revealDelay = cascadeItemSettleTime(0, numbering - 1) + CASCADE_CONTENT_GAP;
        return (
          <AiSectionCard
            key={group.id}
            numbering={numbering}
            heading={group.heading}
            question={group.question}
            meta={<ConfidenceMix items={group.items} />}
          >
            <InsightTable
              items={group.items}
              isAnalyzing={isAnalyzing}
              revealDelay={revealDelay}
              onAction={onAction}
            />
          </AiSectionCard>
        );
      })}
    </div>
  );
}

/** Las lecturas de un grupo contadas por lo segura que está la IA de ellas. */
function ConfidenceMix({ items }: { items: readonly CicloInsight[] }) {
  const dots = React.useMemo<readonly AiMetaDot[]>(() => {
    const tally = { high: 0, medium: 0, low: 0 } as Record<InsightConfidence, number>;
    for (const item of items) tally[item.confidence] += 1;
    return (["high", "medium", "low"] as const).map((id) => ({
      id,
      color: CONFIDENCE_STYLES[id].color,
      count: tally[id],
      title: `${tally[id]} de confiabilidad ${CONFIDENCE_STYLES[id].label.toLowerCase()}`,
    }));
  }, [items]);

  return <AiSectionMeta count={items.length} unit="lectura" unitPlural="lecturas" dots={dots} />;
}

function InsightTable({
  items,
  isAnalyzing,
  revealDelay = 0,
  onAction,
}: {
  items: readonly CicloInsight[];
  isAnalyzing: boolean;
  revealDelay?: number;
  onAction: (action: InsightAction) => void;
}) {
  return (
    <table className={AI_TABLE}>
      <thead className={AI_THEAD}>
        <tr className={AI_THEAD_ROW}>
          <th className="w-10 px-4 py-2.5 text-center">#</th>
          <th className="py-2.5">Lectura de la IA</th>
          <th className="w-[150px] py-2.5 pr-4 text-right">Confiabilidad</th>
          <th className="w-10 py-2.5 pr-4" aria-label="Detalle" />
        </tr>
      </thead>
      <motion.tbody
        className={AI_TBODY}
        initial="hidden"
        animate="show"
        custom={revealDelay}
        variants={cascadeContainer}
      >
        {items.map((insight, index) => (
          <InsightRows
            key={insight.id}
            index={index + 1}
            insight={insight}
            isAnalyzing={isAnalyzing}
            onAction={onAction}
          />
        ))}
      </motion.tbody>
    </table>
  );
}

/** Una lectura: su titular, y lo que la sostiene cuando está abierta. */
function InsightRows({
  index,
  insight,
  isAnalyzing,
  onAction,
}: {
  index: number;
  insight: CicloInsight;
  isAnalyzing: boolean;
  onAction: (action: InsightAction) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const toggle = () => setOpen((current) => !current);

  if (isAnalyzing) {
    return (
      <tr>
        <td className="px-4 py-3.5 text-center">
          <Skeleton className="mx-auto h-3 w-3" />
        </td>
        <td className="py-3.5 pr-4">
          <Skeleton className="h-3.5 w-[62%]" />
        </td>
        <td className="py-3.5 pr-4">
          <Skeleton className="ml-auto h-4 w-20 rounded-full" />
        </td>
        <td className="py-3.5 pr-4" />
      </tr>
    );
  }

  return (
    <>
      <motion.tr
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        variants={cascadeItem}
        className={cn(AI_ROW, open && "bg-primary/[0.03]")}
      >
        <td className={AI_RANK_CELL}>{index}</td>
        <td className={AI_TITLE_CELL}>{insight.title}</td>
        <td className="py-3 pr-4 text-right">
          <ConfidenceChip level={insight.confidence} />
        </td>
        <td className="py-3 pr-4 text-right">
          <ChevronRight
            className={cn(
              "ml-auto h-4 w-4 text-muted-foreground/60 transition-transform duration-200 group-hover:text-text-primary",
              open && "rotate-90"
            )}
            strokeWidth={2}
          />
        </td>
      </motion.tr>

      {open && (
        <tr className="bg-muted/30">
          <td colSpan={4} className="px-4 py-4">
            <motion.div
              className="flex flex-col gap-3"
              initial="hidden"
              animate="show"
              variants={cascadeContainer}
            >
              <motion.p
                variants={cascadeItem}
                className="max-w-4xl text-[13px] leading-relaxed text-text-primary"
              >
                {insight.body}
              </motion.p>

              <motion.p
                variants={cascadeItem}
                className="flex items-start gap-2 text-[11px] leading-relaxed text-text-secondary"
              >
                <Quote className="mt-px h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span>
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidencia
                  </span>{" "}
                  <span className="font-medium tabular-nums">{insight.evidence}</span>
                </span>
              </motion.p>

              {/* Lo que separa esta pestaña de la de una encuesta: la lectura
                  termina en la vista donde se puede hacer algo, con el filtro
                  que la produjo ya puesto. Un hallazgo que obliga a
                  reconstruir ese filtro a mano es una nota al margen. */}
              {insight.action && (
                <motion.div variants={cascadeItem} className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAction(insight.action!);
                    }}
                    className="gap-1.5 text-[12.5px]"
                  >
                    {insight.action.label}
                    <ArrowRight className="size-3.5" strokeWidth={2.4} />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </td>
        </tr>
      )}
    </>
  );
}

/** La banda de confiabilidad como chip, igual que en el reporte de encuestas. */
export function ConfidenceChip({ level }: { level: InsightConfidence }) {
  const style = CONFIDENCE_STYLES[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none"
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.foreground,
      }}
      title={style.meaning}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: style.color }}
      />
      {style.label}
    </span>
  );
}
