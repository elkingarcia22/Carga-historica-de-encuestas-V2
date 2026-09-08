import * as React from "react";
import { Eye, EyeOff, ListChecks } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSortHeader, SelectionHeaderMenu, SortOnlyHeader } from "@/components/data-display";
import { EmptyState } from "@/components/feedback";
import type { CicloStatus, Objective } from "@/components/ciclo-builder";
import type {
  NivelDesempenoConfig,
  ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import {
  estadosForStatus,
  formatRelativeDate,
  objectiveCompliance,
  resolveEstado,
  type PersonRow,
} from "./cicloProgress";
import { ComplianceBar, EstadoChip, InitialsAvatar, NivelChip } from "./StatusChips";
import { PersonObjectivesList } from "./ObjectiveProgressList";
import { ExpandButton, HeaderCell, SearchBox, TablePager } from "./tablePieces";
import { formatCount, usePagedSlice } from "./tableUtils";

type SortKey = "nombre" | "grupo" | "objetivos" | "avance" | "ultima";

interface CicloPeopleTableProps {
  rows: readonly PersonRow[];
  cicloStatus: CicloStatus;
  estados: readonly ObjetivoEstadoConfig[];
  niveles: readonly NivelDesempenoConfig[];
  allowNegative: boolean;
  companyObjectives: readonly Objective[];
  groupOptions: readonly string[];
  groupFilter: ReadonlySet<string>;
  onGroupFilterChange: (next: ReadonlySet<string>) => void;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: ReadonlySet<string>) => void;
  onOpenObjective: (personId: string, objectiveId: string) => void;
}

