const fs = require('fs');
const file = 'src/components/ciclo-builder/ProgressRangeField.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }')) {
  content = content.replace('import { Switch } from "@/components/ui/switch";', 'import { Switch } from "@/components/ui/switch";\nimport { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";\nimport { Info } from "lucide-react";');
}

const oldRangeInput = `function RangeInput({
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
  /** Un valor fuera de la pista: no impide guardar, pero cambia el resultado. */
  warning?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-text-primary">{label}</span>
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
          placeholder="Opcional"
          aria-label={label}
          className={cn(
            "h-10 w-full rounded-md border bg-surface pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
            warning
              ? "border-status-warning focus:border-status-warning focus:ring-status-warning/25"
              : "border-border focus:border-primary focus:ring-primary/25"
          )}
        />
      </span>
      {warning ? (
        <span className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-status-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
          {warning}
        </span>
      ) : (
        <span className="text-[12px] leading-relaxed text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}`;

const newRangeInput = `function RangeInput({
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
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        {label}
        <Tooltip>
          <TooltipTrigger type="button" className="cursor-help text-text-secondary hover:text-text-primary transition-colors">
            <Info className="size-3.5" strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px] p-2 text-[12px]">
            {hint}
          </TooltipContent>
        </Tooltip>
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
      {warning && (
        <span className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-status-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
          {warning}
        </span>
      )}
    </div>
  );
}`;

content = content.replace(oldRangeInput, newRangeInput);

const oldLayout = `<div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
                <RangeVisual
                  measure={measure}
                  isIncrease={isIncrease}
                  start={startLine.value}
                  isDerivedStart={startLine.source !== "declared"}
                  target={target}
                  min={min}
                  max={max}
                />
              )}
            </div>`;

const newLayout = `<TooltipProvider delayDuration={200}>
            <div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4 sm:flex-row sm:items-start">
              <div className="flex flex-1 gap-3 sm:flex-col lg:flex-row">
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
              </div>

              {startLine !== null && target !== null && (
                <div className="flex flex-[1.5] min-w-0 flex-col gap-1.5">
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
            </TooltipProvider>`;

content = content.replace(oldLayout, newLayout);

fs.writeFileSync(file, content);
