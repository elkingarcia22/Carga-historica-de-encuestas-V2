import re

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'r') as f:
    content = f.read()

render_regex = re.compile(r'return \(\s*<div className="flex flex-col gap-2">.*?\);\s*\}', re.DOTALL)

new_render = """return (
    <div className="flex flex-col sm:flex-row items-stretch gap-3">
      {/* Bloque Izquierdo: Entrada y Atajos */}
      <div className="flex-1 rounded-xl border border-border/60 bg-surface px-4 py-3.5 shadow-sm">
        <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-text-secondary">
          <CircleGauge className="size-3.5" strokeWidth={2} />
          Simular un resultado
        </label>
        <div className="flex flex-col gap-3">
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
          
          {presets.length > 0 && (
            <div
              role="radiogroup"
              aria-label="Resultados de prueba"
              className="flex flex-wrap gap-1.5"
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
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-surface-muted text-text-secondary hover:bg-border/40 hover:text-text-primary border border-border/40"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bloque Derecho: Resultado */}
      <div className="flex shrink-0 w-full sm:w-[150px] flex-col justify-center items-center rounded-xl border border-border/60 bg-surface-muted/20 px-3 py-4 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary/70">
          Cumplimiento
        </span>
        {result !== null && roundedPercent !== null ? (
          <>
            <span
              className={cn(
                "mt-1 text-2xl font-bold tabular-nums leading-none tracking-tight",
                roundedPercent <= 0 ? "text-destructive" : "text-primary"
              )}
            >
              {roundedPercent} %
            </span>
            {explanation && (
              <span className="mt-2 text-[10.5px] leading-tight text-text-secondary/90 balance">
                {explanation}
              </span>
            )}
          </>
        ) : (
          <span className="mt-1 text-lg font-semibold text-text-muted">--</span>
        )}
      </div>
    </div>
  );
}"""

content = render_regex.sub(new_render, content)

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'w') as f:
    f.write(content)
