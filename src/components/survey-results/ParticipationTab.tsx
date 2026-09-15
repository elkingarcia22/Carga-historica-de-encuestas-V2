import * as React from "react";
import { ArrowUpDown, CheckCircle2, Clock3, Info, Search, UserX, Users, X, CheckIcon, ChevronDown, Eye, EyeOff, MinusIcon, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MiniMetricCard, AnimatedNumber } from "./MiniMetricCard";
import { COLLABORATORS } from "@/mocks/collaborators";
import {
 participationBySegment,
 type ParticipationRow,
 type SegmentDefinition,
 type SurveyResults,
} from "@/mocks/surveyResults";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PagerButton } from "@/components/survey-builder/CollaboratorTableParts";
import {
 ConfigurableHeaderCells,
 ConfigurableRowCells,
 LazyRowsSentinel,
 LazyRowsSummary,
 SelectionHeaderMenu,
 TableConfigButton,
 useColumnDrag,
 useLazyRows,
 useTableConfig,
} from "@/components/data-display";
import { participationColumns, participationTableCells } from "./participationTableColumns";
import { 
 formatPercent,
 POSITIVE_BG, POSITIVE_TEXT, POSITIVE_BORDER,
 YELLOW_BG, YELLOW_TEXT, YELLOW_BORDER,
 NEGATIVE_BG, NEGATIVE_TEXT, NEGATIVE_BORDER
} from "./favorabilityScale";
import { FormulaBlock } from "./FormulaBlock";

interface ParticipationTabProps {
 results: SurveyResults;
 segment: SegmentDefinition;
 onSegmentChange: (key: string) => void;
 selectedIds: ReadonlySet<string>;
 onSelectionChange: (ids: ReadonlySet<string>) => void;
}

/** Matches the directory pager in the participants step. */
const PAGE_SIZES = [10, 25, 50] as const;

type SortKey = "rate" | "invited" | "inProgress" | "missing" | "label" | "leader" | "area" | "estado";

/**
 * Participation, by group.
 *
 * Sorted by the lowest participation first, because that is the only order this
 * table can be acted on: a list of a hundred groups sorted alphabetically —
 * which is what the reference shows — makes the reader scan every row to find
 * the four that need a reminder. The gap is stated in people, not only in
 * percent: "faltan 12 personas" is something you can go and do something about,
 * "88,7%" is not.
 */
