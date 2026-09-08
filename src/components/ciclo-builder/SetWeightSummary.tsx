import { motion } from "framer-motion";
import { Scale, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOTAL_WEIGHT } from "./cicloBuilderTypes";

/**
 * The weight budget of one assignment, always visible while its objectives are
 * being written.
 *
 * Weight only means something as a share of a fixed whole, and the author edits
 * one objective at a time — without this the "must add up to 100" rule would
 * only surface at the end, when fixing it means revisiting every card.
 */
export function SetWeightSummary({
  total,
  count,
  onDistribute,
}: {
  total: number;
  count: number;
  onDistribute: () => void;
}) {
  const isExact = total === TOTAL_WEIGHT;
  const isOver = total > TOTAL_WEIGHT;

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3",
        isExact
          ? "border-status-positive/25 bg-status-positive/5"
          : isOver
            ? "border-destructive/30 bg-destructive/5"
            : "border-border/60 bg-surface-muted/40"
      )}
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <Scale className="size-4 text-text-secondary" strokeWidth={2} />
        Peso repartido
      </span>

      <span className="relative h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-border/60">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            isExact ? "bg-status-positive" : isOver ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${Math.min(100, (total / TOTAL_WEIGHT) * 100)}%` }}
        />
      </span>

      <span
        className={cn(
          "text-[13px] font-bold tabular-nums",
          isExact ? "text-status-positive" : isOver ? "text-destructive" : "text-text-primary"
        )}
      >
        {total} / {TOTAL_WEIGHT} %
      </span>

      {!isExact && count > 0 && (
        <button
          type="button"
          onClick={onDistribute}
          className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95"
        >
          <Sparkles className="size-3.5" strokeWidth={2.2} />
          Repartir en partes iguales
        </button>
      )}
    </motion.div>
  );
}
