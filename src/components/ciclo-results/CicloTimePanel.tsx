import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SummaryPanel } from "./ResumenPanels";
import type { CicloResults } from "./resultsModel";

/**
 * El calendario del ciclo: cuánto queda y si el avance le va al ritmo.
 *
 * "168 días restantes" escondido en el pie de la tarjeta grande no era un
 * dato, era una nota al margen. Y solo no dice nada: lo que decide si hay que
 * mover algo es la comparación entre el calendario que ya corrió y el avance
 * que se lleva. Por eso las dos barras van una encima de la otra, a la misma
 * escala — la distancia entre sus puntas *es* la respuesta— y debajo va esa
 * distancia escrita, para que nadie tenga que restar de memoria.
 *
 * Un ciclo cerrado conserva la tarjeta: cuánto duró y con qué cerró siguen
 * siendo lo primero que se pregunta al abrir un reporte viejo.
 */

const DAY_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

const formatDay = (iso: string) => DAY_FORMAT.format(new Date(`${iso}T12:00:00`));

export function CicloTimePanel({ results }: { results: CicloResults }) {
  const { showsRisk, daysLeft, totalDays, elapsedDays, elapsed, overallPercent } = results;
  // La diferencia en puntos entre lo que se lleva avanzado y lo que se lleva
  // consumido de calendario. Positiva es ir por delante.
  const gap = Math.round(overallPercent - elapsed);
  const trackPosition = Math.min(100, Math.max(0, elapsed));

  return (
    <SummaryPanel
      title="Tiempo del ciclo"
      hint={
        showsRisk
          ? "Cuánto calendario queda y si el avance le va al ritmo."
          : "Cuánto duró el ciclo y con qué avance cerró."
      }
      aside={
        <span className="shrink-0 whitespace-nowrap text-[10.5px] font-medium text-text-muted">
          {totalDays} días en total
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5 text-[32px] font-extrabold leading-none tracking-tight text-text-primary tabular-nums">
              {showsRisk ? Math.max(0, daysLeft) : totalDays}
              <span className="text-[13px] font-bold text-text-muted">
                {showsRisk
                  ? Math.max(0, daysLeft) === 1
                    ? "día restante"
                    : "días restantes"
                  : "días que duró"}
              </span>
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-text-muted">
              {showsRisk
                ? `${elapsedDays} ${elapsedDays === 1 ? "día corrido" : "días corridos"} de ${totalDays}`
                : `Del ${formatDay(results.data.startDate)} al ${formatDay(results.data.endDate)}`}
            </p>
          </div>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <CalendarClock className="size-4" strokeWidth={2} />
          </span>
        </div>

        {/* La línea de tiempo, con el día de hoy donde va. */}
        <div className="flex flex-col gap-1.5">
          <div className="relative h-2 w-full overflow-visible rounded-full bg-muted dark:bg-white/10">
            <span
              className="pulse-bar-grow absolute inset-y-0 left-0 origin-left rounded-full bg-primary/35"
              style={{ width: `${trackPosition}%` }}
            />
            {showsRisk && (
              <span
                className="pulse-fade-in absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary shadow-sm"
                style={{ left: `${trackPosition}%` }}
                title={`Hoy · ${Math.round(elapsed)} % del calendario`}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-medium text-text-muted">
            <span>{formatDay(results.data.startDate)}</span>
            <span>{formatDay(results.data.endDate)}</span>
          </div>
        </div>

        {/* Calendario contra avance, a la misma escala. */}
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <RaceBar label="Calendario corrido" percent={elapsed} tone="muted" />
          <RaceBar label="Avance del ciclo" percent={overallPercent} tone="brand" />
          {showsRisk && (
            <p
              className={cn(
                "mt-0.5 text-[11px] font-semibold",
                gap >= 0 ? "text-status-positive" : "text-status-warning"
              )}
            >
              {gap === 0
                ? "El avance va justo al ritmo del calendario."
                : gap > 0
                  ? `El avance va ${gap} ${gap === 1 ? "punto" : "puntos"} por delante del calendario.`
                  : `El avance va ${Math.abs(gap)} ${Math.abs(gap) === 1 ? "punto" : "puntos"} por detrás del calendario.`}
            </p>
          )}
        </div>
      </div>
    </SummaryPanel>
  );
}

function RaceBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: "muted" | "brand";
}) {
  const width = Math.max(1, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[112px] shrink-0 text-[11.5px] font-medium text-text-secondary">
        {label}
      </span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/10">
        <span
          className={cn(
            "pulse-bar-grow block h-full origin-left rounded-full",
            tone === "brand" ? "bg-primary" : "bg-text-muted/45"
          )}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-[11.5px] font-bold tabular-nums text-text-primary">
        {Math.round(percent)} %
      </span>
    </div>
  );
}
