import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { average, formatPercent, resolveEstado } from "@/components/ciclo-detail";
import { getEstadoBadgeConfig } from "@/components/objetivos/objetivosConfigStore";
import { EmptyState } from "@/components/feedback";
import { AvancePill } from "./ResultsChips";
import type { CicloResults, ResultEntry, ResultsConfig } from "./resultsModel";

/**
 * Áreas por objetivo de empresa, como cuadro.
 *
 * Misma construcción que el heatmap del reporte de encuestas: primera columna
 * pegada con el nombre y el total, y a la derecha un campo de tiles del mismo
 * alto, separadas solo por una rendija de 1,5 px. Las celdas pintan la banda de
 * resultado de ese cruce; las que no tienen objetivos alineados ahí van en
 * gris con un guion, porque decir "0 %" sería acusar a un área de un
 * incumplimiento que no existe.
 */

export type HeatmapRowBy = "area" | "grupo";

interface ResultsHeatmapProps {
  results: CicloResults;
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  rowBy: HeatmapRowBy;
}

interface Cell {
  percent: number | null;
  count: number;
  people: number;
}

/** La rendija entre dos tiles: el único espacio que hay en el campo de color. */
const CELL_GUTTER = "p-[1.5px]";
const TILE = "h-9 rounded-[5px]";

