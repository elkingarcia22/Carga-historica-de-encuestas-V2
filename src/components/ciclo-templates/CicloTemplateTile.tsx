import * as React from "react";
import { CalendarRange, ChevronRight, Layers, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEUTRAL_ACCENT } from "@/lib/tone";
import type { CicloTemplateSize, CicloTemplateTone } from "./cicloTemplateCatalog";

/**
 * The ciclo template "tile" the whole app uses: a list of objectives in
 * miniature with the template's badge pinned to its corner, then the name and
 * what it holds. The home shelf shows the compact row; the picker's gallery
 * shows the taller card with the sheet sitting on a tinted stage and what the
 * template is for under it. Same object in both places, so a template you
 * spotted on the home is the one you recognize inside the drawer.
 */

/** Tones whose tint comes from a Tailwind opacity class — the three token
 *  colors are declared as `hsl(var(...) / <alpha-value>)`, so a `/10`-style
 *  modifier actually works on them. */
type ClassTone = "positive" | "brand" | "warning";

/** Tones whose tint is computed with `color-mix()` in a `style` prop instead
 *  of a Tailwind opacity class. */
type StyleTone = "ai" | "neutral";

function isStyleTone(tone: CicloTemplateTone): tone is StyleTone {
  return tone === "ai" || tone === "neutral";
}

/** Flat badge treatment per tone — every tile reads as the same object. */
const TONE_BADGE_CLASSES: Readonly<Record<ClassTone, string>> = {
  positive: "bg-status-positive/10 text-status-positive",
  brand: "bg-primary/10 text-primary",
  warning: "bg-status-warning/10 text-status-warning",
};

/** The one colored line on the thumbnail — the template's "title" — in the
 *  same tone as its badge, so sheet and badge read as one object. */
const TONE_LINE_CLASSES: Readonly<Record<ClassTone, string>> = {
  positive: "bg-status-positive/70",
  brand: "bg-primary/70",
  warning: "bg-status-warning/70",
};

/** The stage a sheet sits on in the gallery: the same hue as the badge,
 *  washed down to a faint tint, so a shelf reads by color before by name. */
const TONE_STAGE_CLASSES: Readonly<Record<ClassTone, string>> = {
  positive: "bg-status-positive/[0.07]",
  brand: "bg-primary/[0.07]",
  warning: "bg-status-warning/[0.09]",
};

interface ToneMix {
  badge: React.CSSProperties;
  line: React.CSSProperties;
  stage: React.CSSProperties;
}

function toneMix(color: string, badgeAlpha: number, lineAlpha: number, stageAlpha: number): ToneMix {
  return {
    badge: {
      color,
      backgroundColor: `color-mix(in srgb, ${color} ${badgeAlpha}%, transparent)`,
    },
    line: { backgroundColor: `color-mix(in srgb, ${color} ${lineAlpha}%, transparent)` },
    stage: { backgroundColor: `color-mix(in srgb, ${color} ${stageAlpha}%, transparent)` },
  };
}

const STYLE_TONE_MIX: Readonly<Record<StyleTone, ToneMix>> = {
  ai: toneMix("var(--color-ai-gradient-start)", 14, 70, 7),
  neutral: toneMix(NEUTRAL_ACCENT, 14, 65, 10),
};

type ThumbSize = "sm" | "md" | "lg";

const THUMB_SIZE_CLASSES: Readonly<Record<ThumbSize, string>> = {
  sm: "h-12 w-10",
  md: "h-14 w-[46px]",
  lg: "h-[68px] w-[56px]",
};

export interface ObjectiveSheetThumbProps {
  icon: LucideIcon;
  tone: CicloTemplateTone;
  /** A "more…" tile: dotted outline with the icon alone, no badge. */
  dashed?: boolean;
  size?: ThumbSize;
  className?: string;
}

/**
 * A ciclo's objective list in miniature: a colored title line and three rows,
 * each a name plus the weight bar that objective carries — the shape of the
 * builder's own objective cards, shrunk. Tilts a touch when its parent
 * `.group` is hovered, the way a card lifts off a stack.
 */
