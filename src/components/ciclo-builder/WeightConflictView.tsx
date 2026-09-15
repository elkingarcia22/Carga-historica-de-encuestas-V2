import * as React from "react";
import {
  ArrowLeft,
  Check,
  Scale,
  Sparkles,
  SplitSquareHorizontal,
  TriangleAlert,
  UserRound,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOTAL_WEIGHT } from "./cicloBuilderTypes";
import {
  groupLoadsBySources,
  splitAcrossSources,
  type ConflictGroup,
  type LoadSource,
  type PersonLoad,
} from "./weightConflicts";

/** Cómo va el reparto ahora mismo, en una línea. */
export interface WeightSharesStatus {
  text: string;
  isDone: boolean;
}

export interface WeightSharesController {
  groups: readonly ConflictGroup[];
  shareOf: (source: LoadSource) => number;
  setShare: (setId: string, value: number) => void;
  /** Reparte el ciclo de cada quien entre sus asignaciones, proporcionalmente. */
  autoAdjust: () => void;
  canApply: boolean;
  status: WeightSharesStatus;
  /** Lo tecleado, listo para aplicarse sobre el ciclo de una sola vez. */
  shareMap: () => ReadonlyMap<string, number>;
  isBalanced: (group: ConflictGroup) => boolean;
  isResolved: (group: ConflictGroup) => boolean;
}

/**
 * El reparto del peso, sin la pantalla que lo muestra.
 *
 * Vive fuera de la vista porque quien enseña estas tarjetas no es quien
 * ofrece sus acciones: dentro del cajón, "Repartir por mí" y "Aplicar pesos"
 * son botones de la barra flotante, que se dibuja aparte del cuerpo. El
 * estado tiene que estar donde los dos lo alcancen.
 */
export function useWeightShares(
  loads: readonly PersonLoad[],
  active: boolean
): WeightSharesController {
  const [shares, setShares] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!active) return;
    const initial: Record<string, number> = {};
    loads.forEach((load) =>
      load.sources.forEach((source) => {
        initial[source.setId] = source.weight;
      })
    );
    setShares(initial);
    // Arranca del reparto real cada vez que se entra; el anfitrión recalcula
    // `loads` en cada render y eso no es motivo para reiniciar lo tecleado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const groups = React.useMemo(() => groupLoadsBySources(loads), [loads]);

  const shareOf = (source: LoadSource) => shares[source.setId] ?? source.weight;
  const groupTotal = (group: ConflictGroup) =>
    group.sources.reduce((sum, source) => sum + shareOf(source), 0);

  /**
   * Son dos problemas distintos y se cuentan por separado, porque decirlos
   * juntos miente: un reparto puede sumar 100 y seguir sin servir si deja una
   * asignación en 0 % —existe y no pesa nada—, y avisar de eso con un "no
   * suma 100 %" delante de un 100 clavado no hay quien lo entienda.
   */
  const isBalanced = (group: ConflictGroup) => groupTotal(group) === TOTAL_WEIGHT;
  const hasEmpty = (group: ConflictGroup) => group.sources.some((source) => shareOf(source) === 0);
  const isResolved = (group: ConflictGroup) => isBalanced(group) && !hasEmpty(group);

  const peopleOff = groups
    .filter((group) => !isBalanced(group))
    .reduce((sum, group) => sum + group.people.length, 0);
  const emptyCount = new Set(
    groups.flatMap((group) =>
      group.sources.filter((source) => shareOf(source) === 0).map((source) => source.setId)
    )
  ).size;
  const canApply = groups.length > 0 && groups.every(isResolved);
  const affected = loads.length;

  const status: WeightSharesStatus = canApply
    ? {
        isDone: true,
        text:
          affected === 1
            ? `Su ciclo cierra en ${TOTAL_WEIGHT} %`
            : `Los ${affected} ciclos cierran en ${TOTAL_WEIGHT} %`,
      }
    : {
        isDone: false,
        text:
          peopleOff > 0
            ? peopleOff === 1
              ? `A 1 persona no le suma ${TOTAL_WEIGHT} %`
              : `A ${peopleOff} personas no les suma ${TOTAL_WEIGHT} %`
            : emptyCount === 1
              ? "Una asignación se quedaría en 0 % y no contaría"
              : `${emptyCount} asignaciones se quedarían en 0 % y no contarían`,
      };

  const autoAdjust = () => {
    // La propuesta se arma en limpio y solo después se mezcla con lo tecleado:
    // compararla contra el reparto actual haría que un peso que hoy está en 0 %
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

  return {
    groups,
    shareOf,
    setShare: (setId, value) => setShares((current) => ({ ...current, [setId]: value })),
    autoAdjust,
    canApply,
    status,
    shareMap: () => new Map(Object.entries(shares)),
    isBalanced,
    isResolved,
  };
}

