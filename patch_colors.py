import re

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'r') as f:
    content = f.read()

# 1. Update the layout
render_regex = re.compile(r'\{\/\* Bloque Derecho: Resultado \*\/\}.*?</div>\n    </div>', re.DOTALL)

new_render = """{/* Bloque Derecho: Resultado */}
      <div className="flex shrink-0 w-full sm:w-[260px] flex-col justify-center rounded-xl border border-border/60 bg-surface px-4 py-3.5 shadow-sm">
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
                  estadoBadge?.textClass ?? "text-primary"
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
    </div>"""

content = render_regex.sub(new_render, content)

# 2. Update explain function
explain_regex = re.compile(r'function explain\(.*?\) \{.*?return null;\n\}', re.DOTALL)

new_explain = """function explain(
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
}"""

content = explain_regex.sub(new_explain, content)

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'w') as f:
    f.write(content)
