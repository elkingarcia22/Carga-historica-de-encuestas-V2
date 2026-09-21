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
import { APPROVAL_META, APPROVAL_ORDER, LIFECYCLE_META } from "./objectiveLifecycle";
import { BREAKDOWN_META, BREAKDOWN_ORDER, type BreakdownKey } from "./resultsBreakdown";
import { RISK_META, RISK_ORDER, type CicloResults } from "./resultsModel";
import {
  FILTER_META,
  type FilterKey,
  type FilterScope,
  type ResultsFiltersState,
} from "./useResultsFilters";

/**
 * La barra del reporte, arriba de todas las pestañas: con qué se agrupa y qué
 * entra en la cuenta.
 *
 * Estaba dentro de la cabecera de cada tarjeta —uno por pestaña, tres copias
 * del mismo control— y el resumen no tenía ninguno: se filtraba pulsando los
 * gráficos pero no se podía decir "solo Comercial" antes de leerlos. Aquí es
 * una sola y es de la pantalla, que es lo que ya prometía el estado compartido
 * de `useResultsFilters`.
 *
 * Es la misma anatomía del informe de una encuesta: "Ver por" elige el corte,
 * "Segmentación" lo angosta con un desplegable por demográfico —uno a la vez,
 * que es como se lee un reporte— y "Filtros" guarda lo que describe al
 * objetivo, donde marcar varias sí tiene sentido ("Cumplido" *y*
 * "Sobrecumplió" son una sola pregunta).
 */

const CONTROL_CLASS =
  "h-9 justify-start gap-2 rounded-lg border-border bg-surface px-3 text-[13px] text-text-primary transition-colors hover:bg-border/30";

/**
 * El valor del desplegable cuando el demográfico está intacto. No es cadena
 * vacía porque Radix la reserva para "sin valor" y no deja construir un ítem
 * con ella.
 */
const SIN_FILTRAR = "__todos__";

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

/** Los atributos con los que la empresa describe a su gente, más la asignación
 *  que le dio sus objetivos. Son los mismos del directorio, así que la lista
 *  sale de los participantes reales del ciclo y no de un catálogo aparte que
 *  podría desincronizarse. */
