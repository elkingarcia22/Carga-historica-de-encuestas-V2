import * as React from "react";
import { Check, SlidersHorizontal, Users, X } from "lucide-react";
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
import { MEASURE_META, MEASURE_ORDER } from "@/components/ciclo-builder";
import {
  APPROVAL_META,
  APPROVAL_ORDER,
  LIFECYCLE_META,
  LIFECYCLE_ORDER,
} from "./objectiveLifecycle";
import { RISK_META, RISK_ORDER, type CicloResults } from "./resultsModel";
import { FILTER_META, type FilterKey, type ResultsFiltersState } from "./useResultsFilters";

/**
 * Los filtros del reporte, arriba de todas las pestañas.
 *
 * Estaban dentro de la cabecera de cada tarjeta —uno por pestaña, tres copias
 * del mismo control— y el resumen no tenía ninguno: se filtraba pulsando los
 * gráficos pero no se podía decir "solo Comercial" antes de leerlos. Aquí son
 * uno solo y son de la pantalla, que es lo que ya prometía el estado
 * compartido de `useResultsFilters`.
 *
 * Van partidos en dos botones porque son dos preguntas distintas: **quién**
 * entra en la cuenta (los demográficos de la persona) y **qué** se está
 * contando (lo que describe al objetivo). Meterlos en un solo popover de once
 * grupos obligaba a recorrerlo entero para encontrar "País".
 */

const CONTROL_CLASS =
  "h-9 justify-start gap-2 rounded-lg border-border bg-surface px-3 text-[13px] text-text-primary transition-colors hover:bg-border/30";

export interface FilterOption {
  id: string;
  label: string;
  color?: string;
  hint?: string;
}

interface OptionGroup {
  key: FilterKey;
  title: string;
  options: readonly FilterOption[];
}

const byLabel = (a: string, b: string) => a.localeCompare(b, "es");

/** Los valores distintos de un atributo de la gente del ciclo, ordenados. */
function distinct(
  rows: CicloResults["rows"],
  pick: (row: CicloResults["rows"][number]) => string | null
): FilterOption[] {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = pick(row);
    if (value) values.add(value);
  });
  return [...values].sort(byLabel).map((id) => ({ id, label: id }));
}

/** Los seis atributos con los que la empresa describe a su gente. Son los
 *  mismos del directorio, así que la lista sale de los participantes reales
 *  del ciclo y no de un catálogo aparte que podría desincronizarse. */
function useDemographicGroups(results: CicloResults): OptionGroup[] {
  return React.useMemo(
    () =>
      (
        [
          { key: "areas" as const, pick: (row: CicloResults["rows"][number]) => row.area },
          { key: "leaders" as const, pick: (row: CicloResults["rows"][number]) => row.leader },
          { key: "countries" as const, pick: (row: CicloResults["rows"][number]) => row.collaborator.country },
          { key: "ages" as const, pick: (row: CicloResults["rows"][number]) => row.collaborator.age },
          { key: "genders" as const, pick: (row: CicloResults["rows"][number]) => row.collaborator.gender },
          { key: "customGroups" as const, pick: (row: CicloResults["rows"][number]) => row.collaborator.customGroup },
        ]
      )
        .map(({ key, pick }) => ({
          key,
          title: FILTER_META[key].label,
          options: distinct(results.rows, pick),
        }))
        .filter((group) => group.options.length > 1),
    [results.rows]
  );
}

