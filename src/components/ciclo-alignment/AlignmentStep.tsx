import * as React from "react";
import {
  Building2,
  Link2,
  Search,
  Share2,
  Sparkles,
  Target,
  UserRound,
  Users2,
  X,
  Check,
  Link2Off,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/selection/SegmentedControl";
import { alignmentCounts, type CicloDraft } from "@/components/ciclo-builder";
import { AlignmentCanvas, type NodePositions } from "./AlignmentCanvas";
import type { CompanyOption } from "./AlignmentNodeCard";
import {
  ALIGNMENT_LEVEL_HINTS,
  ALIGNMENT_LEVEL_LABELS,
  buildAlignmentGraph,
  MAX_PERSON_NODES,
  type AlignmentLevel,
  type ObjectiveRef,
} from "./alignmentGraph";
import { ManualAlignmentPopover } from "./ManualAlignmentPopover";

interface AlignmentStepProps {
  draft: CicloDraft;
  level: AlignmentLevel;
  onLevelChange: (level: AlignmentLevel) => void;
  positions: NodePositions;
  onPositionsChange: (positions: NodePositions) => void;
  /** Alinea los objetivos indicados con un objetivo de empresa, o los suelta
   *  cuando llega `null`. */
  onAlign: (refs: readonly ObjectiveRef[], companyObjectiveId: string | null) => void;
  /** El nodo seleccionado en el mapa (para el dock global) */
  onSelectedNodeChange: (node: import("./alignmentGraph").AlignmentNode | undefined) => void;
  /** Vuelve al paso que llenaría el hueco que el mapa está denunciando. */
  onGoToCompanyStep: () => void;
  onGoToObjectivesStep: () => void;
}

const LEVEL_ORDER: readonly AlignmentLevel[] = ["objetivos", "agrupacion", "colaboradores"];

const LEVEL_ICON = {
  objetivos: Target,
  agrupacion: Users2,
  colaboradores: UserRound,
} as const;

/**
 * Último paso del ciclo: el mapa de alineación.
 *
 * Los pasos anteriores reparten metas; este contesta la pregunta que ninguno
 * de ellos contesta —¿hacia dónde empuja cada una?— y deja arreglarla en el
 * sitio, arrastrando una flecha hasta el objetivo de la empresa que le toca.
 *
 * El mismo ciclo se puede mirar en tres alturas. No son tres mapas: son el
 * mismo grafo agrupado de otra manera, y por eso el nivel no cambia nada del
 * borrador, solo de lo que se dibuja.
 */
export function AlignmentStep({
  draft,
  level,
  onLevelChange,
  positions,
  onPositionsChange,
  onAlign,
  onSelectedNodeChange,
  onGoToCompanyStep,
  onGoToObjectivesStep,
}: AlignmentStepProps) {
  const [search, setSearch] = React.useState("");
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const graph = React.useMemo(
    () => buildAlignmentGraph(draft, { level, search }),
    [draft, level, search]
  );

  React.useEffect(() => {
    onSelectedNodeChange(selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) : undefined);
  }, [graph, selectedNodeId, onSelectedNodeChange]);

  const companyOptions = React.useMemo<CompanyOption[]>(
    () =>
      draft.useCompanyObjectives
        ? draft.companyObjectives.map((objective) => ({
            id: objective.id,
            title: objective.title.trim() === "" ? "Objetivo sin título" : objective.title.trim(),
          }))
        : [],
    [draft.companyObjectives, draft.useCompanyObjectives]
  );

  const counts = React.useMemo(() => alignmentCounts(draft.objectiveSets), [draft.objectiveSets]);
  const totalAssigned = counts.aligned + counts.unaligned;
  const coverage = totalAssigned === 0 ? 0 : Math.round((counts.aligned / totalAssigned) * 100);

  const hasNorth = companyOptions.length > 0;
  const hasAssignments = totalAssigned > 0;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 self-stretch">
      <header className="rounded-2xl border border-border/60 bg-surface shadow-card">
        <div className="flex items-start gap-3 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Share2 className="size-[18px]" strokeWidth={2.2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-[15px] font-bold tracking-tight text-text-primary">
                Alineación
              </h2>
              {hasAssignments && hasNorth && (
                <CoverageChip aligned={counts.aligned} total={totalAssigned} coverage={coverage} />
              )}
            </div>
            <p className="max-w-[90ch] text-[12.5px] leading-relaxed text-text-secondary">
              Mira el mapa del ciclo y arrastra el punto azul de cada tarjeta hacia el objetivo de la empresa.
            </p>
          </div>
        </div>
      </header>

      {!hasNorth ? (
        <EmptyState
          icon={Building2}
          title="Todavía no hay un norte al que alinear"
          description="El mapa conecta lo que reparte el ciclo con los objetivos de la empresa. Sin ellos no hay nada a lo que apuntar."
          actionLabel="Definir objetivos de la empresa"
          onAction={onGoToCompanyStep}
        />
      ) : !hasAssignments ? (
        <EmptyState
          icon={Target}
          title="Este ciclo aún no reparte objetivos"
          description="Cuando haya asignaciones por grupo o por persona, aparecerán aquí para conectarlas con el norte de la empresa."
          actionLabel="Crear una asignación"
          onAction={onGoToObjectivesStep}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-2xl border border-border/60 bg-surface p-3 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <SegmentedControl
                ariaLabel="Nivel del mapa"
                size="sm"
                options={LEVEL_ORDER.map((option) => ({
                  value: option,
                  label: ALIGNMENT_LEVEL_LABELS[option],
                  icon: LEVEL_ICON[option],
                }))}
                value={level}
                onChange={(value) => onLevelChange(value as AlignmentLevel)}
              />
              <p className="pl-1 text-[11px] font-medium text-text-muted">
                {ALIGNMENT_LEVEL_HINTS[level]}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Legend level={level} />
              <label className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-2.5 size-3.5 text-text-muted"
                  strokeWidth={2.2}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar en el mapa…"
                  aria-label="Buscar tarjetas del mapa"
                  className="h-8 w-[190px] rounded-lg border border-border/70 bg-surface pl-8 pr-7 text-[12px] font-medium text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {search !== "" && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearch("")}
                    className="absolute right-2 text-text-muted transition-colors hover:text-text-primary"
                  >
                    <X className="size-3.5" strokeWidth={2.4} />
                  </button>
                )}
              </label>
            </div>
          </div>

          {(graph.hiddenCount > 0 || (search !== "" && graph.filteredCount > 0)) && (
            <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-[11px] font-medium text-text-secondary">
              {graph.hiddenCount > 0 &&
                `El mapa dibuja hasta ${MAX_PERSON_NODES} personas: primero quienes reciben metas de más de un frente o tienen asignación propia. Otras ${graph.hiddenCount} quedan representadas por la tarjeta de su grupo — búscalas por nombre para traerlas al mapa. `}
              {search !== "" &&
                graph.filteredCount > 0 &&
                `${graph.filteredCount} ${graph.filteredCount === 1 ? "tarjeta oculta" : "tarjetas ocultas"} por la búsqueda.`}
            </p>
          )}

          <div className="min-h-[440px] flex-1">
            <AlignmentCanvas
              key={level}
              graph={graph}
              companyOptions={companyOptions}
              initialPositions={positions}
              onPositionsCommit={onPositionsChange}
              selectedId={selectedNodeId}
              onSelectId={setSelectedNodeId}
              onAlign={onAlign}
              fitKey={`${level}:${graph.nodes.length}`}
            />
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] font-medium text-text-muted">
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3.5" strokeWidth={2.2} />
              Arrastra el punto azul hasta un objetivo de la empresa
            </span>
            <span>Rueda para acercar · arrastra el fondo para moverte</span>
            <span>Pasa sobre una flecha para cortarla</span>
          </p>
        </div>
      )}
    </section>
  );
}

