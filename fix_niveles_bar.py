import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """                <motion.header variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-sm">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">
                        Niveles de desempeño
                      </h2>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura los niveles de desempeño y define los rangos de cumplimiento para calificar a los colaboradores.
                      </p>
                    </div>
                  </div>
                </motion.header>

                {/* Continuum Visual Bar for Niveles (CONTENEDOR APARTE) */}
                <div className="sticky -top-4 z-20 pt-4 pb-2 -mx-4 px-4 bg-background">
                  <motion.div variants={cascadeItem} className="shrink-0 rounded-xl border border-border/60 bg-surface px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-text-secondary mb-2">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-primary" />
                        Distribución de niveles
                      </span>
                      <span className="text-[11px] font-medium bg-surface-muted px-2 py-0.5 rounded-md text-text-muted">
                        {niveles.length} niveles configurados
                      </span>
                    </div>

                    <TooltipProvider>
                      <div className="h-4 w-full rounded-full bg-surface-muted/60 border border-border/50 flex overflow-hidden p-0.5 gap-0.5 shadow-inner">
                      {[...niveles].sort((a, b) => a.minPorcentaje - b.minPorcentaje).map((nivel) => {
                        return (
                          <Tooltip key={nivel.id} delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div
                                style={{
                                  flex: Math.max(1, (nivel.maxPorcentaje - nivel.minPorcentaje) || 5),
                                  backgroundColor: nivel.colorHex,
                                }}
                                className="h-full rounded-full transition-all duration-200 relative cursor-pointer hover:opacity-80 hover:brightness-110"
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={8}
                              className="flex flex-col gap-1 px-3.5 py-2 bg-slate-900 text-white dark:bg-slate-950 dark:text-slate-50 border border-slate-800 shadow-2xl rounded-xl z-50 !opacity-100 data-closed:animate-none data-closed:duration-0"
                            >
                              <div className="flex items-center gap-2 font-bold text-xs">
                                <span 
                                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs" 
                                  style={{ backgroundColor: nivel.colorHex }}
                                />
                                <span>{nivel.nombre}</span>
                              </div>
                              <div className="text-[11px] font-medium text-slate-300 pl-4.5 tabular-nums">
                                Rango: <span className="font-semibold text-white">{nivel.minPorcentaje}% a {nivel.maxPorcentaje}%</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      </div>
                    </TooltipProvider>
                  </motion.div>
                </div>

                <motion.div variants={cascadeItem}>
"""

pattern = r"                <motion\.header variants=\{cascadeItem\}.*?Agrega o elimina niveles para los rangos.*?</p>"
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
