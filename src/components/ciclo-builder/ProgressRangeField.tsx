import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  MEASURE_META,
  formatMeasureValue,
  parseAmount,
  type MeasureType,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";
import { resolveStartLine, trackWarnings } from "./complianceRules";

interface ProgressRangeFieldProps {
  measure: Exclude<MeasureType, "boolean">;
  /** El sentido de la carrera decide de qué lado del mínimo cuenta 0 %. */
  direction: ObjectiveDirection;
  initialValue: string;
  targetValue: string;
  enabled: boolean;
  minValue: string;
  maxValue: string;
  onChange: (patch: {
    rangeEnabled?: boolean;
    minValue?: string;
    maxValue?: string;
  }) => void;
  /** Sólo los campos, sin el interruptor ni el borde: para cuando quien
   * llama ya decidió que el rango está activo y lo enciende desde fuera. */
  embedded?: boolean;
}

/** Mismo criterio que en los valores: el menos sólo vale al inicio. */
const sanitize = (raw: string) => {
  const isNegative = raw.trimStart().startsWith("-");
  const digits = raw.replace(/[^0-9.,]/g, "");
  return isNegative ? `-${digits}` : digits;
};

/**
 * El piso y el techo de lo que cuenta como avance (reglas R4 y R5).
 *
 * Es el campo que nadie entiende por su nombre, porque "mínimo y máximo de
 * avance" suena a un rango dentro del cual tiene que caer el resultado — y no
 * lo es. Son dos reglas separadas sobre cómo se *puntúa* un resultado: por
 * debajo del piso el objetivo saca cero en vez de sacar poco, y pasado el
 * techo deja de acumular.
 *
 * Y el lado que cuenta como "por debajo" depende del sentido de la carrera:
 * en un objetivo de reducción el mínimo es un valor al que hay que *bajar*, no
 * uno que haya que superar. Antes este componente asumía siempre el sentido
 * ascendente, así que a un objetivo de reducción le mostraba la explicación al
 * revés y le marcaba como error la única ordenación que era correcta.
 */
