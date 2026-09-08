import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GuidedStepProps {
  /** 1-based position inside the objective card. */
  number: number;
  question: string;
  /** Why this step exists, in one line. Always present: a step that can't
   * explain itself is the field the author will guess at. */
  help: string;
  children: React.ReactNode;
  className?: string;
  /** Segundos de espera antes de aparecer. Sirve para encadenar la entrada
   * cuando varios pasos se montan a la vez —al volver al brief desde la
   * revisión, por ejemplo— para que caigan en cascada en vez de todos de
   * golpe. Cuando se revela uno solo, se queda en 0. */
  delay?: number;
}

/**
 * One question inside the objective card.
 *
 * The card is a form, but it is presented as a conversation — a numbered
 * question, the reason it is being asked, then the control. Steps mount as the
 * previous one is answered, so the author is never looking at a field whose
 * meaning depends on a decision they haven't made yet.
 *
 * La entrada es lenta y desenfocada a propósito: un paso que aparece de golpe
 * se lee como un salto de la interfaz, mientras que uno que se va enfocando
 * mientras sube se lee como la conversación avanzando. El desenfoque es lo
 * que da esa sensación de "venía de más atrás" sin mover nada de sitio.
 */
export function GuidedStep({
  number,
  question,
  help,
  children,
  className,
  delay = 0,
}: GuidedStepProps) {
  // Quien pidió menos movimiento recibe el mismo contenido sin el viaje: la
  // aparición se resuelve en opacidad y nada más.
  const prefersReducedMotion = useReducedMotion();

  const hidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 18, filter: "blur(10px)" };
  const shown = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    <motion.section
      data-objective-step
      initial={hidden}
      animate={shown}
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1],
        // El desenfoque se despeja antes que el viaje: así el texto ya se
        // puede leer mientras el bloque termina de asentarse.
        filter: { duration: prefersReducedMotion ? 0.2 : 0.45, delay, ease: "easeOut" },
      }}
      // Margen para `scrollIntoView`: cuando la tarjeta lleva el foco a este
      // paso, deja aire arriba y abajo en vez de pegarlo al borde. El margen
      // superior es generoso porque la tarjeta clásica tiene un header fijo
      // que, si no, taparía el principio del paso recién abierto.
      className={cn("relative scroll-mb-16 scroll-mt-20 pl-9", className)}
    >
      {/* Connector runs behind the badge, so the questions read as one thread
          rather than as separate boxes stacked by accident. */}
      <span
        aria-hidden
        className="absolute left-[13px] top-7 h-[calc(100%-0.5rem)] w-px bg-border/70"
      />

      <span
        aria-hidden
        className="absolute left-0 top-0 flex size-[27px] items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary"
      >
        {number}
      </span>

      <header className="flex flex-col gap-0.5 pb-3">
        <h4 className="text-[13.5px] font-semibold leading-snug text-text-primary">{question}</h4>
        <p className="max-w-[75ch] text-[12px] leading-relaxed text-text-secondary">{help}</p>
      </header>

      {children}
    </motion.section>
  );
}