export function ResultsHeatmap({ results, entries, config, rowBy }: ResultsHeatmapProps) {
  const model = React.useMemo(() => {
    const companyById = new Map(
      results.data.companyObjectives.map((objective) => [objective.id, objective])
    );
    const columns = results.data.companyObjectives.filter((objective) =>
      entries.some((entry) => entry.objective.alignedTo === objective.id)
    );
    const unaligned = entries.filter(
      (entry) => !entry.objective.alignedTo || !companyById.has(entry.objective.alignedTo)
    );

    const rowKeyOf = (entry: ResultEntry) =>
      rowBy === "area" ? entry.person.collaborator.area : entry.person.groupId ?? "Individual";

    const rows = [...new Set(entries.map(rowKeyOf))].sort((a, b) => a.localeCompare(b, "es"));

    const cellOf = (rowEntries: readonly ResultEntry[]): Cell => ({
      percent: rowEntries.length === 0 ? null : average(rowEntries.map((entry) => entry.percent)),
      count: rowEntries.length,
      people: new Set(rowEntries.map((entry) => entry.personId)).size,
    });

    const grid = new Map<string, Cell>();
    rows.forEach((row) => {
      const rowEntries = entries.filter((entry) => rowKeyOf(entry) === row);
      columns.forEach((column) => {
        grid.set(
          `${row}::${column.id}`,
          cellOf(rowEntries.filter((entry) => entry.objective.alignedTo === column.id))
        );
      });
      if (unaligned.length > 0) {
        grid.set(`${row}::__sin__`, cellOf(rowEntries.filter((entry) => unaligned.includes(entry))));
      }
      grid.set(`${row}::__total__`, cellOf(rowEntries));
    });

    const columnTotals = new Map(
      columns.map((column) => [
        column.id,
        average(
          entries.filter((entry) => entry.objective.alignedTo === column.id).map((e) => e.percent)
        ),
      ])
    );

    return { columns, rows, grid, columnTotals, hasUnaligned: unaligned.length > 0 };
  }, [results, entries, rowBy]);

  if (model.columns.length === 0 || model.rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 p-8">
        <EmptyState
          title="No hay cuadro que dibujar"
          description="El cuadro cruza áreas con objetivos de empresa. Este ciclo no tiene objetivos de empresa con objetivos alineados a ellos."
          className="border-none bg-transparent shadow-none"
        />
      </div>
    );
  }

  const rowLabel = rowBy === "area" ? "Área" : "Asignación";

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table className="w-full min-w-[56rem]">
        <TableHeader>
          <TableRow className="border-b border-border/60 hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-[240px] min-w-[240px] border-r border-border/60 bg-muted-solid py-3 pl-7 pr-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {rowLabel}
            </TableHead>
            <TableHead className="w-[110px] border-r border-border/60 bg-muted-solid py-3 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center justify-end gap-1">
                Total
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/70 hover:text-text-primary">
                      <Info className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-[12px] leading-relaxed">
                    Promedio del cumplimiento de todos los objetivos de la fila, contando también
                    los que no se alinearon a ningún objetivo de empresa.
                  </TooltipContent>
                </Tooltip>
              </span>
            </TableHead>
            {model.columns.map((column) => (
              <TableHead
                key={column.id}
                className="min-w-[120px] py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate">{column.title || "Objetivo sin nombre"}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-[12px]">
                    {column.title}
                    <span className="font-semibold">
                      {" "}
                      · total {formatPercent(model.columnTotals.get(column.id) ?? 0)}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            ))}
            {model.hasUnaligned && (
              <TableHead className="min-w-[120px] py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="block truncate">Sin objetivo de empresa</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.rows.map((row) => {
            const total = model.grid.get(`${row}::__total__`);
            const totalEstado =
              total?.percent === null || total === undefined
                ? null
                : resolveEstado(config.estados, total.percent, results.data.status);
            return (
              <TableRow key={row} className="group border-transparent transition-colors hover:bg-muted/30">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[240px] min-w-[240px] border-r border-border/60 bg-surface py-[3px] pl-7 pr-4 text-left align-middle"
                >
                  <div className="flex h-9 items-center">
                    <span className="truncate text-[13px] font-semibold text-text-primary">{row}</span>
                  </div>
                </th>
                <td
                  className="border-r border-border/60 bg-surface px-3 py-[3px] text-right align-middle"
                  style={{ borderBottomColor: "var(--color-surface)" }}
                >
                  <div className="flex h-9 items-center justify-end">
                    {total && total.percent !== null ? (
                      <AvancePill percent={total.percent} estado={totalEstado} labeled={false} />
                    ) : (
                      <span className="text-[12px] text-muted-foreground/50">—</span>
                    )}
                  </div>
                </td>
                {model.columns.map((column) => (
                  <HeatTile
                    key={column.id}
                    cell={model.grid.get(`${row}::${column.id}`)}
                    config={config}
                    status={results.data.status}
                    rowLabel={row}
                    columnLabel={column.title}
                  />
                ))}
                {model.hasUnaligned && (
                  <HeatTile
                    cell={model.grid.get(`${row}::__sin__`)}
                    config={config}
                    status={results.data.status}
                    rowLabel={row}
                    columnLabel="Sin objetivo de empresa"
                  />
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function HeatTile({
  cell,
  config,
  status,
  rowLabel,
  columnLabel,
}: {
  cell: Cell | undefined;
  config: ResultsConfig;
  status: CicloResults["data"]["status"];
  rowLabel: string;
  columnLabel: string;
}) {
  const empty = !cell || cell.percent === null;
  const estado = empty ? null : resolveEstado(config.estados, cell.percent as number, status);
  const badge = estado ? getEstadoBadgeConfig(estado) : null;

  return (
    <TableCell className={cn(CELL_GUTTER, "align-middle")}>
      <Tooltip>
        <TooltipTrigger asChild>
          {empty ? (
            <div
              className={cn(
                "flex w-full items-center justify-center bg-muted/30 text-muted-foreground/50",
                TILE
              )}
            >
              <span className="text-[11px]">—</span>
            </div>
          ) : (
            <div
              className={cn(
                "relative flex w-full items-center justify-center border font-extrabold tabular-nums text-[12px] transition-transform hover:z-10 hover:scale-[1.04]",
                TILE,
                badge?.bg ?? "bg-muted",
                badge?.text ?? "text-text-secondary",
                badge?.border ?? "border-border/60"
              )}
            >
              {formatPercent(cell.percent as number)}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="flex w-[240px] flex-col gap-2 text-[12px] leading-relaxed">
          <div className="flex items-center gap-1.5">
            {empty ? (
              <>
                <span className="text-background/70">—</span>
                <span className="font-semibold">Sin objetivos alineados</span>
              </>
            ) : (
              <>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: estado?.colorHex }}
                />
                <span className="font-semibold">{estado?.nombre ?? "Sin estado"}</span>
              </>
            )}
          </div>
          <p className="text-background/70">
            {rowLabel} · {columnLabel}
          </p>
          {!empty && (
            <dl className="flex w-full flex-col gap-1 border-t border-background/25 pt-2">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[11px] font-medium text-background/70">Objetivos</dt>
                <dd className="font-semibold tabular-nums text-background">{cell.count}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[11px] font-medium text-background/70">Personas</dt>
                <dd className="font-semibold tabular-nums text-background">{cell.people}</dd>
              </div>
            </dl>
          )}
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}