export function ProgressRangeField({
  measure,
  direction,
  initialValue,
  targetValue,
  enabled,
  minValue,
  maxValue,
  onChange,
  embedded = false,
}: ProgressRangeFieldProps) {
  const symbol = MEASURE_META[measure].symbol;
  const initial = parseAmount(initialValue);
  const target = parseAmount(targetValue);
  const min = parseAmount(minValue);
  const max = parseAmount(maxValue);
  const isIncrease = direction === "increase";

  const startLine =
    target !== null && target !== initial ? resolveStartLine(direction, target, initial) : null;

  const warnings =
    startLine !== null && target !== null
      ? trackWarnings(direction, startLine.value, target, min, max)
      : [];
  const warningFor = (field: "min" | "max") =>
    warnings.find((warning) => warning.field === field)?.message;

  // Lleva la vista a los campos en cuanto se activa el interruptor — sólo en
  // la versión no embebida, donde el interruptor vive en este mismo
  // componente. En la versión embebida (tarjeta compacta) el interruptor
  // vive en el padre, así que es el padre quien hace este mismo scroll sobre
  // su propio `CompactStep` — ver `RulesAndTestBlocks`.
  // Sin espera: se ancla el contenedor arriba del scroll de inmediato y los
  // campos crecen *dentro* de ese encuadre ya fijo, en vez de esperar a que
  // terminen de crecer para recién entonces saltar — eso es lo que se sentía
  // como demora.
  const outerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (embedded || !enabled) return;
    outerRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [embedded, enabled]);

  const fields = (
    <TooltipProvider delayDuration={200}>
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start",
        !embedded && "border-t border-border/60 px-4 py-4"
      )}
    >
      <div className="flex-1">
        <RangeInput
          label="Mínimo de avance"
          hint={
            isIncrease
              ? "Si el resultado no llega hasta aquí, el cumplimiento se registra como 0 %."
              : "Si el resultado no baja hasta aquí, el cumplimiento se registra como 0 %."
          }
          symbol={symbol}
          value={minValue}
          warning={warningFor("min")}
          onChange={(next) => onChange({ minValue: next })}
        />
      </div>
      <div className="flex-1">
        <RangeInput
          label="Máximo de avance"
          hint={
            isIncrease
              ? "Si el resultado lo supera, el cumplimiento se topa en este valor."
              : "Si el resultado baja más allá, el cumplimiento se topa en este valor."
          }
          symbol={symbol}
          value={maxValue}
          warning={warningFor("max")}
          onChange={(next) => onChange({ maxValue: next })}
        />
      </div>

      {startLine !== null && target !== null && (
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-primary">Visualización</span>
          <RangeVisual
            measure={measure}
            isIncrease={isIncrease}
            start={startLine.value}
            isDerivedStart={startLine.source !== "declared"}
            target={target}
            min={min}
            max={max}
          />
        </div>
      )}
    </div>
    </TooltipProvider>
  );

  if (embedded) return fields;

  return (
    <div ref={outerRef} className="scroll-mt-20 rounded-xl border border-border/60 bg-surface">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Switch
          id="range-toggle"
          checked={enabled}
          onCheckedChange={(checked) => onChange({ rangeEnabled: checked })}
          aria-label="Activar mínimos y máximos de avance"
        />
        <label htmlFor="range-toggle" className="min-w-0 flex-1 cursor-pointer">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
            <Gauge className="size-3.5 text-text-secondary" strokeWidth={2} />
            Activar mínimos y máximos de avance
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              Opcional
            </span>
          </span>
        </label>
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="range-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {fields}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RangeInput({
  label,
  hint,
  symbol,
  value,
  warning,
  onChange,
}: {
  label: string;
  hint: string;
  symbol: string;
  value: string;
  warning?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-text-primary">
        {label}
      </span>
      <label className="relative flex items-center">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 text-[13px] font-semibold text-text-secondary"
        >
          {symbol}
        </span>
        <input
          value={value}
          inputMode="decimal"
          onChange={(event) => onChange(sanitize(event.target.value))}
          placeholder="Opcional"
          aria-label={label}
          className={cn(
            "h-10 w-full rounded-md border bg-surface pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
            warning
              ? "border-status-warning focus:border-status-warning focus:ring-status-warning/25"
              : "border-border focus:border-primary focus:ring-primary/25"
          )}
        />
      </label>
      {warning ? (
        <span className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-status-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
          {warning}
        </span>
      ) : (
        <span className="text-[12px] leading-relaxed text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

/**
 * Las tres zonas sobre un mismo eje.
 *
 * Las posiciones se calculan en *avance* y no en las unidades de la medida —
 * 0 es la salida, 1 es la meta — así que un objetivo de reducción, cuyos
 * números corren hacia abajo, se dibuja de izquierda a derecha igual que uno
 * de aumento. Esa normalización es la que hace que un solo dibujo sirva para
 * los dos sentidos y también para pistas enteramente negativas.
 */
function RangeVisual({
  measure,
  isIncrease,
  start,
  isDerivedStart,
  target,
  min,
  max,
}: {
  measure: MeasureType;
  isIncrease: boolean;
  start: number;
  isDerivedStart: boolean;
  target: number;
  min: number | null;
  max: number | null;
}) {
  const span = target - start;
  const progressOf = (value: number) => (value - start) / span;

  const rawMin = min === null ? 0 : progressOf(min);
  const rawMax = max === null ? 1 : progressOf(max);
  const domain = Math.max(1, rawMax, rawMin) * 1.06;
  const at = (progress: number) => Math.max(0, Math.min(1, progress / domain)) * 100;

  const floor = Math.max(0, Math.min(rawMin, 1));
  const ceiling = Math.max(floor, rawMax);

  const markers = [
    { key: "start", percent: at(0), rawValue: start, label: "Inicio", value: formatMeasureValue(start, measure), color: "bg-text-secondary", textColor: "text-text-secondary", side: "bottom" },
    ...(min !== null ? [{ key: "min", percent: at(rawMin), rawValue: min, label: "Piso", value: formatMeasureValue(min, measure), color: "bg-destructive", textColor: "text-destructive", side: "top" }] : []),
    { key: "target", percent: at(1), rawValue: target, label: "Meta", value: formatMeasureValue(target, measure), color: "bg-primary", textColor: "text-primary", side: "bottom" },
    ...(max !== null ? [{ key: "max", percent: at(rawMax), rawValue: max, label: "Techo", value: formatMeasureValue(max, measure), color: "bg-muted-foreground", textColor: "text-muted-foreground", side: "top" }] : []),
  ];

  const COINCIDENT_VALUE_EPSILON = 1e-6;
  
  const processGroup = (groupMarkers) => {
    const consumed = new Set();
    const merged = [];
    for (const marker of groupMarkers) {
      if (consumed.has(marker.key)) continue;
      const group = groupMarkers.filter((other) => Math.abs(other.rawValue - marker.rawValue) <= COINCIDENT_VALUE_EPSILON);
      group.forEach((member) => consumed.add(member.key));
      merged.push(
        group.length === 1
          ? marker
          : {
              key: group.map((m) => m.key).join("+"),
              percent: marker.percent,
              rawValue: marker.rawValue,
              label: group.map((m) => m.label).join(" y "),
              value: marker.value,
              color: group.some((m) => m.key === "target") ? "bg-primary" : marker.color,
              textColor: group.some((m) => m.key === "target") ? "text-primary" : marker.textColor,
            }
      );
    }
    const ordered = [...merged].sort((a, b) => a.percent - b.percent);
    const rowEnds = [];
    const rows = new Map();
    const LABEL_COLLISION_GAP = 15;
    for (const marker of ordered) {
      let row = rowEnds.findIndex((lastPercent) => marker.percent - lastPercent >= LABEL_COLLISION_GAP);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(marker.percent);
      } else {
        rowEnds[row] = marker.percent;
      }
      rows.set(marker.key, row);
    }
    return { merged, rows, rowCount: Math.max(0, ...merged.map((m) => rows.get(m.key) ?? 0)) + 1 };
  };

  const topGroup = processGroup(markers.filter(m => m.side === "top"));
  const bottomGroup = processGroup(markers.filter(m => m.side === "bottom"));

  return (
    <figure className="flex w-full flex-col justify-center py-2">
      <div className="relative mb-2" style={{ height: `${(topGroup.rowCount === 0 ? 1 : topGroup.rowCount) * 16}px` }}>
        {topGroup.merged.map((marker) => {
          const row = topGroup.rows.get(marker.key) ?? 0;
          const anchor = marker.percent <= 15 ? "start" : marker.percent >= 85 ? "end" : "center";
          return (
            <span
              key={marker.key}
              className={cn(
                "absolute bottom-0 flex flex-col whitespace-nowrap text-[10px] font-semibold",
                anchor === "start" && "items-start",
                anchor === "end" && "items-end",
                anchor === "center" && "-translate-x-1/2 items-center",
                marker.textColor
              )}
              style={{
                ...(anchor === "start" && { left: `${marker.percent}%` }),
                ...(anchor === "end" && { right: `${100 - marker.percent}%` }),
                ...(anchor === "center" && { left: `${marker.percent}%` }),
                bottom: `${row * 16}px`,
              }}
            >
              <span>{marker.label} {marker.value}</span>
            </span>
          );
        })}
      </div>

      <div className="relative h-2 w-full rounded-full bg-border/60">
        {min !== null && (
          <span
            className="absolute inset-y-0 left-0 rounded-l-full bg-destructive/25"
            style={{ width: `${floor}%` }}
          />
        )}
        <span
          className="absolute inset-y-0 bg-primary/70"
          style={{ left: `${floor}%`, width: `${ceiling - floor}%` }}
        />
        {max !== null && (
          <span
            className="absolute inset-y-0 right-0 rounded-r-full bg-border-strong/40"
            style={{ left: `${ceiling}%` }}
          />
        )}

        {markers.map((marker) => (
          <span
            key={marker.key}
            aria-hidden
            className={cn(
              "absolute top-1/2 block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface",
              marker.color
            )}
            style={{ left: `${marker.percent}%` }}
          />
        ))}
      </div>
      
      <div className="relative mt-2" style={{ height: `${bottomGroup.rowCount * 16}px` }}>
        {bottomGroup.merged.map((marker) => {
          const row = bottomGroup.rows.get(marker.key) ?? 0;
          const anchor = marker.percent <= 15 ? "start" : marker.percent >= 85 ? "end" : "center";
          return (
            <span
              key={marker.key}
              className={cn(
                "absolute top-0 flex flex-col whitespace-nowrap text-[10px] font-semibold",
                anchor === "start" && "items-start",
                anchor === "end" && "items-end",
                anchor === "center" && "-translate-x-1/2 items-center",
                marker.textColor
              )}
              style={{
                ...(anchor === "start" && { left: `${marker.percent}%` }),
                ...(anchor === "end" && { right: `${100 - marker.percent}%` }),
                ...(anchor === "center" && { left: `${marker.percent}%` }),
                top: `${row * 16}px`,
              }}
            >
              <span>{marker.label} {marker.value}</span>
            </span>
          );
        })}
      </div>
    </figure>
  );
}