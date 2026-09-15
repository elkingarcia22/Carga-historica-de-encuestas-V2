import * as React from "react";
import { Filter, FilterX } from "lucide-react";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { UbitsTabs } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { EstadoChip, InitialsAvatar, formatPercent } from "@/components/ciclo-detail";
import { LifecycleChip } from "./ResultsChips";
import { CollapsibleSearchBox } from "./tableBridge";
import type { DetailDimension } from "./resultsDetail";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El "cuáles" de cada tarjeta del resumen.
 *
 * Uno solo para todas las tarjetas, no uno por gráfico: lo que cambia entre
 * el riesgo y los niveles de cumplimiento es la lista, no la forma de leerla, y
 * nueve drawers distintos serían nueve sitios donde arreglar el mismo detalle.
 *
 * Los tramos del reparto son las pestañas del drawer y están siempre a la
 * vista: se entra por el que se pulsó —"Por mejorar"— y se salta a "Bueno" o
 * a "Excelente" sin cerrar ni volver al gráfico. Esa es toda la gracia: la
 * pregunta nunca es solo por un tramo, es por la comparación entre tramos.
 *
 * Y todo lo de dentro es la gramática que ya tienen los demás paneles del
 * producto: las pestañas del sistema —el mismo control segmentado del drawer
 * de reportes y de la revisión de la carga masiva, con el contador de cada
 * pestaña en el tono de su tramo—, y la lista dentro de una `DrawerSection`,
 * con su chip de icono, su título, su línea de explicación y el buscador en
 * la cabecera. Nada de tiras de fichas ni de contenedores propios de esta
 * pantalla.
 *
 * Lo mismo con las píldoras de cada fila: son `EstadoChip`, con las parejas
 * de color ya resueltas para leerse, en vez del hex del gráfico puesto como
 * texto sobre blanco —que en amarillo, sencillamente, no se ve—.
 *
 * El pie hace lo único que no se puede hacer desde aquí: llevarse el tramo
 * como filtro a todo el reporte. Leer quién está en riesgo alto es una cosa;
 * mirar el ciclo entero como se ve para esa gente, otra.
 */
export function ResultsDetailDrawer({
  dimension,
  initialBucketId,
  filters,
  open,
  onOpenChange,
}: {
  dimension: DetailDimension;
  /** El tramo que se pulsó en el gráfico. El drawer abre parado ahí. */
  initialBucketId: string;
  filters: ResultsFiltersState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [bucketId, setBucketId] = React.useState(initialBucketId);
  const [search, setSearch] = React.useState("");

  /*
   * Con diez tramos la tira se desplaza, y el que se pulsó en el gráfico bien
   * puede estar fuera del renglón: el drawer abriría con la lista de
   * "Operaciones" y la pestaña activa escondida a la derecha. Se trae a la
   * vista una vez, al abrir; después manda el usuario.
   */
  const tabsRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const active = tabsRef.current?.querySelector('[data-state="active"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  const bucket =
    dimension.buckets.find((candidate) => candidate.id === bucketId) ?? dimension.buckets[0] ?? null;

  const rows = React.useMemo(() => {
    if (!bucket) return [];
    const term = search.trim().toLowerCase();
    if (term === "") return bucket.rows;
    return bucket.rows.filter((row) => row.haystack.includes(term));
  }, [bucket, search]);

  const noun = dimension.subject === "persona" ? "personas" : "objetivos";
  const filterKey = dimension.filterKey;
  const filterValue = bucket?.filterValue ?? null;
  const isFiltered =
    filterKey !== null && filterValue !== null && filters.isOn(filterKey, filterValue);

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={dimension.title}
      description={dimension.hint}
      size="xl"
      className="!w-[36vw] !max-w-[44rem] !min-w-[32rem] gap-0 !bg-background"
      disablePadding
      footer={
        filterKey !== null && filterValue !== null && bucket ? (
          <SheetFooter className="border-t border-border/60 bg-surface px-4 py-3">
            <Button
              variant={isFiltered ? "outline" : "default"}
              className="w-full gap-2 font-semibold"
              onClick={() => {
                filters.toggle(filterKey, filterValue);
                onOpenChange(false);
              }}
            >
              {isFiltered ? <FilterX className="size-4" /> : <Filter className="size-4" />}
              {isFiltered
                ? `Quitar el filtro «${bucket.label}»`
                : `Ver todo el reporte solo de «${bucket.label}»`}
            </Button>
          </SheetFooter>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        {/* Las pestañas del sistema, ajustadas a sus etiquetas. Con diez
            tramos —un área por fila del ranking— no caben en el ancho del
            drawer, así que la tira se desplaza en su renglón en vez de
            envolverse en tres filas. Se queda quieta, como la de la revisión
            de la carga: es la navegación del drawer, y perderla al bajar por
            una lista de doscientas filas la volvería un adorno de la primera
            pantalla. */}
        <div
          ref={tabsRef}
          className="shrink-0 overflow-x-auto border-b border-border/60 bg-background px-4 pb-3 pt-4 [scrollbar-width:thin]"
        >
          <UbitsTabs
            tabs={dimension.buckets.map((item) => ({
              id: item.id,
              label: item.label,
              badge: item.rows.length,
              badgeTone: item.tone,
            }))}
            activeTabId={bucket?.id ?? ""}
            onTabChange={(id) => {
              setBucketId(id);
              setSearch("");
            }}
            fitContent
            className="mb-0"
          />
        </div>

        {bucket && (
          <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
            <DrawerSection
              className="flex min-h-0 flex-1 flex-col"
              contentClassName="flex min-h-0 flex-1 flex-col"
              icon={dimension.icon}
              tone={bucket.tone}
              title={bucket.label}
              hint={bucket.hint}
              badge={`${rows.length} ${rows.length === 1 ? noun.slice(0, -1) : noun}`}
              stickyHeader
              action={
                <CollapsibleSearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder={`Buscar en ${noun}…`}
                  expandedClassName="w-[190px]"
                />
              }
            >
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-[12.5px] text-text-muted">
                  {bucket.rows.length === 0
                    ? `Nadie quedó en «${bucket.label}».`
                    : "Ninguno coincide con la búsqueda."}
                </p>
              ) : (
                <ul className="-mr-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-3 py-2.5"
                    >
                      {dimension.subject === "persona" && (
                        <InitialsAvatar name={row.name} size="sm" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-text-primary">
                          {row.name}
                        </p>
                        <p className="truncate text-[11.5px] text-text-muted">
                          {row.meta}
                          {row.detail && ` · ${row.detail}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {row.lifecycle && <LifecycleChip lifecycle={row.lifecycle} size="sm" />}
                        {row.estado && <EstadoChip estado={row.estado} size="sm" />}
                        {row.percent !== null && (
                          <span className="w-[3.25rem] whitespace-nowrap text-right text-[13px] font-bold tabular-nums text-text-primary">
                            {formatPercent(row.percent)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>
          </div>
        )}
      </div>
    </DrawerShell>
  );
}
