import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Flag, Hash, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  KEY_ACTION_KIND_META,
  TOTAL_WEIGHT,
  createKeyAction,
  distributeWeights,
  keyActionsTotal,
  type KeyAction,
  type KeyActionKind,
} from "./cicloBuilderTypes";

interface ObjectiveKeyActionsFieldProps {
  actions: readonly KeyAction[];
  /** Con `true`, el avance sale de las acciones y sus aportes deben sumar 100. */
  driveProgress: boolean;
  onChange: (patch: {
    keyActions?: readonly KeyAction[];
    keyActionsDriveProgress?: boolean;
  }) => void;
  showValidation: boolean;
}

/**
 * Las acciones clave del objetivo: qué hay que hacer para llegar a la meta.
 *
 * Un objetivo dice a dónde se quiere llegar, no qué hay que hacer para
 * llegar — y lo segundo es lo que se sigue semana a semana. Cada acción lleva
 * su aporte, y el interruptor de arriba decide qué significa ese aporte: con
 * el avance por acciones apagado son un plan de trabajo, y con él encendido
 * son *la* forma de medir el objetivo, así que entre todas tienen que cubrir
 * el {TOTAL_WEIGHT} % igual que los pesos cubren el ciclo.
 *
 * El reparto se ofrece resuelto ("Repartir por igual") por la misma razón que
 * en los pesos: el número exacto casi nunca importa tanto como que cierre.
 */
