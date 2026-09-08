import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback";
import {
  EstadoChip,
  InitialsAvatar,
  NivelChip,
  formatPercent,
  formatRelativeDate,
} from "@/components/ciclo-detail";
import { HeaderCell, SearchBox, TablePager, usePagedSlice } from "./tableBridge";
import { AvancePill, LifecycleBar, ParticipanteChip, RiskChip } from "./ResultsChips";
import { ResultsDetailCard } from "./ResultsDetailCard";
import type { CicloResults, PersonResultRow } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El padrón del ciclo.
 *
 * Aquí conviven los tres ejes de estado sin pisarse: el ciclo de vida de sus
 * objetivos como barra apilada, su estado de participante como etiqueta y su
 * nivel de desempeño como calificación. Son tres columnas porque son tres
 * preguntas distintas, y fundirlas en una sola "Estado" —como hace el reporte
 * actual— es lo que obliga a preguntar "¿estado de qué?".
 *
 * Una fila abre la ficha de esa persona: el mismo árbol de la pestaña de
 * cumplimiento, recortado a ella.
 */

type SortKey = "nombre" | "avance" | "objetivos" | "actualizacion";

interface ColaboradoresTabProps {
  results: CicloResults;
  rows: readonly PersonResultRow[];
  filters: ResultsFiltersState;
  /** Falso en un ciclo cerrado: el riesgo es un pronóstico y ya no hay. */
  showsRisk: boolean;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: ReadonlySet<string>) => void;
  onOpenPerson: (personId: string) => void;
}

export function ColaboradoresTab({
  rows,
  filters,
  showsRisk,
  selectedIds,
  onSelectionChange,
  onOpenPerson,
}: ColaboradoresTabProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "avance",
    desc: true,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const sorted = React.useMemo(() => {
    const factor = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort.key === "nombre")
        return factor * a.collaborator.name.localeCompare(b.collaborator.name, "es");
      if (sort.key === "objetivos") return factor * (a.entries.length - b.entries.length);
      if (sort.key === "actualizacion")
        return factor * ((a.lastUpdate?.date ?? "").localeCompare(b.lastUpdate?.date ?? ""));
      return factor * (a.percent - b.percent);
    });
  }, [rows, sort]);

  // `usePagedSlice` ya recorta la página a las que existen, así que filtrar
  // hasta dejar menos páginas no necesita corregir el estado: `current` es la
  // página real y es la que se pinta y se le pasa al paginador.
  const { paged, current } = usePagedSlice(sorted, page, pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((currentSort) =>
      currentSort.key === key
        ? { key, desc: !currentSort.desc }
        : { key, desc: key !== "nombre" }
    );

  const pageIds = paged.map((row) => row.person.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const togglePage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const controls = (
    <>
      <SearchBox
        value={filters.filters.search}
        onChange={filters.setSearch}
        placeholder="Buscar colaborador…"
      />
    </>
  );

  if (rows.length === 0) {
    return (
      <ResultsDetailCard
        title="Detalle por colaborador"
        count={0}
        controls={controls}
      >
        <div className="rounded-xl border border-border/60 p-8">
          <EmptyState
            title="Ninguna persona cumple con los filtros"
            description="Ajusta los filtros para volver a ver colaboradores del ciclo."
            className="border-none bg-transparent shadow-none"
          />
        </div>
      </ResultsDetailCard>
    );
  }

  return (
    <ResultsDetailCard
      title="Detalle por colaborador"
      count={rows.length}
      controls={controls}
    >
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table className="min-w-[62rem]">
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <HeaderCell className="w-10 pl-4">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePage}
                  aria-label="Seleccionar la página"
                />
              </HeaderCell>
              <SortableHeader
                label="Colaborador"
                active={sort.key === "nombre"}
                desc={sort.desc}
                onClick={() => toggleSort("nombre")}
              />
              <HeaderCell>Líder</HeaderCell>
              <HeaderCell>Asignación</HeaderCell>
              <SortableHeader
                label="Objetivos"
                active={sort.key === "objetivos"}
                desc={sort.desc}
                onClick={() => toggleSort("objetivos")}
                className="w-[9rem]"
              />
              <SortableHeader
                label="Avance"
                active={sort.key === "avance"}
                desc={sort.desc}
                onClick={() => toggleSort("avance")}
                className="w-[7rem]"
              />
              <HeaderCell>Estado</HeaderCell>
              <HeaderCell>Participante</HeaderCell>
              <HeaderCell>Desempeño</HeaderCell>
              <SortableHeader
                label="Última actualización"
                active={sort.key === "actualizacion"}
                desc={sort.desc}
                onClick={() => toggleSort("actualizacion")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => {
              const selected = selectedIds.has(row.person.id);
              return (
                <TableRow
                  key={row.person.id}
                  data-state={selected ? "selected" : undefined}
                  onClick={() => onOpenPerson(row.person.id)}
                  className={cn(
                    "cursor-pointer border-b border-border/40 transition-colors",
                    !row.counts && "opacity-70"
                  )}
                >
                  <TableCell className="pl-4" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleRow(row.person.id)}
                      aria-label={`Seleccionar a ${row.collaborator.name}`}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={row.collaborator.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-text-primary">
                          {row.collaborator.name}
                        </p>
                        <p className="truncate text-[11.5px] text-text-muted">{row.area}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 text-[12.5px] text-text-secondary">
                    {row.leader}
                  </TableCell>
                  <TableCell className="px-3 text-[12.5px] text-text-secondary">
                    {row.groupLabel}
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-[12.5px] font-bold tabular-nums text-text-primary">
                        {row.entries.length}
                      </span>
                      <LifecycleBar counts={row.lifecycleCounts} width="w-16" />
                    </div>
                  </TableCell>
                  <TableCell className="px-3">
                    <AvancePill percent={row.percent} estado={row.estado} labeled={false} />
                  </TableCell>
                  <TableCell className="px-3">
                    <EstadoChip estado={row.estado} size="sm" />
                  </TableCell>
                  <TableCell className="px-3">
                    <ParticipanteChip estado={row.estadoParticipante} />
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex flex-col gap-1">
                      <NivelChip nivel={row.nivel} />
                      {showsRisk && <RiskChip risk={row.risk} />}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 text-[12.5px] text-text-secondary">
                    {row.lastUpdate ? formatRelativeDate(row.lastUpdate.date) : "Sin reportes"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          Promedio de los mostrados:{" "}
          <span className="font-semibold tabular-nums text-text-primary">
            {formatPercent(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length)}
          </span>
        </p>
        <TablePager
          total={sorted.length}
          page={current}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          noun="colaboradores"
        />
      </div>
    </ResultsDetailCard>
  );
}

function SortableHeader({
  label,
  active,
  desc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <HeaderCell className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
        title={active ? (desc ? "De mayor a menor" : "De menor a mayor") : `Ordenar por ${label}`}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-text-primary",
          active && "text-text-primary"
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3 transition-all",
            active ? "opacity-100" : "opacity-40",
            active && !desc && "-scale-y-100"
          )}
          strokeWidth={2.4}
        />
      </button>
    </HeaderCell>
  );
}
