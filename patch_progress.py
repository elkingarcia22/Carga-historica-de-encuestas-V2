import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# 1. Ensure Tooltip is imported
if "TooltipProvider" not in content:
    content = content.replace(
        'import { Switch } from "@/components/ui/switch";',
        'import { Switch } from "@/components/ui/switch";\nimport { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";\nimport { Info } from "lucide-react";'
    )

# 2. Fix the layout block
layout_regex = re.compile(r'<div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4 sm:flex-row sm:items-start">.*?</TooltipProvider>', re.DOTALL)
new_layout = """<div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4 sm:flex-row sm:items-start">
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
            </TooltipProvider>"""
content = layout_regex.sub(new_layout, content)

# 3. Replace RangeInput to use Tooltip and hide hint text
range_input_regex = re.compile(r'function RangeInput\(\{.*?\}\) \{.*?return \(.*?</label>\s*\);\s*\}', re.DOTALL)
new_range_input = """function RangeInput({
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
}"""
content = range_input_regex.sub(new_range_input, content)

# 4. Modify RangeVisual to be very short, remove MarkerLabels and texts
range_visual_regex = re.compile(r'function RangeVisual\(\{.*?\}\) \{.*?return \(.*?</figure>\s*\);\s*\}', re.DOTALL)
new_range_visual = """function RangeVisual({
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
    { key: "start", percent: at(0), accent: false },
    ...(min !== null ? [{ key: "min", percent: at(rawMin), accent: false }] : []),
    { key: "target", percent: at(1), accent: true },
    ...(max !== null ? [{ key: "max", percent: at(rawMax), accent: false }] : []),
  ];

  return (
    <figure className="flex h-10 w-full flex-col justify-center rounded-md border border-border/60 bg-surface-muted/40 px-3">
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
              marker.accent ? "bg-primary" : "bg-text-secondary"
            )}
            style={{ left: `${marker.percent}%` }}
          />
        ))}
      </div>
      
      <figcaption className="mt-1.5 flex items-center justify-between text-[9.5px] font-medium text-text-secondary">
        <div className="flex gap-2">
          {min !== null && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-destructive/40" /> Piso</span>}
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary/70" /> Avance</span>
          {max !== null && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-border-strong/60" /> Techo</span>}
        </div>
      </figcaption>
    </figure>
  );
}"""
content = range_visual_regex.sub(new_range_visual, content)

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'w') as f:
    f.write(content)
