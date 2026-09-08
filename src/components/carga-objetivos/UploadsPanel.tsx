import * as React from "react";
import { Calendar, Check, FileText } from "lucide-react";
import { toneChip } from "@/lib/tone";
import { Badge } from "@/components/ui/badge";
import { UploadTaskCard } from "./UploadTaskCard";
import { RECENT_UPLOADS, type UploadTaskState } from "./uploadTaskTypes";

/**
 * La pestaña "Cargas": las de esta sesión en vivo, y debajo el historial.
 *
 * Caer aquí justo después de pulsar "Cargar" es el punto: la barra que el
 * revisor quiere mirar está en la misma lista que las cargas anteriores, en
 * vez de detrás de un velo de pantalla completa que hay que esperar.
 */
export function UploadsPanel({
  tasks,
  cycleName,
  onRetry,
  onViewDetails,
  onResumePending,
}: {
  tasks: UploadTaskState[];
  cycleName: string;
  onRetry: (taskId: string) => void;
  onViewDetails: (task: UploadTaskState) => void;
  onResumePending: (task: UploadTaskState) => void;
}) {
  const sorted = React.useMemo(() => [...tasks].sort((a, b) => b.id.localeCompare(a.id)), [tasks]);

  return (
    <div className="flex flex-col gap-4">
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          {sorted.map((task) => (
            <UploadTaskCard
              key={task.id}
              task={task}
              cycleName={cycleName}
              onRetry={() => onRetry(task.id)}
              onViewDetails={() => onViewDetails(task)}
              onResumePending={() => onResumePending(task)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold tracking-tight text-text-primary">Historial de cargas</h3>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
          Últimos 7 días
        </span>
      </div>

      {/* El check de la derecha se vuelve el conteo de errores cuando lo hay:
          una fila que dice "63 objetivos" con un tick verde mientras dos
          fueron rechazados es una fila que miente. */}
      <div className="flex flex-col gap-2">
        {RECENT_UPLOADS.map((upload) => (
          <div key={upload.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
            <span
              style={toneChip("neutral")}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40"
            >
              <FileText className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-text-primary">{upload.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="pointer-events-none h-auto rounded-full border-none bg-primary/5 px-2 py-0 text-[9.5px] font-bold text-primary">
                  {upload.objectivesCount} objetivos
                </Badge>
                <span className="flex items-center gap-1 text-[10.5px] font-medium text-text-muted">
                  <Calendar className="size-2.5" />
                  {upload.loadedAt}
                </span>
              </div>
            </div>
            {upload.failedCount > 0 ? (
              <span className="shrink-0 rounded-md bg-status-negative/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-status-negative">
                {upload.failedCount} con error
              </span>
            ) : (
              <span className="shrink-0 text-status-positive" aria-label="Carga completada">
                <Check className="size-4" strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