interface WeightConflictViewProps {
  controller: WeightSharesController;
  /** Cuánta gente está en esto: lo dice la cabecera. */
  affected: number;
  onBack: () => void;
  /**
   * Saca a esta persona de esa asignación grupal, dejándola intacta para el
   * resto del grupo. Ausente, la opción no se ofrece.
   */
  onSeparate?: (setId: string, personId: string) => void;
}

/**
 * Repartir el 100 % de peso de una persona cuando le llegan objetivos por dos
 * asignaciones a la vez.
 *
 * Es una página más dentro del cajón —como el banco de objetivos—, no una
 * ventana encima. Antes era un modal que se abría sobre un drawer que ya era
 * modal: dos velos apagando la misma pantalla y un panel sin relación con lo
 * que lo trajo. Aquí se entra y se sale con el mismo gesto que el resto del
 * flujo, y sus acciones viven donde viven todas, en la barra flotante.
 *
 * Y se organiza por caso, no por persona. El peso que se teclea es el de la
 * asignación, no el del individuo: con 750 personas compartiendo las mismas
 * dos vías había 750 fichas repitiendo el mismo par de campos, y editar uno
 * los movía todos. Una tarjeta por combinación dice la verdad y cabe.
 */
export function WeightConflictView({
  controller,
  affected,
  onBack,
  onSeparate,
}: WeightConflictViewProps) {
  const { groups, shareOf, setShare, isBalanced, isResolved } = controller;

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-4 border-b border-border/60 bg-surface px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ArrowLeft className="size-4" strokeWidth={2.2} />
          </button>

          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-status-warning/15 text-status-warning"
          >
            <Scale className="size-4" strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-bold text-text-primary">
              Repartir el peso del ciclo
            </h3>
            <p className="truncate text-[12px] text-text-secondary">
              Los objetivos de una persona reparten {TOTAL_WEIGHT} % entre todos, y{" "}
              {affected === 1
                ? "esta persona los recibe"
                : `estas ${affected} personas los reciben`}{" "}
              por más de una asignación.
            </p>
          </div>
        </div>

        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold",
            controller.status.isDone
              ? "bg-status-positive/10 text-status-positive"
              : "bg-status-warning/10 text-status-warning"
          )}
        >
          {controller.status.isDone ? (
            <Check className="size-3.5" strokeWidth={2.6} />
          ) : (
            <TriangleAlert className="size-3.5" strokeWidth={2.2} />
          )}
          {controller.status.text}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-4 py-10 text-center text-[12.5px] text-text-secondary">
          Ya nadie recibe objetivos por dos asignaciones a la vez.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              total={group.sources.reduce((sum, source) => sum + shareOf(source), 0)}
              isBalanced={isBalanced(group)}
              isResolved={isResolved(group)}
              shareOf={shareOf}
              onShareChange={setShare}
              onSeparate={onSeparate}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Un caso: las personas que comparten las mismas asignaciones, y cómo se
 *  reparte su ciclo entre ellas. */