const toggleIn = (set: ReadonlySet<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

/**
 * "Por colaboradores": una fila por persona, con su avance ponderado, el
 * estado y el nivel que le corresponden, y quién la actualizó por última vez.
 * La fila se abre y muestra sus objetivos uno a uno; desde ahí se actualiza.
 */
export function CicloPeopleTable({
  rows,
  cicloStatus,
  estados,
  niveles,
  allowNegative,
  companyObjectives,
  groupOptions,
  groupFilter,
  onGroupFilterChange,
  selectedIds,
  onSelectionChange,
  onOpenObjective,
}: CicloPeopleTableProps) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("nombre");
  const [sortAscending, setSortAscending] = React.useState(true);
  const [estadoFilter, setEstadoFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const [nivelFilter, setNivelFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const [onlySelected, setOnlySelected] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const resetPage = () => setPage(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAscending((value) => !value);
    else {
      setSortKey(key);
      setSortAscending(true);
    }
  };

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const compare = (a: PersonRow, b: PersonRow): number => {
      switch (sortKey) {
        case "nombre":
          return a.person.collaborator.name.localeCompare(b.person.collaborator.name);
        case "grupo":
          return a.groupLabel.localeCompare(b.groupLabel);
        case "objetivos":
          return a.person.objectives.length - b.person.objectives.length;
        case "avance":
          return a.percent - b.percent;
        case "ultima":
          return (a.lastUpdate?.date ?? "").localeCompare(b.lastUpdate?.date ?? "");
      }
    };
    return rows
      .filter((row) => {
        if (onlySelected && !selectedIds.has(row.person.id)) return false;
        if (groupFilter.size > 0 && !groupFilter.has(row.groupLabel)) return false;
        if (estadoFilter.size > 0 && !estadoFilter.has(row.estado?.nombre ?? "")) return false;
        if (nivelFilter.size > 0 && !nivelFilter.has(row.nivel?.nombre ?? "")) return false;
        if (query === "") return true;
        const { name, email, area } = row.person.collaborator;
        return (
          name.toLowerCase().includes(query) ||
          email.toLowerCase().includes(query) ||
          area.toLowerCase().includes(query) ||
          row.groupLabel.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (sortAscending ? compare(a, b) : -compare(a, b)));
  }, [rows, search, sortKey, sortAscending, estadoFilter, nivelFilter, groupFilter, onlySelected, selectedIds]);

  const { paged, current } = usePagedSlice(filtered, page, pageSize);

  const estadoOptions = React.useMemo(
    () => estadosForStatus(estados, cicloStatus).map((estado) => estado.nombre),
    [estados, cicloStatus]
  );
  const nivelOptions = React.useMemo(() => niveles.map((nivel) => nivel.nombre), [niveles]);

  const hasFilters =
    search !== "" || estadoFilter.size > 0 || nivelFilter.size > 0 || groupFilter.size > 0;
  const clearFilters = () => {
    setSearch("");
    setEstadoFilter(new Set());
    setNivelFilter(new Set());
    onGroupFilterChange(new Set());
    resetPage();
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedIds.has(row.person.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-text-primary">Colaboradores del ciclo</h3>
          <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
            {formatCount(filtered.length)}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {groupFilter.size > 0 && (
            <button
              type="button"
              onClick={() => {
                onGroupFilterChange(new Set());
                resetPage();
              }}
              className="flex h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {[...groupFilter].join(", ")}
              <span aria-hidden className="text-primary/70">×</span>
            </button>
          )}
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="Buscar colaborador…"
          />
          <div
            className={cn(
              "flex shrink-0 items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              selectedIds.size > 0 || onlySelected ? "max-w-[240px] opacity-100" : "pointer-events-none max-w-0 opacity-0"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setOnlySelected((value) => !value);
                resetPage();
              }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition-colors",
                onlySelected
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-text-secondary hover:border-primary/30 hover:text-primary"
              )}
            >
              {onlySelected ? <EyeOff className="size-3.5" strokeWidth={2} /> : <Eye className="size-3.5" strokeWidth={2} />}
              {onlySelected ? "Ver todos" : `Ver seleccionados (${formatCount(selectedIds.size)})`}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ListChecks}
              title={onlySelected ? "Aún no has seleccionado nada" : "Sin colaboradores que coincidan"}
              description={
                onlySelected
                  ? "Vuelve a la lista completa para seleccionar colaboradores."
                  : "Prueba con otro término de búsqueda o limpia los filtros."
              }
              className="border-none bg-transparent shadow-none"
              action={
                !onlySelected && hasFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar búsqueda y filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[52px] py-3 pl-5 pr-3">
                    <SelectionHeaderMenu
                      state={allFilteredSelected ? true : selectedIds.size > 0 ? "indeterminate" : false}
                      pageCount={paged.length}
                      matchCount={filtered.length}
                      showSelectPage={paged.length > 0 && !paged.every((row) => selectedIds.has(row.person.id))}
                      showSelectAll={filtered.length > 0 && !allFilteredSelected}
                      showDeselectPage={paged.some((row) => selectedIds.has(row.person.id))}
                      showDeselectAll={selectedIds.size > 0}
                      onSelectPage={() =>
                        onSelectionChange(new Set([...selectedIds, ...paged.map((row) => row.person.id)]))
                      }
                      onSelectAll={() =>
                        onSelectionChange(new Set([...selectedIds, ...filtered.map((row) => row.person.id)]))
                      }
                      onDeselectPage={() => {
                        const pageIds = new Set(paged.map((row) => row.person.id));
                        onSelectionChange(new Set([...selectedIds].filter((id) => !pageIds.has(id))));
                      }}
                      onDeselectAll={() => onSelectionChange(new Set())}
                      formatCount={formatCount}
                      align="start"
                    />
                  </TableHead>
                  <HeaderCell className="min-w-[220px]">
                    <SortOnlyHeader label="Colaborador" sortActive={sortKey === "nombre"} onSort={() => toggleSort("nombre")} />
                  </HeaderCell>
                  <HeaderCell>
                    <FilterSortHeader
                      label="Grupo"
                      options={groupOptions}
                      selected={groupFilter}
                      onToggleFilter={(value) => {
                        onGroupFilterChange(toggleIn(groupFilter, value));
                        resetPage();
                      }}
                      onClearFilter={() => {
                        onGroupFilterChange(new Set());
                        resetPage();
                      }}
                      sortActive={sortKey === "grupo"}
                      onSort={() => toggleSort("grupo")}
                    />
                  </HeaderCell>
                  <HeaderCell className="text-right">
                    <SortOnlyHeader label="Objetivos" sortActive={sortKey === "objetivos"} onSort={() => toggleSort("objetivos")} align="right" />
                  </HeaderCell>
                  <HeaderCell className="min-w-[150px]">
                    <SortOnlyHeader label="Avance" sortActive={sortKey === "avance"} onSort={() => toggleSort("avance")} />
                  </HeaderCell>
                  <HeaderCell>
                    <FilterSortHeader
                      label="Estado"
                      options={estadoOptions}
                      selected={estadoFilter}
                      onToggleFilter={(value) => {
                        setEstadoFilter((current) => toggleIn(current, value));
                        resetPage();
                      }}
                      onClearFilter={() => {
                        setEstadoFilter(new Set());
                        resetPage();
                      }}
                      sortActive={sortKey === "avance"}
                      onSort={() => toggleSort("avance")}
                    />
                  </HeaderCell>
                  <HeaderCell>
                    <FilterSortHeader
                      label="Nivel"
                      options={nivelOptions}
                      selected={nivelFilter}
                      onToggleFilter={(value) => {
                        setNivelFilter((current) => toggleIn(current, value));
                        resetPage();
                      }}
                      onClearFilter={() => {
                        setNivelFilter(new Set());
                        resetPage();
                      }}
                      sortActive={sortKey === "avance"}
                      onSort={() => toggleSort("avance")}
                    />
                  </HeaderCell>
                  <HeaderCell>
                    <SortOnlyHeader label="Actualizado" sortActive={sortKey === "ultima"} onSort={() => toggleSort("ultima")} />
                  </HeaderCell>
                  <HeaderCell className="w-[64px] pr-5 text-right">
                    <span className="sr-only">Detalle</span>
                  </HeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => {
                  const id = row.person.id;
                  const isExpanded = expandedIds.has(id);
                  const isSelected = selectedIds.has(id);
                  return (
                    <React.Fragment key={id}>
                      <TableRow
                        data-state={isSelected ? "selected" : undefined}
                        onClick={() => setExpandedIds((current) => toggleIn(current, id))}
                        className={cn(
                          "cursor-pointer border-border/60 transition-colors hover:bg-muted/30",
                          isExpanded && "bg-primary/[0.03] hover:bg-primary/[0.04]"
                        )}
                      >
                        <TableCell className="py-3 pl-5 pr-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onSelectionChange(toggleIn(selectedIds, id))}
                            aria-label={`Seleccionar a ${row.person.collaborator.name}`}
                          />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <InitialsAvatar name={row.person.collaborator.name} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-[13px] font-bold text-text-primary">
                                {row.person.collaborator.name}
                              </span>
                              <span className="truncate text-[11.5px] text-text-muted" title={row.person.collaborator.email}>
                                {row.person.collaborator.area}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge
                            variant="neutral"
                            className={cn(
                              "h-6 max-w-[150px] truncate px-2.5 text-[11px] font-semibold",
                              row.person.groupId === null && "border-dashed"
                            )}
                            title={row.groupLabel}
                          >
                            {row.groupLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <span className="flex flex-col items-end leading-tight">
                            <span className="text-[13px] font-semibold tabular-nums text-text-primary">
                              {row.person.objectives.length}
                            </span>
                            <span className="whitespace-nowrap text-[10.5px] tabular-nums text-text-muted">
                              {row.reportedCount} con avance
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <ComplianceBar percent={row.percent} estado={row.estado} />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <EstadoChip estado={row.estado} />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <NivelChip nivel={row.nivel} />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {row.lastUpdate ? (
                            <span className="flex min-w-0 flex-col leading-tight" title={`por ${row.lastUpdate.authorName}`}>
                              <span className="whitespace-nowrap text-[12.5px] font-medium text-text-primary">
                                {formatRelativeDate(row.lastUpdate.date)}
                              </span>
                              <span className="max-w-[140px] truncate text-[10.5px] text-text-muted">
                                {row.lastUpdate.authorName}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-text-muted">Sin registros</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 pl-3 pr-5 text-right">
                          <ExpandButton
                            expanded={isExpanded}
                            onClick={() => setExpandedIds((current) => toggleIn(current, id))}
                            label={isExpanded ? "Ocultar objetivos" : "Ver objetivos"}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="border-border/60 bg-surface-muted/30 hover:bg-surface-muted/30">
                          <TableCell colSpan={9} className="p-0">
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-x-auto px-4 pb-4 pt-3"
                            >
                              <PersonObjectivesList
                                items={row.person.objectives.map((tracked) => {
                                  const percent = objectiveCompliance(tracked, allowNegative);
                                  return { tracked, percent, estado: resolveEstado(estados, percent, cicloStatus) };
                                })}
                                companyObjectives={companyObjectives}
                                cicloStatus={cicloStatus}
                                onOpen={(objectiveId) => onOpenObjective(id, objectiveId)}
                              />
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TablePager
        total={filtered.length}
        page={current}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          resetPage();
        }}
        noun="colaboradores"
      />
    </div>
  );
}
