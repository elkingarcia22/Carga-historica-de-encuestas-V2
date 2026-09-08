import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * El buscador y el filtro de una lista dentro del drawer de carga son, en
 * los dos casos, los mismos controles que usa el resto del proyecto —el
 * buscador de `resultados` (`SearchBox`, en `ciclo-detail/tablePieces`) y el
 * botón "Filtros" con su conteo (mismo trato que `ResultsFilterBar`)—, no una
 * pareja de iconos inventada para este módulo. `SearchBox` ya se usa un panel
 * más adentro, en `UploadDetailPanel`; lo que faltaba era que la revisión
 * misma lo usara también en vez de su propio botón que se abre en un campo.
 */

export interface FilterGroup {
  id: string;
  label: string;
  options: readonly string[];
  /** Vacío significa "todos": ningún predicado para este grupo. */
  selected: readonly string[];
  onToggle: (option: string) => void;
}

/**
 * Filtro por varios grupos. Dentro de un grupo las opciones se suman (OR); entre
 * grupos se cruzan (AND). El botón lleva el conteo de filtros activos para que
 * un filtro puesto se vea con el popover cerrado.
 */
export function FilterButton({
  groups,
  onClearAll,
}: {
  groups: FilterGroup[];
  onClearAll: () => void;
}) {
  const activeCount = groups.reduce((total, group) => total + group.selected.length, 0);

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        {/* Mismo botón que "Filtros" en resultados: outline, texto y su
            conteo en una insignia — no un icono suelto que solo cambia de
            color al tener algo marcado. */}
        <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-border px-3 text-[13px]">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" strokeWidth={2} />
          Filtros
          {activeCount > 0 && (
            <Badge variant="neutral" className="h-[18px] min-w-[18px] justify-center px-1 text-[11px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[100] w-72 overflow-hidden rounded-2xl border border-border/60 p-0 shadow-drawer"
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Filtros
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="max-h-[340px] space-y-1 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.id} className="px-1 py-1.5">
              <p className="px-2 pb-1.5 text-[11px] font-bold tracking-tight text-text-primary">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.options.length === 0 && (
                  <p className="px-2 py-1 text-[11px] text-text-muted">Sin opciones</p>
                )}
                {group.options.map((option) => {
                  const isSelected = group.selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => group.onToggle(option)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-all",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong/40 bg-surface-muted"
                        )}
                      >
                        {isSelected && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span
                        className={cn(
                          "truncate text-[12px] font-semibold",
                          isSelected ? "text-primary" : "text-text-secondary"
                        )}
                      >
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
