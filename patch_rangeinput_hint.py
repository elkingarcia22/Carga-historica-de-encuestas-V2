import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# Replace RangeInput to remove Tooltip and restore hint below input
range_input_regex = re.compile(r'function RangeInput\(\{.*?\}\) \{.*?return \(.*?</label>\s*\{warning.*?\}\s*</div>\s*\);\s*\}', re.DOTALL)
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
}"""

content = range_input_regex.sub(new_range_input, content)

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'w') as f:
    f.write(content)
