
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { toneChip, toneText, toneSolid, type Tone } from "@/lib/tone";
import type { UntonedOptionVisual } from "./measureVisual";

interface ObjectiveOptionCardProps extends UntonedOptionVisual {
  /** Left unset, the card falls back to a plain gray/brand look instead of
   * an accent of its own — see `UntonedOptionVisual`. */
  tone?: Tone;
  label: string;
  /** One line under the label: when to pick this, in the author's terms. */
  tagline: string;
  isSelected: boolean;
  onClick: () => void;
  /** Paints the outline red while the step is flagging a missing choice. */
  hasError?: boolean;
  /** `center` stacks icon and label centred, for a dense row of short
   *  options (the periods); `start` keeps them left-aligned with room for a
   *  longer tagline (measure and direction). Ignored by `size="compact"`,
   *  which is always a row. */
  align?: "start" | "center";
  /**
   * `cozy` is the original card: icon on top, label and tagline stacked
   * below, ~124 px tall. `compact` is the same identity — icon chip, colored
   * selection, hover sweep — laid out as a shorter row (icon beside the
   * text) for pickers embedded in a denser card that still want to look and
   * feel like a real choice instead of a plain toggle.
   */
  size?: "cozy" | "compact";
  className?: string;
}

/**
 * One option of a set, as a card in its own accent.
 *
 * Every "pick one of these" in the ciclo builder — how the result is measured,
 * which way it has to move, how long the ciclo runs — is this card, so the
 * three read as one decision made three times instead of three designs. The
 * accent comes from the option itself (see `measureVisual.ts`): the chip
 * carries it always, the label takes it once picked, and `MagicCard`'s own
 * `tone` makes the hover wash and the selected outline land in that same hue
 * rather than in brand blue.
 */
export function ObjectiveOptionCard({
  icon: Icon,
  tone,
  label,
  tagline,
  isSelected,
  onClick,
  hasError,
  align = "start",
  size = "cozy",
  className,
}: ObjectiveOptionCardProps) {
  const centered = align === "center";
  const isCompact = size === "compact";

  return (
    <MagicCard
      role="radio"
      aria-checked={isSelected}
      isSelected={isSelected}
      tone={tone}
      onClick={onClick}
      className={cn(isCompact && "p-2.5", hasError && !isSelected && "border-destructive/50", className)}
      contentClassName={cn(
        "relative h-full w-full",
        isCompact
          ? "flex-row items-center gap-2.5 text-left"
          : cn(
              "flex-col gap-2",
              centered ? "items-center justify-center text-center" : "items-start justify-between gap-3"
            )
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
          isCompact ? "size-8" : "size-9",
          centered && !isCompact && "mt-0.5",
          !tone
            ? isSelected
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            : undefined
        )}
        style={tone ? toneChip(tone) : undefined}
      >
        <Icon className={isCompact ? "size-4" : "size-[18px]"} strokeWidth={2.2} />
      </span>

      <span
        className={cn(
          "flex flex-col",
          isCompact ? "min-w-0 flex-1 gap-0" : centered ? "gap-0.5" : "gap-1"
        )}
      >
        <span
          className={cn(
            "font-semibold leading-tight",
            isCompact ? "text-[12.5px]" : "text-[13px]",
            centered && "text-[12.5px]",
            isSelected && !tone && "text-primary"
          )}
          style={isSelected && tone ? toneText(tone) : undefined}
        >
          {label}
        </span>
        <span
          className={cn(
            "leading-snug text-text-secondary",
            isCompact ? "truncate text-[11px]" : centered ? "text-[11px] font-medium" : "text-[11.5px]"
          )}
        >
          {tagline}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          !isCompact && "absolute right-0 top-0",
          isCompact && "ml-auto",
          isSelected
            ? cn("border-transparent", !tone && "bg-primary text-primary-foreground")
            : "border-input bg-surface"
        )}
        style={isSelected && tone ? toneSolid(tone) : undefined}
      >
        {isSelected && <span className="size-2 rounded-full bg-current" />}
      </span>
    </MagicCard>
  );
}
