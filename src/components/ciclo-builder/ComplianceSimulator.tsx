import * as React from "react";
import { CircleGauge, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MEASURE_META,
  formatMeasureValue,
  parseAmount,
  type MeasureType,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";
import { computeCompliance } from "./complianceRules";
import { FieldLabel } from "./ObjectiveCompactPickers";
import {
  findEstadoForPercent,
  getEstadoBadgeConfig,
  useObjetivosConfig,
} from "@/components/objetivos/objetivosConfigStore";

interface ComplianceSimulatorProps {
  measure: MeasureType;
  direction: ObjectiveDirection;
  /** La salida efectiva, ya resuelta por quien llama (escrita o deducida). */
  start: number;
  target: number;
  min: number | null;
  max: number | null;
  /** `compact` es una sola franja —entrada, atajos y resultado en línea— para
   * la tarjeta compacta, donde el bloque de dos cajas pesaba más que los
   * valores que venía a comprobar. El cálculo y los textos son los mismos. */
  layout?: "default" | "compact";
}

/** Sin `allowNegative`, cualquier "-" que escriban se descarta: no tiene caso
 * dejar teclear un resultado que la configuración del módulo no admite. */
const sanitize = (raw: string, allowNegative: boolean) => {
  const isNegative = allowNegative && raw.trimStart().startsWith("-");
  const digits = raw.replace(/[^0-9.,]/g, "");
  return isNegative ? `-${digits}` : digits;
};

/** Redondea a un decimal, que es la precisión con la que se muestra el avance. */
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * "¿Y esto cuánto daría?" — el objetivo, probado antes de existir.
 *
 * Todas las reglas de cálculo se pueden explicar con palabras, y arriba de este
 * componente se explican. Pero la pregunta que de verdad tiene el autor no es
 * "¿qué dice la regla R5?" sino "si mi equipo llega a tal número, ¿qué le va a
 * salir?". Dejar que teclee ese número y vea la respuesta cierra esa duda en un
 * segundo, y de paso hace evidentes los dos casos que más soporte generan: el
 * mínimo que deja todo en 0 % y el máximo que topa el resultado.
 *
 * Los atajos importan tanto como el campo: quien no sabe qué número escribir
 * igual puede pulsar "justo en la meta" y comprobar que da 100 %.
 */
export function ComplianceSimulator({
  measure,
  direction,
  start,
  target,
  min,
  max,
  layout = "default",
}: ComplianceSimulatorProps) {
  const symbol = MEASURE_META[measure].symbol;
  const { estados, allowNegativeResults } = useObjetivosConfig();
  // Arranca en la meta: es la comprobación que todo el mundo quiere hacer
  // primero, y ver un 100 % de entrada confirma que la pista está bien puesta.
  const [raw, setRaw] = React.useState(() => String(target));
  React.useEffect(() => setRaw(String(target)), [target]);

  const actual = parseAmount(raw);
  const result =
    actual === null
      ? null
      : computeCompliance({
          direction,
          target,
          initial: start,
          min,
          max,
          actual,
          allowNegative: allowNegativeResults,
        });
  const roundedPercent = result === null ? null : round1(result.percent);
  // A qué estado de "Estados de los objetivos" pertenece este porcentaje — la
  // pregunta que el paso 6 está aquí para contestar, no solo el número.
  const matchedEstado =
    roundedPercent === null ? null : findEstadoForPercent(estados, roundedPercent);
  // El colorHex del estado es un tono pastel pensado para la barra de
  // distribución del drawer, no para texto: se traduce a la pareja de
  // clases fondo-claro/texto-oscuro que sí tiene buen contraste.
  const estadoBadge = matchedEstado ? getEstadoBadgeConfig(matchedEstado) : null;

  const explanation =
    result === null
      ? null
      : explain(result, { direction, measure, min, max, allowNegative: allowNegativeResults });

  const presets: { label: string; value: number }[] = measure === "boolean" 
    ? [
        { label: "No se cumple", value: 0 },
        { label: "Se cumple", value: 1 },
      ]
    : [
        { label: "Sin avanzar", value: start },
        { label: "A mitad de camino", value: start + (target - start) / 2 },
        { label: "Justo en la meta", value: target },
        { label: "Más allá de la meta", value: target + (target - start) * 0.5 },
        // El tramo hacia atrás solo tiene sentido probarlo cuando la
        // configuración admite que un resultado cuente como negativo.
        ...(allowNegativeResults
          ? [{ label: "Retrocedió", value: start - (target - start) * 0.15 }]
          : []),
      ];

  const input = measure === "boolean" ? null : (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-text-secondary"
      >
        {symbol}
      </span>
      <input
        value={raw}
        inputMode="decimal"
        onChange={(event) => setRaw(sanitize(event.target.value, allowNegativeResults))}
        aria-label="Resultado de ejemplo"
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
    </div>
  );

  const presetChips = (isCompact: boolean) =>
    presets.length === 0 ? null : (
      // En la fila compacta los chips van junto al input: `contents` saca la
      // caja del radiogroup del layout para que cada botón entre directo en
      // el flex-wrap del padre (mismo gap, mismo salto de línea) en vez de
      // envolver como un bloque aparte que empuja todo a la línea siguiente.
      <div
        role="radiogroup"
        aria-label="Resultados de prueba"
        className={isCompact ? "contents" : "flex flex-wrap gap-1.5"}
      >
        {presets.map((preset) => {
          const presetRaw = String(preset.value);
          const isActive = raw === presetRaw;

          return (
            <button
              key={preset.label}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setRaw(presetRaw)}
              className={cn(
                "transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95",
                isCompact
                  ? cn(
                      // Mismo chip de contorno que el tipo de medida: son
                      // opciones entre las que se elige, no acciones.
                      "flex h-9 items-center rounded-md border px-3 text-[12px] font-semibold",
                      isActive
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary"
                    )
                  : cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-surface-muted text-text-secondary hover:bg-border/40 hover:text-text-primary border border-border/40"
                    )
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    );

  if (layout === "compact") {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <FieldLabel icon={FlaskConical}>Resultado de ejemplo</FieldLabel>
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            {measure === "boolean" ? "Elige una de las dos opciones." : "Escribe un resultado o elige un atajo."}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {measure !== "boolean" && (
              <span className="relative flex w-[150px] shrink-0 items-center">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 text-[13px] font-semibold text-text-secondary"
                >
                  {symbol}
                </span>
                <input
                  value={raw}
                  inputMode="decimal"
                  onChange={(event) => setRaw(sanitize(event.target.value, allowNegativeResults))}
                  aria-label="Resultado de ejemplo"
                  className="h-10 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </span>
            )}
            {presetChips(true)}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel icon={CircleGauge}>Cumplimiento</FieldLabel>
          <div className="flex h-10 items-center gap-2 rounded-md border border-primary/15 px-3">
            {result !== null && roundedPercent !== null ? (
              <>
                <span className="flex shrink-0 items-baseline gap-0.5">
                  <span
                    className={cn(
                      "text-[20px] font-black leading-none tabular-nums tracking-tight",
                      estadoBadge?.iconColor ?? "text-primary"
                    )}
                  >
                    {roundedPercent}
                  </span>
                  <span className="text-[12px] font-bold text-muted-foreground/70">%</span>
                </span>
                {matchedEstado && estadoBadge && (
                  <>
                    <span aria-hidden className="h-3.5 w-px shrink-0 bg-primary/20" />
                    <span
                      className={cn(
                        "truncate rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                        estadoBadge.bg,
                        estadoBadge.text,
                        estadoBadge.border
                      )}
                    >
                      {matchedEstado.nombre}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-[15px] font-black text-text-muted">--</span>
            )}
          </div>
          {explanation && (
            <span className="text-[12px] leading-relaxed text-muted-foreground">{explanation}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-3">
      {/* Bloque Izquierdo: Entrada y Atajos */}
      <div className="flex-1 rounded-xl border border-border/60 bg-surface px-4 py-3.5 shadow-sm">
        <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-text-secondary">
          <CircleGauge className="size-3.5" strokeWidth={2} />
          Simular un resultado
        </label>
        <div className="flex flex-col gap-3">
          {input}
          {presetChips(false)}
        </div>
      </div>

      {/* Bloque Derecho: Resultado */}
      <div className="flex shrink-0 w-full sm:w-1/3 flex-col justify-center rounded-xl border border-border/60 bg-surface px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary/80">
            Resultado final
          </span>
        </div>

        {result !== null && roundedPercent !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-3xl font-black tabular-nums tracking-tighter",
                  estadoBadge?.iconColor ?? "text-primary"
                )}
              >
                {roundedPercent}
              </span>
              <span className="text-lg font-bold text-muted-foreground/60">%</span>
            </div>

            <div className="mt-2.5 border-t border-border/40 pt-2.5">
              <p className="text-[11.5px] leading-relaxed text-text-secondary min-h-[3rem]">
                {explanation}
              </p>
            </div>
          </>
        ) : (
          <span className="text-2xl font-black text-text-muted">--</span>
        )}
      </div>
    </div>
  );
}

/** La frase que dice *por qué* salió ese número, nombrando la regla que actuó.
 * Devuelve null en el caso normal (nada de R4/R5/R0a intervino): ahí el
 * número y el estado ya cuentan toda la historia, no hace falta narrarlo. */
function explain(
  result: ReturnType<typeof computeCompliance>,
  context: {
    direction: ObjectiveDirection;
    measure: MeasureType;
    min: number | null;
    max: number | null;
    allowNegative: boolean;
  }
): string {
  const { direction, measure, min, max, allowNegative } = context;
  const isIncrease = direction === "increase";

  if (result.blockedByMinimum && min !== null) {
    return isIncrease
      ? `No alcanza el mínimo de ${formatMeasureValue(min, measure)}, así que cuenta como 0 % aunque haya avanzado algo.`
      : `No baja hasta el mínimo de ${formatMeasureValue(min, measure)}, así que cuenta como 0 % aunque haya bajado algo.`;
  }

  if (result.truncatedAtZero) {
    return isIncrease
      ? "El resultado quedó por debajo del punto de partida, así que el cumplimiento se muestra como 0 % (nunca negativo)."
      : "El resultado quedó por encima del punto de partida, así que el cumplimiento se muestra como 0 % (nunca negativo).";
  }

  if (allowNegative && result.percent < 0) {
    return isIncrease
      ? "El resultado quedó por debajo del punto de partida: como el módulo admite resultados negativos, el cumplimiento se muestra tal cual, sin truncarse en 0 %."
      : "El resultado quedó por encima del punto de partida: como el módulo admite resultados negativos, el cumplimiento se muestra tal cual, sin truncarse en 0 %.";
  }

  if (result.cappedByMaximum && max !== null) {
    return `Superó el máximo de ${formatMeasureValue(max, measure)}, así que se calcula como si el resultado hubiera sido exactamente ese tope.`;
  }
  
  if (result.percent === 100) {
    return "Alcanzó exactamente el valor de la meta, por lo que el cumplimiento es del 100 %.";
  }

  if (result.percent > 100) {
    return "Superó la meta. El cumplimiento excede el 100 % de forma proporcional al avance extra.";
  }

  if (result.percent === 0) {
    return "No hay avance respecto al valor inicial, por lo que el cumplimiento es del 0 %.";
  }

  return "El avance se calcula proporcionalmente en el trayecto desde el punto de inicio hacia la meta.";
}
