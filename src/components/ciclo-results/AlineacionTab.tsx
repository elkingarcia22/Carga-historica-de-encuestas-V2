import * as React from "react";
import { Compass, Link2, Search, Sparkles, Target, TriangleAlert, UserRound, Users2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/selection/SegmentedControl";
import { EmptyState } from "@/components/feedback";
import { alignmentCounts } from "@/components/ciclo-builder";
import {
  AlignmentCanvas,
  ALIGNMENT_LEVEL_HINTS,
  ALIGNMENT_LEVEL_LABELS,
  buildAlignmentGraph,
  companyIdOfNode,
  companyNodeId,
  MAX_PERSON_NODES,
  type AlignmentLevel,
  type CompanyOption,
  type NodePositions,
  type ObjectiveRef,
} from "@/components/ciclo-alignment";
import { StatCard } from "./ResumenPanels";
import { ResultsDetailCard } from "./ResultsDetailCard";
import {
  ContributionMatrix,
  DriftingPeople,
  EffortVersusResult,
  StrategyBets,
} from "./StrategicAlignmentPanels";
import {
  alignmentHeadline,
  alignmentSource,
  companyPushes,
  contributionMatrix,
  driftingPeople,
  safePercent,
} from "./strategicAlignment";
import { BREAKDOWN_META, type BreakdownKey } from "./resultsBreakdown";
import type { CicloResults, PersonResultRow, ResultEntry, ResultsConfig } from "./resultsModel";
import { FILTER_META, type FilterKey, type ResultsFiltersState } from "./useResultsFilters";

/**
 * La alineación estratégica del ciclo.
 *
 * Vive junto al padrón de colaboradores y no en su propia pestaña porque es la
 * otra mitad de la misma pregunta: la tabla dice quién va cómo, y esto dice
 * hacia dónde está empujando toda esa gente. Se cambia de una a la otra con el
 * mismo switch con el que Cumplimiento cambia de árbol a heatmap.
 *
 * Arriba, el mapa: es el mismo del último paso del constructor —las mismas
 * tarjetas, los mismos tres niveles, el mismo gesto de arrastrar el punto azul
 * hasta un objetivo de empresa—, solo que alimentado con el ciclo que ya está
 * corriendo. Poder arreglar una alineación aquí es medio punto de la vista:
 * el sitio donde se descubre que un objetivo no apunta a nada es el sitio
 * donde hay que poder conectarlo.
 *
 * Debajo, la lectura en cifras, de lo general a lo concreto: cuánto del
 * esfuerzo tiene norte, en qué se está apostando, cuál apuesta está pagando,
 * quién empuja cada una y a quién hay que llamar. Todo se mide en peso —ver
 * `strategicAlignment`— y todo obedece a los filtros de arriba, el mapa
 * incluido.
 */

const LEVEL_ORDER: readonly AlignmentLevel[] = ["objetivos", "agrupacion", "colaboradores"];

/**
 * Los filtros que parten por dentro el 100 % de cada persona.
 *
 * Esta vista no los ofrece —ver `showFilters` en `ResultsGlobalFilters`—, pero
 * los filtros son de la pantalla entera: uno puesto en Resumen sigue vivo al
 * llegar aquí. Cuando eso pasa hay que decirlo, porque cambia en silencio
 * contra qué se mide cada porcentaje de abajo.
 */
const OBJECTIVE_SCOPE_KEYS: readonly FilterKey[] = (
  Object.keys(FILTER_META) as FilterKey[]
).filter((key) => FILTER_META[key].scope === "objetivo");

const LEVEL_ICON = {
  objetivos: Target,
  agrupacion: Users2,
  colaboradores: UserRound,
} as const;

interface AlineacionTabProps {
  /** El ciclo ya recortado por los filtros. */
  results: CicloResults;
  rows: readonly PersonResultRow[];
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  filters: ResultsFiltersState;
  /** El "Ver por" de arriba: con él se agrupa quién empuja cada objetivo. */
  breakdown: BreakdownKey;
  /** El nivel del mapa y lo que el lector movió a mano, en el padre: cambiar
   *  de vista y volver no debería reencuadrar el mapa que acababa de armar. */
  level: AlignmentLevel;
  onLevelChange: (level: AlignmentLevel) => void;
  positions: NodePositions;
  onPositionsChange: (positions: NodePositions) => void;
  /** Conecta (o suelta, con `null`) los objetivos que lleva una tarjeta. */
  onAlign: (refs: readonly ObjectiveRef[], companyObjectiveId: string | null) => void;
  onOpenPerson: (personId: string) => void;
  globalControls?: React.ReactNode;
  globalChips?: React.ReactNode;
  /** El switch Colaboradores / Alineación, en la cabecera de la tarjeta. */
  viewSwitch?: React.ReactNode;
}

export function AlineacionTab({
  results,
  rows,
  entries,
  config,
  filters,
  breakdown,
  level,
  onLevelChange,
  positions,
  onPositionsChange,
  onAlign,
  onOpenPerson,
  globalControls,
  globalChips,
  viewSwitch,
}: AlineacionTabProps) {
  const [search, setSearch] = React.useState("");

  const elapsed = results.showsRisk ? results.elapsed : -1;

  const pushes = React.useMemo(
    () => companyPushes(entries, results.data, config, breakdown, elapsed),
    [entries, results.data, config, breakdown, elapsed]
  );
  const headline = React.useMemo(
    () => alignmentHeadline(entries, rows, results.data, pushes),
    [entries, rows, results.data, pushes]
  );
  const matrix = React.useMemo(
    () => contributionMatrix(entries, breakdown, pushes, results.data),
    [entries, breakdown, pushes, results.data]
  );
  const drifting = React.useMemo(() => driftingPeople(rows, results.data), [rows, results.data]);

  const source = React.useMemo(
    () => alignmentSource(results.data, entries, rows),
    [results.data, entries, rows]
  );
  const graph = React.useMemo(
    () => buildAlignmentGraph(source, { level, search }),
    [source, level, search]
  );
  const companyOptions = React.useMemo<CompanyOption[]>(
    () =>
      results.data.companyObjectives.map((objective) => ({
        id: objective.id,
        title: objective.title.trim() === "" ? "Objetivo sin título" : objective.title.trim(),
      })),
    [results.data.companyObjectives]
  );
  const counts = React.useMemo(() => alignmentCounts(source.objectiveSets), [source.objectiveSets]);

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  /*
   * Pulsar una apuesta no filtra: la aísla en el mapa.
   *
   * Filtrar por objetivo de empresa dejaría a esta tarjeta con una sola fila
   * al 100 % —el reparto que se vino a leer, convertido en una tautología—.
   * Lo que sí se quiere al pulsar "¿y quién cuelga de Ingresos?" es verlo, y
   * el mapa ya sabe aislar el vecindario de una tarjeta.
   */
  const mapRef = React.useRef<HTMLDivElement>(null);
  const focusOnMap = React.useCallback((companyObjectiveId: string) => {
    setSelectedNodeId((current) => {
      const next = companyNodeId(companyObjectiveId);
      return current === next ? null : next;
    });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  /** Lo que está recortando los objetivos desde otra pestaña, si es que algo. */
  const narrowingKeys = OBJECTIVE_SCOPE_KEYS.filter(
    (key) => (filters.filters[key] as ReadonlySet<string>).size > 0
  );

  /** Con qué filtro se angosta el reporte al pulsar una fila de la matriz. */
  const breakdownFilterKey = BREAKDOWN_META[breakdown].filterKey;

  const hasNorth = companyOptions.length > 0;
  const hasObjectives = entries.length > 0;
  /** El objetivo de empresa aislado en el mapa, para resaltarlo también en la
   *  lista de apuestas: son la misma cosa mirada de dos maneras. */
  const selectedCompanyId =
    selectedNodeId === null ? null : (companyIdOfNode(selectedNodeId) ?? null);

  if (!hasNorth || !hasObjectives) {
    return (
      <ResultsDetailCard
        title="Alineación estratégica"
        controls={
          <>
            {globalControls}
            {viewSwitch}
          </>
        }
        chips={globalChips}
      >
        <div className="rounded-xl border border-border/60 p-8">
          <EmptyState
            icon={Compass}
            title={
              hasNorth
                ? "Nada que alinear con estos filtros"
                : "Este ciclo no tiene objetivos de empresa"
            }
            description={
              hasNorth
                ? "Ningún objetivo del ciclo cumple con lo que está filtrado. Quita algún filtro para volver a ver el mapa."
                : "El mapa conecta lo que reparte el ciclo con los objetivos de la empresa. Sin ellos no hay un norte al que apuntar ni alineación que medir."
            }
            className="border-none bg-transparent shadow-none"
          />
        </div>
      </ResultsDetailCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResultsDetailCard
        title="Mapa de alineación"
        count={graph.nodes.length}
        controls={
          <>
            {globalControls}
            {viewSwitch}
          </>
        }
        chips={globalChips}
      >
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
            <CoverageChip aligned={counts.aligned} total={counts.aligned + counts.unaligned} />
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

        <div ref={mapRef} className="h-[520px]">
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
            Arrastra el punto azul hasta un objetivo de la empresa para conectarlo
          </span>
          <span>Rueda para acercar · arrastra el fondo para moverte</span>
          <span>Pasa sobre una flecha para cortarla</span>
        </p>
      </ResultsDetailCard>

      {narrowingKeys.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[color:var(--color-warning)]/30 bg-warning/8 px-3.5 py-2.5 text-[12px] font-medium text-text-secondary">
          <TriangleAlert
            className="size-3.5 shrink-0 text-[color:var(--color-warning)]"
            strokeWidth={2.2}
          />
          <span>
            Hay filtros de objetivo puestos (
            {narrowingKeys.map((key) => FILTER_META[key].label).join(", ")}): lo de abajo se mide
            sobre los objetivos que dejan, no sobre el ciclo completo.
          </span>
          <button
            type="button"
            onClick={() => narrowingKeys.forEach((key) => filters.clearKey(key))}
            className="font-bold text-primary transition-colors hover:underline"
          >
            Quitarlos
          </button>
        </p>
      )}

      {/* Las cuatro cifras que enmarcan la lectura, antes de cualquier
          gráfico: cuánto del esfuerzo tiene norte, cuántas apuestas tienen
          gente detrás, cuánta gente está remando aparte y qué tan concentrada
          está la estrategia. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Compass}
          label="Esfuerzo con norte"
          value={`${safePercent(headline.coverage)} %`}
          share={safePercent(headline.coverage)}
          hint={
            headline.looseObjectives === 0
              ? "Todo el peso del ciclo cuelga de un objetivo de empresa"
              : `${headline.looseObjectives} ${headline.looseObjectives === 1 ? "objetivo" : "objetivos"} sin objetivo de empresa, en ${headline.loosePeople} ${headline.loosePeople === 1 ? "persona" : "personas"}`
          }
        />
        <StatCard
          icon={Target}
          label="Objetivos de empresa con respaldo"
          value={`${headline.backedCount}`}
          total={`${headline.companyCount}`}
          share={safePercent((headline.backedCount / Math.max(1, headline.companyCount)) * 100)}
          hint={
            headline.backedCount === headline.companyCount
              ? "Todos tienen gente empujándolos"
              : `${headline.companyCount - headline.backedCount} sin una sola meta detrás`
          }
        />
        <StatCard
          icon={UserRound}
          label="Personas sin norte"
          value={`${headline.peopleWithoutNorth}`}
          total={`${headline.peopleCounted}`}
          share={safePercent((headline.peopleWithoutNorth / Math.max(1, headline.peopleCounted)) * 100)}
          hint="Ninguno de sus objetivos apunta a la estrategia"
          color={headline.peopleWithoutNorth > 0 ? "var(--color-warning)" : undefined}
        />
        <StatCard
          icon={Sparkles}
          label="La apuesta más grande"
          value={`${safePercent(headline.focusShare)} %`}
          share={safePercent(headline.focusShare)}
          hint={headline.focusLabel}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StrategyBets
          pushes={pushes}
          breakdown={breakdown}
          selectedId={selectedCompanyId}
          onSelect={focusOnMap}
        />
        <EffortVersusResult
          pushes={pushes}
          elapsed={results.elapsed}
          showsRisk={results.showsRisk}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ContributionMatrix
          rows={matrix}
          pushes={pushes}
          breakdown={breakdown}
          activeRowIds={
            breakdownFilterKey === null
              ? undefined
              : (filters.filters[breakdownFilterKey] as ReadonlySet<string>)
          }
          onSelectRow={
            breakdownFilterKey === null
              ? undefined
              : (id) => filters.toggle(breakdownFilterKey, id)
          }
        />
        <DriftingPeople people={drifting} onOpenPerson={onOpenPerson} />
      </div>
    </div>
  );
}

/** Cuánto del ciclo ya tiene norte, en la cabecera del mapa. */
function CoverageChip({ aligned, total }: { aligned: number; total: number }) {
  if (total === 0) return null;
  const coverage = safePercent((aligned / total) * 100);
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
