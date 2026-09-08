import re

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'r') as f:
    content = f.read()

# Match from {/* Bloque Derecho: Resultado */} down to </div>\n    </div>\n  );
right_block_regex = re.compile(r'\{\/\* Bloque Derecho: Resultado \*\/\}.*?</div>\n    </div>', re.DOTALL)

new_right_block = """{/* Bloque Derecho: Resultado */}
      <div className="flex shrink-0 w-full sm:w-[260px] flex-col justify-center rounded-xl bg-muted/40 p-4">
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
                  roundedPercent <= 0 ? "text-destructive" : "text-primary"
                )}
              >
                {roundedPercent}
              </span>
              <span className="text-lg font-bold text-muted-foreground/60">%</span>
            </div>

            {explanation && (
              <div className="mt-2.5 border-t border-border/40 pt-2.5">
                <p className="text-[11.5px] leading-relaxed text-text-secondary">
                  {explanation}
                </p>
              </div>
            )}
          </>
        ) : (
          <span className="text-2xl font-black text-text-muted">--</span>
        )}
      </div>
    </div>"""

content = right_block_regex.sub(new_right_block, content)

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'w') as f:
    f.write(content)
