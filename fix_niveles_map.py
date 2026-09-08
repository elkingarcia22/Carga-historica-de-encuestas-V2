import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """                  <div className="space-y-3 pb-4">
                    {niveles.map((nivel, idx) => (
                      <div
                        key={nivel.id}
                        className="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm transition-all hover:border-primary/40 flex flex-col gap-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-text-secondary mt-[18px]">
                              {idx + 1}
                            </span>
                            <div className="flex-1 max-w-xs">
                              <label className="text-[11px] font-bold text-text-muted block mb-1">
                                Nombre del nivel
                              </label>
                              <Input
                                value={nivel.nombre}
                                onChange={(e) => handleUpdateNivel(nivel.id, { nombre: e.target.value })}
                                className="h-9 font-bold text-[13px] border-border/70"
                                placeholder="Nombre del nivel..."
                              />
                            </div>

                            <div className="w-32">
                              <label className="text-[11px] font-bold text-text-muted block mb-1">
                                Desde (%)
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={nivel.minPorcentaje}
                                  onChange={(e) => {
                                    let val = Number(e.target.value);
                                    if (!allowNegativeResults && val < 0) val = 0;
                                    handleUpdateNivel(nivel.id, { minPorcentaje: val });
                                  }}
                                  className="h-9 text-[13px] font-semibold pr-7"
                                  min={allowNegativeResults ? -999 : 0}
                                  max={999}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                                  %
                                </span>
                              </div>
                            </div>

                            <div className="w-32">
                              <label className="text-[11px] font-bold text-text-muted block mb-1">
                                Hasta (%)
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={nivel.maxPorcentaje}
                                  onChange={(e) => {
                                    let val = Number(e.target.value);
                                    if (!allowNegativeResults && val < 0) val = 0;
                                    handleUpdateNivel(nivel.id, { maxPorcentaje: val });
                                  }}
                                  className="h-9 text-[13px] font-semibold pr-7"
                                  min={allowNegativeResults ? -999 : 0}
                                  max={999}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                                  %
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-[180px]">
                              <label className="text-[11px] font-bold text-text-muted block mb-1">
                                Color
                              </label>
                                <Select
                                  value={nivel.colorHex}
                                  onValueChange={(val) => {
                                    const selectedColor = COLOR_VARIANTS.find(c => c.hex === val);
                                    if (selectedColor) {
                                      handleUpdateNivel(nivel.id, {
                                        colorHex: selectedColor.hex,
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full min-w-[140px] text-[13px] font-semibold">
                                    <SelectValue placeholder="Color" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COLOR_VARIANTS.map((c) => (
                                      <SelectItem key={c.hex} value={c.hex} className="text-[12px]">
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="h-3.5 w-3.5 rounded-full border border-border/50 shrink-0" 
                                            style={{ backgroundColor: c.hex }} 
                                          />
                                          <span>{c.label}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 mt-[18px]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteNivel(nivel.id)}
                              disabled={niveles.length <= 1}
                              className="h-8 w-8 text-text-muted hover:text-status-negative hover:bg-status-negative/10 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                              title={niveles.length <= 1 ? "Debe haber mínimo 1 nivel" : "Eliminar nivel"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>"""

# Replace from <div className="space-y-3 pb-4"> down to </div> before <div className="mt-2">
# Let's use regex
content = re.sub(r"                  <div className=\"space-y-3 pb-4\">\n.*?                  </div>\n\n                  <div className=\"mt-2\">", replacement + "\n\n                  <div className=\"mt-2\">", content, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
