import * as React from "react";
import { ChevronDown, Plus, Search, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CicloListRow } from "@/components/ciclo-detail";

/**
 * A qué ciclo va a aterrizar el archivo, elegido dentro del propio asistente.
 *
 * Vive arriba de "Qué quieres hacer" porque lo decide todo lo que sigue: sin
 * un ciclo — existente o por crear — no hay contra qué resolver los usuarios
 * del archivo. El nombre es el control, igual que en el resto del módulo: un
 * campo que se parece a un select abre el buscador, y "Crear un ciclo nuevo"
 * vive dentro de la misma lista en vez de ser un botón aparte.
 */

const ESTADO_CLASS: Record<string, string> = {
  "En curso": "bg-status-warning/15 text-status-warning",
  Finalizado: "bg-status-positive-bg text-status-positive",
  "Por iniciar": "bg-surface-muted text-text-secondary",
};

export interface CicloSelectorFieldProps {
  ciclos: readonly CicloListRow[];
  value: CicloListRow | null;
  isCreatingNew: boolean;
  newCicloName: string;
  onSelectExisting: (ciclo: CicloListRow) => void;
  onStartNew: () => void;
  onBackToExisting: () => void;
  onNewNameChange: (name: string) => void;
}

export function CicloSelectorField({
  ciclos,
  value,
  isCreatingNew,
  newCicloName,
  onSelectExisting,
  onStartNew,
  onBackToExisting,
  onNewNameChange,
}: CicloSelectorFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === "" ? ciclos : ciclos.filter((ciclo) => ciclo.nombre.toLowerCase().includes(needle));
  }, [ciclos, query]);

  return (
    /* Sin rótulo propio: el encabezado lo pone la `DrawerSection` que envuelve
       este campo, igual que en el resto de los paneles laterales. */
    <div className="flex flex-col gap-2">
      {isCreatingNew ? (
        <div className="flex flex-col gap-1.5">
          <Input
            autoFocus
            value={newCicloName}
            onChange={(event) => onNewNameChange(event.target.value)}
            placeholder="Nombre del ciclo nuevo"
            aria-label="Nombre del ciclo nuevo"
            className="h-11"
          />
          <button
            type="button"
            onClick={onBackToExisting}
            className="self-start px-1 text-[11px] font-bold text-primary hover:underline"
          >
            Elegir un ciclo existente
          </button>
        </div>
      ) : (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={value ? `Ciclo: ${value.nombre}. Clic para cambiarlo.` : "Selecciona un ciclo"}
              className={cn(
                "flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                value
                  ? "border-border/60 hover:border-border hover:bg-surface-muted/60"
                  : "border-primary/50 bg-primary/[0.04] hover:border-primary"
              )}
            >
              <Target
                className={cn("size-4 shrink-0", value ? "text-text-muted" : "text-primary")}
                strokeWidth={2.25}
              />
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-bold", value ? "text-text-primary" : "text-primary")}>
                {value ? value.nombre : "Selecciona un ciclo"}
              </span>
              {value && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
                    ESTADO_CLASS[value.estado] ?? "bg-surface-muted text-text-secondary"
                  )}
                >
                  {value.estado}
                </span>
              )}
              <ChevronDown className="size-3.5 shrink-0 text-text-muted" strokeWidth={2.5} />
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[420px] overflow-hidden p-0">
            <div className="border-b border-border/50 px-3 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar ciclo por nombre"
                  aria-label="Buscar ciclo"
                  className="h-8 w-full rounded-lg border border-border/60 bg-surface pl-8 pr-2.5 text-[12px] font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto py-1">
              {results.length === 0 ? (
                <p className="px-3 py-5 text-center text-[11px] font-medium text-text-secondary">
                  Ningún ciclo coincide con "{query}".
                </p>
              ) : (
                results.map((ciclo) => (
                  <button
                    key={ciclo.id}
                    type="button"
                    onClick={() => {
                      onSelectExisting(ciclo);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-muted/60",
                      value?.id === ciclo.id && "bg-primary/5"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-text-primary">{ciclo.nombre}</p>
                      <p className="mt-0.5 truncate text-[10.5px] font-medium text-text-muted">
                        {ciclo.periodo} · {ciclo.fechaInicio} a {ciclo.fechaCierre}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap",
                        ESTADO_CLASS[ciclo.estado] ?? "bg-surface-muted text-text-secondary"
                      )}
                    >
                      {ciclo.estado}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* La cuarta respuesta que un archivo puede necesitar: el ciclo
                todavía no existe. Vive en la misma lista, no en un botón
                aparte, porque es una opción tan válida como cualquier ciclo. */}
            <div className="border-t border-border/50 p-2">
              <button
                type="button"
                onClick={() => {
                  onStartNew();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="size-3.5" strokeWidth={2.25} />
                Crear un ciclo nuevo
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