/** Lo que describe al objetivo o a su dueño dentro del ciclo. */
function useCicloGroups(results: CicloResults): OptionGroup[] {
  return React.useMemo(() => {
    const groups: OptionGroup[] = [
      {
        key: "approvals",
        title: FILTER_META.approvals.label,
        options: APPROVAL_ORDER.map((id) => ({
          id,
          label: APPROVAL_META[id].label,
          color: APPROVAL_META[id].colorHex,
          hint: APPROVAL_META[id].description,
        })),
      },
      {
        key: "estados",
        title: FILTER_META.estados.label,
        options: results.estados.map((estado) => ({
          id: estado.id,
          label: estado.nombre,
          color: estado.colorHex,
          hint: estado.descripcion,
        })),
      },
      {
        key: "lifecycles",
        title: FILTER_META.lifecycles.label,
        options: LIFECYCLE_ORDER.map((id) => ({
          id,
          label: LIFECYCLE_META[id].label,
          color: LIFECYCLE_META[id].colorHex,
          hint: LIFECYCLE_META[id].description,
        })),
      },
      {
        key: "niveles",
        title: FILTER_META.niveles.label,
        options: results.niveles.map((nivel) => ({
          id: nivel.id,
          label: nivel.nombre,
          color: nivel.colorHex,
        })),
      },
      {
        key: "companyObjectives",
        title: FILTER_META.companyObjectives.label,
        options: results.companyObjectiveMix.map((share) => ({
          id: share.id,
          label: share.label,
          hint: `${share.count} ${share.count === 1 ? "objetivo" : "objetivos"}`,
        })),
      },
      {
        key: "measures",
        title: FILTER_META.measures.label,
        options: MEASURE_ORDER.map((id) => ({ id, label: MEASURE_META[id].label })),
      },
      {
        key: "groups",
        title: FILTER_META.groups.label,
        options: distinct(results.rows, (row) => row.groupLabel),
      },
      {
        key: "estadosParticipante",
        title: FILTER_META.estadosParticipante.label,
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
    ];
    if (results.showsRisk) {
      groups.splice(3, 0, {
        key: "risks",
        title: FILTER_META.risks.label,
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

/** Cuántos filtros hay puestos dentro de un conjunto de grupos. */
const countIn = (groups: readonly OptionGroup[], state: ResultsFiltersState) =>
  groups.reduce(
    (sum, group) => sum + (state.filters[group.key] as ReadonlySet<string>).size,
    0
  );

export function ResultsGlobalFilters({
  results,
  state,
}: {
  results: CicloResults;
  state: ResultsFiltersState;
}) {
  const demographics = useDemographicGroups(results);
  const ciclo = useCicloGroups(results);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterPopover
        icon={Users}
        label="Demográficos"
        title="Filtrar por quién"
        description="Limita el reporte a cierta gente. Todo lo demás se recalcula con lo que quede."
        groups={demographics}
        state={state}
        count={countIn(demographics, state)}
      />
      <FilterPopover
        icon={SlidersHorizontal}
        label="Filtros"
        title="Filtrar por qué se está midiendo"
        description="Lo que describe al objetivo y a su avance. Sin nada marcado se muestran todos."
        groups={ciclo}
        state={state}
        count={countIn(ciclo, state)}
      />
      <ResultsFilterChips results={results} state={state} />
    </div>
  );
}

function FilterPopover({
  icon: Icon,
  label,
  title,
  description,
  groups,
  state,
  count,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  title: string;
  description: string;
  groups: readonly OptionGroup[];
  state: ResultsFiltersState;
  count: number;
}) {
  if (groups.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(CONTROL_CLASS, count > 0 && "border-primary/50 text-primary")}>
          <Icon className={cn("h-3.5 w-3.5", count > 0 ? "text-primary" : "text-muted-foreground")} strokeWidth={2} />
          {label}
          {count > 0 && (
            <Badge variant="neutral" className="h-4.5 min-w-[18px] justify-center px-1 text-[11px]">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[440px] max-h-[var(--radix-popover-content-available-height)] gap-0 overflow-y-auto p-0"
      >
        <div className="flex flex-col gap-0.5 p-2.5">
          <PopoverTitle className="px-2 pt-0.5 text-[13px]">{title}</PopoverTitle>
          <PopoverDescription className="px-2 pb-1 text-[12px] leading-relaxed">
            {description}
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
      </PopoverContent>
    </Popover>
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
    if (key === "approvals") return APPROVAL_META[id as keyof typeof APPROVAL_META]?.label ?? id;
    if (key === "lifecycles") return LIFECYCLE_META[id as keyof typeof LIFECYCLE_META]?.label ?? id;
    if (key === "risks") return RISK_META[id as keyof typeof RISK_META]?.label ?? id;
    if (key === "measures") return MEASURE_META[id as keyof typeof MEASURE_META]?.label ?? id;
    if (key === "estados") return results.estados.find((estado) => estado.id === id)?.nombre ?? id;
    if (key === "niveles") return results.niveles.find((nivel) => nivel.id === id)?.nombre ?? id;
    if (key === "companyObjectives")
      return results.companyObjectiveMix.find((share) => share.id === id)?.label ?? id;
    if (key === "estadosParticipante")
      return (
        results.rows.find((row) => row.estadoParticipante?.id === id)?.estadoParticipante?.nombre ??
        id
      );
    return id;
  };

  const chips = (Object.keys(FILTER_META) as FilterKey[]).flatMap((key) =>
    [...(state.filters[key] as ReadonlySet<string>)].map((id) => ({ key, id }))
  );
  const hasSearch = state.filters.search.trim() !== "";
  if (chips.length === 0 && !hasSearch) return null;

  return (
    <>
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
        <Badge key={`${key}:${id}`} variant="neutral" className="max-w-[280px] gap-1.5 pr-1 text-[12px] font-medium">
          <span className="min-w-0 truncate">
            {FILTER_META[key].label}: {labelFor(key, id)}
          </span>
          <button
            type="button"
            onClick={() => state.toggle(key, id)}
            aria-label={`Quitar filtro ${FILTER_META[key].label}`}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-border/40 hover:text-text-primary"
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
    </>
  );
}
