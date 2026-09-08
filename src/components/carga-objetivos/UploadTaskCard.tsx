import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip, type Tone } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { countByStatus, countPending, taskProgress, type UploadTaskState } from "./uploadTaskTypes";

/**
 * Una carga de esta sesión, como tarjeta en la pestaña "Cargas": el chip de
 * estado, el nombre del archivo, qué está haciendo ahora y el porcentaje — con
 * la barra solo mientras hay algo que llenar.
 */
export function UploadTaskCard({
  task,
  cycleName,
  onRetry,
  onViewDetails,
  onResumePending,
}: {
  task: UploadTaskState;
  cycleName: string;
  onRetry: () => void;
  onViewDetails: () => void;
  onResumePending: () => void;
}) {
  const progress = taskProgress(task);
  const uploaded = countByStatus(task, "uploaded");
  const pendingCount = countPending(task);
  const isLoading = task.status === "loading";
  /** Solo lo que la carga escribe: las filas que la revisión no dejó pasar no cuentan. */
  const writing = task.rows.filter((row) => row.status !== "unassigned" && row.status !== "analysis_error").length;

  // Rojo, no ámbar, cuando se cayó el servicio: no es que algunas filas no
  // pasaran, es que la carga no terminó. Dos noticias, dos colores.
  const tone: Tone | "negative" = isLoading
    ? "brand"
    : task.serviceFailed
      ? "negative"
      : pendingCount > 0
        ? "warning"
        : "positive";

  const statusLine = isLoading
    ? `Cargando ${writing} ${writing === 1 ? "objetivo" : "objetivos"} en "${cycleName}"…`
    : task.serviceFailed
      ? `La carga se interrumpió: ${uploaded} ${uploaded === 1 ? "objetivo alcanzó" : "objetivos alcanzaron"} a cargarse y ${
          pendingCount === 1 ? "quedó 1" : `quedaron ${pendingCount}`
        } sin cargar.`
      : pendingCount > 0
        ? `${uploaded} ${uploaded === 1 ? "cargado" : "cargados"} · ${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`
        : `${uploaded} ${uploaded === 1 ? "objetivo cargado" : "objetivos cargados"} en "${cycleName}"`;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-3.5 shadow-card",
        task.serviceFailed ? "border-status-negative/40" : "border-border/60"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          style={tone === "negative" ? undefined : toneChip(tone)}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40",
            tone === "negative" && "bg-status-negative/10 text-status-negative"
          )}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          ) : tone === "positive" ? (
            <Check className="size-4" strokeWidth={2.5} />
          ) : (
            <AlertTriangle className="size-4" strokeWidth={2.5} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-text-primary">{task.name}</p>
          <p
            className={cn(
              "mt-0.5 truncate text-[11.5px]",
              task.serviceFailed ? "font-medium text-status-negative" : "text-text-muted"
            )}
          >
            {statusLine}
          </p>
        </div>

        {isLoading && <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{progress}%</span>}

        {!isLoading && (
          <div className="ml-1 flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="outline" onClick={onViewDetails} className="font-bold">
              Ver detalle
            </Button>
            {pendingCount > 0 && (
              <Button type="button" onClick={onResumePending} className="font-bold">
                Retomar carga
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* El reintento solo aparece aquí, y solo cuando hay algo que reintentar:
          una fila rechazada por sus datos no se arregla mandándola otra vez;
          una que nunca se mandó, sí. */}
      {task.serviceFailed && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] text-text-muted">
            Estamos teniendo problemas técnicos. Lo que ya cargó se mantiene.
          </p>
          <Button type="button" variant="outline" onClick={onRetry} className="shrink-0 gap-1.5 font-bold">
            <RefreshCw className="size-3" strokeWidth={2.5} />
            Reintentar {pendingCount}
          </Button>
        </div>
      )}
    </div>
  );
}