function useDemographicGroups(results: CicloResults): OptionGroup[] {
  return React.useMemo(
    () =>
      (
        [
          { key: "areas" as const, pick: (row: CicloResults["rows"][number]) => row.area },
          { key: "leaders" as const, pick: (row: CicloResults["rows"][number]) => row.leader },
          // "Grupo del ciclo" queda fuera de aquí a propósito: es la misma
          // asignación que el "Ver por" ya ofrece como corte ("Asignación"),
          // y filtrar por ella aquí sería una segunda forma de hacer lo mismo
          // con otro nombre en un desplegable distinto.
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

/**
 * Lo que describe al objetivo o a su dueño dentro del ciclo.
 *
 * "Aprobación" y "Estado del objetivo" son las dos preguntas que importan
 * —¿tiene permiso para contar? ¿cómo le fue?— y no se pisan: Aprobación ya
 * cubre "Por aprobar" y "Denegado"; el estado solo lista las bandas de
 * cumplimiento de un objetivo que ya pasó esa aprobación.
 *
 * Hubo un tercer grupo aquí, "Etapa del objetivo" —el ciclo de vida completo:
 * Por aprobar, Por ajustar, Por iniciar, En progreso, Completado—. Se quitó
 * del popover porque duplicaba a los otros dos con las mismas palabras y
 * significados distintos: su "Por aprobar" era el de Aprobación, y su "Por
 * iniciar"/"En progreso" no eran las bandas configuradas sino la etapa del
 * flujo, así que marcar una casilla y la otra con el mismo nombre filtraban
 * cosas distintas. El filtro en sí sigue vivo —lo usan los enlaces de
 * Análisis con IA ("ver esto en Cumplimiento")— solo que ya no se ofrece como
 * una tercera lista de casillas que nadie pedía.
 */
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
    ];
    if (results.showsRisk) {
      // Después de "estados" (índice 1) y antes de "niveles": al sacar
      // "lifecycles" de este arreglo, el índice fijo que insertaba el riesgo
      // en el lugar correcto se corrió y se llevaba el riesgo detrás de
      // "Objetivo de empresa" en vez de dejarlo junto a las otras dos
      // preguntas sobre el objetivo.
      groups.splice(2, 0, {
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
  breakdown,
  onBreakdownChange,
  showBreakdown = true,
  showSegmentation = true,
  filterScope,
  segmentationAfterSearch = false,
  searchSlot,
  excludeBreakdowns = [],
}: {
  results: CicloResults;
  state: ResultsFiltersState;
  breakdown?: BreakdownKey;
  onBreakdownChange?: (value: BreakdownKey) => void;
  /** Falso en Colaboradores: ya lista a cada persona, así que no hay por
   *  dónde agruparla —el "Ver por" no tiene qué hacer ahí. */
  showBreakdown?: boolean;
  /** Falso junto con `showBreakdown`: es un segundo control sobre el mismo
   *  corte que "Ver por" ya no ofrece. */
  showSegmentation?: boolean;
  /**
   * Deja en "Filtros" solo los de este alcance. Sin esto entran todos.
   *
   * Lo usa Alineación estratégica con "persona": esa vista reparte el 100 %
   * que cada persona tiene entre sus metas, así que recortar gente entera
   * —riesgo, nivel— sigue dejando un reparto legible ("el esfuerzo de los que
   * van en riesgo"), mientras que recortar objetivos —aprobación, estado,
   * objetivo de empresa, tipo de medida— parte ese 100 % por dentro y cada
   * porcentaje pasa a medirse contra un denominador que ya no es el ciclo.
   */
  filterScope?: FilterScope;
  /** Cierto en Colaboradores: sin "Ver por" antes, "Segmentación" quedaría
   *  pegada al borde izquierdo en vez de junto al resto de los controles de
   *  la tabla — se sienta después del buscador en su lugar. */
  segmentationAfterSearch?: boolean;
  /** El buscador de la pestaña, si tiene uno — se sienta justo a la
   *  izquierda de "Filtros", que es donde se lee último antes de recortar. */
  searchSlot?: React.ReactNode;
  excludeBreakdowns?: BreakdownKey[];
}) {
  const demographics = useDemographicGroups(results);
  const allCicloGroups = useCicloGroups(results);
  const ciclo =
    filterScope === undefined
      ? allCicloGroups
      : allCicloGroups.filter((group) => FILTER_META[group.key].scope === filterScope);
  const filtersAboutPeople = filterScope === "persona";
  const segmentacion = showSegmentation && <SegmentacionPopover groups={demographics} state={state} />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showBreakdown && onBreakdownChange && (
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">Ver por:</span>
          <Select value={breakdown} onValueChange={(value) => onBreakdownChange(value as BreakdownKey)}>
            <SelectTrigger className="h-9 w-[170px] rounded-lg border-border bg-surface px-3 text-[13px] transition-colors hover:bg-border/30 focus:ring-2 focus:ring-primary/20">
              <SelectValue className="truncate text-text-primary" />
            </SelectTrigger>
            <SelectContent position="popper">
              {BREAKDOWN_ORDER.filter((k) => !excludeBreakdowns.includes(k)).map((key) => (
                <SelectItem key={key} value={key} className="text-[13px]">
                  {BREAKDOWN_META[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!segmentationAfterSearch && segmentacion}

      {searchSlot}

      {segmentationAfterSearch && segmentacion}

      {ciclo.length > 0 && (
        <FilterPopover
          icon={SlidersHorizontal}
          label="Filtros"
          title={
            filtersAboutPeople
              ? "Filtrar por quién carga los objetivos"
              : "Filtrar por qué se está midiendo"
          }
          description={
            filtersAboutPeople
              ? "Lo que describe a la persona dentro del ciclo. Sin nada marcado se muestran todas."
              : "Lo que describe al objetivo y a su avance. Sin nada marcado se muestran todos."
          }
          groups={ciclo}
          state={state}
          count={countIn(ciclo, state)}
        />
      )}
    </div>
  );
}

/**
 * "Filtrar a fondo": un desplegable por demográfico, uno solo a la vez.
 *
 * Es la forma del informe de una encuesta, y no las listas de casillas del
 * botón de al lado, porque angostar el reporte a "Comercial" y a la vez a
 * "Marketing" no es angostarlo: la pregunta que se hace aquí es de un valor.
 */
function SegmentacionPopover({
  groups,
  state,
}: {
  groups: readonly OptionGroup[];
  state: ResultsFiltersState;
}) {
  if (groups.length === 0) return null;
  const count = countIn(groups, state);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(CONTROL_CLASS, count > 0 && "border-primary/50 text-primary")}
        >
          <SlidersHorizontal
            className={cn("h-3.5 w-3.5", count > 0 ? "text-primary" : "text-muted-foreground")}
            strokeWidth={2}
          />
          Segmentación
          {count > 0 && (
            <Badge variant="neutral" className="h-4.5 min-w-[18px] justify-center px-1 text-[11px]">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0"
      >
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-0.5">
            <PopoverTitle className="text-[13px]">Filtrar a fondo</PopoverTitle>
            <PopoverDescription className="text-[12px] leading-relaxed">
              Limita el reporte a ciertos valores demográficos. Todo lo demás se recalcula con lo
              que quede.
            </PopoverDescription>
          </div>

          {groups.map((group) => {
            const selected = state.onlyValue(group.key);
            return (
              <div key={group.key} className="flex items-center gap-2.5 border-t border-border/60 pt-3">
                <span className="w-[85px] shrink-0 truncate text-[13px] font-medium text-text-secondary">
                  {group.title}
                </span>
                <Select
                  value={selected ?? SIN_FILTRAR}
                  onValueChange={(value) =>
                    state.setOnly(group.key, value === SIN_FILTRAR ? null : value)
                  }
                >
                  <SelectTrigger className="h-8 flex-1 rounded-md border-transparent bg-muted/40 px-2.5 text-[13px] hover:bg-muted/60 focus:ring-1 focus:ring-primary/20">
                    {/* Un trigger vacío no dice si el demográfico está sin
                        tocar o si algo se rompió. */}
                    <SelectValue placeholder="Sin filtrar" className="text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={SIN_FILTRAR} className="text-[13px]">
                      Sin filtrar
                    </SelectItem>
                    {group.options.map((option) => (
                      <SelectItem key={option.id} value={option.id} className="text-[13px]">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {/* Un enlace de texto sobre la divisoria, como el "Quitar todo" del
              otro popover de filtros — no el botón `Button`, cuyo borde base
              se ve entero en los cuatro lados en vez de solo arriba. */}
          {count > 0 && (
            <div className="border-t border-border/60 pt-3">
              <button
                type="button"
                onClick={() => groups.forEach((group) => state.clearKey(group.key))}
                className="text-[12px] font-medium text-primary underline-offset-2 transition-colors hover:underline"
              >
                Quitar filtros
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
        align="end"
        className="w-[400px] max-h-[var(--radix-popover-content-available-height)] gap-0 overflow-y-auto p-0"
      >
        {/* La cabecera se queda a la vista: con ocho grupos hay que recorrer,
            y "Quitar todo" al fondo de un scroll no lo encuentra nadie. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-popover px-3.5 py-3">
          <div className="min-w-0">
            <PopoverTitle className="text-[13px]">{title}</PopoverTitle>
            <PopoverDescription className="mt-0.5 text-[12px] leading-relaxed">
              {description}
            </PopoverDescription>
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => groups.forEach((group) => state.clearKey(group.key))}
              className="shrink-0 pt-0.5 text-[12px] font-medium text-primary underline-offset-2 transition-colors hover:underline"
            >
              Quitar todo
            </button>
          )}
        </div>

        {/*
          * Un grupo por bloque y sus valores como píldoras que envuelven, no
          * una rejilla de dos columnas de listas verticales: con grupos de
          * tres y de seis valores, las dos columnas quedaban desalineadas y
          * cada grupo empujaba al de al lado. Así cada bloque mide lo que
          * necesita —una o dos líneas— y los ocho se recorren de un tirón.
          */}
        <div className="flex flex-col">
          {groups.map((group) => {
            const applied = (state.filters[group.key] as ReadonlySet<string>).size;
            return (
              <section
                key={group.key}
                className="flex flex-col gap-2 border-b border-border/50 px-3.5 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </p>
                  {applied > 0 && (
                    <>
                      <span className="rounded-full bg-primary/10 px-1.5 text-[10.5px] font-bold tabular-nums text-primary">
                        {applied}
                      </span>
                      <button
                        type="button"
                        onClick={() => state.clearKey(group.key)}
                        className="ml-auto text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-text-primary hover:underline"
                      >
                        Quitar
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((option) => {
                    const active = state.isOn(group.key, option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        title={option.hint ?? option.label}
                        aria-pressed={active}
                        onClick={() => state.toggle(group.key, option.id)}
                        className={cn(
                          "inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                          active
                            ? "border-primary/40 bg-primary/[0.08] font-semibold text-primary"
                            : "border-border/70 text-text-secondary hover:border-border hover:bg-muted/60 hover:text-text-primary"
                        )}
                      >
                        {option.color && (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: option.color }}
                          />
                        )}
                        <span className="min-w-0 truncate">{option.label}</span>
                        {active && <Check className="size-3 shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Los filtros puestos, como fichas que se quitan una a una.
 *
 * Van en su propio renglón bajo la barra y no apretadas al lado de los
 * botones: apiladas ahí empujaban los controles y, con dos o tres puestas, la
 * fila entera se leía como una sola tira de cosas del mismo rango. Es lo que
 * hace el informe de una encuesta con las suyas.
 */
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
    return id;
  };

  const chips = (Object.keys(FILTER_META) as FilterKey[]).flatMap((key) =>
    [...(state.filters[key] as ReadonlySet<string>)].map((id) => ({ key, id }))
  );
  const hasSearch = state.filters.search.trim() !== "";
  if (chips.length === 0 && !hasSearch) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
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
    </div>
  );
}
