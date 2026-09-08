import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CICLO_STEP_HINTS,
  CICLO_STEP_LABELS,
  cicloStepNumber,
  getCicloStepState,
  getCicloStepperOrder,
  isCicloStepComplete,
  type CicloStepId,
  type CicloStepState,
  type CicloStepperStatusInput,
} from "./cicloStepper";

interface CicloStepsPanelProps {
  activeStep: CicloStepId;
  stepInput: CicloStepperStatusInput;
  /** Steps flagged red after a failed "Finalizar". */
  errorSteps?: ReadonlySet<CicloStepId>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectStep: (step: CicloStepId) => void;
}

/**
 * The circle carrying a step's state: its number while reachable, a check once
 * done, and the same muted treatment as the survey builder while it is locked.
 */
function StepMarker({
  step,
  state,
  stepOrder,
  hasError,
}: {
  step: CicloStepId;
  state: CicloStepState;
  stepOrder: readonly CicloStepId[];
  hasError?: boolean;
}) {
  return (
    <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface">
      {state === "complete" && !hasError && (
        <motion.div
          className="absolute inset-0 rounded-full bg-status-positive/40"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      )}

      <span
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors duration-500",
          hasError && "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
          !hasError && state === "active" && "bg-primary text-primary-foreground",
          !hasError && state === "complete" && "bg-status-positive/15 text-status-positive",
          !hasError && state === "available" && "bg-border/50 text-text-secondary",
          !hasError && state === "locked" && "bg-border/40 text-muted-foreground/60"
        )}
      >
        <AnimatePresence initial={false}>
          {state === "complete" && !hasError ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M20 6L9 17L4 12"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                />
              </svg>
            </motion.div>
          ) : (
            <motion.span
              key="number"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {cicloStepNumber(step, stepOrder)}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

/**
 * Left menu as a stepper.
 *
 * Same contract as the survey builder's panel — one path, walked in order —
 * minus the section tree, because a ciclo has no tree to unfold. The hint under
 * each label survives that removal on purpose: with only four steps there is
 * room to say what each one is for, and "Objetivos de la empresa" versus
 * "Definir objetivos" is exactly the pair that needs it.
 */
export function CicloStepsPanel({
  activeStep,
  stepInput,
  errorSteps,
  isCollapsed,
  onToggleCollapsed,
  onSelectStep,
}: CicloStepsPanelProps) {
  const stateOf = (step: CicloStepId) => getCicloStepState(step, stepInput, activeStep);
  const hasError = (step: CicloStepId) =>
    errorSteps?.has(step) === true && !isCicloStepComplete(step, stepInput);
  const stepOrder = getCicloStepperOrder(stepInput.draft);

  if (isCollapsed) {
    return (
      <aside className="flex max-h-full w-[52px] shrink-0 flex-col items-center gap-2 self-start overflow-hidden rounded-2xl border border-border/60 bg-surface p-2 shadow-card">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expandir menú"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground/70 transition-all hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Expandir menú</TooltipContent>
        </Tooltip>

        {/* Los pasos reparten la altura que queda en vez de desbordarla: cada
            uno pide 40px pero puede encogerse hasta los 28px del círculo, así
            que en una ventana baja el panel se comprime y sigue mostrando el
            camino completo. Perder de vista un paso es peor que tenerlos algo
            más juntos. */}
        <div className="flex min-h-0 w-full flex-auto flex-col">
          {stepOrder.map((step, index) => {
            const state = stateOf(step);
            const isLocked = state === "locked";

            return (
              <div
                key={step}
                className="relative flex shrink basis-10 grow-0 items-center justify-center"
              >
                {index < stepOrder.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-[calc(50%+14px)] h-[calc(100%-28px)] w-px -translate-x-1/2 bg-border"
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={isLocked ? undefined : () => onSelectStep(step)}
                      disabled={isLocked}
                      aria-label={CICLO_STEP_LABELS[step]}
                      aria-current={state === "active" ? "step" : undefined}
                      className="rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed enabled:active:scale-95"
                    >
                      <StepMarker step={step} state={state} stepOrder={stepOrder} hasError={hasError(step)} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    {CICLO_STEP_LABELS[step]}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex max-h-full w-[288px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border border-border/60 bg-surface p-2 shadow-card">
      <div className="mb-2 flex shrink-0 items-center justify-between pl-3 pr-1 pt-1.5">
        <h2 className="text-[13px] font-semibold text-text-secondary">Pasos de creación</h2>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Contraer menú"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/70 transition-all hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95"
        >
          <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Misma regla que en el panel contraído: las filas piden 48px y ceden
          hasta la altura del círculo antes que dejar un paso fuera de
          pantalla, así que la lista nunca necesita scroll propio. */}
      <ul className="flex min-h-0 flex-auto flex-col">
        {stepOrder.map((step, index) => {
          const state = stateOf(step);
          const isLocked = state === "locked";
          const stepHasError = hasError(step);

          return (
            <li key={step} className="relative flex shrink basis-12 grow-0 items-stretch">
              {index < stepOrder.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[22px] top-[calc(50%+14px)] h-[calc(100%-28px)] w-px bg-border"
                />
              )}

              <button
                type="button"
                onClick={isLocked ? undefined : () => onSelectStep(step)}
                disabled={isLocked}
                aria-current={state === "active" ? "step" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  !isLocked && state !== "active" && "hover:bg-surface-muted",
                  isLocked && "cursor-not-allowed"
                )}
              >
                {state === "active" && (
                  <motion.div
                    layoutId="active-ciclo-step-bg"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <StepMarker step={step} state={state} stepOrder={stepOrder} hasError={stepHasError} />

                <span className="relative z-10 flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-[13px] tracking-tight transition-colors duration-300",
                      state === "active" && "font-semibold text-primary",
                      state === "complete" && "font-medium text-text-primary",
                      stepHasError && "font-medium text-destructive",
                      state === "available" && "font-medium text-text-primary",
                      state === "locked" && "font-medium text-muted-foreground/70"
                    )}
                  >
                    {CICLO_STEP_LABELS[step]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