export function ParticipationTab({ results, segment, onSegmentChange, selectedIds, onSelectionChange }: ParticipationTabProps) {
 const [query, setQuery] = React.useState("");
 const [page, setPage] = React.useState(1);
 const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
 const searchInputRef = React.useRef<HTMLInputElement>(null);
 const [sort, setSort] = React.useState<{ key: SortKey; ascending: boolean }>({
 key: "rate",
 ascending: true,
 });
 const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZES[0]);
 
 const [onlySelected, setOnlySelected] = React.useState(false);

 const [leaderFilter, setLeaderFilter] = React.useState<ReadonlySet<string>>(new Set());
 const [areaFilter, setAreaFilter] = React.useState<ReadonlySet<string>>(new Set());
 const [estadoFilter, setEstadoFilter] = React.useState<ReadonlySet<string>>(new Set());
 // Which groups (areas, countries, leaders…) to show for the current segment.
 // Empty is the canonical "nothing excluded" state — every option renders
 // checked and no row is filtered out, rather than the opposite convention
 // the other filters use where empty means "none picked yet".
 const [groupFilter, setGroupFilter] = React.useState<ReadonlySet<string>>(new Set());

 const toggleLeaderFilter = (value: string) => {
 setLeaderFilter(prev => {
 const next = new Set(prev);
 if (next.has(value)) next.delete(value);
 else next.add(value);
 return next;
 });
 };
 const toggleAreaFilter = (value: string) => {
 setAreaFilter(prev => {
 const next = new Set(prev);
 if (next.has(value)) next.delete(value);
 else next.add(value);
 return next;
 });
 };
   const toggleEstadoFilter = (value: string) => {
    setEstadoFilter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      
      if (next.size > 0 && !segment.perPerson) {
        const personSegment = results.segments.find(s => s.perPerson);
        if (personSegment) {
          setTimeout(() => onSegmentChange(personSegment.key), 0);
        }
      }
      
      return next;
    });
  };
 const toggleGroupFilter = (value: string, allLabels: readonly string[]) => {
 setGroupFilter(prev => {
 // Unchecking the first box has nothing explicit to start from — spell
 // out everyone-but-this-one so the box that was clicked is the one
 // that turns off.
 const next = prev.size === 0 ? new Set(allLabels) : new Set(prev);
 if (next.has(value)) next.delete(value);
 else next.add(value);
 // Back to everyone checked collapses to the canonical empty state.
 return next.size === allLabels.length ? new Set() : next;
 });
 };

 const rows = React.useMemo(() => participationBySegment(results, segment), [results, segment]);

 const availableLeaders = React.useMemo(() => {
 if (!segment.perPerson) return [];
 const leaders = new Set<string>();
 rows.forEach(r => {
 const p = COLLABORATORS.find((p) => p.name === r.label);
 if (p?.leader) leaders.add(p.leader);
 else leaders.add("—");
 });
 return Array.from(leaders).sort();
 }, [rows, segment.perPerson]);

 const availableAreas = React.useMemo(() => {
 if (!segment.perPerson) return [];
 const areas = new Set<string>();
 rows.forEach(r => {
 const p = COLLABORATORS.find((p) => p.name === r.label);
 if (p?.area) areas.add(p.area);
 else areas.add("—");
 });
 return Array.from(areas).sort();
 }, [rows, segment.perPerson]);
 
 const availableEstados = ["Completado", "En progreso", "Falta"];

 const availableGroupLabels = React.useMemo(
 () => (segment.perPerson ? [] : segment.options.map((option) => option.label)),
 [segment]
 );

 const visibleRows = React.useMemo(() => {
 const needle = query.trim().toLowerCase();
 const filtered = rows.filter((row) => {
 if (needle && !row.label.toLowerCase().includes(needle)) return false;
 if (onlySelected && !selectedIds.has(row.id)) return false;
 
 let rowEstado = "";

 if (segment.perPerson) {
 const person = COLLABORATORS.find((p) => p.name === row.label);
 const personLeader = person?.leader || "—";
 const personArea = person?.area || "—";
 rowEstado = row.completed > 0 ? "Completado" : row.inProgress > 0 ? "En progreso" : "Falta";
 
 if (leaderFilter.size > 0 && !leaderFilter.has(personLeader)) return false;
 if (areaFilter.size > 0 && !areaFilter.has(personArea)) return false;
 if (estadoFilter.size > 0 && !estadoFilter.has(rowEstado)) return false;
 } else {
 const isCompleted = row.completed === row.invited;
 const isNotStarted = row.completed === 0 && row.inProgress === 0;
 rowEstado = isCompleted ? "Completado" : isNotStarted ? "Falta" : "En progreso";
 if (groupFilter.size > 0 && !groupFilter.has(row.label)) return false;
 if (estadoFilter.size > 0 && !estadoFilter.has(rowEstado)) return false;
 }

 return true;
 });
 const direction = sort.ascending ? 1 : -1;

 return [...filtered].sort((a, b) => {
 const getFields = (r: ParticipationRow) => {
 if (segment.perPerson) {
 const person = COLLABORATORS.find((p) => p.name === r.label);
 const leader = person?.leader || "—";
 const area = person?.area || "—";
 const estado = r.completed > 0 ? "Completado" : r.inProgress > 0 ? "En progreso" : "Falta";
 return { leader, area, estado };
 } else {
 const isCompleted = r.completed === r.invited;
 const isNotStarted = r.completed === 0 && r.inProgress === 0;
 const estado = isCompleted ? "Completado" : isNotStarted ? "Falta" : "En progreso";
 return { leader: "", area: "", estado };
 }
 };

 if (sort.key === "label") return a.label.localeCompare(b.label) * direction;
 if (sort.key === "invited") return (a.invited - b.invited) * direction;
 if (sort.key === "rate") return (a.rate - b.rate) * direction;
 if (sort.key === "inProgress") return (a.inProgress - b.inProgress) * direction;
 if (sort.key === "missing") {
 const aMissing = a.invited - a.completed - a.inProgress;
 const bMissing = b.invited - b.completed - b.inProgress;
 return (aMissing - bMissing) * direction;
 }
 
 const aFields = getFields(a);
 const bFields = getFields(b);

 if (sort.key === "leader") return aFields.leader.localeCompare(bFields.leader) * direction;
 if (sort.key === "area") return aFields.area.localeCompare(bFields.area) * direction;
 if (sort.key === "estado") return aFields.estado.localeCompare(bFields.estado) * direction;
 
 return 0;
 });
 }, [rows, query, sort, onlySelected, selectedIds, segment.perPerson, leaderFilter, areaFilter, estadoFilter, groupFilter]);

 // A different list (new search, new segment or new order) starts at the top.
 const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
 const currentPage = Math.min(page, pageCount);
 const firstIndex = (currentPage - 1) * pageSize;
 const pagedRows = visibleRows.slice(firstIndex, firstIndex + pageSize);

 const handleSegmentChange = (key: string) => {
 setPage(1);
 onSelectionChange(new Set());
 setOnlySelected(false);
 setGroupFilter(new Set());
 onSegmentChange(key);
 };

 const toggleSort = (key: SortKey) => {
 setPage(1);
 setSort((current) =>
 current.key === key
 ? { key, ascending: !current.ascending }
 : { key, ascending: key !== "invited" && key !== "inProgress" && key !== "missing" }
 );
 };

 const selectedOnPage = pagedRows.filter((row) => selectedIds.has(row.id)).length;
 const headerState =
 pagedRows.length > 0 && selectedOnPage === pagedRows.length
 ? true
 : selectedOnPage > 0
 ? "indeterminate"
 : false;

  /*
   * La lectura de la casilla cambia con el modo: por páginas habla de la
   * página que se está viendo, bajando de corrido habla de todo lo que pasó
   * los filtros —no hay página que nombrar, así que "marcada" solo puede
   * querer decir "está todo".
   */
 const selectedMatches = visibleRows.filter((row) => selectedIds.has(row.id)).length;
 const matchState: boolean | "indeterminate" =
 selectedMatches === 0 ? false : selectedMatches === visibleRows.length ? true : "indeterminate";

 const setSelection = (ids: Iterable<string>) => onSelectionChange(new Set(ids));

 const toggleOne = (id: string) => {
 const next = new Set(selectedIds);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 setSelection(next);
 };

 const selectPage = () => setSelection([...selectedIds, ...pagedRows.map((r) => r.id)]);
 const deselectPage = () => {
 const pageIds = new Set(pagedRows.map((r) => r.id));
 setSelection([...selectedIds].filter((id) => !pageIds.has(id)));
 };
 const selectAllMatches = () => setSelection([...selectedIds, ...visibleRows.map((r) => r.id)]);
 const clearSelection = () => {
 onSelectionChange(new Set());
 setOnlySelected(false);
 };

 const allMatchesSelected = visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(r.id));
 const isPageFullySelected = pagedRows.length > 0 && selectedOnPage === pagedRows.length;
 
 const showSelectPage = pagedRows.length > 0 && !isPageFullySelected;
 const showDeselectPage = isPageFullySelected;
 const showSelectAll = visibleRows.length > 0 && !allMatchesSelected;
 const showDeselectAll = allMatchesSelected;

  /*
   * Las dos lecturas —por persona y por grupo— comparten configuración: es la
   * misma tabla, y las columnas que no aplican a una se apagan solas. Lo que
   * el lector haya ordenado o escondido sobrevive al cambio de "Ver por".
   */
  const config = useTableConfig(
    "encuestas-participacion",
    participationColumns(segment.perPerson === true)
  );
  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });
  const lazy = useLazyRows({
    total: visibleRows.length,
    enabled: config.isLazy,
    step: pageSize,
    resetKey: visibleRows,
  });
  const shownRows = config.isLazy ? visibleRows.slice(0, lazy.count) : pagedRows;

  const cells = participationTableCells({
    segment,
    sort,
    toggleSort: (key) => toggleSort(key as SortKey),
    groupLabels: availableGroupLabels,
    groupFilter,
    onToggleGroup: (value) => toggleGroupFilter(value, availableGroupLabels),
    onClearGroup: () => setGroupFilter(new Set()),
    leaders: availableLeaders,
    leaderFilter,
    onToggleLeader: toggleLeaderFilter,
    onClearLeader: () => setLeaderFilter(new Set()),
    areas: availableAreas,
    areaFilter,
    onToggleArea: toggleAreaFilter,
    onClearArea: () => setAreaFilter(new Set()),
    estados: availableEstados,
    estadoFilter,
    onToggleEstado: toggleEstadoFilter,
    onClearEstado: () => setEstadoFilter(new Set()),
  });

 const { completed, inProgress, invited } = results.participation;
 const missing = Math.max(0, invited - completed - inProgress);

 return (
 <div className="flex flex-col gap-8">
 <div className="flex flex-col gap-6 pb-6">
 {/* Métricas de participación — mismas tarjetas que las de favorabilidad */}
 <div className="grid pt-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
 <MiniMetricCard size="compact"
 icon={Users}
 label="Total de participación"
 value={<AnimatedNumber value={results.participation.rate} format={formatPercent} />}
 >
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 className="text-muted-foreground hover:text-text-primary transition-colors bg-muted/30 p-1 rounded-md"
 >
 <Info className="h-3.5 w-3.5" />
 </button>
 </TooltipTrigger>
 <TooltipContent
 side="top"
 className="max-w-[400px] p-4 bg-surface-nav text-white shadow-drawer border-none"
 >
 <div className="flex flex-col gap-3 items-start leading-relaxed">
 <p className="text-[12px]">
 <strong>Participación:</strong>
 <br />
 Es el porcentaje de personas invitadas que completaron la encuesta.
 </p>
 <FormulaBlock
 numerator="Personas que completaron"
 denominator="Personas invitadas"
 result="% de participación"
 />
 </div>
 </TooltipContent>
 </Tooltip>
 </MiniMetricCard>

   <MiniMetricCard size="compact"
    icon={CheckCircle2}
    label="Completadas"
    value={<AnimatedNumber value={completed} format={formatCount} />}
    color={POSITIVE_TEXT}
    onClick={() => toggleEstadoFilter("Completado")}
    active={estadoFilter.has("Completado")}
  />
   <MiniMetricCard size="compact"
    icon={Clock3}
    label="En progreso"
    value={<AnimatedNumber value={inProgress} format={formatCount} />}
    color={YELLOW_TEXT}
    onClick={() => toggleEstadoFilter("En progreso")}
    active={estadoFilter.has("En progreso")}
  />
   <MiniMetricCard size="compact"
    icon={UserX}
    label="Faltan"
    value={<AnimatedNumber value={missing} format={formatCount} />}
    color={NEGATIVE_TEXT}
    onClick={() => toggleEstadoFilter("Falta")}
    active={estadoFilter.has("Falta")}
  />
 </div>

 <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
 <div className="flex flex-wrap items-center gap-4">
 <div className="flex items-center gap-2">
 <h3 className="text-[13px] font-bold text-text-primary">
 Detalle de la participación por {segment.label.toLowerCase()}
 </h3>
 <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
 {visibleRows.length}
 </Badge>
 </div>
 
 <div className="flex items-center gap-4 ml-auto">
 <div
 className={cn(
 "relative flex h-9 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-lg border bg-surface",
 (isSearchExpanded || query !== "")
 ? "w-[300px] border-primary/50 ring-1 ring-primary/15"
 : "w-9 border-border hover:bg-border/50 cursor-pointer"
 )}
 onClick={() => {
 if (!isSearchExpanded && query === "") {
 setIsSearchExpanded(true);
 setTimeout(() => searchInputRef.current?.focus(), 50);
 }
 }}
 onBlur={(e) => {
 if (!e.currentTarget.contains(e.relatedTarget) && query === "") {
 setIsSearchExpanded(false);
 }
 }}
 >
 <div
 className={cn(
 "absolute left-0 -ml-px -mt-px flex h-9 w-9 items-center justify-center transition-colors",
 (isSearchExpanded || query !== "") ? "text-primary" : "text-muted-foreground"
 )}
 >
 <Search className="h-4 w-4 translate-x-[0.667px] translate-y-[0.667px]" strokeWidth={2} />
 </div>
 
 <input
 ref={searchInputRef}
 value={query}
 onChange={(event) => {
 setQuery(event.target.value);
 setPage(1);
 }}
 placeholder={`Busca por ${segment.label.toLowerCase()}`}
 aria-label={`Buscar en ${segment.label}`}
 className={cn(
 "h-full w-[300px] bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70",
 (isSearchExpanded || query !== "") ? "opacity-100" : "opacity-0 pointer-events-none"
 )}
 />
 {query !== "" && (
 <button
 type="button"
 onClick={() => {
 setQuery("");
 searchInputRef.current?.focus();
 }}
 className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
 >
 <X className="h-3.5 w-3.5" strokeWidth={2.5} />
 </button>
 )}
 </div>

 <div
 className={cn(
 "flex shrink-0 items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
 (selectedIds.size > 0 || onlySelected)
 ? "max-w-[200px] opacity-100"
 : "max-w-0 opacity-0 pointer-events-none"
 )}
 >
 <button
 type="button"
 onClick={() => {
 setOnlySelected((value) => !value);
 setPage(1);
 }}
 className={cn(
 "flex h-9 whitespace-nowrap shrink-0 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors",
 onlySelected
 ? "border-primary/40 bg-primary/5 text-primary"
 : "border-border text-text-secondary hover:border-primary/30 hover:text-primary"
 )}
 >
 {onlySelected ? (
 <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
 ) : (
 <Eye className="h-3.5 w-3.5" strokeWidth={2} />
 )}
 {onlySelected ? "Ver todos" : `Ver seleccionados (${formatCount(selectedIds.size)})`}
 </button>
 </div>

 <TableConfigButton config={config} noun="filas" />

 <div className="flex shrink-0 items-center gap-2">
 <span className="text-[13px] font-medium text-muted-foreground">Ver por:</span>
 <Select value={segment.key} onValueChange={handleSegmentChange}>
 <SelectTrigger className="h-9 w-[160px] rounded-lg border-border bg-surface px-3 text-[13px] transition-colors hover:bg-border/30 focus:ring-2 focus:ring-primary/20">
 <SelectValue className="truncate text-text-primary" />
 </SelectTrigger>
 <SelectContent position="popper">
 {results.segments.map((s) => (
 <SelectItem key={s.key} value={s.key} className="text-[13px]">
 {s.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 <div className="overflow-hidden rounded-xl border border-border/60">
 {visibleRows.length === 0 ? (
 <div className="p-8">
 <EmptyState
 icon={Users}
 title={onlySelected ? "Aún no has seleccionado nada" : "Sin grupos que coincidan"}
 description={onlySelected ? "Vuelve a la lista completa para seleccionar grupos." : "Prueba con otro término o cambia los filtros."}
 className="border-none bg-transparent shadow-none"
 action={
 (!onlySelected && (query !== "" || areaFilter.size > 0 || leaderFilter.size > 0 || estadoFilter.size > 0)) ? (
 <Button
 variant="secondary"
 onClick={() => {
 setQuery("");
 setAreaFilter(new Set());
 setLeaderFilter(new Set());
 setEstadoFilter(new Set());
 setPage(1);
 setIsSearchExpanded(false);
 }}
 >
 Limpiar búsqueda y filtros
 </Button>
 ) : undefined
 }
 />
 </div>
 ) : (
 <div className="relative overflow-x-auto w-full">
 <Table>
 <TableHeader>
 <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
 <TableHead className="w-16 px-0">
 <SelectionHeaderMenu
 state={config.isLazy ? matchState : headerState}
 paged={!config.isLazy}
 pageCount={pagedRows.length}
 matchCount={visibleRows.length}
 showSelectPage={showSelectPage}
 showSelectAll={showSelectAll}
 showDeselectPage={showDeselectPage}
 showDeselectAll={showDeselectAll}
 onSelectPage={selectPage}
 onSelectAll={selectAllMatches}
 onDeselectPage={deselectPage}
 onDeselectAll={clearSelection}
 formatCount={formatCount}
 />
 </TableHead>
 <ConfigurableHeaderCells config={config} drag={drag} cells={cells} />
 </TableRow>
 </TableHeader>
 <TableBody>
 {shownRows.map((row) => (
 <TableRow
 key={row.id}
 data-state={selectedIds.has(row.id) ? "selected" : undefined}
 onClick={() => toggleOne(row.id)}
 className="group cursor-pointer border-border/60 transition-colors hover:bg-muted/30"
 >
 <TableCell className="px-0">
 <div className="flex items-center justify-center">
 <Checkbox
 checked={selectedIds.has(row.id)}
 onCheckedChange={() => toggleOne(row.id)}
 onClick={(event) => event.stopPropagation()}
 aria-label={`Seleccionar ${segment.perPerson ? "participante" : "grupo"} ${row.label}`}
 />
 </div>
 </TableCell>
 <ConfigurableRowCells config={config} cells={cells} row={row} />
 </TableRow>
 ))}
 <LazyRowsSentinel
 lazy={lazy}
 colSpan={config.columns.length + 1}
 noun={segment.perPerson ? "personas" : "grupos"}
 />
 </TableBody>
 </Table>
 </div>
 )}
 </div>

 <div className="flex flex-wrap items-center justify-between gap-3">
 {config.isLazy ? (
 <LazyRowsSummary
 lazy={lazy}
 total={visibleRows.length}
 noun={segment.perPerson ? "personas" : "grupos"}
 />
 ) : (
 <>
 <p className="text-[12px] text-muted-foreground">
 {visibleRows.length === 0
 ? "0 grupos"
 : `${formatCount(firstIndex + 1)}–${formatCount(firstIndex + pagedRows.length)} de ${formatCount(visibleRows.length)}`}
 </p>

 <div className="flex items-center gap-2">
 <Select
 value={String(pageSize)}
 onValueChange={(value) => {
 setPageSize(Number(value));
 setPage(1);
 }}
 >
 <SelectTrigger
 aria-label="Grupos por página"
 className="h-8 w-[130px] rounded-lg px-2.5 text-[12px]"
 >
 <SelectValue />
 </SelectTrigger>
 <SelectContent position="popper" sideOffset={6}>
 {PAGE_SIZES.map((size) => (
 <SelectItem key={size} value={String(size)} className="text-[13px]">
 {size} por página
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 <PagerButton
 label="Página anterior"
 disabled={currentPage <= 1}
 onClick={() => setPage(currentPage - 1)}
 >
 Anterior
 </PagerButton>
 <span className="text-[12px] tabular-nums text-text-secondary">
 {formatCount(currentPage)} / {formatCount(pageCount)}
 </span>
 <PagerButton
 label="Página siguiente"
 disabled={currentPage >= pageCount}
 onClick={() => setPage(currentPage + 1)}
 >
 Siguiente
 </PagerButton>
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}




/** Column header that toggles the sort, in the table's own header type scale. */
function formatCount(n: number) {
 return new Intl.NumberFormat("es-CO").format(n);
}

