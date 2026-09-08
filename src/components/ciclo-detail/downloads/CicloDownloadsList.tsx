import * as React from "react";
import { Check, ChevronDown, Download, History, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DrawerSection } from "@/components/overlays";
import {
  CICLO_INDIVIDUAL_SECTIONS,
  cicloReportTypeFor,
  type CicloDownloadEntry,
  type CicloReportRequest,
} from "./cicloDownloadTypes";
import { demographicFor } from "./cicloReportModel";

/**
 * La pestaña "Descargas": lo que se pidió y en qué va.
 *
 * Cada fila es un recibo —el archivo ya llegó al navegador cuando terminó de
 * prepararse— así que sus acciones son volver a bajarlo, compartirlo y abrir
 * con qué configuración se armó. Esa última importa más de lo que parece: un
 * reporte de hace tres días solo se puede volver a comparar si se sabe a qué
 * grupos estaba recortado.
 */

export function CicloDownloadsList({
  entries,
  onDeliver,
  onShare,
}: {
  entries: readonly CicloDownloadEntry[];
  onDeliver: (id: string) => void;
  onShare: (id: string) => void;
}) {
  // El check marca *esta* descarga, no el historial: las entradas llegan de la
  // más nueva a la más vieja, así que la primera terminada es el archivo que
  // acaba de aterrizar y las demás vuelven a su icono de formato.
  const latestDeliveredId = entries.find(
    (entry) => entry.status === "ready" && entry.delivered
  )?.id;

  return (
    <div className="flex min-h-full flex-col gap-3 bg-background p-4">
      <DrawerSection
        icon={History}
        tone="brand"
        title="Lista de descargas"
        hint="Los reportes que pediste en esta sesión, con la configuración de cada uno."
        badge={entries.length > 0 ? `${entries.length}` : undefined}
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <History className="h-6 w-6" strokeWidth={2} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[13.5px] font-semibold text-text-primary">
                Sin descargas recientes
              </span>
              <span className="max-w-[260px] text-[12px] leading-relaxed text-text-muted">
                Los reportes que generes aparecerán aquí para volver a bajarlos.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
            {entries.map((entry) => (
              <DownloadRow
                key={entry.id}
                entry={entry}
                isLatest={entry.id === latestDeliveredId}
                onDeliver={onDeliver}
                onShare={onShare}
              />
            ))}
          </div>
        )}
      </DrawerSection>
    </div>
  );
}

function DownloadRow({
  entry,
  isLatest,
  onDeliver,
  onShare,
}: {
  entry: CicloDownloadEntry;
  isLatest: boolean;
  onDeliver: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const Icon = cicloReportTypeFor(entry.kind).icon;
  const isPreparing = entry.status === "preparing";
  const needsRetry = !isPreparing && !entry.delivered;
  const showsCheck = !isPreparing && !needsRetry && isLatest;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-surface transition-colors",
        detailsOpen ? "border-border/80" : "border-border/60"
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            needsRetry
              ? "bg-status-warning/10 text-status-warning"
              : showsCheck
                ? "bg-status-positive/10 text-status-positive"
                : "bg-muted text-muted-foreground"
          )}
        >
          {showsCheck ? (
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
          ) : (
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="truncate text-[13px] font-semibold text-text-primary"
            title={entry.fileName}
          >
            {entry.fileName}
          </span>
          {isPreparing ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${entry.progress}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-[12px] font-bold tabular-nums text-primary">
                {Math.round(entry.progress)}%
              </span>
            </div>
          ) : (
            <span
              className={cn(
                "text-[12px]",
                needsRetry ? "font-semibold text-status-warning" : "text-muted-foreground"
              )}
            >
              {needsRetry ? "La descarga quedó bloqueada por el navegador" : startedLabel(entry)}
            </span>
          )}
        </div>

        {isPreparing ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Preparando reporte"
          />
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => onShare(entry.id)}
              title="Compartir"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="sr-only">Compartir</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => onDeliver(entry.id)}
              title="Descargar"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="sr-only">Descargar</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 w-7 rounded-full p-0 transition-colors hover:bg-primary/10 hover:text-primary",
                detailsOpen ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
              onClick={() => setDetailsOpen((current) => !current)}
              title="Ver detalle"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  detailsOpen && "rotate-180"
                )}
              />
              <span className="sr-only">Ver detalle</span>
            </Button>
          </div>
        )}
      </div>

      {detailsOpen && <ReportDetailPanel request={entry.request} />}
    </div>
  );
}

const startedLabel = (entry: CicloDownloadEntry): string => {
  const date = new Date(entry.startedAt);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} a las ${hours}:${minutes}`;
};

/**
 * El detalle de una descarga: con qué configuración se armó, en filas
 * etiqueta → valor. Solo se listan las perillas que el formato usa — decirle a
 * quien bajó un libro de objetivos qué secciones tenía el PDF es ruido.
 */
function ReportDetailPanel({ request }: { request: CicloReportRequest }) {
  const type = cicloReportTypeFor(request.kind);

  const { audience } = request;
  const rows: { label: string; value: string }[] = [
    { label: "Formato", value: type.title },
    {
      label: "Modalidad",
      value: audience.mode === "individual" ? "Individual" : "Masivo",
    },
  ];

  if (audience.mode === "individual") {
    rows.push({
      label: "Colaboradores",
      value:
        audience.personIds.length === 0
          ? "Todo el ciclo"
          : `${audience.personIds.length} elegidos`,
    });
  } else {
    rows.push({
      label: demographicFor(audience.key).label,
      value: audience.values.length === 0 ? "Todo el ciclo" : audience.values.join(", "),
    });
  }

  if (request.estadoFilter.length > 0) {
    rows.push({ label: "Estados incluidos", value: `${request.estadoFilter.length} de la escala` });
  }
  if (request.nivelFilter.length > 0) {
    rows.push({ label: "Niveles incluidos", value: `${request.nivelFilter.length} de la escala` });
  }

  if (request.kind === "individual") {
    rows.push({
      label: "Bloques",
      value:
        request.individualSections.length === 0
          ? "Solo los datos del colaborador"
          : CICLO_INDIVIDUAL_SECTIONS.filter((section) =>
              request.individualSections.includes(section.id)
            )
              .map((section) => section.label)
              .join(", "),
    });
  }

  return (
    <div className="border-t border-border/60 bg-background/60 px-3 py-2.5">
      <dl className="flex flex-col">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={cn(
              "flex items-start justify-between gap-4 py-1.5",
              index > 0 && "border-t border-border/40"
            )}
          >
            <dt className="shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-text-secondary">
              {row.label}
            </dt>
            <dd className="min-w-0 flex-1 text-right text-[12px] leading-snug text-text-primary">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
