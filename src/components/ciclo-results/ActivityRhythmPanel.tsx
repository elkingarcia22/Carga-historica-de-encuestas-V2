import * as React from "react";
import { cn } from "@/lib/utils";
import { SummaryPanel } from "./ResumenPanels";
import type { ResultEntry } from "./resultsModel";

/**
 * Cuándo se mueve el ciclo.
 *
 * Las demás tarjetas del resumen reparten un total —cuántos objetivos hay en
 * cada banda, cuántos por aprobar—; esta responde otra pregunta: *a qué hora*
 * y *qué día* la gente entra a reportar. Sirve para lo que ninguna cifra de
 * cumplimiento dice: cuándo mandar el recordatorio, y si el ciclo se reporta
 * de a poco o todo contra el cierre de mes.
 *
 * Se lee sobre el historial completo de cada objetivo, no sobre su último
 * valor: el interés está en cada vez que alguien tocó el objetivo, no en dónde
 * quedó.
 */

/** Con qué grano se mira el reloj del ciclo. */
export type ActivityGrain = "hora" | "semana" | "mes";

const GRAIN_LABELS: Readonly<Record<ActivityGrain, string>> = {
  hora: "Hora",
  semana: "Día",
  mes: "Día del mes",
};

const GRAIN_ORDER: readonly ActivityGrain[] = ["hora", "semana", "mes"];

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const WEEKDAYS_LONG = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

/**
 * Los dos colores son la única forma de separar un tramo del otro dentro de
 * una misma columna —igual que en la cuadrícula de tipo de medida—: no son
 * estados configurados, son dos categorías que hay que distinguir de un
 * vistazo.
 */
const AVANCE_COLOR = "var(--color-brand)";
const COMENTARIO_COLOR = "#8B5CF6";

interface ActivityBucket {
  id: string;
  /** Lo que va bajo la columna; se omite en los granos apretados. */
  label: string;
  /** Cómo se nombra el tramo entero: "16:00–17:00", "miércoles", "día 28". */
  longLabel: string;
  avances: number;
  comentarios: number;
}

const bucketsFor = (grain: ActivityGrain): ActivityBucket[] => {
  if (grain === "hora") {
    return Array.from({ length: 24 }, (_, hour) => ({
      id: String(hour),
      // Solo las horas en punto de cada tres: veinticuatro rótulos de dos
      // cifras en media fila se pisan entre ellos.
      label: hour % 3 === 0 ? String(hour).padStart(2, "0") : "",
      longLabel: `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`,
      avances: 0,
      comentarios: 0,
    }));
  }
  if (grain === "semana") {
    return WEEKDAYS.map((day, index) => ({
      id: String(index),
      label: day,
      longLabel: WEEKDAYS_LONG[index],
      avances: 0,
      comentarios: 0,
    }));
  }
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return {
      id: String(day),
      label: day === 1 || day % 5 === 0 ? String(day) : "",
      longLabel: `día ${day}`,
      avances: 0,
      comentarios: 0,
    };
  });
};

/** En qué columna cae una fecha según el grano. Lunes es el primer día. */
function indexOf(date: Date, grain: ActivityGrain): number {
  if (grain === "hora") return date.getHours();
  if (grain === "semana") return (date.getDay() + 6) % 7;
  return date.getDate() - 1;
}

/**
 * Cada entrada del historial cuenta en el tramo que le toca. Una que trae
 * valor *y* comentario suma en los dos: fue las dos cosas, y elegir una
 * escondería la mitad de lo que pasó.
 */
export function buildActivityBuckets(
  entries: readonly ResultEntry[],
  grain: ActivityGrain
): ActivityBucket[] {
  const buckets = bucketsFor(grain);
  entries.forEach((entry) => {
    entry.tracked.updates.forEach((update) => {
      const bucket = buckets[indexOf(new Date(update.date), grain)];
      if (!bucket) return;
      if (update.value !== null) bucket.avances += 1;
      if (update.comment.trim() !== "") bucket.comentarios += 1;
    });
  });
  return buckets;
}

const CHART_HEIGHT = 116;

