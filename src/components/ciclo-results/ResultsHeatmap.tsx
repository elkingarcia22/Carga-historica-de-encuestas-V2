import * as React from "react";
import { ChevronDown, ChevronRight, Grid2X2, ListFilter, ListTree, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { average, formatPercent, resolveEstado } from "@/components/ciclo-detail";
import { EmptyState } from "@/components/feedback";
import { ScaleToggle } from "@/components/survey-results/ScaleToggle";
import {
  DEEP_POSITIVE,
  DEEP_POSITIVE_BG,
  DEEP_POSITIVE_BORDER,
  DEEP_POSITIVE_TEXT,
  NEGATIVE,
  NEGATIVE_BG,
  NEGATIVE_BORDER,
  NEGATIVE_TEXT,
  POSITIVE,
  POSITIVE_BG,
  POSITIVE_BORDER,
  POSITIVE_TEXT,
  SOFTER_NEGATIVE,
  SOFTER_NEGATIVE_BG,
  SOFTER_NEGATIVE_BORDER,
  SOFTER_NEGATIVE_TEXT,
  YELLOW,
  YELLOW_BG,
  YELLOW_BORDER,
  YELLOW_TEXT,
  type ScaleLegendItem,
} from "@/components/survey-results/favorabilityScale";
import { AvancePill } from "./ResultsChips";
import { BREAKDOWN_META, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import type { CicloResults, ResultEntry, ResultsConfig } from "./resultsModel";

/**
 * El heatmap del ciclo: los objetivos en las filas, el corte en las columnas.
 *
 * Es la misma pieza que el heatmap del reporte de encuestas —ahí las filas son
 * secciones y preguntas, aquí objetivos de empresa y sus objetivos— y por eso
 * comparte su chrome: primera columna pegada con el árbol y su total, un campo
 * de tiles del mismo alto separadas por una rendija, el botón de escala y el
 * de "Personalizar". Dos productos de la misma casa leyendo una matriz de la
 * misma forma es lo que hace que no haya que aprenderla dos veces.
 *
 * Estaba al revés —las áreas en las filas y los objetivos de empresa en las
 * columnas— y eso lo rompía por dos lados: no se podía abrir un objetivo de
 * empresa para ver los suyos, y al cambiar el "Ver por" cambiaban las filas en
 * vez de las columnas, que es lo que un corte hace en una matriz.
 */

/** La rendija entre dos tiles: el único espacio que hay en el campo de color. */
const CELL_GUTTER = "p-[1.5px]";
const TILE = "h-9 rounded-[5px]";

/** Sin objetivo de empresa al que colgarse, un objetivo va a su propia rama. */
const UNALIGNED_ID = "__sin-alineacion__";

interface ResultsHeatmapProps {
  results: CicloResults;
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  /** El corte elegido arriba: es lo que arma las columnas. */
  columnBy: BreakdownKey;
  /**
   * Los ajustes de presentación viven en el padre porque su control vive en la
   * cabecera de la tarjeta, junto al switch Árbol/Heatmap —igual que en
   * encuestas—. La rejilla solo los obedece.
   */
  hiddenLevels: ReadonlySet<HeatmapLevel>;
  dimmedBands: ReadonlySet<string>;
}

/** Los dos niveles que el heatmap puede mostrar, cada uno apagable por su cuenta. */
export type HeatmapLevel = "empresa" | "objetivo";

const LEVEL_OPTIONS: readonly { id: HeatmapLevel; label: string }[] = [
  { id: "empresa", label: "Objetivos de empresa" },
  { id: "objetivo", label: "Objetivos" },
];

interface HeatRow {
  id: string;
  level: HeatmapLevel;
  title: string;
  subtitle: string;
  entries: readonly ResultEntry[];
  children: readonly HeatRow[];
}

interface Cell {
  percent: number | null;
  count: number;
  people: number;
}

const cellOf = (rowEntries: readonly ResultEntry[]): Cell => ({
  percent: rowEntries.length === 0 ? null : average(rowEntries.map((entry) => entry.percent)),
  count: rowEntries.length,
  people: new Set(rowEntries.map((entry) => entry.personId)).size,
});

/**
 * La escala de calor: la misma paleta con la que encuestas pinta su heatmap.
 *
 * Las bandas configuradas NO sirven para esto y el intento anterior lo probó:
 * son una clasificación, no una magnitud. "En progreso" va de 1 a 69 %, así
 * que a mitad de ciclo TODOS los promedios de área caen en ella y la rejilla
 * entera salía del mismo amarillo. Un mapa de calor donde nada contrasta no es
 * un mapa de calor.
 *
 * Lo que cambió es de dónde sale el color. Antes se interpolaba un rojo→verde
 * literal y saturado, y el campo quedaba a gritos: con el relleno al 42 % el
 * número que va encima compite con su propia celda y una fila baja se lee como
 * una alarma antes que como un dato. El reporte de encuestas ya resolvió eso
 * mismo en su heatmap —relleno pálido, texto hondo del mismo tono y un filo de
 * un pixel— y sus tokens `--fav-*` ya viven en este proyecto, así que aquí se
 * leen los mismos en vez de inventar una segunda escala de color para la misma
 * lectura. De paso el modo oscuro sale gratis: los tokens se re-afinan solos
 * en `.dark`, cosa que un rgb literal nunca hizo.
 *
 * Los cortes siguen siendo los del producto —50 y 80, los mismos de
 * `shareColor`, del dial de participación y de la columna "% Avance"—; lo que
 * se agregó es un escalón dentro de cada extremo, para que un 12 % y un 46 %
 * —los dos "bajos"— tampoco se vean iguales. Por eso son cinco bandas y no
 * tres: ninguna cruza un corte del producto, solo lo subdivide.
 *
 * Las bandas configuradas del ciclo siguen mandando donde sí clasifican: el
 * nombre del estado en el tooltip, el chip del total y el reparto de la
 * tarjeta de arriba.
 */
export interface HeatBand {
  id: string;
  label: string;
  /** El tramo como lo dice la leyenda, p. ej. "50 a 79 %". */
  range: string;
  /** Tope de la banda, exclusivo. La última se queda con todo lo de arriba. */
  max: number;
  /** Relleno sólido: el punto del tooltip y la casilla del resaltado. */
  color: string;
  /** Relleno pálido de la celda. */
  background: string;
  /** El filo que le devuelve la forma a un pastel. */
  border: string;
  /** Texto que se mantiene legible sobre `background`. */
  foreground: string;
}

export const HEAT_BANDS: readonly HeatBand[] = [
  {
    id: "muy-bajo",
    label: "Avance muy bajo",
    range: "menos de 25 %",
    max: 25,
    color: NEGATIVE,
    background: NEGATIVE_BG,
    border: NEGATIVE_BORDER,
    foreground: NEGATIVE_TEXT,
  },
  {
    id: "bajo",
    label: "Avance bajo",
    range: "25 a 49 %",
    max: 50,
    color: SOFTER_NEGATIVE,
    background: SOFTER_NEGATIVE_BG,
    border: SOFTER_NEGATIVE_BORDER,
    foreground: SOFTER_NEGATIVE_TEXT,
  },
  {
    id: "medio",
    label: "Avance medio",
    range: "50 a 79 %",
    max: 80,
    color: YELLOW,
    background: YELLOW_BG,
    border: YELLOW_BORDER,
    foreground: YELLOW_TEXT,
  },
  {
    id: "alto",
    label: "Avance alto",
    range: "80 a 94 %",
    max: 95,
    color: POSITIVE,
    background: POSITIVE_BG,
    border: POSITIVE_BORDER,
    foreground: POSITIVE_TEXT,
  },
  {
    id: "en-meta",
    label: "En meta",
    range: "95 % o más",
    max: Infinity,
    color: DEEP_POSITIVE,
    background: DEEP_POSITIVE_BG,
    border: DEEP_POSITIVE_BORDER,
    foreground: DEEP_POSITIVE_TEXT,
  },
];

/** La banda en la que cae un avance. */
const bandOf = (percent: number): HeatBand =>
  HEAT_BANDS.find((band) => percent < band.max) ?? HEAT_BANDS[HEAT_BANDS.length - 1];

/** La escala de calor como leyenda del botón de escala. */
export function heatScaleLegend(): ScaleLegendItem[] {
  return HEAT_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    range: band.range,
    color: band.color,
    background: band.background,
    border: band.border,
    foreground: band.foreground,
  }));
}

