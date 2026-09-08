import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OBJECTIVE_EDIT_SHORTCUTS } from "./aiObjectiveGenerator";
import {
  MEASURE_META,
  formatRawValue,
  type Objective,
} from "./cicloBuilderTypes";

interface AiObjectiveReviewListProps {
  objectives: readonly Objective[];
  /** Ids que entrarán al ciclo. Lo demás se descarta al confirmar. */
  selectedIds: ReadonlySet<string>;
  /** La tarjeta que la IA está rehaciendo ahora mismo, si hay alguna. */
  pendingId?: string | null;
  /** Qué está haciendo con ella: corregirla o volver a tirarla. */
  pendingLabel?: string;
  /** 0–100: cuánto lleva ese retoque. */
  pendingProgress?: number;
  onToggle: (id: string) => void;
  onRegenerate: (id: string) => void;
  /** El autor dijo qué cambiar, con sus palabras. */
  onEdit: (id: string, instruction: string) => void;
  /** Fuera de la propuesta, no solo sin marcar. */
  onRemove: (id: string) => void;
  editingId?: string | null;
  onEditingIdChange?: (id: string | null) => void;
}

/**
 * La propuesta, antes de tocar el ciclo.
 *
 * Este paso existe porque insertar cinco objetivos generados directamente en
 * la lista deja al autor con cinco tarjetas que no escribió y ninguna señal
 * de cuál revisar primero. Aquí cada uno se lee entero en tres líneas —qué
 * mide, hacia dónde, de cuánto a cuánto— y se acepta, se descarta, se borra,
 * se vuelve a tirar o se corrige diciendo qué cambiar, que son las cosas que
 * se quieren hacer con una propuesta que casi encaja.
 */
export function AiObjectiveReviewList({
  objectives,
  selectedIds,
  pendingId = null,
  pendingLabel = "Aplicando tu cambio…",
  pendingProgress = 0,
  onToggle,
  onRegenerate,
  onEdit,
  onRemove,
  editingId = null,
  onEditingIdChange,
}: AiObjectiveReviewListProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      {/* Sin `AnimatePresence` alrededor de la lista a propósito: la salida
          no llegaba a completarse —React 19 en StrictMode, igual que en el
          compositor— y la tarjeta borrada se quedaba en pantalla aunque ya
          no estuviera en la propuesta. Borrar tiene que quitarla, y eso
          pesa más que verla irse. Las que quedan sí se reacomodan solas
          gracias al `layout`. */}
      {objectives.map((objective, index) => (
        <motion.li
          key={objective.id}
          layout="position"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
        >
          <ReviewCard
            objective={objective}
            isSelected={selectedIds.has(objective.id)}
            isPending={pendingId === objective.id}
            pendingLabel={pendingLabel}
            pendingProgress={pendingProgress}
            // Quién tiene el editor abierto lo decide el compositor, no la
            // tarjeta: así solo hay uno abierto a la vez y sobrevive a que la
            // lista se reordene o se rehaga una propuesta.
            isEditorOpen={editingId === objective.id}
            onEditorOpenChange={(open) => onEditingIdChange?.(open ? objective.id : null)}
            onToggle={() => onToggle(objective.id)}
            onRegenerate={() => onRegenerate(objective.id)}
            onEdit={(instruction) => onEdit(objective.id, instruction)}
            onRemove={() => onRemove(objective.id)}
          />
        </motion.li>
      ))}
    </ul>
  );
}