function GroupCard({
  group,
  total,
  isBalanced,
  isResolved,
  shareOf,
  onShareChange,
  onSeparate,
}: {
  group: ConflictGroup;
  total: number;
  /** La suma da {TOTAL_WEIGHT}. Es lo único que dice el contador de arriba:
   *  que una asignación se haya quedado en 0 % se avisa en su propia fila. */
  isBalanced: boolean;
  isResolved: boolean;
  shareOf: (source: LoadSource) => number;
  onShareChange: (setId: string, value: number) => void;
  onSeparate?: (setId: string, personId: string) => void;
}) {
  const people = group.people;
  const isSingle = people.length === 1;
  const names = people.slice(0, 2).map((person) => person.name);
  const rest = people.length - names.length;

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-card",
        isResolved ? "border-status-positive/40" : "border-status-warning/40"
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
            {isSingle ? (
              <UserRound className="size-4" strokeWidth={2.2} />
            ) : (
              <Users2 className="size-4" strokeWidth={2.2} />
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-bold text-text-primary">
              {isSingle ? people[0].name : `${people.length} personas`}
            </span>
            <span className="truncate text-[11.5px] font-medium text-text-muted">
              {isSingle
                ? people[0].area
                : `${names.join(", ")}${rest > 0 ? ` y ${rest} más` : ""}`}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold tabular-nums",
            isBalanced
              ? "bg-status-positive/10 text-status-positive"
              : "bg-status-warning/10 text-status-warning"
          )}
        >
          {isBalanced ? (
            <Check className="size-3.5" strokeWidth={2.8} />
          ) : (
            <TriangleAlert className="size-3.5" strokeWidth={2.4} />
          )}
          {total} de {TOTAL_WEIGHT} % de peso
        </span>
      </header>

      <div className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
        {group.sources.map((source) => {
          const isEmpty = shareOf(source) === 0;
          return (
            <div
              key={source.setId}
              className="flex items-center gap-3 bg-surface-muted/20 px-3.5 py-3"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary">
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
                <span
                  className={cn(
                    "truncate text-[11px] font-medium",
                    isEmpty ? "text-status-warning" : "text-text-muted"
                  )}
                >
                  {isEmpty
                    ? "Sin peso: sus objetivos no contarían para nadie"
                    : `${source.objectiveCount} ${
                        source.objectiveCount === 1 ? "objetivo" : "objetivos"
                      }${
                        source.sharedWith > 0
                          ? ` · el mismo peso para ${source.sharedWith} ${
                              source.sharedWith === 1 ? "persona más" : "personas más"
                            }`
                          : ""
                      }`}
                </span>
              </div>
              {/* Bajarle el peso a una asignación que comparten cientos de
                  personas por culpa de una sola es una decisión cara, así que la
                  salida barata va justo al lado: sacar a esta persona y dejar al
                  grupo como estaba. Solo cuando el caso es de una: sacar a 750
                  personas de a una no es una salida, es otro problema. */}
              {onSeparate && isSingle && source.kind === "grupal" && source.sharedWith > 0 && (
                <button
                  type="button"
                  onClick={() => onSeparate(source.setId, people[0].personId)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  title={`Saca a ${people[0].name} de esta asignación sin cambiarle el peso a las otras ${source.sharedWith} personas`}
                >
                  <SplitSquareHorizontal className="size-3.5" strokeWidth={2.2} />
                  Sacarla de aquí
                </button>
              )}
              <ShareInput
                value={shareOf(source)}
                onChange={(next) => onShareChange(source.setId, next)}
                label={`Peso de ${source.label}`}
                hasWarning={isEmpty}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Las dos acciones del reparto, para quien no tiene barra flotante donde
 * ponerlas. Dentro del cajón no se usa: allí son botones del rail.
 */
export function WeightConflictActions({
  controller,
  onCancel,
  onApply,
}: {
  controller: WeightSharesController;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-xl px-3.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        Cancelar
      </button>
      {controller.groups.length > 0 && (
        <button
          type="button"
          onClick={controller.autoAdjust}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
        >
          <Sparkles className="size-4" strokeWidth={2.2} />
          Repartir por mí
        </button>
      )}
      <button
        type="button"
        disabled={!controller.canApply}
        onClick={onApply}
        className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        <Check className="size-4" strokeWidth={2.4} />
        Aplicar pesos
      </button>
    </div>
  );
}

function ShareInput({
  value,
  onChange,
  label,
  hasWarning = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  hasWarning?: boolean;
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
    <span className="relative flex w-[86px] shrink-0 items-center">
      <input
        value={typed}
        inputMode="numeric"
        onChange={(event) => setTyped(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        aria-label={label}
        className={cn(
          "h-10 w-full rounded-lg border bg-surface pl-3 pr-7 text-left text-[13px] font-bold tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25",
          hasWarning ? "border-status-warning/60 bg-status-warning/5" : "border-border"
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-[12px] font-semibold text-text-muted"
      >
        %
      </span>
    </span>
  );
}
