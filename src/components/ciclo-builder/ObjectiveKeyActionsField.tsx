import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Flag, Hash, Plus, Sparkles, Trash2 } from "lucide-react";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  KEY_ACTION_KIND_META,
  TOTAL_WEIGHT,
  createKeyAction,
  distributeWeights,
  keyActionsTotal,
  type KeyAction,
  type KeyActionKind,
} from "./cicloBuilderTypes";
import {
  DEFAULT_OBJECTIVE_MODEL_RULES,
  objectiveModelVocab,
  type ObjectiveModelVocab,
} from "./objectiveModel";

interface ObjectiveKeyActionsFieldProps {
  actions: readonly KeyAction[];
  /** Con `true`, el avance sale de las acciones y sus aportes deben sumar 100. */
  driveProgress: boolean;
  onChange: (patch: {
    keyActions?: readonly KeyAction[];
    keyActionsDriveProgress?: boolean;
  }) => void;
  showValidation: boolean;
  /** Cómo llama el modelo del ciclo a lo que cuelga del objetivo: acciones
   *  clave, resultados clave, tareas… Sin él habla en acciones, que es como
   *  hablaba el constructor antes de que existieran los modelos. */
  vocab?: ObjectiveModelVocab;
  /**
   * Quién decide si lo que cuelga mueve el avance:
   *
   * - `locked-on`: lo decidió el modelo —los resultados clave de OKR siempre
   *   miden— así que el interruptor desaparece.
   * - `locked-off`: el modelo no cuelga nada que mida (KPI), así que esto es
   *   un plan de seguimiento y el avance sigue saliendo de la cifra.
   * - `choice`: lo decide el autor, que es el caso de las acciones clave.
   */
  progressMode?: "locked-on" | "locked-off" | "choice";
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
  vocab = objectiveModelVocab(null, DEFAULT_OBJECTIVE_MODEL_RULES),
  progressMode = "choice",
}: ObjectiveKeyActionsFieldProps) {
  const total = keyActionsTotal(actions);
  const isExact = total === TOTAL_WEIGHT;

  // "Añade otro resultado clave" frente a "añade otra acción clave": el
  // modelo pone las palabras, y su género concuerda los artículos.
  const child = (vocab.child ?? "Acción clave").toLowerCase();
  const children = (vocab.children ?? "Acciones clave").toLowerCase();
  const isMasculine = vocab.childrenGender === "m";
  const drives =
    progressMode === "locked-on"
      ? true
      : progressMode === "locked-off"
        ? false
        : driveProgress;

  const patchAction = (id: string, patch: Partial<KeyAction>) =>
    onChange({
      keyActions: actions.map((action) =>
        action.id === id ? { ...action, ...patch } : action
      ),
    });

  const addAction = () => {
    const free = Math.max(0, TOTAL_WEIGHT - total);
    onChange({ keyActions: [...actions, createKeyAction(drives ? free : 0)] });
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
      {progressMode === "choice" && (
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
        <span>El avance se calcula con {isMasculine ? "estos" : "estas"} {children}</span>
      </label>
      )}

      <p className="max-w-[78ch] text-[12px] leading-relaxed text-text-secondary">
        {drives
          ? `${isMasculine ? "Cada uno" : "Cada una"} suma su aporte al avance del objetivo. Entre ${isMasculine ? "todos" : "todas"} deben cubrir el ${TOTAL_WEIGHT} %.`
          : `${isMasculine ? "Los" : "Las"} ${children} son el plan de trabajo: quedan a la vista del equipo, pero el avance lo sigue marcando la cifra del objetivo.`}
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
                  driveProgress={drives}
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
          {actions.length === 0
            ? `Añadir ${isMasculine ? "un" : "una"} ${child}`
            : `Añadir ${isMasculine ? "otro" : "otra"} ${child}`}
        </button>

        {drives && actions.length > 0 && (
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
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 text-destructive transition-all hover:border-destructive/50 hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
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

        <DueDateField
          value={action.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
          label={`Fecha límite de la acción ${position}`}
        />

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

/** "yyyy-mm-dd" ↔ Date en hora local: evita el corrimiento de un día que da
 *  `new Date(string)` al interpretarlo en UTC. */
function parseDueDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDueDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** El plazo para dar por cumplido el hito (o la cantidad): dicho con
 *  "Fecha límite" en vez de un input desnudo, para que no se confunda con
 *  cuándo se creó o se registró la acción. */
function DueDateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDueDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[12px] font-medium text-text-primary outline-none transition-all hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          <CalendarDays className="size-3.5 text-text-secondary" strokeWidth={2} />
          <span className="text-text-secondary">Fecha límite:</span>
          <span className={cn(!selected && "text-text-secondary")}>
            {selected ? formatDueDate(selected).split("-").reverse().join("/") : "sin definir"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          onSelect={(date) => {
            onChange(date ? formatDueDate(date) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
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
