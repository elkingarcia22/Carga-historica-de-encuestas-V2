import * as React from "react";
import {
  Check,
  Sparkles,
  SplitSquareHorizontal,
  TriangleAlert,
  UserRound,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOTAL_WEIGHT } from "./cicloBuilderTypes";
import { splitAcrossSources, type PersonLoad } from "./weightConflicts";

interface WeightConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quiénes están descuadrados y por dónde les llegan los objetivos. */
  loads: readonly PersonLoad[];
  /** Un mapa `setId -> cupo`, aplicado de una sola vez sobre el ciclo. */
  onApply: (shares: ReadonlyMap<string, number>) => void;
  /**
   * Saca a esta persona de esa asignación grupal, dejándola intacta para el
   * resto del grupo. Ausente, la opción no se ofrece.
   */
  onSeparate?: (setId: string, personId: string) => void;
}

/**
 * Quién se pasa del 100 %, por qué, y cómo arreglarlo sin salir de aquí.
 *
 * El choque no se ve desde ninguna asignación: cada una cierra bien en lo
 * suyo, y sin embargo la persona que está en las dos lleva 160 %. Por eso el
 * modal se organiza por persona y no por asignación — nombra a quién le pasa,
 * enseña por dónde le llega cada parte, y deja repartir su 100 entre esas
 * vías. "Ajustar automáticamente" hace ese reparto proporcionalmente, que es
 * lo que casi siempre se quiere: nadie pierde su prioridad relativa, solo
 * caben todos.
 *
 * Un cupo pertenece a la asignación, no a la persona, así que tocarlo cuando
 * la comparten varios lo dice antes de dejar aplicar.
 */
