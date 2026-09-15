import * as React from "react";
import { Check, Scale, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetFooter } from "@/components/ui/sheet";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import {
  MIN_OBJECTIVE_WEIGHT,
  TOTAL_WEIGHT,
  distributeWeights,
  type Objective,
  type ObjectiveSet,
} from "./cicloBuilderTypes";
import { rescaleObjectives, targetLabel } from "./objectiveSets";

/** Una asignación tal como la ve este modal: su nombre, su cupo y su reparto. */
export interface WeightBalanceGroup {
  setId: string;
  label: string;
  budget: number;
  objectives: readonly Objective[];
}

export type WeightBalanceResult = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

interface WeightBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly WeightBalanceGroup[];
  /** Un mapa `setId -> objectiveId -> peso`, aplicado de una sola vez. */
  onApply: (result: WeightBalanceResult) => void;
  title?: string;
  description?: string;
  /**
   * Con qué caja se presenta. "dialog" —el modal centrado— es lo que usa el
   * constructor, donde cuadrar pesos es un paso más de lo que ya se está
   * escribiendo. "drawer" lo saca por el costado, que es como el resto del
   * módulo abre una edición sobre una tabla que se queda detrás.
   */
  presentation?: "dialog" | "drawer";
}

/** Cómo se llama una asignación dentro del modal, sin que él sepa de grupos. */
export function objectiveSetLabel(set: ObjectiveSet): string {
  if (set.targetIds.length === 0) return "Asignación sin destinatarios";
  const names = set.targetIds.map((id) => targetLabel(set, id));
  return names.length <= 2 ? names.join(" y ") : `${names[0]} y ${names.length - 1} más`;
}

export function weightBalanceGroup(set: ObjectiveSet, budget: number): WeightBalanceGroup {
  return {
    setId: set.id,
    label: objectiveSetLabel(set),
    budget,
    objectives: set.objectives,
  };
}

/**
 * Cuadrar los pesos de una tanda de objetivos sin abrirlos uno por uno.
 *
 * El reparto es una decisión sobre el conjunto —subirle a uno es bajarle a
 * otro— y sin embargo hasta ahora solo se podía tocar desde dentro de cada
 * tarjeta, donde nunca se ven las demás. Este modal pone la lista entera en
 * una pantalla, con su total siempre a la vista, y deja el arreglo automático
 * a un clic: repartir en partes iguales, o estirar lo que ya hay hasta que
 * cierre conservando las proporciones que alguien eligió a mano.
 *
 * Nada se escribe hasta "Aplicar": el borrador vive aquí, así que cerrar sin
 * aplicar deja el ciclo exactamente como estaba.
 */
