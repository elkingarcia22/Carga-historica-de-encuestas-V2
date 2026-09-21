import * as React from "react";
import {
  HeartHandshake,
  Minus,
  Plus,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip, toneText } from "@/lib/tone";
import { MagicCard } from "@/components/ui/magic-card";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { AMBITION_TONE, FOCUS_TONE } from "./measureVisual";
import {
  AMBITION_META,
  AMBITION_ORDER,
  FOCUS_META,
  FOCUS_ORDER,
  focusLabel,
  isPresetFocus,
  type AmbitionLevel,
  type BriefFocus,
  type ObjectiveFocus,
} from "./aiObjectiveBrief";

/**
 * Los controles del brief de IA.
 *
 * Viven aparte de la tarjeta que los ordena porque cada uno responde una
 * pregunta distinta y ninguno sabe en qué paso va: eso lo decide el
 * compositor, que es quien va revelándolos de a uno.
 */

const FOCUS_ICONS: Record<FocusIconName, LucideIcon> = {
  "trending-up": TrendingUp,
  wallet: Wallet,
  "heart-handshake": HeartHandshake,
  users: Users,
  "settings-2": Settings2,
  rocket: Rocket,
};

type FocusIconName = (typeof FOCUS_META)[ObjectiveFocus]["icon"];

const AMBITION_ICONS: Readonly<Record<AmbitionLevel, LucideIcon>> = {
  conservador: Shield,
  retador: Target,
  agresivo: Zap,
};

/**
 * Cuántos objetivos generar.
 *
 * Es el control segmentado del sistema y no una fila de botones propia: el
 * rango es corto, la opción elegida tiene que leerse de un vistazo, y ese
 * estado seleccionado ya está resuelto una vez para toda la plataforma.
 */
