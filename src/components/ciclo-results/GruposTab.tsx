import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback";
import { FilterSortHeader, SortOnlyHeader } from "@/components/data-display/TableHeaderControls";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  LazyRowsSentinel,
  LazyRowsSummary,
  TableConfigButton,
  useColumnDrag,
  useLazyRows,
  useTableConfig,
  type TableColumnCells,
  type TableColumnSpec,
} from "@/components/data-display/table-config";
import {
  NivelChip,
  formatPercent,
  formatRelativeDate,
} from "@/components/ciclo-detail";
import {
  CollapsibleSearchBox,
  HEADER_CELL_CLASS,
  HeaderCell,
  TablePager,
  usePagedSlice,
} from "./tableBridge";
import { AvancePill, EstadoBar, RiskChip } from "./ResultsChips";
import { ResultsDetailCard } from "./ResultsDetailCard";
import { ResultsGlobalFilters } from "./ResultsGlobalFilters";
import {
  ACTUALIZACION_BUCKETS,
  AVANCE_BUCKETS,
  OBJETIVOS_BUCKETS,
  clearColumnFilter,
  countColumnFilters,
  matchesColumnFilters,
  toggleColumnFilter,
  actualizacionBucketOf,
  type ColumnFilterKey,
  type ColumnFilters,
} from "./colaboradoresColumns";
import { RISK_META, RISK_ORDER } from "./resultsModel";
import type { CicloResults, PersonResultRow } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";
import { BREAKDOWN_META, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import { resolveEstado, resolveNivel } from "@/components/ciclo-detail";
import { countEstados } from "./resultsModel";
import { getEstadoBadgeConfig } from "@/components/objetivos/objetivosConfigStore";
import { riskFor } from "./resultsModel";
import { Users } from "lucide-react";

type SortKey =
  | "nombre"
  | "personas"
  | "objetivos"
  | "avance"
  | "estado"
  | "riesgo"
  | "actualizacion";

interface GruposTabProps {
  results: CicloResults;
  baseResults: CicloResults;
  filters: ResultsFiltersState;
  breakdown: BreakdownKey;
  onBreakdownChange: (key: BreakdownKey) => void;
  globalChips?: React.ReactNode;
  viewSwitch?: React.ReactNode;
}

export function GruposTab({
  results,
  baseResults,
  filters,
  breakdown,
  onBreakdownChange,
  globalChips,
  viewSwitch,
}: GruposTabProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "avance",
    desc: true,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [columns, setColumns] = React.useState<ColumnFilters>({
    objetivos: new Set(),
    avance: new Set(),
    actualizacion: new Set(),
  });
  
  // Aggregate data by breakdown
  const groupData = React.useMemo(() => {
    const buckets = new Map<string, {
      label: string;
      percentSum: number;
      people: Set<string>;
      entries: any[];
    }>();
    
    // We only aggregate what's visible after ResultsGlobalFilters
    results.rows.forEach(row => {
      const label = breakdownValueOf({
        collaborator: row.collaborator,
        groupId: row.person.groupId
      }, breakdown);
      
      const bucket = buckets.get(label) || {
        label,
        percentSum: 0,
        people: new Set(),
        entries: [],
        lastUpdate: null,
      };
      
      bucket.percentSum += row.percent;
      bucket.people.add(row.person.id);
      bucket.entries.push(...row.entries);
      if (row.lastUpdate) {
        if (!bucket.lastUpdate || new Date(row.lastUpdate.date) > new Date(bucket.lastUpdate.date)) {
          bucket.lastUpdate = row.lastUpdate;
        }
      }
      buckets.set(label, bucket);
    });
    
    return Array.from(buckets.values()).map(bucket => {
      const percent = bucket.people.size > 0 ? bucket.percentSum / bucket.people.size : 0;
      const estado = resolveEstado(results.estados, percent, results.data.status);
      const nivel = resolveNivel(results.niveles, percent);
      const risk = riskFor(percent, results.elapsed);
      const estadoCounts = countEstados(bucket.entries);
      
      return {
        id: bucket.label,
        label: bucket.label,
        percent,
        peopleCount: bucket.people.size,
        entriesCount: bucket.entries.length,
        estado,
        nivel,
        risk,
        estadoCounts,
        lastUpdate: bucket.lastUpdate,
      };
    });
  }, [results.rows, breakdown, results, results.data.status, results.elapsed]);

  const columnCount = countColumnFilters(columns);

  const toggleColumn = (column: ColumnFilterKey, value: string) => {
    setColumns((current) => toggleColumnFilter(current, column, value));
    setPage(1);
  };

  const clearColumn = (column: ColumnFilterKey) => {
    setColumns((current) => clearColumnFilter(current, column));
    setPage(1);
  };

  const now = React.useMemo(() => new Date(), []);

  // We filter with the same matchesColumnFilters logic (conceptually) but it's simpler here
  const visible = React.useMemo(() => {
    return groupData.filter(group => {
      // Very basic column filter mapping
      if (columns.objetivos.size > 0) {
        let bucket = "";
        if (group.entriesCount === 0) bucket = "0";
        else if (group.entriesCount <= 5) bucket = "1-5";
        else if (group.entriesCount <= 10) bucket = "6-10";
        else bucket = "11+";
        if (!columns.objetivos.has(bucket)) return false;
      }
      if (columns.avance.size > 0) {
        let bucket = "";
        if (group.percent === 0) bucket = "0";
        else if (group.percent < 25) bucket = "1-24";
        else if (group.percent < 50) bucket = "25-49";
        else if (group.percent < 75) bucket = "50-74";
        else if (group.percent < 100) bucket = "75-99";
        else bucket = "100";
        if (!columns.avance.has(bucket)) return false;
      }
      if (columns.actualizacion.size > 0) {
        if (!columns.actualizacion.has(actualizacionBucketOf(group as any, now))) return false;
      }
      return true;
    });
  }, [groupData, columns]);

  const sorted = React.useMemo(() => {
    const factor = sort.desc ? -1 : 1;
    const byName = (a: any, b: any) => a.label.localeCompare(b.label, "es");
    return [...visible].sort((a, b) => {
      switch (sort.key) {
        case "nombre": return factor * byName(a, b);
        case "personas": return factor * (a.peopleCount - b.peopleCount) || byName(a, b);
        case "objetivos": return factor * (a.entriesCount - b.entriesCount) || byName(a, b);
        case "avance": return factor * (a.percent - b.percent) || byName(a, b);
        case "actualizacion":
          const aDate = a.lastUpdate ? new Date(a.lastUpdate.date).getTime() : 0;
          const bDate = b.lastUpdate ? new Date(b.lastUpdate.date).getTime() : 0;
          return factor * (aDate - bDate) || byName(a, b);
        default: return factor * (a.percent - b.percent) || byName(a, b);
      }
    });
  }, [visible, sort]);

  const showsRisk = results.showsRisk;
  const columnSpecs = React.useMemo<TableColumnSpec[]>(() => [
    { id: "nombre", label: BREAKDOWN_META[breakdown].label },
    { id: "personas", label: "Personas" },
    { id: "objetivos", label: "Objetivos" },
    { id: "avance", label: "Avance promedio" },
    { id: "estado", label: "Estado promedio" },
    { id: "riesgo", label: "Riesgo promedio", available: showsRisk },
    { id: "actualizacion", label: "Última actualización" },
  ], [breakdown, showsRisk]);

  const config = useTableConfig("ciclo-resultados-grupos-v2", columnSpecs);
  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });

  const { paged, current } = usePagedSlice(sorted, page, pageSize);

  const lazy = useLazyRows({
    total: sorted.length,
    enabled: config.isLazy,
    resetKey: sorted,
  });

  const shown = config.isLazy ? sorted.slice(0, lazy.count) : paged;

  const toggleSort = (key: SortKey) =>
    setSort((currentSort) =>
      currentSort.key === key
        ? { key, desc: !currentSort.desc }
        : { key, desc: key !== "nombre" }
    );

  const cells: TableColumnCells<any> = {
    nombre: {
      headClassName: "px-4",
      head: <SortOnlyHeader label={BREAKDOWN_META[breakdown].label} sortActive={sort.key === "nombre"} onSort={() => toggleSort("nombre")} />,
      cell: (row) => <p className="truncate text-[13px] font-semibold text-text-primary">{row.label}</p>,
    },
    personas: {
      headClassName: "w-[8rem] px-4",
      head: <SortOnlyHeader label="Personas" sortActive={sort.key === "personas"} onSort={() => toggleSort("personas")} />,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold">{row.peopleCount}</span>
        </div>
      ),
    },
    objetivos: {
      headClassName: "w-[10rem] px-4",
      head: (
        <FilterSortHeader
          label="Objetivos"
          options={OBJETIVOS_BUCKETS}
          selected={columns.objetivos}
          onToggleFilter={(value) => toggleColumn("objetivos", value)}
          onClearFilter={() => clearColumn("objetivos")}
          sortActive={sort.key === "objetivos"}
          onSort={() => toggleSort("objetivos")}
        />
      ),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-[12.5px] font-bold tabular-nums text-text-primary">{row.entriesCount}</span>
          <EstadoBar counts={row.estadoCounts} estados={results.estados} width="w-16" />
        </div>
      ),
    },
    avance: {
      headClassName: "w-[10rem] px-4",
      head: (
        <FilterSortHeader
          label="Avance"
          options={AVANCE_BUCKETS}
          selected={columns.avance}
          onToggleFilter={(value) => toggleColumn("avance", value)}
          onClearFilter={() => clearColumn("avance")}
          sortActive={sort.key === "avance"}
          onSort={() => toggleSort("avance")}
        />
      ),
      cell: (row) => <AvancePill percent={row.percent} estado={row.estado} labeled={false} />,
    },
    estado: {
      headClassName: "px-4",
      head: <SortOnlyHeader label="Estado" sortActive={sort.key === "estado"} onSort={() => toggleSort("estado")} />,
      cell: (row) => <NivelChip nivel={row.nivel} />,
    },
    riesgo: {
      headClassName: "px-4",
      head: <SortOnlyHeader label="Riesgo" sortActive={sort.key === "riesgo"} onSort={() => toggleSort("riesgo")} />,
      cell: (row) => <RiskChip risk={row.risk} />,
    },
    actualizacion: {
      headClassName: "px-4",
      cellClassName: "text-[12.5px] text-text-secondary",
      head: (
        <FilterSortHeader
          label="Última actualización"
          options={ACTUALIZACION_BUCKETS}
          selected={columns.actualizacion}
          onToggleFilter={(value) => toggleColumn("actualizacion", value)}
          onClearFilter={() => clearColumn("actualizacion")}
          sortActive={sort.key === "actualizacion"}
          onSort={() => toggleSort("actualizacion")}
        />
      ),
      cell: (row) => row.lastUpdate ? formatRelativeDate(row.lastUpdate.date) : "Sin reportes",
    },
  };

  const controls = (
    <>
      <CollapsibleSearchBox
        value={filters.filters.search}
        onChange={filters.setSearch}
        placeholder={`Buscar por ${BREAKDOWN_META[breakdown].label.toLowerCase()}...`}
      />
      <ResultsGlobalFilters
        results={baseResults}
        state={filters}
        showBreakdown={true}
        breakdown={breakdown}
        onBreakdownChange={onBreakdownChange}
        showSegmentation={false}
        excludeBreakdowns={["persona"]}
      />
      <TableConfigButton config={config} noun="grupos" />
      {viewSwitch}
    </>
  );

  if (visible.length === 0) {
    return (
      <ResultsDetailCard title="Detalle por grupo" count={0} controls={controls} chips={globalChips} wide>
        <div className="-mx-4 flex items-center justify-center border-y border-border/60 p-8">
          <EmptyState
            title="Ningún grupo cumple con los filtros"
            description="Ajusta los filtros para volver a ver los resultados."
            className="border-none bg-transparent shadow-none"
          />
        </div>
      </ResultsDetailCard>
    );
  }

  return (
    <ResultsDetailCard title="Detalle por grupo" count={visible.length} controls={controls} chips={globalChips} wide>
      <div className="-mx-4 border-y border-border/60">
        <table className="w-full caption-bottom border-collapse text-sm">
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="sticky top-[var(--results-sticky-top,72px)] z-20 border-b-0 bg-muted-solid shadow-[0_1px_0_0_hsl(var(--border)/0.6)] hover:bg-muted-solid">
              <ConfigurableHeaderCells config={config} drag={drag} cells={cells} className={HEADER_CELL_CLASS} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                <ConfigurableRowCells config={config} cells={cells} row={row} className="px-4 py-3" />
              </TableRow>
            ))}
            <LazyRowsSentinel lazy={lazy} colSpan={config.columns.length} noun="grupos" />
          </TableBody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-muted-foreground">
            Promedio global: <span className="font-semibold tabular-nums text-text-primary">
              {formatPercent(visible.reduce((sum, row) => sum + row.percent, 0) / (visible.length || 1))}
            </span>
          </p>
        </div>
        {config.isLazy ? (
          <LazyRowsSummary lazy={lazy} total={sorted.length} noun="grupos" />
        ) : (
          <TablePager
            total={sorted.length}
            page={current}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            noun="grupos"
          />
        )}
      </div>
    </ResultsDetailCard>
  );
}
