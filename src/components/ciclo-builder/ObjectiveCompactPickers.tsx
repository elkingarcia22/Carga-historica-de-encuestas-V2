import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Info, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { DIRECTION_VISUAL, MEASURE_VISUAL } from "./measureVisual";
import {
  DIRECTION_META,
  MEASURE_META,
  MEASURE_ORDER,
  type MeasureType,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";

/**
 * Controles de la tarjeta compacta de objetivo.
 *
 * Son las mismas preguntas que en la tarjeta clásica —y las mismas reglas de
 * cálculo, importadas de los mismos sitios— con otra forma: chips en vez de
 * tarjetas de 124 px, un segmento en vez de dos tarjetas, y la ayuda de cada
 * paso detrás de un icono en lugar de una línea siempre visible. Los campos
 * de valores, piso/techo y el simulador se reutilizan de la tarjeta clásica.
 */

// ── Bloque ──────────────────────────────────────────────────────────────────

interface CompactStepProps {
  /** Sin pregunta el bloque es sólo un contenedor con el mismo ritmo vertical. */
  question?: string;
  /** La explicación del paso. Sigue existiendo, pero bajo demanda. */
  help?: string;
  /**
   * Posición del paso dentro de la tarjeta, 1-based. Sólo la pasa la versión
   * guiada: con número, el bloque se presenta como pregunta numerada y la
   * ayuda se lee siempre debajo —como en la tarjeta clásica— en vez de
   * esconderse tras el icono de información.
   */
  number?: number;
  /** Acción secundaria alineada a la derecha del título. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Para llevar el scroll al paso desde fuera cuando lo revela un control
   * que no vive en este mismo bloque (p. ej. el botón "Probar objetivo" del
   * header). Combínalo con `block: "start"` en el `scrollIntoView` de quien
   * llama, no `"nearest"`: con contenedores de alto animado de por medio,
   * `"nearest"` puede decidir que ya está lo bastante visible y no mover
   * el scroll real nada en absoluto. */
  sectionRef?: React.Ref<HTMLElement>;
}

const REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function CompactStep({
  question,
  help,
  number,
  aside,
  children,
  className,
  sectionRef,
}: CompactStepProps) {
  const prefersReducedMotion = useReducedMotion();
  const isNumbered = number !== undefined;

  return (
    <motion.section
      ref={sectionRef}
      data-objective-step
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.15 : 0.32, ease: REVEAL_EASE }}
      // Margen para `scrollIntoView`: deja aire bajo el header fijo de la
      // tarjeta y no pega el paso al borde inferior del scroll.
      className={cn("flex scroll-mb-6 scroll-mt-16 flex-col gap-2.5", className)}
    >
      {question && isNumbered && (
        <header className="flex items-start gap-2">
          <span
            aria-hidden
            className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary"
          >
            {number}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h4 className="text-[13px] font-semibold leading-[22px] text-text-primary">
              {question}
            </h4>
            {help && (
              <p className="max-w-[78ch] text-[12px] leading-relaxed text-text-secondary">{help}</p>
            )}
          </div>
          {aside && <div className="ml-auto flex items-center">{aside}</div>}
        </header>
      )}
      {question && !isNumbered && (
        <header className="flex min-h-6 items-center gap-1.5">
          <h4 className="text-[13px] font-semibold leading-none text-text-primary">{question}</h4>
          {help && <HelpHint label={question} text={help} />}
          {aside && <div className="ml-auto flex items-center">{aside}</div>}
        </header>
      )}
      {/* La versión guiada sangra el control bajo la pregunta para que el
          número mande sobre todo el bloque y la tarjeta se lea como una
          conversación; en móvil no, donde el ancho vale más que el hilo. */}
      <div className={cn("flex min-w-0 flex-col gap-2.5", isNumbered && "sm:pl-[30px]")}>
        {children}
      </div>
    </motion.section>
  );
}