export function ResultsHeatmap({
  results,
  entries,
  config,
  columnBy,
  hiddenLevels,
  dimmedBands,
}: ResultsHeatmapProps) {
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set());

  const model = React.useMemo(() => {
    const companyById = new Map(
      results.data.companyObjectives.map((objective) => [objective.id, objective])
    );

    const columnKeyOf = (entry: ResultEntry) =>
      breakdownValueOf(
        { collaborator: entry.person.collaborator, groupId: entry.person.groupId },
        columnBy
      );
    const columns = [...new Set(entries.map(columnKeyOf))].sort((a, b) => a.localeCompare(b, "es"));

    // Filas: un objetivo de empresa por rama, y sus objetivos colgando. La
    // rama de huérfanos va al final porque es la excepción, no una más.
    const byCompany = new Map<string, ResultEntry[]>();
    entries.forEach((entry) => {
      const aligned = entry.objective.alignedTo;
      const key = aligned && companyById.has(aligned) ? aligned : UNALIGNED_ID;
      const bucket = byCompany.get(key);
      if (bucket) bucket.push(entry);
      else byCompany.set(key, [entry]);
    });
    const order = [...results.data.companyObjectives.map((objective) => objective.id), UNALIGNED_ID];

    const rows: HeatRow[] = order
      .filter((companyId) => (byCompany.get(companyId)?.length ?? 0) > 0)
      .map((companyId) => {
        const companyEntries = byCompany.get(companyId) ?? [];
        const byObjective = new Map<string, ResultEntry[]>();
        companyEntries.forEach((entry) => {
          const bucket = byObjective.get(entry.objective.id);
          if (bucket) bucket.push(entry);
          else byObjective.set(entry.objective.id, [entry]);
        });
        return {
          id: companyId,
          level: "empresa" as const,
          title: companyById.get(companyId)?.title ?? "Sin objetivo de empresa",
          subtitle: `${byObjective.size} ${byObjective.size === 1 ? "objetivo" : "objetivos"}`,
          entries: companyEntries,
          children: [...byObjective.entries()].map(([objectiveId, objectiveEntries]) => ({
            id: `${companyId}::${objectiveId}`,
            level: "objetivo" as const,
            title: objectiveEntries[0].objective.title || "Objetivo sin nombre",
            subtitle: `Peso ${objectiveEntries[0].objective.weight} %`,
            entries: objectiveEntries,
            children: [],
          })),
        };
      });

    // La rejilla entera de una vez: recorrer las entradas por celda al pintar
    // sería O(filas × columnas × entradas) en cada render.
    const grid = new Map<string, Cell>();
    const walk = (row: HeatRow) => {
      const byColumn = new Map<string, ResultEntry[]>();
      row.entries.forEach((entry) => {
        const key = columnKeyOf(entry);
        const bucket = byColumn.get(key);
        if (bucket) bucket.push(entry);
        else byColumn.set(key, [entry]);
      });
      columns.forEach((column) => grid.set(`${row.id}::${column}`, cellOf(byColumn.get(column) ?? [])));
      grid.set(`${row.id}::__total__`, cellOf(row.entries));
      row.children.forEach(walk);
    };
    rows.forEach(walk);

    return { columns, rows, grid };
  }, [results, entries, columnBy]);

  /*
   * La primera rama abre sola: aterrizar en una rejilla de filas cerradas —
   * un objetivo de empresa por línea, sin un solo objetivo a la vista— obliga
   * a un clic antes de poder leer nada. Solo una vez: `autoExpanded` evita que
   * cada recorte de "Ver por" o de filtros vuelva a forzarla abierta después
   * de que alguien ya la cerró a propósito.
   */
  const autoExpanded = React.useRef(false);
  React.useEffect(() => {
    if (autoExpanded.current) return;
    const first = model.rows[0];
    if (!first) return;
    autoExpanded.current = true;
    setExpanded((current) => new Set(current).add(first.id));
  }, [model.rows]);

  const meta = BREAKDOWN_META[columnBy];

  const toggleRow = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Una columna por colaborador no es un heatmap: cada celda sería una sola
  // persona: seiscientas columnas de una celda no comparan nada. Se dice en
  // vez de dibujarlo.
  if (!meta.drawsHeatmap) {
    return (
      <div className="rounded-xl border border-border/60 p-8">
        <EmptyState
          icon={Grid2X2}
          title="El heatmap no se desglosa por colaborador"
          description="Cada columna sería una sola persona. Elige otro corte en “Ver por”, arriba, para volver a verlo."
          className="border-none bg-transparent shadow-none"
        />
      </div>
    );
  }

  if (model.rows.length === 0 || model.columns.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 p-8">
        <EmptyState
          icon={Grid2X2}
          title="No hay heatmap que dibujar"
          description="El heatmap cruza los objetivos del ciclo con el corte elegido arriba, y con estos filtros no queda ninguno."
          className="border-none bg-transparent shadow-none"
        />
      </div>
    );
  }

  /** Las filas que de verdad se pintan, ya resueltas anidación y niveles. */
  const visibleRows: { row: HeatRow; depth: number; numbering: number }[] = [];
  model.rows.forEach((row, index) => {
    if (!hiddenLevels.has(row.level)) visibleRows.push({ row, depth: 0, numbering: index + 1 });
    if (expanded.has(row.id)) {
      row.children.forEach((child, childIndex) => {
        if (!hiddenLevels.has(child.level)) {
          visibleRows.push({ row: child, depth: 1, numbering: childIndex + 1 });
        }
      });
    }
  });

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table className="w-full min-w-[56rem]">
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead className="sticky left-0 z-20 w-[280px] min-w-[280px] border-r border-border/60 bg-muted-solid py-3 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Objetivo
              </TableHead>
              <TableHead className="w-[96px] min-w-[96px] border-r border-border/60 bg-muted-solid py-3 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center justify-end gap-1">Total</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-[12px] leading-relaxed">
                    El cumplimiento de la fila entera, sin partir por {meta.plural}.
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              {model.columns.map((column) => (
                <TableHead
                  key={column}
                  className="min-w-[120px] py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate">{column}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-[12px]">
                      {column}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map(({ row, depth, numbering }) => {
              const total = model.grid.get(`${row.id}::__total__`);
              const totalEstado =
                total == null || total.percent === null
                  ? null
                  : resolveEstado(config.estados, total.percent, results.data.status);
              const canOpen = row.children.length > 0 && !hiddenLevels.has("objetivo");
              const isOpen = expanded.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  className="group border-transparent transition-colors hover:bg-muted/30"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-[280px] min-w-[280px] border-r border-border/60 bg-surface py-[3px] pl-4 pr-4 text-left align-middle"
                  >
                    <div
                      className="flex h-9 items-center gap-1.5"
                      style={{ paddingLeft: depth * 18 }}
                    >
                      <button
                        type="button"
                        onClick={() => canOpen && toggleRow(row.id)}
                        aria-expanded={canOpen ? isOpen : undefined}
                        aria-label={isOpen ? `Contraer ${row.title}` : `Expandir ${row.title}`}
                        disabled={!canOpen}
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors",
                          canOpen ? "hover:bg-border/40 hover:text-text-primary" : "opacity-0"
                        )}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-3.5" strokeWidth={2.5} />
                        ) : (
                          <ChevronRight className="size-3.5" strokeWidth={2.5} />
                        )}
                      </button>
                      <span
                        aria-hidden
                        className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 px-1 text-[10px] font-bold tabular-nums text-muted-foreground"
                      >
                        {numbering}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-left text-[13px] text-text-primary",
                              depth === 0 ? "font-bold" : "font-medium"
                            )}
                          >
                            {row.title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] text-[12px]">
                          {row.title}
                          <span className="block text-background/70">{row.subtitle}</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <td className="w-[96px] min-w-[96px] whitespace-nowrap border-r border-border/60 bg-surface px-3 py-[3px] text-right align-middle">
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
                      key={column}
                      cell={model.grid.get(`${row.id}::${column}`)}
                      config={config}
                      status={results.data.status}
                      rowLabel={row.title}
                      columnLabel={column}
                      dimmedBands={dimmedBands}
                    />
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * "Personalizar": qué niveles se pintan y qué bandas mantienen su color. Son
 * dos ajustes de presentación, no de datos, así que van juntos detrás de un
 * solo disparador y lejos de "Filtros", que sí recorta lo que se mira.
 */