export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  // If value is null, treat it as 0.
  const numericValue = value ?? 0;

  const handleDecrease = () => {
    if (numericValue > 0) {
      onChange(numericValue - 1);
    }
  };

  const handleIncrease = () => {
    if (max === undefined || numericValue < max) {
      onChange(numericValue + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      onChange(0);
      return;
    }
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      const boundedVal = max !== undefined ? Math.min(Math.max(0, val), max) : Math.max(0, val);
      onChange(boundedVal);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDecrease}
        disabled={numericValue <= 0}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      
      <input
        type="number"
        min={0}
        max={max}
        value={numericValue === 0 && value === null ? "" : numericValue}
        onChange={handleInputChange}
        className="w-14 text-center h-10 rounded-xl border-transparent bg-transparent px-1 text-[18px] font-semibold text-text-primary tabular-nums outline-none transition-colors focus:border-border focus:bg-surface focus:ring-2 focus:ring-primary/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      
      <button
        type="button"
        onClick={handleIncrease}
        disabled={max !== undefined && numericValue >= max}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * Los frentes del ciclo, con la puerta abierta a los que no están en la lista.
 *
 * Los seis de arriba cubren la mayoría de los ciclos, pero no todos: una
 * empresa que se juega el año en "sostenibilidad" o en "expansión a México"
 * no debería tener que traducirlo a una de nuestras seis palabras. Lo que
 * escriba entra como un frente más y el generador tira de él igual.
 */
export function FocusChips({
  value,
  onChange,
}: {
  value: readonly BriefFocus[];
  onChange: (value: readonly BriefFocus[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const custom = value.filter((focus) => !isPresetFocus(focus));

  const toggle = (focus: BriefFocus) =>
    onChange(value.includes(focus) ? value.filter((item) => item !== focus) : [...value, focus]);

  const addCustom = () => {
    const trimmed = draft.trim().replace(/\s+/g, " ");
    if (trimmed === "") return;
    // Sin duplicados y sin distinguir mayúsculas: "Clientes" escrito a mano
    // es el mismo frente que el chip "Clientes" de la lista.
    const exists = value.some(
      (focus) => focusLabel(focus).toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) onChange([...value, trimmed]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_ORDER.map((focus) => {
          const meta = FOCUS_META[focus];
          const Icon = FOCUS_ICONS[meta.icon];
          const isSelected = value.includes(focus);
          const tone = FOCUS_TONE[focus] ?? "brand";

          return (
            <button
              key={focus}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(focus)}
              title={meta.tagline}
              // Same recipe the survey builder's own theme chips use: the
              // chip stays neutral and only the icon carries the front's
              // accent, so a row of six reads as one calm set of options
              // rather than a wall of color — then picking one fills the
              // whole chip in that same hue.
              style={isSelected ? { ...toneChip(tone), borderColor: "currentColor" } : undefined}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97]",
                isSelected
                  ? "shadow-sm"
                  : "border-border bg-surface text-text-secondary hover:-translate-y-0.5 hover:shadow-card"
              )}
            >
              <Icon
                className="size-3.5 shrink-0"
                strokeWidth={isSelected ? 2.5 : 2.2}
                style={isSelected ? undefined : toneText(tone)}
              />
              {meta.label}
            </button>
          );
        })}

        {custom.map((focus) => (
          <span
            key={focus}
            className="flex h-9 items-center gap-1.5 rounded-full border border-primary bg-primary/5 pl-3.5 pr-1.5 text-[12.5px] font-semibold text-primary"
          >
            {focus}
            <button
              type="button"
              onClick={() => toggle(focus)}
              aria-label={`Quitar ${focus}`}
              className="flex size-5 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <X className="size-3" strokeWidth={2.6} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="¿Otro frente? Escríbelo, por ejemplo: sostenibilidad"
          aria-label="Añadir otro frente"
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-[12.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={draft.trim() === ""}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-secondary"
        >
          <Plus className="size-3.5" strokeWidth={2.6} />
          Añadir
        </button>
      </div>
    </div>
  );
}

/**
 * Qué tan exigentes deben ser las metas.
 *
 * Va con las mismas tarjetas que "cómo se mide el resultado" porque es una
 * decisión del mismo peso y del mismo tipo: tres opciones excluyentes que hay
 * que poder comparar leyendo, no adivinando. "Agresivo" no significa nada por
 * sí solo; lo que el autor está decidiendo es si el ciclo se cumple o se
 * pelea, y eso hay que decirlo con palabras.
 */
export function AmbitionPicker({
  value,
  onChange,
}: {
  value: AmbitionLevel | null;
  onChange: (value: AmbitionLevel) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {AMBITION_ORDER.map((level) => {
        const meta = AMBITION_META[level];
        const Icon = AMBITION_ICONS[level];
        const isSelected = value === level;

        const tone = AMBITION_TONE[level] ?? "brand";

        return (
          <MagicCard
            key={level}
            role="radio"
            aria-checked={isSelected}
            isSelected={isSelected}
            tone={tone}
            onClick={() => onChange(level)}
            className="min-h-0 p-3"
            contentClassName="relative w-full items-start gap-2.5"
          >
            <span
              aria-hidden
              className={cn(
                "absolute right-0 top-0 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                !isSelected && "border-border/60"
              )}
              style={isSelected ? { borderColor: "currentColor" } : undefined}
            >
              {isSelected && <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105"
              style={toneChip(tone)}
            >
              <Icon className="size-4" strokeWidth={2.2} />
            </span>

            <span className="flex min-w-0 flex-col gap-1.5 pr-3">
              <span
                className="text-[13px] font-semibold leading-tight"
                style={isSelected ? toneText(tone) : { color: "var(--color-text-primary)" }}
              >
                {meta.label}
              </span>
              <span className="text-[11.5px] font-medium leading-snug text-text-primary">
                {meta.tagline}
              </span>
              <span className="text-[11.5px] leading-snug text-text-secondary">
                {meta.headline}
              </span>
            </span>
          </MagicCard>
        );
      })}
    </div>
  );
}

/** El campo de texto libre del brief. Borde normal: el énfasis lo pone la
 * pregunta de arriba, no el marco. */
export function AiPromptField({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 3,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmit?.();
        }
      }}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
    />
  );
}

/** Frases de arranque de un clic para el campo de contexto. */
export function StarterChips({
  starters,
  onPick,
  show = true,
}: {
  starters: readonly string[];
  onPick: (starter: string) => void;
  show?: boolean;
}) {
  if (!show) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {starters.map((starter) => (
        <button
          key={starter}
          type="button"
          onClick={() => onPick(starter)}
          className="rounded-xl border border-border/70 bg-surface px-3 py-2 text-left text-[12px] font-medium leading-snug text-text-secondary transition-all hover:-translate-y-px hover:border-primary/40 hover:text-text-primary hover:shadow-card"
        >
          {starter}
        </button>
      ))}
    </div>
  );
}

/**
 * El botón secundario que abre el generador.
 *
 * Va con borde degradado y no con relleno: la acción principal de estos
 * pasos sigue siendo escribir el objetivo a mano, y un botón sólido de IA
 * al lado de uno punteado invertiría esa jerarquía sin que nadie lo haya
 * decidido.
 *
 * Trabajando, el botón es la única señal de que algo está pasando —no hay
 * un segundo loader debajo del campo repitiendo el mismo mensaje—: el
 * degradado que normalmente sólo se ve en el hover queda encendido fijo,
 * un brillo de vidrio lo cruza en bucle, y una luz recorre el borde.
 */
export const AiTriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { label: string; animated?: boolean; loading?: boolean }
>(function AiTriggerButton({ label, className, animated = true, loading = false, style, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-busy={loading}
      className={cn(
        "group relative flex h-11 items-center gap-2 self-start overflow-hidden rounded-xl px-4 text-[13px] font-semibold text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        // El borde propio se apaga mientras carga: lo que se ve entonces es
        // sólo el que dibuja `MovingBorderBeam` en movimiento — animar un
        // borde encima de otro se veía como dos bordes distintos.
        loading ? "border border-transparent bg-surface" : "border-ai-gradient-surface",
        animated && "transition-all hover:shadow-card active:scale-[0.98]",
        loading && "shimmer-mirror",
        className
      )}
      // `shadow-ai-premium` (clase) choca de nombre con una utilidad que
      // Tailwind genera sola a partir del theme, y esa gana la cascada sin
      // avisar — el brillo nunca se veía. En línea no hay con qué chocar.
      style={loading ? { ...style, boxShadow: "var(--shadow-ai-premium)" } : style}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0",
          loading ? "opacity-100" : "opacity-0",
          animated && !loading && "transition-opacity duration-300 group-hover:opacity-100"
        )}
        style={{
          background: loading
            ? "linear-gradient(135deg, rgba(46,198,255,0.32), rgba(124,58,237,0.28) 55%, rgba(244,63,94,0.30))"
            : "linear-gradient(135deg, rgba(46,198,255,0.10), rgba(124,58,237,0.08) 55%, rgba(244,63,94,0.09))",
        }}
      />
      {loading && (
        <MovingBorderBeam duration={2200} borderWidth={1.5} rx={12} ry={12} mode="line" />
      )}
      <Sparkles
        className={cn(
          "relative size-4 shrink-0 text-ai-gradient-start",
          !loading && animated && "transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
        )}
        strokeWidth={2.3}
      />
      <span className="relative">{label}</span>
    </button>
  );
});
