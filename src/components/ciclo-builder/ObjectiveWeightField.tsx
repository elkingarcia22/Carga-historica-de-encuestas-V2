import * as React from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { MIN_OBJECTIVE_WEIGHT, TOTAL_WEIGHT } from "./cicloBuilderTypes";

interface ObjectiveWeightFieldProps {
  weight: number;
  onChange: (weight: number) => void;
  /** Sum of every other objective's weight, so the field can say what is left. */
  otherObjectivesWeight: number;
  showValidation?: boolean;
  /**
   * Cuánto hay que repartir en total. Casi siempre el ciclo entero, pero una
   * asignación que comparte a su gente con otra reparte solo su cupo — y el
   * campo tiene que contar contra ese número, no contra 100.
   */
  budget?: number;
}

/**
 * How much of the ciclo this one objective is worth.
 *
 * A bare percentage box invites the author to type 100 into every objective,
 * because nothing on screen says the numbers are competing for the same pie.
 * The slider plus the "quedan N %" line make that budget visible while the
 * value is being chosen, which is the only moment it can still be reasoned
 * about cheaply.
 */
export function ObjectiveWeightField({
  weight,
  onChange,
  otherObjectivesWeight,
  showValidation = false,
  budget = TOTAL_WEIGHT,
}: ObjectiveWeightFieldProps) {
  // Typed independently of the committed value so an empty box mid-edit isn't
  // instantly coerced back to a number and fights the keystroke.
  const [draftValue, setDraftValue] = React.useState(() => String(weight));
  React.useEffect(() => setDraftValue(String(weight)), [weight]);

  const commit = () => {
    const parsed = Number.parseInt(draftValue, 10);
    const next = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(budget, parsed));
    onChange(next);
    setDraftValue(String(next));
  };

  const remaining = budget - otherObjectivesWeight - weight;
  const error =
    showValidation && weight < MIN_OBJECTIVE_WEIGHT
      ? `El peso no puede ser inferior al ${MIN_OBJECTIVE_WEIGHT} %`
      : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        <Scale className="size-3.5 text-text-secondary" strokeWidth={2} />
        Peso dentro del ciclo
        <span className="text-destructive">•</span>
      </span>

      <div className="flex items-center gap-4">
        <Slider
          value={[weight]}
          min={0}
          max={budget}
          step={1}
          onValueChange={([next]) => onChange(next)}
          aria-label="Peso del objetivo"
          className="min-w-0 flex-1"
        />

        <span className="relative flex w-[92px] shrink-0 items-center">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 text-[13px] font-semibold text-text-secondary"
          >
            %
          </span>
          <input
            value={draftValue}
            inputMode="numeric"
            onChange={(event) => setDraftValue(event.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            aria-label="Peso del objetivo en porcentaje"
            aria-invalid={!!error}
            // Único campo de este paso: listo para escribir en cuanto aparece.
            autoFocus
            className={cn(
              "h-10 w-full rounded-md border bg-surface pl-7 pr-2 text-center text-[13px] font-semibold tabular-nums text-text-primary outline-none transition-all focus:ring-2",
              error
                ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                : "border-border focus:border-primary focus:ring-primary/25"
            )}
          />
        </span>
      </div>

      {error ? (
        <span className="text-[12px] text-destructive">{error}</span>
      ) : (
        <span className="text-[12px] leading-relaxed text-muted-foreground">
          Los pesos de todos los objetivos deben sumar {budget} %.{" "}
          {remaining === 0 ? (
            <span className="font-semibold text-status-positive">Ya está repartido.</span>
          ) : remaining > 0 ? (
            <>
              Aún quedan <span className="font-semibold text-text-primary">{remaining} %</span> por
              repartir.
            </>
          ) : (
            <span className="font-semibold text-destructive">
              Te pasaste {Math.abs(remaining)} %.
            </span>
          )}
        </span>
      )}
    </div>
  );
}