export function WeightBalanceDialog({
  open,
  onOpenChange,
  groups,
  onApply,
  title = "Ajustar pesos",
  description = "Reparte el peso de cada objetivo sin entrar uno por uno. El total tiene que cerrar antes de aplicar.",
  presentation = "dialog",
}: WeightBalanceDialogProps) {
  const [draft, setDraft] = React.useState<Record<string, Record<string, number>>>({});

  // Cada apertura arranca del reparto que hay hoy: un borrador viejo de una
  // tanda anterior propondría cifras de objetivos que ya no están en pantalla.
  React.useEffect(() => {
    if (!open) return;
    setDraft(
      Object.fromEntries(
        groups.map((group) => [
          group.setId,
          Object.fromEntries(group.objectives.map((o) => [o.id, o.weight])),
        ])
      )
    );
    // Los grupos se recalculan en cada render del padre; lo que importa es el
    // momento de abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalsByGroup = React.useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group.setId,
          group.objectives.reduce((sum, o) => sum + (draft[group.setId]?.[o.id] ?? o.weight), 0),
        ])
      ) as Record<string, number>,
    [groups, draft]
  );

  const offenders = groups.filter((group) => totalsByGroup[group.setId] !== group.budget);
  const canApply = offenders.length === 0;

  const setWeight = (setId: string, objectiveId: string, weight: number) =>
    setDraft((current) => ({
      ...current,
      [setId]: { ...current[setId], [objectiveId]: weight },
    }));

  const applyWeights = (setId: string, objectives: readonly Objective[], weights: number[]) =>
    setDraft((current) => ({
      ...current,
      [setId]: Object.fromEntries(objectives.map((o, index) => [o.id, weights[index]])),
    }));

  const distributeEvenly = (group: WeightBalanceGroup) =>
    applyWeights(
      group.setId,
      group.objectives,
      distributeWeights(group.objectives.length, group.budget)
    );

  /** Estira lo tecleado hasta el cupo, manteniendo las proporciones. */
  const fitToBudget = (group: WeightBalanceGroup) => {
    const withDraft = group.objectives.map((o) => ({
      ...o,
      weight: draft[group.setId]?.[o.id] ?? o.weight,
    }));
    const fitted = rescaleObjectives(withDraft, group.budget);
    applyWeights(
      group.setId,
      group.objectives,
      fitted.map((o) => o.weight)
    );
  };

  const fixEverything = () => groups.forEach(fitToBudget);

  const isDrawer = presentation === "drawer";

  /** Los dos botones que cuadran una tanda sin tocar fila por fila. */
  const groupTools = (group: WeightBalanceGroup) => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => distributeEvenly(group)}
        className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
      >
        Partes iguales
      </button>
      <button
        type="button"
        onClick={() => fitToBudget(group)}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Sparkles className="size-3.5" strokeWidth={2.2} />
        Cuadrar
      </button>
    </div>
  );

  /**
   * Lo que falta o sobra del cupo de una tanda, con la cifra al pie de sus
   * filas y no en la cabecera de la tarjeta: arriba el "60 / 100 %" quedaba
   * mudo sobre si eso es bueno o malo. Aquí dice la palabra que completa el
   * número — falta repartir, se pasó del cupo, o ya quedó al tope — justo
   * donde se acaba de mover el último deslizador.
   */
  const groupFeedback = (group: WeightBalanceGroup) => {
    const total = totalsByGroup[group.setId] ?? 0;
    const diff = total - group.budget;
    const isExact = diff === 0;
    const isOver = diff > 0;
    const Icon = isExact ? Check : TriangleAlert;
    const tone = isExact ? "positive" : isOver ? "negative" : "warning";

    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5",
          tone === "positive" && "border-status-positive/25 bg-status-positive/5",
          tone === "negative" && "border-destructive/25 bg-destructive/5",
          tone === "warning" && "border-status-warning/25 bg-status-warning/5"
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            tone === "positive" && "text-status-positive",
            tone === "negative" && "text-destructive",
            tone === "warning" && "text-status-warning"
          )}
          strokeWidth={2.4}
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-[12.5px] font-semibold",
            tone === "positive" && "text-status-positive",
            tone === "negative" && "text-destructive",
            tone === "warning" && "text-text-secondary"
          )}
        >
          {isExact
            ? "Ya quedó al tope"
            : isOver
              ? `Te pasaste ${diff} % del cupo`
              : `Faltan ${Math.abs(diff)} % por repartir`}
        </p>
        <span
          className={cn(
            "shrink-0 text-[13px] font-bold tabular-nums",
            tone === "positive" && "text-status-positive",
            tone === "negative" && "text-destructive",
            tone === "warning" && "text-text-primary"
          )}
        >
          {total} / {group.budget} %
        </span>
      </div>
    );
  };

  const groupRows = (group: WeightBalanceGroup, stacked: boolean) => (
    <div
      className={cn(
        "flex flex-col divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60",
        // Dentro de una tarjeta del drawer el interior baja un tono, como los
        // bloques del drawer de reportes; en el modal la lista se apoya
        // directo sobre el panel y es ella la que sube.
        stacked ? "bg-background" : "bg-surface"
      )}
    >
      {group.objectives.map((objective, index) => (
        <WeightRow
          key={objective.id}
          position={index + 1}
          objective={objective}
          value={draft[group.setId]?.[objective.id] ?? objective.weight}
          max={group.budget}
          stacked={stacked}
          onChange={(weight) => setWeight(group.setId, objective.id, weight)}
        />
      ))}
    </div>
  );

  const emptyNote = (
    <p className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-4 py-8 text-center text-[12.5px] text-text-secondary">
      No hay objetivos que ajustar todavía.
    </p>
  );

  const statusLine = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[12px] font-medium",
        canApply ? "text-status-positive" : "text-text-secondary"
      )}
    >
      {canApply ? (
        <>
          <Check className="size-3.5 shrink-0" strokeWidth={2.4} />
          Todo cuadra
        </>
      ) : (
        <>
          <TriangleAlert className="size-3.5 shrink-0 text-status-warning" strokeWidth={2.2} />
          {offenders.length === 1
            ? "1 asignación sin cuadrar"
            : `${offenders.length} asignaciones sin cuadrar`}
        </>
      )}
    </span>
  );

  const applyButtons = (
    <>
      {!canApply && groups.length > 0 && (
        <Button variant="outline" className="gap-1.5" onClick={fixEverything}>
          <Sparkles className="size-4" strokeWidth={2.2} />
          Ajustar automáticamente
        </Button>
      )}
      <Button variant="ghost" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button
        disabled={!canApply || groups.length === 0}
        onClick={() => {
          onApply(draft);
          onOpenChange(false);
        }}
      >
        Aplicar
      </Button>
    </>
  );

  /*
   * El panel lateral se arma como el de reportes: fondo de página, y cada
   * tanda en su propia tarjeta con chip, título y la línea que dice qué se
   * está repartiendo. Antes era el cuerpo del modal tal cual, y a lo ancho de
   * un drawer se leía como una lista suelta sobre una hoja en blanco.
   */
  if (isDrawer) {
    return (
      <DrawerShell
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        // El mismo ancho del drawer de reportes: 30 % del viewport con piso en
        // `md`, para que se ensanche en un monitor grande y nunca se encoja en
        // un portátil. `!bg-background` para que el hueco que el Sheet deja
        // entre cabecera, cuerpo y pie no se lea como una franja blanca.
        className="!w-[30vw] !max-w-[30vw] !min-w-[28rem] !bg-background"
        title={title}
        description={description}
        disablePadding
        footer={
          // Sin el texto de estado al lado: a los 28rem del panel, esa
          // frase competía por espacio con los botones y los apretaba. Lo
          // que cuadra o no ya se ve al pie de cada tarjeta, junto a sus
          // propias filas — repetirlo aquí, angosto, sobraba.
          <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-border/60 bg-surface px-4 py-3">
            {applyButtons}
          </SheetFooter>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background px-4 pb-4 pt-1">
          {groups.length === 0 && emptyNote}

          {groups.map((group) => (
            <DrawerSection
              key={group.setId}
              icon={Scale}
              tone="brand"
              title={group.label}
              hint={
                group.budget === TOTAL_WEIGHT
                  ? `Cuánto pesa cada objetivo dentro de su ${TOTAL_WEIGHT} %. Sube uno y tendrás que bajarle a otro.`
                  : `Cupo de ${group.budget} % — comparte el ciclo con otra asignación.`
              }
              contentClassName="flex flex-col gap-2.5"
            >
              <div className="flex justify-end">{groupTools(group)}</div>
              {groupRows(group, true)}
              {groupFeedback(group)}
            </DrawerSection>
          ))}
        </div>
      </DrawerShell>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Scale className="size-4" strokeWidth={2.2} />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed text-text-secondary">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[52vh] flex-col gap-4 overflow-y-auto px-5 py-4">
          {groups.length === 0 && emptyNote}

          {groups.map((group) => (
            <section key={group.setId} className="flex flex-col gap-2.5">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-bold text-text-primary">
                    {group.label}
                  </span>
                  {group.budget !== TOTAL_WEIGHT && (
                    <span className="text-[11.5px] font-medium text-text-muted">
                      Cupo de {group.budget} % — comparte el ciclo con otra asignación
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">{groupTools(group)}</div>
              </header>

              {groupRows(group, false)}
              {groupFeedback(group)}
            </section>
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
          {statusLine}
          <div className="flex shrink-0 items-center gap-2">{applyButtons}</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Una fila del reparto: qué objetivo es, y cuánto pesa.
 *
 * `stacked` la parte en dos renglones —nombre arriba, control abajo— para el
 * panel lateral, que es la mitad de ancho que el modal: en una sola línea el
 * nombre quedaba en tres palabras y el deslizador en un pulgar de largo.
 */
function WeightRow({
  position,
  objective,
  value,
  max,
  stacked = false,
  onChange,
}: {
  position: number;
  objective: Objective;
  value: number;
  max: number;
  stacked?: boolean;
  onChange: (weight: number) => void;
}) {
  const [typed, setTyped] = React.useState(() => String(value));
  React.useEffect(() => setTyped(String(value)), [value]);

  const commit = () => {
    const parsed = Number.parseInt(typed, 10);
    const next = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(TOTAL_WEIGHT, parsed));
    onChange(next);
    setTyped(String(next));
  };

  const name = objective.title.trim() || "Objetivo sin título";

  const index = (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10.5px] font-bold tabular-nums text-text-secondary">
      {position}
    </span>
  );

  const slider = (
    <Slider
      value={[value]}
      min={0}
      max={Math.max(max, MIN_OBJECTIVE_WEIGHT)}
      step={1}
      onValueChange={([next]) => onChange(next)}
      aria-label={`Peso de ${name}`}
      className={stacked ? "min-w-0 flex-1" : "w-[140px] shrink-0"}
    />
  );

  const amount = (
    <span className="relative flex w-[72px] shrink-0 items-center">
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
        aria-label={`Peso de ${name} en porcentaje`}
        className="h-9 w-full rounded-md border border-border bg-surface pl-6 pr-2 text-center text-[12.5px] font-semibold tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
    </span>
  );

  if (stacked) {
    return (
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          {index}
          {/* Sin truncar: en dos renglones el nombre completo cabe, y saber
              cuál es el objetivo es justo lo que decide cuánto pesa. */}
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-text-primary">
            {name}
          </span>
        </div>
        <div className="flex items-center gap-3 pl-[30px]">
          {slider}
          {amount}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      {index}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-primary">
        {name}
      </span>
      {slider}
      {amount}
    </div>
  );
}