export function HeatmapCustomize({
  hiddenLevels,
  onToggleLevel,
  onResetLevels,
  dimmedBands,
  onToggleBand,
  onResetBands,
}: {
  hiddenLevels: ReadonlySet<HeatmapLevel>;
  onToggleLevel: (level: HeatmapLevel) => void;
  onResetLevels: () => void;
  dimmedBands: ReadonlySet<string>;
  onToggleBand: (id: string) => void;
  onResetBands: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const adjustments = hiddenLevels.size + dimmedBands.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 justify-start gap-2 rounded-lg border-border bg-surface px-3 text-[13px] text-text-primary transition-colors hover:bg-border/30"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
          Personalizar
          {adjustments > 0 && (
            <Badge variant="neutral" className="h-4.5 min-w-[18px] justify-center px-1 text-[11px]">
              {adjustments}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] gap-0 overflow-y-auto p-0">
        <div className="flex flex-col gap-0.5 p-2.5">
          <PopoverTitle className="flex items-center gap-1.5 px-2 pt-0.5 text-[13px]">
            <ListTree className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            Niveles a mostrar
          </PopoverTitle>
          <PopoverDescription className="px-2 pb-1 text-[12px] leading-relaxed">
            Desmarca un nivel para sacar sus filas del heatmap.
          </PopoverDescription>
          <div className="flex flex-col gap-1.5 px-2 pt-1">
            {LEVEL_OPTIONS.map((option) => (
              <ScaleToggle
                key={option.id}
                option={{ id: option.id, label: option.label }}
                active={!hiddenLevels.has(option.id)}
                onToggle={() => onToggleLevel(option.id)}
              />
            ))}
          </div>
          {hiddenLevels.size > 0 && (
            <button
              type="button"
              onClick={onResetLevels}
              className="flex w-full items-center justify-start gap-1.5 border-t border-border/60 px-2 pb-0.5 pt-2 text-[12px] font-medium text-primary transition-colors hover:underline"
            >
              Restablecer niveles
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5 border-t border-border/60 p-2.5">
          <PopoverTitle className="flex items-center gap-1.5 px-2 pt-0.5 text-[13px]">
            <ListFilter className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            Resaltar por avance
          </PopoverTitle>
          <PopoverDescription className="px-2 pb-1 text-[12px] leading-relaxed">
            Desmarca un tramo para atenuar sus celdas; lo marcado mantiene su color.
          </PopoverDescription>
          <div className="flex flex-col gap-1.5 px-2 pt-1">
            {HEAT_BANDS.map((band) => (
              <ScaleToggle
                key={band.id}
                option={{
                  id: band.id,
                  label: band.label,
                  range: band.range,
                  palette: {
                    color: band.color,
                    background: band.background,
                    border: band.border,
                    foreground: band.foreground,
                  },
                }}
                active={!dimmedBands.has(band.id)}
                onToggle={() => onToggleBand(band.id)}
              />
            ))}
          </div>
          {dimmedBands.size > 0 && (
            <button
              type="button"
              onClick={onResetBands}
              className="flex w-full items-center justify-start gap-1.5 border-t border-border/60 px-2 pb-0.5 pt-2 text-[12px] font-medium text-primary transition-colors hover:underline"
            >
              Restablecer resaltado
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HeatTile({
  cell,
  config,
  status,
  rowLabel,
  columnLabel,
  dimmedBands,
}: {
  cell: Cell | undefined;
  config: ResultsConfig;
  status: CicloResults["data"]["status"];
  rowLabel: string;
  columnLabel: string;
  dimmedBands: ReadonlySet<string>;
}) {
  /*
   * "No aplica" y "va en cero" son lecturas distintas y no pueden compartir
   * color. Si a ese grupo no le colgaron ningún objetivo alineado a esta fila,
   * el objetivo sencillamente no le toca: pintarlo rojo lo acusaría de un
   * incumplimiento que no existe. Va en gris con una raya, fuera de la escala.
   *
   * El rojo queda para lo que sí se midió y dio bajo —un 0 % real es un 0 %
   * reportado por alguien a quien sí le asignaron el objetivo—.
   */
  const empty = !cell || cell.percent === null;
  const percent = empty ? 0 : ((cell as Cell).percent as number);
  const estado = empty ? null : resolveEstado(config.estados, percent, status);
  const band = empty ? null : bandOf(percent);
  const dimmed = band ? dimmedBands.has(band.id) : false;

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
                "relative flex w-full items-center justify-center text-[12px] font-extrabold tabular-nums transition-transform hover:z-10",
                TILE,
                dimmed
                  ? "bg-muted text-muted-foreground hover:scale-100"
                  : "hover:scale-[1.04]"
              )}
              style={
                dimmed
                  ? undefined
                  : {
                      backgroundColor: band!.background,
                      color: band!.foreground,
                      // El filo va por dentro: un `border` real le robaría un
                      // pixel a la tile y rompería la rendija pareja del campo.
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${band!.border} 30%, transparent)`,
                    }
              }
            >
              {formatPercent(percent)}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="flex w-[240px] flex-col gap-2 text-[12px] leading-relaxed">
          <div className="flex items-center gap-1.5">
            {empty ? (
              <>
                <span className="text-background/70">—</span>
                <span className="font-semibold">No aplica</span>
              </>
            ) : (
              <>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: band?.color }}
                />
                <span className="font-semibold">{band?.label}</span>
                {estado && (
                  <span className="text-background/60">· {estado.nombre}</span>
                )}
              </>
            )}
          </div>
          <p className="text-background/70">
            {rowLabel} · {columnLabel}
          </p>
          {empty && (
            <p className="text-background/70">
              A este grupo no le asignaron ningún objetivo alineado a esta fila, así que no hay
              nada que medirle aquí.
            </p>
          )}
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