export function WeightConflictDialog({
  open,
  onOpenChange,
  loads,
  onApply,
  onSeparate,
}: WeightConflictDialogProps) {
  const [shares, setShares] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!open) return;
    const initial: Record<string, number> = {};
    loads.forEach((load) =>
      load.sources.forEach((source) => {
        initial[source.setId] = source.weight;
      })
    );
    setShares(initial);
    // El estado arranca del reparto real cada vez que se abre; el padre
    // recalcula `loads` en cada render y no es una razón para reiniciarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shareOf = (source: PersonLoad["sources"][number]) =>
    shares[source.setId] ?? source.weight;

  const personTotal = (load: PersonLoad) =>
    load.sources.reduce((sum, source) => sum + shareOf(source), 0);

  /**
   * Cerrar en 100 no basta: una vía en 0 % es una asignación que existe y no
   * cuenta para nada. Dejar pasar ese reparto sería dar por resuelto justo el
   * caso que trajo a alguien hasta aquí — "quiero ponerle esto y no me cabe".
   */
  const isResolved = (load: PersonLoad) =>
    personTotal(load) === TOTAL_WEIGHT && load.sources.every((source) => shareOf(source) > 0);

  const unresolved = loads.filter((load) => !isResolved(load));
  const canApply = unresolved.length === 0 && loads.length > 0;

  const autoAdjust = () => {
    // La propuesta se arma en limpio y solo después se mezcla con lo tecleado:
    // compararla contra el reparto actual haría que un cupo que hoy está en 0 %
    // —la asignación que se está creando— se quedara ahí para siempre.
    const proposal = new Map<string, number>();
    loads.forEach((load) => {
      splitAcrossSources(load.sources).forEach((share, setId) => {
        // La misma asignación puede tocar a dos personas con conflictos
        // distintos: gana la propuesta más estricta, que es la única que deja
        // a las dos dentro de 100.
        const previous = proposal.get(setId);
        proposal.set(setId, previous === undefined ? share : Math.min(previous, share));
      });
    });
    setShares((current) => ({ ...current, ...Object.fromEntries(proposal) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-status-warning/15 text-status-warning">
              <TriangleAlert className="size-4" strokeWidth={2.2} />
            </span>
            Conflictos de peso
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed text-text-secondary">
            Estas personas reciben objetivos por más de una vía y su ciclo no cierra en{" "}
            {TOTAL_WEIGHT} %. Reparte su {TOTAL_WEIGHT} % entre las asignaciones que las alcanzan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto px-5 py-4">
          {loads.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-4 py-8 text-center text-[12.5px] text-text-secondary">
              Nadie está recibiendo objetivos por dos vías a la vez.
            </p>
          )}

          {loads.map((load) => {
            const total = personTotal(load);
            const isExact = isResolved(load);
            return (
              <section
                key={load.personId}
                className={cn(
                  "flex flex-col gap-2.5 rounded-xl border bg-surface p-3.5",
                  isExact ? "border-status-positive/40" : "border-destructive/30"
                )}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
                      <UserRound className="size-4" strokeWidth={2.2} />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-bold text-text-primary">
                        {load.name}
                      </span>
                      <span className="truncate text-[11.5px] font-medium text-text-muted">
                        {load.area} · {load.sources.length} asignaciones
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums",
                      isExact
                        ? "bg-status-positive/10 text-status-positive"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {total} / {TOTAL_WEIGHT} %
                  </span>
                </header>

                <div className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60">
                  {load.sources.map((source) => (
                    <div
                      key={source.setId}
                      className="flex items-center gap-3 bg-surface-muted/20 px-3 py-2.5"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
                        {source.kind === "grupal" ? (
                          <Users2 className="size-3.5" strokeWidth={2.2} />
                        ) : (
                          <UserRound className="size-3.5" strokeWidth={2.2} />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[12.5px] font-semibold text-text-primary">
                          {source.label}
                        </span>
                        <span className="truncate text-[11px] font-medium text-text-muted">
                          {source.objectiveCount}{" "}
                          {source.objectiveCount === 1 ? "objetivo" : "objetivos"}
                          {source.sharedWith > 0 &&
                            ` · afecta a ${source.sharedWith} ${
                              source.sharedWith === 1 ? "persona más" : "personas más"
                            }`}
                        </span>
                      </div>
                      {/* Bajarle el cupo a una asignación que comparten
                          cientos de personas por culpa de una sola es una
                          decisión cara, así que la salida barata va justo al
                          lado: sacar a esta persona y dejar al grupo como
                          estaba. */}
                      {onSeparate && source.kind === "grupal" && source.sharedWith > 0 && (
                        <button
                          type="button"
                          onClick={() => onSeparate(source.setId, load.personId)}
                          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          title={`Saca a ${load.name} de esta asignación sin cambiarle nada a las otras ${source.sharedWith} personas`}
                        >
                          <SplitSquareHorizontal className="size-3.5" strokeWidth={2.2} />
                          Separar
                        </button>
                      )}
                      <ShareInput
                        value={shares[source.setId] ?? source.weight}
                        onChange={(next) =>
                          setShares((current) => ({ ...current, [source.setId]: next }))
                        }
                        label={`Cupo de ${source.label}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-[12px] font-medium",
              canApply ? "text-status-positive" : "text-text-secondary"
            )}
          >
            {loads.length === 0 ? (
              <>
                <Check className="size-3.5 shrink-0 text-status-positive" strokeWidth={2.4} />
                Ya no queda nada por ajustar
              </>
            ) : canApply ? (
              <>
                <Check className="size-3.5 shrink-0" strokeWidth={2.4} />
                Todos cierran en {TOTAL_WEIGHT} %
              </>
            ) : (
              <>
                <TriangleAlert className="size-3.5 shrink-0 text-status-warning" strokeWidth={2.2} />
                {unresolved.length === 1
                  ? "1 persona sin cuadrar"
                  : `${unresolved.length} personas sin cuadrar`}
              </>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {!canApply && loads.length > 0 && (
              <Button variant="outline" className="gap-1.5" onClick={autoAdjust}>
                <Sparkles className="size-4" strokeWidth={2.2} />
                Ajustar automáticamente
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!canApply}
              onClick={() => {
                onApply(new Map(Object.entries(shares)));
                onOpenChange(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [typed, setTyped] = React.useState(() => String(value));
  React.useEffect(() => setTyped(String(value)), [value]);

  const commit = () => {
    const parsed = Number.parseInt(typed, 10);
    const next = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(TOTAL_WEIGHT, parsed));
    onChange(next);
    setTyped(String(next));
  };

  return (
    <span className="relative flex w-[76px] shrink-0 items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 text-[12px] font-semibold text-text-secondary"
      >
        %
      </span>
      <input
        value={typed}
        inputMode="numeric"
        onChange={(event) => setTyped(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        aria-label={label}
        className="h-9 w-full rounded-md border border-border bg-surface pl-6 pr-2 text-center text-[12.5px] font-semibold tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
    </span>
  );
}
