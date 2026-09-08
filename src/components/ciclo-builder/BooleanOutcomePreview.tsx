import { ArrowRight, Check, X } from "lucide-react";

/**
 * What a "se cumple / no se cumple" objective looks like at closing time.
 *
 * There is nothing to configure here, which is exactly why it needs saying:
 * an author who just picked this measure is looking at a card that suddenly
 * stopped asking for numbers, and the honest answer is that this kind of
 * objective has none — it lands on 0 % or on 100 %, with nothing in between.
 */
export function BooleanOutcomePreview() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-muted/40 px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <OutcomeChip tone="negative" label="No se cumple" score="0 %" />
        <ArrowRight className="size-4 text-text-secondary" strokeWidth={2.2} />
        <OutcomeChip tone="positive" label="Se cumple" score="100 %" />
      </div>

      <p className="text-[12px] leading-relaxed text-text-secondary">
        No hay valor inicial ni meta: al cerrar el ciclo, quien haga el seguimiento
        marca una de las dos opciones y el avance queda en 0 % o en 100 %. Si necesitas
        medir avances parciales, vuelve al paso anterior y elige una medida numérica.
      </p>
    </div>
  );
}

function OutcomeChip({
  tone,
  label,
  score,
}: {
  tone: "positive" | "negative";
  label: string;
  score: string;
}) {
  const isPositive = tone === "positive";
  const Icon = isPositive ? Check : X;

  return (
    <span
      className={
        isPositive
          ? "flex items-center gap-2 rounded-full border border-status-positive/25 bg-status-positive/10 px-3 py-1.5"
          : "flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"
      }
    >
      <Icon
        className={isPositive ? "size-3.5 text-status-positive" : "size-3.5 text-muted-foreground"}
        strokeWidth={2.6}
      />
      <span className="text-[12.5px] font-semibold text-text-primary">{label}</span>
      <span className="text-[11.5px] font-semibold tabular-nums text-text-secondary">{score}</span>
    </span>
  );
}
