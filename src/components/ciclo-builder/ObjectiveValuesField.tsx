import * as React from "react";
import { ArrowRight, Calculator, CircleAlert, Flag, MapPin, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MEASURE_META,
  formatMeasureValue,
  parseAmount,
  type MeasureType,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";
import { resolveStartLine, trackBlockingIssue } from "./complianceRules";

interface ObjectiveValuesFieldProps {
  measure: Exclude<MeasureType, "boolean">;
  direction: ObjectiveDirection;
  initialValue: string;
  targetValue: string;
  onChange: (patch: { initialValue?: string; targetValue?: string }) => void;
  showValidation?: boolean;
}

/**
 * Dígitos, los dos separadores que teclea un autor hispanohablante, y el signo
 * menos — las metas financieras en pérdidas (de -$500 a -$1.000) son un caso
 * de uso real, así que el menos tiene que poder escribirse, pero sólo al
 * principio: "5-0" no es un número.
 */
const sanitize = (raw: string) => {
  const isNegative = raw.trimStart().startsWith("-");
  const digits = raw.replace(/[^0-9.,]/g, "");
  return isNegative ? `-${digits}` : digits;
};

/**
 * Tercera decisión: de dónde parte el objetivo y dónde tiene que aterrizar.
 *
 * El valor inicial es opcional (reglas R6b/R6c): cuando no se escribe, el
 * sistema deduce una línea de salida. Eso no puede quedar implícito — un
 * objetivo cuyo 50 % se calcula contra un punto de partida que el autor nunca
 * vio es exactamente el que después genera la pregunta "¿por qué me da este
 * número?". Así que cuando el campo queda vacío, la tarjeta de abajo dice cuál
 * salida se va a usar, con el mismo formato que si se hubiera escrito.
 *
 * Las reglas de relación entre los dos números (R1/R2/R3: la meta no puede
 * igualar ni quedar del lado equivocado del valor inicial) sólo se muestran
 * una vez que el autor sale de los dos campos. Mostrarlas en cada tecla
 * marcaría en rojo un "8" que iba camino a ser "83" — un número a medio
 * escribir no es un número equivocado. Y saltar de "Valor inicial" a "Meta"
 * con Tab tampoco cuenta como salir: son un par, y sólo importa el momento en
 * que el foco deja a los dos.
 */
export function ObjectiveValuesField({
  measure,
  direction,
  initialValue,
  targetValue,
  onChange,
  showValidation = false,
}: ObjectiveValuesFieldProps) {
  const symbol = MEASURE_META[measure].symbol;
  const initial = parseAmount(initialValue);
  const target = parseAmount(targetValue);
  const isIncrease = direction === "increase";

  // Se marca al salir del PAR de campos, no al escribir ni al saltar de uno
  // al otro: la relación entre valor inicial y meta sólo tiene sentido
  // juzgarla una vez el autor terminó de escribir el número (no dígito a
  // dígito), y moverse de "Valor inicial" a "Meta" con Tab es parte de
  // escribir, no de salir.
  const groupRef = React.useRef<HTMLDivElement>(null);
  const [hasBlurred, setHasBlurred] = React.useState(false);
  const showBlocking = hasBlurred || showValidation;

  const handleGroupBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (groupRef.current?.contains(event.relatedTarget)) return;
    setHasBlurred(true);
  };

  const blockingRaw = trackBlockingIssue(direction, target, initial);
  const blocking = showBlocking ? blockingRaw : null;
  // R0b apunta a la meta (es la meta la que no puede ser cero sin salida);
  // R1/R2/R3 apuntan a la relación entre las dos, y se señalan en la meta
  // porque es el campo que el autor acaba de escribir.
  const targetError =
    blocking ?? (showValidation && target === null ? "Completa este campo" : undefined);

  // La salida efectiva sólo se puede resolver una vez hay meta: las cuatro
  // reglas de deducción dependen del signo de la meta. Usa el bloqueo real
  // (no el que se está ocultando todavía) para no ofrecer una salida deducida
  // sobre una combinación que de todos modos es inválida.
  const startLine = target !== null && blockingRaw === null
    ? resolveStartLine(direction, target, initial)
    : null;

  const isDerived = startLine !== null && startLine.source !== "declared";
  const safeTarget = target ?? 0;
  const safeStart = startLine !== null ? startLine.value : (initial ?? 0);
  const safeSpan = Math.abs(safeTarget - safeStart);
  const safeSpanPercent =
    safeStart !== 0
      ? Math.round((safeSpan / Math.abs(safeStart)) * 1000) / 10
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div ref={groupRef} onBlur={handleGroupBlur} className="contents">
          <div className="flex-1">
            <ValueInput
              icon={MapPin}
              label="Valor inicial"
              optional
              hint="Dónde estás hoy (opcional)."
              symbol={symbol}
              value={initialValue}
              onChange={(next) => onChange({ initialValue: next })}
              // Primer campo de este paso: aparece ya listo para escribir.
              autoFocus
            />
          </div>
          <div className="flex-1">
            <ValueInput
              icon={Flag}
              label="Meta"
              hint="El resultado a lograr."
              symbol={symbol}
              value={targetValue}
              error={targetError}
              onChange={(next) => onChange({ targetValue: next })}
            />
          </div>
        </div>

        <div className="flex flex-1 min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
            <Calculator className="size-3.5 text-text-secondary" strokeWidth={2} />
            Resumen
          </span>
          <div className="flex h-10 items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3">
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-text-primary">
              {formatMeasureValue(safeStart, measure)}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-primary" strokeWidth={2.2} />
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-text-primary">
              {formatMeasureValue(safeTarget, measure)}
            </span>
            
            <div className="mx-1 h-3.5 w-px shrink-0 bg-primary/20" />
            
            <span className="truncate text-[11.5px] text-text-secondary">
              Vas a{" "}
              <span className="font-semibold text-text-primary">
                {isIncrease ? "aumentar" : "reducir"}
              </span>{" "}
              <span className="font-semibold tabular-nums text-text-primary">
                {formatMeasureValue(safeSpan, measure)}
              </span>
              {safeSpanPercent !== null && ` (${safeSpanPercent} %)`}
            </span>
          </div>
        </div>
      </div>

      {isDerived && (
        <span className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-text-secondary">
          <Wand2 className="mt-px size-3.5 shrink-0 text-primary" strokeWidth={2} />
          <span>
            Como no escribiste un valor inicial, tomamos{" "}
            <span className="font-semibold text-text-primary">
              {formatMeasureValue(startLine.value, measure)}
            </span>{" "}
            como punto de partida
            {startLine.source === "zero"
              ? "."
              : ", porque el cero quedaría del lado equivocado de la meta."}
          </span>
        </span>
      )}

      {showBlocking && blockingRaw !== null && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] leading-relaxed text-destructive">
          <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} />
          {blockingRaw}
        </p>
      )}
    </div>
  );
}

function ValueInput({
  icon: Icon,
  label,
  hint,
  symbol,
  value,
  error,
  optional,
  onChange,
  autoFocus,
}: {
  icon: typeof MapPin;
  label: string;
  hint: string;
  symbol: string;
  value: string;
  error?: string;
  optional?: boolean;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        <Icon className="size-3.5 text-text-secondary" strokeWidth={2} />
        {label}
        {optional ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            Opcional
          </span>
        ) : (
          <span className="text-destructive">•</span>
        )}
      </span>

      <span className="relative flex items-center">
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
          placeholder={optional ? "Sin definir" : "0"}
          aria-label={label}
          aria-invalid={!!error}
          autoFocus={autoFocus}
          className={cn(
            "h-10 w-full rounded-md border bg-surface pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
            error
              ? "border-destructive focus:border-destructive focus:ring-destructive/25"
              : "border-border focus:border-primary focus:ring-primary/25"
          )}
        />
      </span>

      {error ? (
        <span className="text-[12px] text-destructive">{error}</span>
      ) : (
        <span className="text-[12px] leading-relaxed text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}