export function ObjectiveSheetThumb({
  icon: Icon,
  tone,
  dashed = false,
  size = "sm",
  className,
}: ObjectiveSheetThumbProps) {
  // Each ternary calls the type guard directly (rather than branching on a
  // `mixed` variable computed once) so TypeScript narrows `tone` to
  // `ClassTone` right where it indexes these two maps.
  const mixed = isStyleTone(tone) ? STYLE_TONE_MIX[tone] : undefined;
  const badgeClassName = isStyleTone(tone) ? undefined : TONE_BADGE_CLASSES[tone];
  const lineClassName = isStyleTone(tone) ? undefined : TONE_LINE_CLASSES[tone];
  const isLarge = size === "lg";
  // Descending weights, so the miniature reads as a weighted list rather than
  // identical rows. The large sheet fits a fourth, which is what keeps it
  // from looking like the small one blown up.
  const weights = isLarge ? [1, 0.78, 0.55, 0.35] : [1, 0.72, 0.45];

  return (
    <span className={cn("relative z-[1] mb-1 mr-1 block shrink-0", className)}>
      <span
        className={cn(
          "flex flex-col gap-[3px] rounded-[7px] border px-1.5 pt-2 shadow-sm transition-transform duration-300 ease-out",
          THUMB_SIZE_CLASSES[size],
          isLarge && "gap-[4px] rounded-[9px] px-2 pt-2.5",
          "group-hover:-translate-y-0.5 group-hover:-rotate-2",
          dashed
            ? "items-center justify-center border-dashed border-border bg-surface pt-0"
            : "border-border/70 bg-surface"
        )}
      >
        {dashed ? (
          <Icon className="h-4 w-4 text-text-muted" strokeWidth={2} />
        ) : (
          <>
            <span
              className={cn("rounded-full", isLarge ? "h-[4px] w-6" : "h-[3px] w-4", lineClassName)}
              style={mixed?.line}
            />
            {weights.map((weight, index) => (
              <span key={index} className="mt-[1px] flex items-center gap-[2px]">
                <span className="h-[2px] flex-1 rounded-full bg-border" />
                <span
                  className={cn("rounded-full", isLarge ? "h-[3px]" : "h-[3px]", lineClassName)}
                  style={{ width: `${weight * (isLarge ? 12 : 8)}px`, ...mixed?.line }}
                />
              </span>
            ))}
          </>
        )}
      </span>
      {!dashed && (
        <span
          className={cn(
            "absolute -bottom-1.5 -right-2 flex items-center justify-center rounded-full ring-2 ring-surface transition-transform duration-300 group-hover:scale-110",
            isLarge ? "h-[26px] w-[26px]" : "h-[22px] w-[22px]",
            badgeClassName
          )}
          style={mixed?.badge}
        >
          <Icon className={isLarge ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.25} />
        </span>
      )}
    </span>
  );
}

export interface ToneStageProps {
  tone: CicloTemplateTone;
  children: React.ReactNode;
  className?: string;
}

/** The tinted panel a sheet thumbnail sits on inside a gallery card. */
export function ToneStage({ tone, children, className }: ToneStageProps) {
  const mixed = isStyleTone(tone) ? STYLE_TONE_MIX[tone] : undefined;
  return (
    <span
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset ring-border/40",
        !isStyleTone(tone) && TONE_STAGE_CLASSES[tone],
        className
      )}
      style={mixed?.stage}
    >
      {/* A faint light from the top-left, so the stage has a little depth
          instead of reading as a flat swatch. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,hsl(var(--card)/0.55),transparent_60%)]"
      />
      {children}
    </span>
  );
}

/** "3 objetivos · Trimestre" with a small icon before each figure. */
export function CicloTemplateSizeMeta({
  size,
  className,
}: {
  size: CicloTemplateSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-text-muted",
        className
      )}
    >
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Layers className="h-3 w-3" strokeWidth={2} />
        {size.objectives}
      </span>
      <span className="inline-flex items-center gap-1">
        <CalendarRange className="h-3 w-3" strokeWidth={2} />
        {size.periodLabel}
      </span>
    </span>
  );
}

export interface CicloTemplateTileProps {
  icon: LucideIcon;
  tone: CicloTemplateTone;
  label: string;
  /** The one-line size summary under the name (compact variant). */
  meta: string;
  /** Native tooltip — the full name plus whatever the tile had to truncate. */
  title: string;
  onClick: () => void;
  /**
   * `compact`: one row, thumb + name + meta (the home shelf).
   * `card`: taller — the sheet on a tinted stage, then the name, what it is
   * for and its size, with a chevron that slides in on hover. A gallery entry
   * you open, not a shortcut you press.
   * `list`: one full-width row — thumb, name, what it is for on one truncated
   * line, then its size — for browsing many templates at a glance instead of
   * scanning a grid.
   */
  variant?: "compact" | "card" | "list";
  /** What the template is for — shown by the `card` variant (two lines) and
   *  the `list` variant (one, truncated). */
  description?: string;
  /** Objective count and suggested period, shown by `card` and `list`. */
  size?: CicloTemplateSize;
  /** A "more…" tile: dotted outline, no badge. */
  dashed?: boolean;
  className?: string;
}