export function HelpHint({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Ayuda: ${label}`}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Info className="size-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Medida ──────────────────────────────────────────────────────────────────

interface MeasureChipsProps {
  value: MeasureType | null;
  onChange: (measure: MeasureType) => void;
  hasError?: boolean;
}

/**
 * Las cuatro medidas, como la tarjeta clásica las presentaba —icono propio,
 * nombre y una línea de cuándo usarla— pero en una fila más baja en vez de
 * la tarjeta de 124 px. Con la tagline siempre visible en la propia tarjeta,
 * un tooltip encima sólo repetía "cuándo usarla" dos veces; se quitó.
 */
export function MeasureChips({ value, onChange, hasError }: MeasureChipsProps) {
  return (
    <div role="radiogroup" aria-label="Tipo de medida" className="grid grid-cols-2 gap-2 sm:grid-cols-4 h-full">
      {MEASURE_ORDER.map((measure) => {
        const info = MEASURE_META[measure];
        const visual = MEASURE_VISUAL[measure];
        const isSelected = value === measure;

        return (
          <ObjectiveOptionCard
            key={measure}
            {...visual}
            size="compact"
            label={info.label}
            tagline={info.tagline}
            isSelected={isSelected}
            onClick={() => onChange(measure)}
            hasError={hasError}
            className="min-h-[64px] h-full"
          />
        );
      })}
    </div>
  );
}

// ── Sentido ─────────────────────────────────────────────────────────────────

const DIRECTIONS: readonly ObjectiveDirection[] = ["increase", "decrease"];

interface DirectionSegmentProps {
  value: ObjectiveDirection | null;
  onChange: (direction: ObjectiveDirection) => void;
  hasError?: boolean;
}

/**
 * Igual que "Tipo de medida": la misma tarjeta clásica —icono, nombre y una
 * línea de qué significa elegirla— achatada a una fila con
 * `ObjectiveOptionCard size="compact"`, en vez del par de chips que sólo
 * llevaban un icono y una palabra. Sin tooltip: la tagline en la tarjeta ya
 * dice "Quieres que el número suba/baje", así que el ejemplo del tooltip no
 * aportaba nada que no estuviera ya a la vista.
 */
export function DirectionSegment({ value, onChange, hasError }: DirectionSegmentProps) {
  return (
    <div role="radiogroup" aria-label="Sentido del objetivo" className="grid grid-cols-2 gap-2 h-full">
      {DIRECTIONS.map((direction) => {
        const meta = DIRECTION_META[direction];
        const isSelected = value === direction;
        const visual = DIRECTION_VISUAL[direction];

        return (
          <ObjectiveOptionCard
            key={direction}
            {...visual}
            size="compact"
            label={meta.label}
            tagline={meta.headline}
            isSelected={isSelected}
            onClick={() => onChange(direction)}
            hasError={hasError && value === null}
            className="min-h-[64px] h-full"
          />
        );
      })}
    </div>
  );
}

// ── Se cumple / no se cumple ────────────────────────────────────────────────

export function BooleanOutcomeChips() {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 h-full w-full">
      <OutcomeChip tone="negative" label="No se cumple" score="0 %" />
      <ArrowRight className="size-3.5 shrink-0 text-text-secondary" strokeWidth={2.2} />
      <OutcomeChip tone="positive" label="Se cumple" score="100 %" />
    </div>
  );
}

export function BooleanOutcomeNote() {
  return (
    <p className="text-[12px] leading-relaxed text-text-secondary">
      Sin valor inicial ni meta: al cerrar el ciclo, quien haga el seguimiento marca una de las
      dos opciones y el avance queda en 0 % o en 100 %.
    </p>
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
    <div
      className={cn(
        "flex min-h-[64px] h-full w-full items-center gap-2.5 rounded-2xl border bg-surface p-2.5",
        isPositive ? "border-status-positive/25 bg-status-positive/5" : "border-border/60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          isPositive ? "bg-status-positive/15 text-status-positive" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" strokeWidth={2.2} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0">
        <span className="truncate text-[12.5px] font-semibold leading-tight text-text-primary">
          {label}
        </span>
        <span className="truncate text-[11px] leading-snug text-text-secondary">
          {score}
        </span>
      </span>
    </div>
  );
}

// ── Etiqueta de columna ─────────────────────────────────────────────────────

/**
 * El rótulo que encabeza cada columna del bloque de medida, con la misma voz
 * que los de "Valor inicial" y "Meta" para que ambas filas se lean como una
 * rejilla continua.
 */
export function FieldLabel({
  icon: Icon,
  children,
  required,
  help,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  required?: boolean;
  help?: string;
}) {
  return (
    <span className="flex min-h-5 items-center gap-1.5 text-[13px] font-semibold text-text-primary">
      <Icon className="size-3.5 shrink-0 text-text-secondary" strokeWidth={2} />
      {children}
      {required && <span className="text-destructive">•</span>}
      {help && <HelpHint label={String(children)} text={help} />}
    </span>
  );
}
