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
 * que se lleva.
 *
 * La primera versión dibujaba esa comparación tres veces —la línea de tiempo
 * con su punto de "hoy", y debajo dos barras completas, una por calendario y
 * otra por avance— y las tres decían lo mismo con contraste distinto: la
 * barra del calendario, gris clarito sobre fondo gris, casi no se veía al
 * lado de la del avance en azul sólido. Ahora es una sola barra —el avance,
 * que es el dato que decide si hay que actuar— con una guía punteada en la
 * posición del calendario ya corrido, igual que "Avance por área" marca su
 * propio calendario: una barra de más no es una lectura más clara, es la
 * misma lectura repetida con menos contraste.
 *
 * Un ciclo cerrado conserva la tarjeta: cuánto duró y con qué cerró siguen
 * siendo lo primero que se pregunta al abrir un reporte viejo. Como ya cerró,
 * la guía del calendario no aplica —el calendario entero ya corrió— así que
 * desaparece junto con la frase de la diferencia.
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

        {/* Una sola barra —el avance— con una guía punteada en la posición
            del calendario ya corrido. La distancia entre el borde de la
            barra y la guía *es* la respuesta; no hace falta una segunda
            barra para decir lo mismo dos veces. */}
        <div className="flex flex-col gap-1.5">
          <div className="relative h-2.5 w-full overflow-visible rounded-full bg-muted dark:bg-white/10">
            <span
              className="pulse-bar-grow absolute inset-y-0 left-0 origin-left rounded-full bg-primary"
              style={{ width: `${Math.max(1.5, Math.min(100, overallPercent))}%` }}
            />
            {showsRisk && (
              <span
                aria-hidden
                className="pulse-fade-in absolute -inset-y-1 z-10 w-0 border-l-2 border-dashed border-text-secondary/60"
                style={{ left: `${trackPosition}%` }}
                title={`Calendario corrido · ${Math.round(elapsed)} %`}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-medium text-text-muted">
            <span>{formatDay(results.data.startDate)}</span>
            <span>{formatDay(results.data.endDate)}</span>
          </div>
        </div>

        {/* La lectura exacta de esa misma barra, y la distancia entre sus
            dos puntas escrita para que nadie tenga que restar de memoria. */}
        <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between text-[11.5px] font-medium text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
              Avance del ciclo
            </span>
            <span className="font-bold tabular-nums text-text-primary">
              {Math.round(overallPercent)} %
            </span>
          </div>
          {showsRisk && (
            <div className="flex items-center justify-between text-[11.5px] font-medium text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full border-2 border-dashed border-text-secondary/60"
                />
                Calendario corrido
              </span>
              <span className="font-bold tabular-nums text-text-primary">
                {Math.round(elapsed)} %
              </span>
            </div>
          )}
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
