import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CICLO_SETUP_FLOW_LABELS,
  useCicloSetupFlow,
  type CicloSetupFlow,
} from "./cicloSetupFlow";

const FLOWS: readonly CicloSetupFlow[] = ["guided", "parametrizado"];

/**
 * El interruptor entre las dos versiones del primer paso.
 *
 * Vive junto al título del paso mientras dure la comparación: cambia el
 * editor que se ve y, con él, el recorrido entero del constructor. Chips
 * sueltos y no un control segmentado, por la misma razón que las reglas del
 * modelo: aquí se elige un valor, no se cambia de vista.
 */
export function CicloSetupFlowToggle() {
  const [flow, setFlow] = useCicloSetupFlow();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] font-medium text-text-muted">Paso 1</span>
      <div role="radiogroup" aria-label="Versión del primer paso" className="flex gap-1">
        {FLOWS.map((option) => {
          const isSelected = option === flow;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setFlow(option)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97]",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-text-secondary hover:border-primary/30 hover:text-text-primary"
              )}
            >
              {isSelected && <Check className="size-3" strokeWidth={2.8} />}
              {CICLO_SETUP_FLOW_LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