export function CicloTemplateTile({
  icon,
  tone,
  label,
  meta,
  title,
  onClick,
  variant = "compact",
  description,
  size,
  dashed = false,
  className,
}: CicloTemplateTileProps) {
  const isCard = variant === "card";
  const isList = variant === "list";
  const mixed = isStyleTone(tone) ? STYLE_TONE_MIX[tone] : undefined;

  // Both non-card shapes tint their whole background; `card`'s own thumbnail
  // stage carries the tint instead. The light overlay that sits on top of
  // that tint (below) is what keeps it a wash rather than a flat block of
  // color — it just needs to reach much further across a `list` row than
  // across a small square `compact` tile, which is why the two variants use
  // different gradients there instead of sharing one.
  const tintsWholeTile = !isCard;
  const tintClassName =
    !dashed && tintsWholeTile && !isStyleTone(tone) ? TONE_STAGE_CLASSES[tone] : undefined;
  const tintStyle = !dashed && tintsWholeTile ? mixed?.stage : undefined;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={tintStyle}
      className={cn(
        "group relative flex w-full overflow-hidden rounded-2xl border text-left",
        // Same wash + 1px lift as the builder's option cards, so these tiles
        // hover like every other card in the app.
        "magic-card-sweep magic-card-lift",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isCard ? "flex-col gap-3 p-3 pb-3.5" : "items-center gap-3 py-2.5 pl-3 pr-3",
        isList && "sm:gap-4",
        dashed
          ? "border-dashed border-border bg-surface-muted/50 hover:border-primary/40"
          : cn("border-border/60", tintClassName ?? "bg-surface"),
        className
      )}
    >
      {tintsWholeTile && !dashed && (
        // The light that keeps the tint a wash instead of a flat block of
        // color. A corner radial reaches every edge of a small compact tile;
        // stretched across a full-width row it faded out a third of the way
        // in, so `list` gets a left-to-right wash that keeps going.
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            isList
              ? "bg-[linear-gradient(to_right,hsl(var(--card)/0.15)_0%,hsl(var(--card)/0.94)_42%)]"
              : "bg-[radial-gradient(120%_140%_at_8%_0%,hsl(var(--card)/0.55),transparent_60%)]"
          )}
        />
      )}
      {isCard ? (
        <>
          <ToneStage tone={tone} className="z-[1] h-[92px] w-full">
            <ObjectiveSheetThumb
              icon={icon}
              tone={tone}
              dashed={dashed}
              size="lg"
              className="mb-0 mr-0"
            />
          </ToneStage>
          <span className="relative z-[1] flex min-w-0 flex-col gap-1 px-1">
            <span className="flex items-start gap-2">
              <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-text-primary">
                {label}
              </span>
              <ChevronRight
                aria-hidden
                className="mt-px h-4 w-4 shrink-0 -translate-x-1 text-text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100"
                strokeWidth={2}
              />
            </span>
            {description && (
              <span className="line-clamp-2 text-[12px] leading-relaxed text-text-secondary">
                {description}
              </span>
            )}
            {size && <CicloTemplateSizeMeta size={size} className="mt-1" />}
          </span>
        </>
      ) : isList ? (
        <>
          <ObjectiveSheetThumb icon={icon} tone={tone} dashed={dashed} />
          {/* One truncated line: the two texts have to shrink together, so
              `truncate` sits on this wrapper rather than on each span. */}
          <span className="relative z-[1] min-w-0 flex-1 truncate text-[13px] leading-tight">
            <span className="font-semibold text-text-primary">{label}</span>
            {description && <span className="text-text-secondary"> — {description}</span>}
          </span>
          {size && (
            <span className="relative z-[1] hidden shrink-0 sm:block">
              <CicloTemplateSizeMeta size={size} />
            </span>
          )}
          <ChevronRight
            aria-hidden
            className="relative z-[1] h-4 w-4 shrink-0 -translate-x-1 text-text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100"
            strokeWidth={2}
          />
        </>
      ) : (
        <>
          <ObjectiveSheetThumb icon={icon} tone={tone} dashed={dashed} />
          <span className="relative z-[1] flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-semibold leading-tight text-text-primary">
              {label}
            </span>
            <span className="truncate text-[11px] font-medium leading-tight text-text-muted">
              {meta}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
