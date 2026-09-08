import * as React from "react";
import {
  Building2,
  Check,
  Layers,
  Link2,
  Link2Off,
  Target,
  UserRound,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AlignmentNode, AlignmentNodeKind } from "./alignmentGraph";

/** Un objetivo de empresa, como destino elegible desde una tarjeta. */
export interface CompanyOption {
  id: string;
  title: string;
}

interface AlignmentNodeCardProps {
  node: AlignmentNode;
  isSelected: boolean;
  /** Hay algo seleccionado y esta tarjeta no participa: se apaga. */
  isDimmed: boolean;
  /** Hay una flecha en el aire y esta tarjeta la puede recibir. */
  isDropCandidate: boolean;
  /** El cursor está justo encima con la flecha en la mano. */
  isDropHovered: boolean;
  isLinkSource: boolean;
  companyOptions: readonly CompanyOption[];
  onSelect: () => void;
  onPointerDownCard: (event: React.PointerEvent) => void;
  onStartLink: (event: React.PointerEvent) => void;
  onAlign: (companyObjectiveId: string) => void;
  onUnalign: () => void;
}

const KIND_ICON: Readonly<Record<AlignmentNodeKind, LucideIcon>> = {
  company: Building2,
  objective: Target,
  target: Users2,
  person: UserRound,
  origin: Layers,
};

/** Un acento por familia, para que el nivel se lea sin mirar la leyenda. */
const KIND_ACCENT: Readonly<Record<AlignmentNodeKind, string>> = {
  company: "var(--color-brand)",
  objective: "var(--color-indigo)",
  target: "var(--color-warning)",
  person: "var(--color-positive)",
  origin: "var(--color-text-muted)",
};

/**
 * Una tarjeta del mapa.
 *
 * Se arrastra por el cuerpo y se conecta por el puerto de la izquierda —el
 * mismo gesto de una pizarra— pero todo lo que hace ese gesto se puede hacer
 * también desde el menú "Alinear": arrastrar con precisión no puede ser el
 * único camino a una decisión del ciclo.
 */
export function AlignmentNodeCard({
  node,
  isSelected,
  isDimmed,
  isDropCandidate,
  isDropHovered,
  isLinkSource,
  companyOptions,
  onSelect,
  onPointerDownCard,
  onStartLink,
  onAlign,
  onUnalign,
}: AlignmentNodeCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const Icon = KIND_ICON[node.kind];
  const accent = KIND_ACCENT[node.kind];
  const isCompany = node.kind === "company";
  const canLink = node.objectiveRefs.length > 0;

  return (
    <div
      data-node-id={node.id}
      className={cn(
        "group absolute select-none transition-opacity duration-200",
        isDimmed && !isSelected && "opacity-30"
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onPointerDown={onPointerDownCard}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className={cn(
          "relative flex h-full w-full cursor-grab flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-surface pl-4 pr-3 text-left shadow-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing",
          isCompany ? "border-primary/25 bg-primary/[0.04]" : "border-border/70",
          isSelected && "border-primary/60 shadow-drawer",
          isDropCandidate && "border-dashed border-primary/50",
          isDropHovered && "scale-[1.03] border-primary bg-primary/10 shadow-drawer",
          isLinkSource && "border-primary/60"
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
          style={{ backgroundColor: accent }}
        />

        <div className="flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            <Icon className="size-[13px]" strokeWidth={2.3} />
          </span>
          <h4
            className={cn(
              "min-w-0 flex-1 truncate text-[12.5px] font-bold leading-tight tracking-tight text-text-primary",
              isCompany && "text-[13px]"
            )}
            title={node.title}
          >
            {node.title}
          </h4>
        </div>

        <p className="truncate pl-8 text-[11px] font-medium leading-tight text-text-secondary">
          {node.subtitle}
        </p>

        <div className="flex min-w-0 items-center gap-1.5 pl-8">
          {node.badge !== null && (
            <span
              className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[10px] font-bold tabular-nums"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                color: accent,
              }}
            >
              {node.badge}
            </span>
          )}
          {node.note !== null && (
            <span className="truncate text-[10px] font-medium text-text-muted">{node.note}</span>
          )}
        </div>
      </div>

      {/* Puerto de salida: de aquí sale la flecha hacia un objetivo de empresa. */}
      {canLink && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Alinear ${node.title} arrastrando`}
              onPointerDown={onStartLink}
              className={cn(
                "absolute top-1/2 z-10 flex size-[18px] -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-surface bg-border-strong transition-all duration-200 hover:scale-125 hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "-left-[9px]",
                (isSelected || isLinkSource) && "bg-primary",
                node.alignedTo.length > 0 && "bg-primary/70"
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="left">Arrastra hasta un objetivo de la empresa</TooltipContent>
        </Tooltip>
      )}

      {/* Puerto de entrada del norte: solo señal, no se arrastra desde aquí. */}
      {isCompany && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-[7px] top-1/2 size-[14px] -translate-y-1/2 rounded-full border-2 border-surface bg-primary/30 transition-all duration-200",
            (isDropCandidate || isDropHovered) && "scale-125 bg-primary"
          )}
        />
      )}

      {/* El mismo gesto, escrito: elegir el destino de una lista. */}
      {canLink && companyOptions.length > 0 && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Alinear ${node.title}`}
              onPointerDown={(event) => event.stopPropagation()}
              className={cn(
                "absolute -top-2 right-2 z-10 flex h-6 items-center gap-1 rounded-full border border-border/70 bg-surface px-2 text-[10px] font-bold text-text-secondary opacity-0 shadow-card transition-all hover:border-primary/50 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100",
                menuOpen && "opacity-100"
              )}
            >
              <Link2 className="size-3" strokeWidth={2.4} />
              Alinear
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-[260px] p-1.5">
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold text-text-muted">
              Contribuye a…
            </p>
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {companyOptions.map((option) => {
                const isLinked = node.alignedTo.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onAlign(option.id);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-primary transition-colors hover:bg-surface-muted"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isLinked ? "border-transparent bg-primary text-white" : "border-border"
                      )}
                    >
                      {isLinked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.title}</span>
                  </button>
                );
              })}
            </div>
            {node.alignedTo.length > 0 && (
              <>
                <div className="my-1 h-px bg-border/70" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onUnalign();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Link2Off className="size-3.5" strokeWidth={2.2} />
                  Quitar alineación
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