function CoverageChip({
  aligned,
  total,
  coverage,
}: {
  aligned: number;
  total: number;
  coverage: number;
}) {
  const isDone = aligned === total;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        isDone
          ? "bg-status-positive/12 text-status-positive"
          : "bg-warning/12 text-[color:var(--color-warning)]"
      )}
    >
      {isDone && <Sparkles className="size-3" strokeWidth={2.6} />}
      {aligned} de {total} alineados · {coverage} %
    </span>
  );
}

const LEGEND: Readonly<Record<AlignmentLevel, readonly { color: string; label: string }[]>> = {
  objetivos: [
    { color: "var(--color-brand)", label: "Empresa" },
    { color: "var(--color-indigo)", label: "Objetivo asignado" },
  ],
  agrupacion: [
    { color: "var(--color-brand)", label: "Empresa" },
    { color: "var(--color-warning)", label: "Destinatario" },
  ],
  colaboradores: [
    { color: "var(--color-brand)", label: "Empresa" },
    { color: "var(--color-positive)", label: "Persona" },
    { color: "var(--color-text-muted)", label: "Origen" },
  ],
};

function Legend({ level }: { level: AlignmentLevel }) {
  return (
    <ul className="hidden items-center gap-3 rounded-lg border border-border/60 bg-surface-subtle px-2.5 py-1.5 lg:flex">
      {LEGEND[level].map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-8 py-12 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" strokeWidth={2} />
      </span>
      <h3 className="text-[15px] font-bold tracking-tight text-text-primary">{title}</h3>
      <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-text-secondary">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-1 flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {actionLabel}
      </button>
    </div>
  );
}
