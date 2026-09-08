import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  GripVertical,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { countByStatus, taskProgress, type UploadTaskState } from "./uploadTaskTypes";

/**
 * La cara minimizada de la carga masiva: la misma tarjeta flotante del centro
 * de descargas —chip de icono, título, línea de estado y, bajo una divisoria,
 * el cuerpo—, porque quien minimizó una descarga no debería aprender un
 * segundo widget para los objetivos.
 *
 * Lleva dos cosas que para quien la mira son la misma: una carga corriendo en
 * segundo plano y una revisión aparcada a medias. Ambas son "la carga masiva,
 * ahora mismo fuera de pantalla".
 */

export interface ParkedReview {
  readyObjectives: number;
  totalObjectives: number;
  remainingUsers: number;
}

export function CargaObjetivosWidget({
  cycleName,
  tasks,
  parkedReview,
  isConfirmingDiscard,
  onRequestDiscard,
  onCancelDiscard,
  onDiscard,
  onOpenDrawer,
  onClose,
  dodgeRight = false,
}: {
  cycleName: string;
  tasks: UploadTaskState[];
  /** Presente cuando una revisión se minimizó en vez de cargarse. */
  parkedReview?: ParkedReview;
  isConfirmingDiscard: boolean;
  onRequestDiscard: () => void;
  onCancelDiscard: () => void;
  onDiscard: () => void;
  onOpenDrawer: () => void;
  onClose: () => void;
  /** Se corre a la izquierda cuando el widget de descargas ocupa la esquina. */
  dodgeRight?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const { cardRef, position, isDragging, gripHandlers } = useDraggablePosition();

  const loading = tasks.filter((task) => task.status === "loading");
  const isBusy = loading.length > 0;
  const hasFailure = tasks.some((task) => task.serviceFailed);

  const title = isBusy
    ? "Cargando objetivos…"
    : tasks.length > 0
      ? hasFailure
        ? "Carga interrumpida"
        : "Carga completada"
      : "Carga masiva en revisión";
  const subtitle = isBusy ? `${loading.length} en curso` : cycleName;

  return (
    <div
      ref={cardRef}
      role="status"
      aria-label="Carga masiva de objetivos"
      className={cn(
        "fixed z-50 w-[320px] overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-[0_12px_40px_rgb(0,0,0,0.16)]",
        !position && (dodgeRight ? "bottom-6 right-[calc(1.5rem+320px+12px)]" : "bottom-6 right-6"),
        isDragging && "select-none"
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div className="flex items-center gap-1 p-3.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Mover"
              {...gripHandlers}
              style={{ touchAction: "none" }}
              className={cn(
                "flex h-7 w-5 shrink-0 cursor-grab select-none items-center justify-center rounded-lg text-text-muted/60 transition-colors hover:bg-surface-muted hover:text-text-secondary active:cursor-grabbing",
                isDragging && "cursor-grabbing bg-surface-muted text-text-secondary"
              )}
            >
              <GripVertical className="size-4" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Arrastra para mover · doble clic para volver a su sitio</TooltipContent>
        </Tooltip>

        <span
          style={hasFailure && !isBusy ? undefined : toneChip(isBusy ? "brand" : tasks.length > 0 ? "positive" : "brand")}
          className={cn(
            "ml-1 flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40",
            hasFailure && !isBusy && "bg-status-negative/10 text-status-negative"
          )}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          ) : tasks.length > 0 ? (
            hasFailure ? (
              <AlertTriangle className="size-4" strokeWidth={2.5} />
            ) : (
              <Check className="size-4" strokeWidth={2.5} />
            )
          ) : (
            <FileSearch className="size-4" strokeWidth={2.5} />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-semibold leading-tight text-text-primary">{title}</span>
          <span className="mt-0.5 truncate text-[12px] leading-relaxed text-text-muted">{subtitle}</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 self-start text-muted-foreground">
          <WidgetIconButton label="Abrir la carga masiva" onClick={onOpenDrawer}>
            <ExternalLink className="size-3.5" />
          </WidgetIconButton>
          <WidgetIconButton label={collapsed ? "Expandir" : "Minimizar"} onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </WidgetIconButton>
          <WidgetIconButton label="Cerrar" onClick={parkedReview ? onRequestDiscard : onClose}>
            <X className="size-4" />
          </WidgetIconButton>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border/50 px-3.5 pb-3.5 pt-3">
          {/* Descartar una revisión aparcada es la única acción de aquí que
              destruye trabajo, así que es la única que pregunta. */}
          {isConfirmingDiscard && parkedReview ? (
            <div>
              <p className="text-[12px] font-medium text-text-secondary">
                <span className="font-bold text-status-negative">¿Descartar esta carga?</span> Se pierde todo lo que
                resolviste en el archivo.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancelDiscard} className="flex-1 font-bold">
                  Conservarla
                </Button>
                <Button type="button" variant="destructive" size="sm" autoFocus onClick={onDiscard} className="flex-1 font-bold">
                  Descartar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
              {parkedReview && (
                <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-primary">
                      <FileSearch className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      Revisión sin terminar
                    </span>
                    <button
                      type="button"
                      onClick={onOpenDrawer}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      Retomar
                    </button>
                  </div>
                  <span className="text-[11px] tabular-nums text-text-muted">
                    {parkedReview.readyObjectives} de {parkedReview.totalObjectives} listos
                    {parkedReview.remainingUsers > 0 &&
                      ` · faltan ${parkedReview.remainingUsers} ${parkedReview.remainingUsers === 1 ? "usuario" : "usuarios"}`}
                  </span>
                </div>
              )}

              {[...tasks]
                .sort((a, b) => b.id.localeCompare(a.id))
                .slice(0, 4)
                .map((task) => {
                  const failed = countByStatus(task, "failed");
                  const isLoading = task.status === "loading";
                  return (
                    <div key={task.id} className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 py-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-primary">
                        {!isLoading &&
                          (task.serviceFailed ? (
                            <AlertTriangle className="size-3.5 shrink-0 text-status-negative" strokeWidth={2.5} />
                          ) : (
                            <Check className="size-3.5 shrink-0 text-status-positive" strokeWidth={2.5} />
                          ))}
                        <span className="truncate" title={task.name}>
                          {task.name}
                        </span>
                      </span>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-text-muted">Carga en progreso</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                              style={{ width: `${taskProgress(task)}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-primary">
                            {taskProgress(task)}%
                          </span>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "text-[11px]",
                            failed > 0 ? "font-semibold text-status-negative" : "text-text-muted"
                          )}
                        >
                          {task.serviceFailed
                            ? "La carga se interrumpió. Ábrela para reintentar."
                            : failed > 0
                              ? `${failed} ${failed === 1 ? "objetivo no se pudo guardar" : "objetivos no se pudieron guardar"}`
                              : "Carga completada"}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WidgetIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
