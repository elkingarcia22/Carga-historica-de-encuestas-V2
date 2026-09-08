import * as React from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEASURE_META, MEASURE_ORDER } from "@/components/ciclo-builder";
import { LIFECYCLE_META, LIFECYCLE_ORDER } from "./objectiveLifecycle";
import { AXIS_LABELS, RISK_META, RISK_ORDER, type CicloResults, type ResultsAxis } from "./resultsModel";
import { FILTER_LABELS, type FilterKey, type ResultsFiltersState } from "./useResultsFilters";

/**
 * Los controles de una vista de detalle: "Ver por" y "Filtros".
 *
 * Mismas medidas y mismo trato que los del reporte de encuestas —altura 9,
 * borde `border-border`, texto 13— porque van en la misma cabecera de tarjeta
 * y un botón distinto ahí se lee como un componente ajeno. El buscador no
 * está aquí: es de la tabla, y va en la tarjeta que tiene tabla.
 */

const CONTROL_CLASS =
  "h-9 justify-start gap-2 rounded-lg border-border bg-surface px-3 text-[13px] text-text-primary transition-colors hover:bg-border/30";

interface OptionGroup {
  key: FilterKey;
  title: string;
  options: readonly { id: string; label: string; color?: string; hint?: string }[];
}

function useFilterGroups(results: CicloResults): OptionGroup[] {
  return React.useMemo<OptionGroup[]>(() => {
    const uniq = (values: readonly string[]) =>
      [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

    const groups: OptionGroup[] = [
      {
        key: "lifecycles",
        title: FILTER_LABELS.lifecycles,
        options: LIFECYCLE_ORDER.map((id) => ({
          id,
          label: LIFECYCLE_META[id].label,
          color: LIFECYCLE_META[id].colorHex,
          hint: LIFECYCLE_META[id].description,
        })),
      },
      {
        key: "niveles",
        title: FILTER_LABELS.niveles,
        options: [...results.nivelCounts.keys()].map((id) => {
          const nivel = results.rows.find((row) => row.nivel?.id === id)?.nivel;
          return { id, label: nivel?.nombre ?? id, color: nivel?.colorHex };
        }),
      },
      {
        key: "estadosParticipante",
        title: FILTER_LABELS.estadosParticipante,
        options: [...results.estadoParticipanteCounts.keys()].map((id) => {
          const estado = results.rows.find((row) => row.estadoParticipante?.id === id)
            ?.estadoParticipante;
          return {
            id,
            label: estado?.nombre ?? id,
            color: estado?.colorHex,
            hint: estado?.cuentaEnResultados ? undefined : "No entra en promedios ni rankings.",
          };
        }),
      },
      {
        key: "areas",
        title: FILTER_LABELS.areas,
        options: uniq(results.rows.map((row) => row.area)).map((id) => ({ id, label: id })),
      },
      {
        key: "leaders",
        title: FILTER_LABELS.leaders,
        options: uniq(results.rows.map((row) => row.leader)).map((id) => ({ id, label: id })),
      },
      {
        key: "groups",
        title: FILTER_LABELS.groups,
        options: uniq(results.rows.map((row) => row.groupLabel)).map((id) => ({ id, label: id })),
      },
      {
        key: "measures",
        title: FILTER_LABELS.measures,
        options: MEASURE_ORDER.map((id) => ({ id, label: MEASURE_META[id].label })),
      },
    ];
    if (results.showsRisk) {
      groups.splice(1, 0, {
        key: "risks",
        title: FILTER_LABELS.risks,
        options: RISK_ORDER.map((id) => ({
          id,
          label: RISK_META[id].label,
          color: RISK_META[id].colorHex,
          hint: RISK_META[id].description,
        })),
      });
    }
    return groups.filter((group) => group.options.length > 1);
  }, [results]);
}

export function ResultsFilterControls({
  results,
  state,
  axis,
  onAxisChange,
}: {
  results: CicloResults;
  state: ResultsFiltersState;
  /** Sin eje, no hay "Ver por": las vistas que no dibujan el árbol filtran
   *  igual pero no eligen recorrido. */
  axis?: ResultsAxis;
  onAxisChange?: (axis: ResultsAxis) => void;
}) {
  const groups = useFilterGroups(results);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {axis && onAxisChange && (
        <>
          <span className="text-[13px] font-medium text-muted-foreground">Ver por:</span>
          <Select value={axis} onValueChange={(value) => onAxisChange(value as ResultsAxis)}>
            <SelectTrigger className="h-9 w-[190px] rounded-lg border-border bg-surface px-3 text-[13px] transition-colors hover:bg-border/30 focus:ring-2 focus:ring-primary/20">
              <SelectValue className="truncate text-text-primary" />
            </SelectTrigger>
            <SelectContent position="popper">
              {(Object.keys(AXIS_LABELS) as ResultsAxis[]).map((key) => (
                <SelectItem key={key} value={key} className="text-[13px]">
                  {AXIS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={CONTROL_CLASS}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            Filtros
            {state.activeCount > 0 && (
              <Badge variant="neutral" className="h-4.5 min-w-[18px] justify-center px-1 text-[11px]">
                {state.activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[420px] max-h-[var(--radix-popover-content-available-height)] gap-0 overflow-y-auto p-0"
        >
          <div className="flex flex-col gap-0.5 p-2.5">
            <PopoverTitle className="px-2 pt-0.5 text-[13px]">Filtrar resultados</PopoverTitle>
            <PopoverDescription className="px-2 pb-1 text-[12px] leading-relaxed">
              Sin nada marcado se muestran todos. Las personas se filtran por lo que las describe
              a ellas; los objetivos, por lo suyo.
            </PopoverDescription>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border/60 p-2.5">
            {groups.map((group) => (
              <section key={group.key} className="flex min-w-0 flex-col gap-1 px-2">
                <p className="text-[11px] font-semibold text-muted-foreground">{group.title}</p>
                <div className="flex flex-col gap-0.5">
                  {group.options.map((option) => {
                    const active = state.isOn(group.key, option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        title={option.hint}
                        onClick={() => state.toggle(group.key, option.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] transition-colors",
                          active
                            ? "bg-primary/[0.08] font-semibold text-primary"
                            : "text-text-secondary hover:bg-muted/60 hover:text-text-primary"
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: option.color ?? "transparent" }}
                        />
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {active && <Check className="size-3 shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {state.activeCount > 0 && (
            <button
              type="button"
              onClick={state.clearAll}
              className="flex w-full items-center justify-start gap-1.5 border-t border-border/60 px-4 py-2.5 text-[12px] font-medium text-primary transition-colors hover:underline"
            >
              Quitar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Los filtros puestos, como fichas que se quitan una a una. */
export function ResultsFilterChips({
  results,
  state,
}: {
  results: CicloResults;
  state: ResultsFiltersState;
}) {
  const labelFor = (key: FilterKey, id: string): string => {
    if (key === "lifecycles") return LIFECYCLE_META[id as keyof typeof LIFECYCLE_META]?.label ?? id;
    if (key === "risks") return RISK_META[id as keyof typeof RISK_META]?.label ?? id;
    if (key === "measures") return MEASURE_META[id as keyof typeof MEASURE_META]?.label ?? id;
    if (key === "niveles")
      return results.rows.find((row) => row.nivel?.id === id)?.nivel?.nombre ?? id;
    if (key === "estadosParticipante")
      return (
        results.rows.find((row) => row.estadoParticipante?.id === id)?.estadoParticipante?.nombre ??
        id
      );
    return id;
  };

  const chips = (Object.keys(FILTER_LABELS) as FilterKey[]).flatMap((key) =>
    [...(state.filters[key] as ReadonlySet<string>)].map((id) => ({ key, id }))
  );
  const hasSearch = state.filters.search.trim() !== "";
  if (chips.length === 0 && !hasSearch) return null;

  return (
    <div className="-mt-1 flex flex-wrap items-center gap-2">
      {hasSearch && (
        <Badge variant="neutral" className="gap-1.5 pr-1 text-[12px] font-medium">
          Búsqueda: {state.filters.search}
          <button
            type="button"
            onClick={() => state.setSearch("")}
            aria-label="Quitar búsqueda"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-border/40 hover:text-text-primary"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </Badge>
      )}
      {chips.map(({ key, id }) => (
        <Badge key={`${key}:${id}`} variant="neutral" className="gap-1.5 pr-1 text-[12px] font-medium">
          {FILTER_LABELS[key]}: {labelFor(key, id)}
          <button
            type="button"
            onClick={() => state.toggle(key, id)}
            aria-label={`Quitar filtro ${FILTER_LABELS[key]}`}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-border/40 hover:text-text-primary"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={state.clearAll}
        className="text-[12px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-text-primary hover:underline"
      >
        Quitar todo
      </button>
    </div>
  );
}
