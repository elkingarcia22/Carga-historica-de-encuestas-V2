import * as React from "react";
import { Check, ChevronDown, FilePlus2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MEASURE_SYMBOL,
  searchObjectives,
  type ObjectiveLink,
  type ParsedObjective,
} from "@/lib/objectivesImport";

/**
 * Elegir cuál de los objetivos del usuario reescribe una fila de edición.
 *
 * Hermano de `UserIdentityPicker`, un nivel más abajo y con el mismo principio:
 * el nombre es el control. Allá el nombre de la persona abre el directorio;
 * aquí el nombre del objetivo abre los objetivos de esa persona.
 *
 * Lo que agrega es una cuarta respuesta: un identificador sin nadie detrás es
 * un callejón sin salida, pero un objetivo sin nada detrás tiene una salida
 * perfectamente buena — cargarlo como objetivo nuevo.
 */

const ObjectiveFacts: React.FC<{ objective: ParsedObjective }> = ({ objective }) => (
  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-medium text-text-secondary/70">
    <span className="tabular-nums">Peso {objective.weightPercent}%</span>
    <span>
      {MEASURE_SYMBOL[objective.measureType]} {objective.measureType}
    </span>
    <span className="tabular-nums">
      {objective.trend === "Aumentar" ? "↗" : "↘"} Meta {objective.target}
    </span>
  </span>
);

export interface ObjectiveMatchPickerProps {
  /** El nombre propio de la fila: cómo se llamará el objetivo tras la edición. */
  title: string;
  link: ObjectiveLink;
  /** Los objetivos del usuario en este ciclo — todo a lo que la fila puede apuntar. */
  candidates: ParsedObjective[];
  /** Ids que otras filas del archivo ya reclamaron, y no se pueden repetir. */
  takenIds: ReadonlySet<string>;
  /** `null` significa "deja de reescribir y créalo nuevo". */
  onChange: (targetId: string | null) => void;
  /** Falso mientras el grupo no tiene usuario: no hay dónde buscar. */
  enabled: boolean;
  /**
   * Si "crear como objetivo nuevo" es una de las respuestas. Lo es al editar
   * y no al actualizar avances: un objetivo que no existe no tiene avance que
   * reportar.
   */
  allowCreateNew?: boolean;
}

export const ObjectiveMatchPicker: React.FC<ObjectiveMatchPickerProps> = ({
  title,
  link,
  candidates,
  takenIds,
  onChange,
  enabled,
  allowCreateNew = true,
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const byId = React.useMemo(
    () => new Map(candidates.map((objective) => [objective.id, objective])),
    [candidates]
  );

  const shown = link.targetId
    ? byId.get(link.targetId)
    : link.suggestionId
      ? byId.get(link.suggestionId)
      : undefined;

  const isPending = link.status === "possible";
  const isCreating = link.targetId === undefined && !isPending;

  const results = React.useMemo(
    () =>
      searchObjectives(
        // Un objetivo que otra fila ya reescribe no se ofrece: dos ediciones al
        // mismo objetivo se pisarían y la segunda ganaría en silencio.
        candidates.filter((objective) => !takenIds.has(objective.id) || objective.id === link.targetId),
        query
      ),
    [candidates, takenIds, link.targetId, query]
  );

  const select = (targetId: string | null) => {
    onChange(targetId);
    setOpen(false);
    setQuery("");
  };

  return (
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
          disabled={!enabled}
          aria-label={
            shown
              ? `${title}. Corresponde a “${shown.title}” en UBITS. Clic para cambiar a qué objetivo apunta.`
              : allowCreateNew
                ? `${title}. No se encontró en UBITS, se creará nuevo. Clic para asociarlo a uno existente.`
                : `${title}. No se encontró en UBITS. Clic para elegir a qué objetivo corresponde.`
          }
          title={
            isPending
              ? link.reason
              : shown
                ? `Corresponde a “${shown.title}”. Clic para cambiarlo.`
                : allowCreateNew
                  ? `“${link.lookupTitle}” no existe en UBITS: se creará como objetivo nuevo. Clic para asociarlo a uno existente.`
                  : `“${link.lookupTitle}” no existe en UBITS. Clic para elegir a cuál corresponde.`
          }
          className={cn(
            "group/link flex h-7 w-full min-w-0 items-center gap-1 rounded-md border px-1.5 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-40",
            isPending ? "border-border/50 bg-surface" : "border-transparent",
            "hover:border-border/50 hover:bg-surface"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{title}</span>
          <ChevronDown
            className="size-3 shrink-0 text-text-muted/70 transition-colors group-hover/link:text-text-secondary"
            strokeWidth={2.5}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[420px] overflow-hidden p-0">
        <div className="border-b border-border/50 px-3 py-2.5">
          {isPending ? (
            <p className="text-[11px] font-medium text-text-secondary">
              Te proponemos esta asociación por nombre. Confírmala o elige otra.
            </p>
          ) : isCreating ? null : (
            <p className="text-[11px] font-medium text-text-secondary">
              El archivo busca{" "}
              <span className="break-words font-bold text-text-primary">“{link.lookupTitle}”</span>
            </p>
          )}
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar entre los objetivos de este usuario"
              aria-label="Buscar objetivo del usuario"
              className="h-8 w-full rounded-lg border border-border/60 bg-surface pl-8 pr-2.5 text-[12px] font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <p className="text-[11px] font-medium text-text-secondary">
                {candidates.length === 0
                  ? "Este usuario todavía no tiene objetivos en el ciclo."
                  : `Ninguno de sus objetivos coincide con "${query}".`}
              </p>
            </div>
          ) : (
            results.map((objective) => {
              const isSelected = objective.id === link.targetId;
              const isSuggested = objective.id === link.suggestionId && isPending;
              return (
                <button
                  key={objective.id}
                  type="button"
                  onClick={() => select(objective.id)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                    isSelected ? "bg-primary/5" : "hover:bg-surface-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      isSelected ? "text-primary" : "text-transparent"
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-bold text-text-primary">{objective.title}</span>
                      {isSuggested && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold bg-status-warning/15 text-status-warning">
                          Propuesto
                        </span>
                      )}
                    </span>
                    <ObjectiveFacts objective={objective} />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {allowCreateNew && (
          <div className="border-t border-border/50 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => select(null)}
              className={cn(
                "w-full justify-start gap-1.5 px-2 text-[11px] font-bold",
                isCreating ? "bg-primary/5 text-primary" : "text-text-secondary hover:bg-primary/10 hover:text-primary"
              )}
            >
              <FilePlus2 className="size-3.5" strokeWidth={2.25} />
              {isCreating ? "Se creará como objetivo nuevo" : "Crear como objetivo nuevo"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
