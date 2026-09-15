import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip, type Tone } from "@/lib/tone";

interface SetupBlockProps {
  id?: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  /** Para qué sirve el bloque, en una línea. Se ve mientras está abierto. */
  hint: string;
  /** La decisión tomada, en una línea. Reemplaza al hint al plegarse. */
  summary: string | null;
  isAnswered: boolean;
  isOpen: boolean;
  onToggle: () => void;
  hasError?: boolean;
  children: React.ReactNode;
}

/**
 * Un bloque de la parametrización del ciclo: una tarjeta que se pliega.
 *
 * Misma anatomía que `DrawerSection` —chip del icono en su tono, título en
 * frase, línea de ayuda— con dos cosas más: la cabecera entera es el botón
 * que abre y cierra, y al plegarse dice lo que se decidió en vez de para qué
 * servía. Así cuatro decisiones caben en una pantalla sin volverse un paso a
 * paso infinito: lo contestado se resume, lo pendiente se despliega.
 *
 * La entrada es la de `GuidedStep`: sube y se enfoca. Un bloque que aparece
 * de golpe se lee como un salto; uno que llega enfocándose se lee como la
 * conversación avanzando.
 */
export function SetupBlock({
  id,
  icon: Icon,
  tone,
  title,
  hint,
  summary,
  isAnswered,
  isOpen,
  onToggle,
  hasError = false,
  children,
}: SetupBlockProps) {
  const prefersReducedMotion = useReducedMotion();
  const hidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 18, filter: "blur(10px)" };
  const shown = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" };

  const showSummary = !isOpen && summary !== null;

  return (
    <motion.section
      id={id}
      data-setup-block
      initial={hidden}
      animate={shown}
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.6,
        ease: [0.16, 1, 0.3, 1],
        filter: { duration: prefersReducedMotion ? 0.2 : 0.42, ease: "easeOut" },
      }}
      className={cn(
        "scroll-mt-4 rounded-2xl border bg-surface shadow-card transition-colors",
        hasError ? "border-destructive/50" : "border-border/60"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span
          aria-hidden
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40"
          style={toneChip(tone)}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
          {isAnswered && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-status-positive text-white ring-2 ring-surface">
              <Check className="size-2.5" strokeWidth={3.2} />
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <span className="text-[14px] font-semibold leading-tight tracking-tight text-text-primary">
            {title}
          </span>
          {showSummary ? (
            <span className="truncate text-[12.5px] font-medium leading-relaxed text-text-primary/80">
              {summary}
            </span>
          ) : (
            <span className="text-[12px] leading-relaxed text-text-secondary">{hint}</span>
          )}
        </span>

        <ChevronDown
          aria-hidden
          className={cn(
            "mt-2 size-4 shrink-0 text-text-muted transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          strokeWidth={2.3}
        />
      </button>

      {isOpen && (
        <div className="cascade-enter border-t border-border/50 px-5 pb-5 pt-4">{children}</div>
      )}
    </motion.section>
  );
}