export function ActivityRhythmPanel({ entries }: { entries: readonly ResultEntry[] }) {
  const [grain, setGrain] = React.useState<ActivityGrain>("hora");

  const buckets = React.useMemo(() => buildActivityBuckets(entries, grain), [entries, grain]);

  const totals = React.useMemo(() => {
    const avances = buckets.reduce((sum, bucket) => sum + bucket.avances, 0);
    const comentarios = buckets.reduce((sum, bucket) => sum + bucket.comentarios, 0);
    const peak = buckets.reduce(
      (best, bucket) =>
        bucket.avances + bucket.comentarios > best.avances + best.comentarios ? bucket : best,
      buckets[0]
    );
    const max = Math.max(...buckets.map((bucket) => bucket.avances + bucket.comentarios));
    return { avances, comentarios, peak, max, all: avances + comentarios };
  }, [buckets]);

  return (
    <SummaryPanel
      title="Ritmo de actividad"
      hint="Cuándo se actualizan los objetivos y cuándo se comenta."
      total={totals.all}
      aside={
        <div
          className="flex shrink-0 rounded-lg bg-muted/60 p-0.5"
          role="radiogroup"
          aria-label="Grano del ritmo"
        >
          {GRAIN_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={grain === option}
              onClick={() => setGrain(option)}
              className={cn(
                "rounded-[6px] px-2 py-1 text-[11px] font-semibold transition-colors",
                grain === option
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {GRAIN_LABELS[option]}
            </button>
          ))}
        </div>
      }
    >
      {totals.all === 0 ? (
        <p className="py-6 text-center text-[12px] text-text-muted">
          Nadie ha reportado ni comentado todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* El titular es la respuesta a la pregunta de la tarjeta; las
              columnas están debajo para ver si ese pico es una punta clara o
              apenas asoma sobre el resto. */}
          <p className="text-[12px] text-text-secondary">
            Más actividad {grain === "hora" ? "entre las" : grain === "semana" ? "los" : "el"}{" "}
            <span className="font-bold text-text-primary">{totals.peak.longLabel}</span> ·{" "}
            {totals.peak.avances + totals.peak.comentarios} registros
          </p>

          <div className="flex items-end gap-[3px]" style={{ height: CHART_HEIGHT }}>
            {buckets.map((bucket) => {
              const total = bucket.avances + bucket.comentarios;
              const share = total / Math.max(1, totals.max);
              return (
                <div
                  key={bucket.id}
                  title={`${bucket.longLabel} · ${bucket.avances} ${
                    bucket.avances === 1 ? "avance" : "avances"
                  }, ${bucket.comentarios} ${
                    bucket.comentarios === 1 ? "comentario" : "comentarios"
                  }`}
                  className="flex min-w-0 flex-1 flex-col justify-end"
                  style={{ height: "100%" }}
                >
                  {/* Un tramo en cero no dibuja nada, pero la columna vacía se
                      queda: un hueco en el eje dice "aquí no pasó nada", que
                      es justo la lectura. */}
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-[3px]"
                    style={{ height: `${Math.max(total === 0 ? 0 : 2, share * 100)}%` }}
                  >
                    {bucket.comentarios > 0 && (
                      <span
                        className="w-full shrink-0"
                        style={{
                          height: `${(bucket.comentarios / Math.max(1, total)) * 100}%`,
                          backgroundColor: COMENTARIO_COLOR,
                        }}
                      />
                    )}
                    {bucket.avances > 0 && (
                      <span
                        className="w-full shrink-0"
                        style={{
                          height: `${(bucket.avances / Math.max(1, total)) * 100}%`,
                          backgroundColor: AVANCE_COLOR,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]" aria-hidden>
            {buckets.map((bucket) => (
              <span
                key={bucket.id}
                className="min-w-0 flex-1 text-center text-[9.5px] font-semibold tabular-nums text-text-muted"
              >
                {bucket.label}
              </span>
            ))}
          </div>

          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2.5 text-[12px]">
            <SeriesKey color={AVANCE_COLOR} label="Avances" value={totals.avances} />
            <SeriesKey color={COMENTARIO_COLOR} label="Comentarios" value={totals.comentarios} />
          </ul>
        </div>
      )}
    </SummaryPanel>
  );
}

function SeriesKey({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2 text-text-secondary">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
      <span className="font-bold tabular-nums text-text-primary">{value}</span>
    </li>
  );
}
