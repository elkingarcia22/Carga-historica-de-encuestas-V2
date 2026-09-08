import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the ) : ( with )} {activeTab === "estados" && (
content = content.replace("              </>\n            ) : (\n              <>\n                <motion.header", "              </>\n            )}\n            {activeTab === \"estados\" && (\n              <>\n                <motion.header")

# Now append the niveles tab content before the end of the tabs area
# We look for:
#                 </motion.div>
#               </>
#             )}
#           </motion.div>
#           </div>

niveles_block = """              </>
            )}

            {activeTab === "niveles" && (
              <>
                <motion.header variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-sm">
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

                <motion.div variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface p-5 shadow-sm mb-4">
                  <p className="text-[13px] text-text-secondary mb-5">
                    <strong>Agrega o elimina niveles para los rangos</strong> de porcentajes finales, puedes <strong>seleccionar un color</strong> y agregar un <strong>nombre descriptivo</strong> para cada nivel.
                  </p>

                  <div className="space-y-3 pb-4">
                    {niveles.map((nivel) => (
                      <div
                        key={nivel.id}
                        className="rounded-2xl border border-border/60 bg-surface p-4 shadow-sm transition-all hover:border-primary/40 flex flex-col gap-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-[11px] font-bold text-text-muted block mb-1">
                              Selecciona un color
                            </label>
                            <Select
                              value={nivel.colorHex}
                              onValueChange={(val) => handleUpdateNivel(nivel.id, { colorHex: val })}
                            >
                              <SelectTrigger className="h-9 w-full text-[13px] font-semibold">
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
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-32">
                            <label className="text-[11px] font-bold text-text-muted block mb-1">
                              % final
                            </label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={nivel.maxPorcentaje}
                                onChange={(e) => handleUpdateNivel(nivel.id, { maxPorcentaje: Number(e.target.value) })}
                                className="h-9 text-[13px] font-semibold pr-7"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                                %
                              </span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <label className="text-[11px] font-bold text-text-muted block mb-1">
                              Nombre del nivel
                            </label>
                            <Input
                              value={nivel.nombre}
                              onChange={(e) => handleUpdateNivel(nivel.id, { nombre: e.target.value })}
                              className="h-9 text-[13px] font-semibold"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0 mt-[18px]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteNivel(nivel.id)}
                              disabled={niveles.length <= 1}
                              className="h-8 w-8 text-text-muted hover:text-status-negative hover:bg-status-negative/10 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2">
                    <Button
                      onClick={handleAddNivel}
                      variant="outline"
                      disabled={niveles.length >= 5}
                      className="gap-2 font-semibold text-[13px]"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar nivel
                    </Button>
                  </div>
                </motion.div>
              </>
            )}"""

content = content.replace("              </>\n            )}\n          </motion.div>", niveles_block + "\n          </motion.div>")

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