export function ObjectiveKeyActionsField({
  actions,
  driveProgress,
  onChange,
  showValidation,
}: ObjectiveKeyActionsFieldProps) {
  const total = keyActionsTotal(actions);
  const isExact = total === TOTAL_WEIGHT;

  const patchAction = (id: string, patch: Partial<KeyAction>) =>
    onChange({
      keyActions: actions.map((action) =>
        action.id === id ? { ...action, ...patch } : action
      ),
    });

  const addAction = () => {
    const free = Math.max(0, TOTAL_WEIGHT - total);
    onChange({ keyActions: [...actions, createKeyAction(driveProgress ? free : 0)] });
  };

  const removeAction = (id: string) =>
    onChange({ keyActions: actions.filter((action) => action.id !== id) });

  const distributeEvenly = () => {
    const shares = distributeWeights(actions.length, TOTAL_WEIGHT);
    onChange({
      keyActions: actions.map((action, index) => ({ ...action, contribution: shares[index] })),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
        <Switch
          checked={driveProgress}
          onCheckedChange={(checked) => {
            // Encender el avance por acciones sin repartir nada dejaría el
            // objetivo en 0 % para siempre: si nadie ha tocado los aportes,
            // se reparten solos y ya se ajustan a mano si hace falta.
            if (checked && actions.length > 0 && keyActionsTotal(actions) === 0) {
              const shares = distributeWeights(actions.length, TOTAL_WEIGHT);
              onChange({
                keyActionsDriveProgress: true,
                keyActions: actions.map((action, index) => ({
                  ...action,
                  contribution: shares[index],
                })),
              });
              return;
            }
            onChange({ keyActionsDriveProgress: checked });
          }}
          className="data-[state=checked]:bg-status-positive"
        />
        <span>El avance se calcula con estas acciones</span>
      </label>

      <p className="max-w-[78ch] text-[12px] leading-relaxed text-text-secondary">
        {driveProgress
          ? `Cada acción cumplida suma su aporte al avance del objetivo. Entre todas deben cubrir el ${TOTAL_WEIGHT} %.`
          : "Las acciones son el plan de trabajo: se ven en el seguimiento, pero el avance lo sigue marcando la cifra del objetivo."}
      </p>

      {actions.length > 0 && (
        <div className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
          <AnimatePresence initial={false}>
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <KeyActionRow
                  action={action}
                  position={index + 1}
                  driveProgress={driveProgress}
                  showValidation={showValidation}
                  onChange={(patch) => patchAction(action.id, patch)}
                  onRemove={() => removeAction(action.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addAction}
          className="group flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-3 text-[12.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
        >
          <Plus className="size-3.5 transition-transform group-hover:rotate-90" strokeWidth={2.4} />
          {actions.length === 0 ? "Añadir una acción clave" : "Añadir otra acción"}
        </button>

        {driveProgress && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {!isExact && (
              <button
                type="button"
                onClick={distributeEvenly}
                className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <Sparkles className="size-3.5" strokeWidth={2.2} />
                Repartir por igual
              </button>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-bold tabular-nums",
                isExact
                  ? "bg-status-positive/10 text-status-positive"
                  : showValidation
                    ? "bg-destructive/10 text-destructive"
                    : "bg-surface-muted text-text-secondary"
              )}
            >
              {total} / {TOTAL_WEIGHT} %
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_ICON: Readonly<Record<KeyActionKind, typeof Flag>> = {
  hito: Flag,
  cantidad: Hash,
};

function KeyActionRow({
  action,
  position,
  driveProgress,
  showValidation,
  onChange,
  onRemove,
}: {
  action: KeyAction;
  position: number;
  driveProgress: boolean;
  showValidation: boolean;
  onChange: (patch: Partial<KeyAction>) => void;
  onRemove: () => void;
}) {
  const missingTitle = showValidation && action.title.trim() === "";

  return (
    <div className="flex flex-col gap-2 bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10.5px] font-bold tabular-nums text-text-secondary">
          {position}
        </span>
        <input
          value={action.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Qué hay que hacer: “Cerrar 10 demos con clientes nuevos”"
          aria-label={`Acción clave ${position}`}
          aria-invalid={missingTitle}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md border bg-surface px-2.5 text-[12.5px] font-medium text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
            missingTitle
              ? "border-destructive focus:border-destructive focus:ring-destructive/25"
              : "border-border focus:border-primary focus:ring-primary/25"
          )}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Eliminar acción ${position}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Eliminar acción</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[30px]">
        <KindToggle value={action.kind} onChange={(kind) => onChange({ kind })} />

        {action.kind === "cantidad" && (
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-text-secondary">
            <span>Meta</span>
            <input
              value={action.targetCount}
              inputMode="numeric"
              onChange={(event) =>
                onChange({ targetCount: event.target.value.replace(/[^0-9.,]/g, "") })
              }
              placeholder="10"
              aria-label={`Cuántas veces se hace la acción ${position}`}
              className="h-8 w-[68px] rounded-md border border-border bg-surface px-2 text-center text-[12px] font-semibold tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <span>veces</span>
          </label>
        )}

        <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-text-secondary">
          <CalendarDays className="size-3.5" strokeWidth={2} />
          <input
            type="date"
            value={action.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
            aria-label={`Fecha límite de la acción ${position}`}
            className="h-8 rounded-md border border-border bg-surface px-2 text-[12px] font-medium text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </label>

        {driveProgress && (
          <label className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium text-text-secondary">
            <span>Aporta</span>
            <span className="relative flex w-[66px] items-center">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2 text-[11.5px] font-semibold text-text-secondary"
              >
                %
              </span>
              <input
                value={String(action.contribution)}
                inputMode="numeric"
                onChange={(event) => {
                  const parsed = Number.parseInt(
                    event.target.value.replace(/[^0-9]/g, ""),
                    10
                  );
                  onChange({
                    contribution: Number.isNaN(parsed)
                      ? 0
                      : Math.max(0, Math.min(TOTAL_WEIGHT, parsed)),
                  });
                }}
                aria-label={`Aporte de la acción ${position}`}
                className="h-8 w-full rounded-md border border-border bg-surface pl-5 pr-1.5 text-center text-[12px] font-semibold tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

/** Hito o cantidad, como un par de chips — es una decisión de una palabra. */
function KindToggle({
  value,
  onChange,
}: {
  value: KeyActionKind;
  onChange: (value: KeyActionKind) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-muted p-0.5">
      {(Object.keys(KEY_ACTION_KIND_META) as KeyActionKind[]).map((kind) => {
        const Icon = KIND_ICON[kind];
        const isActive = kind === value;
        return (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange(kind)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  isActive
                    ? "bg-surface text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Icon className="size-3.5" strokeWidth={2.2} />
                {KEY_ACTION_KIND_META[kind].label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{KEY_ACTION_KIND_META[kind].tagline}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