function ReviewCard({
  objective,
  isSelected,
  isPending,
  pendingLabel,
  pendingProgress,
  onToggle,
  onRegenerate,
  onEdit,
  onRemove,
  isEditorOpen,
  onEditorOpenChange,
}: {
  objective: Objective;
  isSelected: boolean;
  isPending: boolean;
  pendingLabel: string;
  pendingProgress: number;
  onToggle: () => void;
  onRegenerate: () => void;
  onEdit: (instruction: string) => void;
  onRemove: () => void;
  isEditorOpen: boolean;
  onEditorOpenChange: (open: boolean) => void;
}) {
  const setEditorOpen = onEditorOpenChange;
  const [draft, setDraft] = React.useState("");

  const measure = objective.measure;
  const measureMeta = measure ? MEASURE_META[measure] : null;
  const isBoolean = measure === "boolean";
  const initial = formatRawValue(objective.initialValue, measure);
  const target = formatRawValue(objective.targetValue, measure);
  const DirectionIcon = objective.direction === "decrease" ? TrendingDown : TrendingUp;

  // Al mandar un retoque el editor se cierra: lo que se escribió ya está en
  // camino y dejarlo abierto invita a pedir dos cambios sobre un objetivo
  // que aún no existe. Se cierra aquí, en el gesto que lo provoca, y no
  // vigilando `isPending` desde un efecto.
  const closeEditor = () => {
    setEditorOpen(false);
    setDraft("");
  };

  const submitEdit = () => {
    const instruction = draft.trim();
    if (instruction === "") return;
    onEdit(instruction);
    closeEditor();
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-surface transition-all",
        isSelected
          ? "border-border/70 shadow-card"
          : "border-border/50 opacity-55 hover:opacity-80",
        isEditorOpen && "border-primary/40 shadow-card"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={isSelected ? "Descartar este objetivo" : "Incluir este objetivo"}
          onClick={onToggle}
          disabled={isPending}
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50",
            isSelected
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface hover:border-primary/50"
          )}
        >
          {isSelected && <Check className="size-3.5" strokeWidth={3} />}
        </button>

        <div className="relative flex min-w-0 flex-1 flex-col gap-2">
          <div
            className={cn(
              "flex flex-col gap-2 transition-all duration-300",
              isPending && "pointer-events-none select-none opacity-35 blur-[3px]"
            )}
          >
            <div className="flex flex-col gap-0.5">
              <h4 className="text-[13.5px] font-bold leading-snug text-text-primary">
                {objective.title}
              </h4>
              <p className="text-[12px] leading-relaxed text-text-secondary">
                {objective.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {measureMeta && (
                <Pill>
                  <span className="font-bold tabular-nums">{measureMeta.symbol}</span>
                  {measureMeta.label}
                </Pill>
              )}

              {!isBoolean && objective.direction && (
                <Pill>
                  <DirectionIcon
                    className={cn(
                      "size-3.5",
                      objective.direction === "decrease"
                        ? "text-status-negative"
                        : "text-status-positive"
                    )}
                    strokeWidth={2.4}
                  />
                  {objective.direction === "decrease" ? "Reducir" : "Aumentar"}
                </Pill>
              )}

              {!isBoolean && initial && target && (
                <Pill>
                  <span className="tabular-nums text-text-secondary">{initial}</span>
                  <ArrowRight className="size-3 text-text-muted" strokeWidth={2.4} />
                  <span className="font-bold tabular-nums text-text-primary">{target}</span>
                </Pill>
              )}
            </div>
          </div>
        </div>

        {!isEditorOpen && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <CardAction
              label="Editar"
              onClick={() => setEditorOpen(true)}
              disabled={isPending}
            >
              <Pencil className="size-4" strokeWidth={2.2} />
            </CardAction>

            <CardAction
              label="Proponer otra versión"
              onClick={() => {
                onRegenerate();
              }}
              disabled={isPending}
            >
              <RefreshCw className="size-4" strokeWidth={2.2} />
            </CardAction>

            <CardAction label="Borrar esta propuesta" onClick={onRemove} disabled={isPending} isDanger>
              <Trash2 className="size-4" strokeWidth={2.2} />
            </CardAction>
          </div>
        )}
      </div>

      {/* Sin `AnimatePresence` por lo mismo que el aviso de "trabajando" de
          más abajo: aquí las salidas tampoco llegan a completarse, y al mandar
          el retoque el panel se quedaba a medio plegar —con los botones
          recortados— en vez de irse. Entra animado y desaparece cuando deja
          de hacer falta. */}
      {isEditorOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <EditPanel
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={submitEdit}
            onCancel={closeEditor}
          />
        </motion.div>
      )}

      {/* Cubre la tarjeta entera y no solo el bloque de texto: si el editor
          estaba abierto debajo, la tarjeta es más alta que el título y la
          descripción, y un aviso del tamaño de esos dos dejaba un sobrante
          en blanco hasta el borde. Va sobre todo —casilla, texto, acciones—
          porque nada de eso se puede tocar mientras la IA trabaja.

          Fondo blanco y opaco a propósito: no es una insinuación sobre lo
          que hay debajo, es la misma tarjeta "trabajando" que ya conoce el
          resto del producto, solo que a su tamaño.

          Sin `AnimatePresence` a propósito: aquí las salidas no llegan a
          completarse y dejaban el aviso montado en opacidad cero para
          siempre, tapando la tarjeta que acababa de actualizarse. Entra con
          un fundido y desaparece cuando deja de hacer falta. */}
      {isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute inset-0 z-10 flex rounded-2xl bg-ai-gradient p-px shadow-card"
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 rounded-[calc(var(--radius-2xl)-1px)] bg-surface px-5 py-4">
            <div className="flex w-full max-w-[240px] items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ai-gradient text-white">
                <Sparkles className="size-3.5" strokeWidth={2.4} />
              </span>
              <span className="truncate text-[12.5px] font-semibold text-text-primary">
                {pendingLabel}
              </span>
              <span className="ml-auto shrink-0 text-[11px] font-bold text-ai-gradient tabular-nums">
                {Math.round(pendingProgress)}%
              </span>
            </div>
            <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-ai-gradient transition-all duration-200"
                style={{ width: `${Math.max(4, Math.round(pendingProgress))}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </article>
  );
}

/**
 * Decir qué cambiar, en vez de volver a tirar los dados.
 *
 * Abajo y dentro de la misma tarjeta a propósito: lo que se está corrigiendo
 * es este objetivo y no la propuesta entera, y hay que poder leerlo mientras
 * se escribe qué le falta.
 */
function EditPanel({
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 bg-surface-muted/30 px-4 py-3.5">
      <label className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-text-primary">
          ¿Qué quieres cambiar de este objetivo?
        </span>
        <textarea
          rows={2}
          autoFocus
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
            }
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Ej. Que la meta sea más exigente y que se mida en porcentaje"
          className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        {OBJECTIVE_EDIT_SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            onClick={() => onDraftChange(shortcut)}
            className="h-7 rounded-full border border-border/70 bg-surface px-3 text-[11.5px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {shortcut}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-xl border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={draft.trim() === ""}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-ai-gradient px-4 text-[12.5px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
        >
          <Sparkles className="size-3.5" strokeWidth={2.4} />
          Editar
        </button>
      </div>
    </div>
  );
}

function CardAction({
  label,
  onClick,
  disabled,
  isActive = false,
  isDanger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  isDanger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-30",
            isDanger
              ? "border border-status-negative/30 bg-status-negative/10 text-status-negative hover:border-status-negative/50 hover:bg-status-negative/20"
              : "text-text-muted hover:bg-primary/5 hover:text-primary",
            isActive && "bg-primary/10 text-primary"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 items-center gap-1.5 rounded-full border border-border/70 bg-surface-muted/50 px-2.5 text-[11.5px] font-semibold text-text-secondary">
      {children}
    </span>
  );
}
