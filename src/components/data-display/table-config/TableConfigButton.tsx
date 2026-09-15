import { Eye, EyeOff, GripVertical, ListEnd, Lock, Pin, PinOff, Rows3, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TableConfig } from "./useTableConfig";
import { useColumnDrag } from "./useColumnDrag";
import type { TableRowsMode } from "./tableConfigTypes";

/**
 * "Configurar", el botón que se sienta junto a "Filtros".
 *
 * Filtrar cambia qué filas se miran; configurar cambia cómo se mira la tabla
 * —qué columnas, en qué orden, cómo llegan las filas—. Son dos preguntas
 * distintas y por eso son dos botones vecinos y no un solo menú con todo
 * dentro, pero viven en la misma fila porque se contestan en el mismo momento:
 * justo antes de ponerse a leer.
 *
 * Reordenar se puede hacer aquí y también arrastrando el encabezado en la
 * tabla. Las dos formas mueven el mismo estado: el panel es para quien viene
 * a buscar el control, el encabezado para quien ya sabe qué quiere mover.
 */

/*
 * El nombre de lo que se lista entra en la frase sin artículo —"se cargan más
 * colaboradores"— porque el género lo pone cada tabla: "las encuestas" y "los
 * colaboradores" no comparten plantilla.
 */
const MODES: {
  id: TableRowsMode;
  label: string;
  hint: (noun: string) => string;
  icon: typeof Rows3;
}[] = [
  {
    id: "lazy",
    label: "Scroll infinito",
    hint: (noun) => `Se cargan más ${noun} a medida que bajas.`,
    icon: ListEnd,
  },
  {
    id: "paged",
    label: "Paginación",
    hint: () => "Página por página, con su tamaño fijo.",
    icon: Rows3,
  },
];

export function TableConfigButton({
  config,
  /** "colaboradores", "ciclos"… para nombrar lo que se está listando. */
  noun = "filas",
  /** Falso donde la tabla no ofrece paginación —una lista corta dentro de un panel. */
  showRowsMode = true,
  className,
}: {
  config: TableConfig;
  noun?: string;
  showRowsMode?: boolean;
  className?: string;
}) {
  const drag = useColumnDrag({ axis: "y", onReorder: config.moveColumn });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Configurar la tabla"
          title="Configurar la tabla"
          className={cn(
            "relative h-9 w-9 shrink-0 justify-center rounded-lg border-border bg-surface p-0 text-text-primary transition-colors hover:bg-border/30",
            config.isDirty && "border-primary/50 text-primary",
            className
          )}
        >
          <Settings2
            className={cn("h-4 w-4", config.isDirty ? "text-primary" : "text-muted-foreground")}
            strokeWidth={2}
          />
          {/* Un punto y no un contador: en un botón de 36 px una cifra se lee
              como parte del icono. Lo que hace falta saber aquí es que la
              tabla no está como viene de fábrica; el detalle está dentro. */}
          {config.isDirty && (
            <span
              aria-hidden
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[330px] max-h-[var(--radix-popover-content-available-height)] gap-0 overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-popover px-3.5 py-3">
          <div className="min-w-0">
            <PopoverTitle className="text-[13px]">Configurar tabla</PopoverTitle>
            <PopoverDescription className="mt-0.5 text-[12px] leading-relaxed">
              Qué columnas ves, en qué orden y cómo se cargan las filas.
            </PopoverDescription>
          </div>
          {config.isDirty && (
            <button
              type="button"
              onClick={config.reset}
              className="shrink-0 pt-0.5 text-[12px] font-medium text-primary underline-offset-2 transition-colors hover:underline"
            >
              Restablecer
            </button>
          )}
        </div>

        <section className="flex flex-col gap-1.5 border-b border-border/50 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[12px] font-bold text-text-primary">Columnas</h4>
            {config.hiddenCount > 0 && (
              <button
                type="button"
                onClick={config.showAllColumns}
                className="text-[12px] font-medium text-primary underline-offset-2 transition-colors hover:underline"
              >
                Mostrar todas
              </button>
            )}
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Arrástralas para cambiar el orden —también desde el encabezado de la tabla—. La
            chincheta deja una columna quieta al desplazarte de lado.
          </p>

          <ul className="mt-1 flex flex-col">
            {config.fixedColumns.map((column) => (
              <li
                key={column.id}
                className="flex items-center gap-2 rounded-md px-1 py-1.5 text-[12.5px] text-muted-foreground"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate">{column.label}</span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide">Fija</span>
              </li>
            ))}

            {config.movableColumns.map((column) => {
              const isHidden = config.hidden.has(column.id);
              const isPinned = config.pinned.has(column.id);
              const side = drag.dropSideFor(column.id);
              return (
                <li
                  key={column.id}
                  {...drag.dropTargetProps(column.id)}
                  data-drag-cell=""
                  className={cn(
                    "relative flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/50",
                    drag.draggingId === column.id && "opacity-40",
                    side === "before" &&
                      "before:absolute before:inset-x-1 before:top-0 before:h-0.5 before:rounded-full before:bg-primary before:content-['']",
                    side === "after" &&
                      "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:content-['']"
                  )}
                >
                  <span
                    {...drag.dragHandleProps(column.id)}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Mover ${column.label}`}
                    className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/70 transition-colors hover:text-text-primary active:cursor-grabbing"
                  >
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>

                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[12.5px]",
                      isHidden ? "text-muted-foreground line-through" : "text-text-primary"
                    )}
                  >
                    {column.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => config.togglePin(column.id)}
                    aria-label={`${isPinned ? "Soltar" : "Fijar"} la columna ${column.label}`}
                    aria-pressed={isPinned}
                    title={
                      isPinned
                        ? "Soltar: vuelve a desplazarse con la tabla"
                        : "Fijar: se queda quieta al desplazarte de lado"
                    }
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                      isPinned
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-text-primary"
                    )}
                  >
                    {isPinned ? (
                      <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => config.toggleVisibility(column.id)}
                    aria-label={`${isHidden ? "Mostrar" : "Ocultar"} la columna ${column.label}`}
                    aria-pressed={!isHidden}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                      isHidden
                        ? "text-muted-foreground hover:bg-muted hover:text-text-primary"
                        : "text-primary hover:bg-primary/10"
                    )}
                  >
                    {isHidden ? (
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {showRowsMode && (
          <section className="flex flex-col gap-1.5 px-3.5 py-3">
            <h4 className="text-[12px] font-bold text-text-primary">Cómo llegan las filas</h4>
            <div className="mt-0.5 flex flex-col gap-1.5">
              {MODES.map((mode) => {
                const active = config.mode === mode.id;
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => config.setMode(mode.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/40"
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                      strokeWidth={2}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[12.5px] font-semibold",
                          active ? "text-primary" : "text-text-primary"
                        )}
                      >
                        {mode.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                        {mode.hint(noun)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </PopoverContent>
    </Popover>
  );
}
