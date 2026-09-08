import re

permisos_estados = """            {activeTab === "permisos" && (
              <>
                <motion.header variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-sm">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">
                        Permisos y configuración
                      </h2>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura los permisos para objetivos y resultados.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-border/40 w-full my-5" />

                  {/* Permisos Colaboradores */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Permisos colaboradores
                      </h3>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura qué acciones pueden realizar los colaboradores para gestionar sus objetivos individuales.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="border border-border/50 rounded-xl bg-surface-muted/20 p-5">
                        <h4 className="text-[13px] font-bold text-text-primary mb-4 pb-3 border-b border-border/50">Objetivos propios</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Ver</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Crear</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Actualizar</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Editar</span>
                            <Switch />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Eliminar</span>
                            <Switch />
                          </div>
                        </div>
                      </div>

                      <div className="border border-border/50 rounded-xl bg-surface-muted/20 p-5">
                        <h4 className="text-[13px] font-bold text-text-primary mb-4 pb-3 border-b border-border/50">Objetivos del equipo (Líderes)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Ver</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Crear</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Actualizar</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Editar</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Eliminar</span>
                            <Switch />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.header>
              </>
            )}

            {activeTab === "estados" && (
              <>
                <motion.header variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-sm">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">
                        Estados y rangos
                      </h2>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura los estados posibles y sus rangos de cumplimiento.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-5">
                    <div>
                      <h3 className="text-[13px] font-bold text-text-primary flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-primary" />
                        Permitir resultados negativos
                      </h3>
                      <p className="text-[12px] text-text-secondary mt-1">
                        Habilita esta opción si deseas permitir que los líderes ingresen y evalúen porcentajes menores a 0%.
                      </p>
                    </div>
                    <Switch 
                      checked={allowNegativeResults} 
                      onCheckedChange={setAllowNegativeResults}
                    />
                  </div>
                </motion.header>

                <div className="sticky -top-4 z-20 pt-4 pb-2 -mx-4 px-4 bg-background">
                  <motion.div variants={cascadeItem} className="shrink-0 rounded-xl border border-border/60 bg-surface px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-text-secondary mb-2">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-primary" />
                        Distribución de estados
                      </span>
                      <span className="text-[11px] font-medium bg-surface-muted px-2 py-0.5 rounded-md text-text-muted">
                        {estados.length} estados configurados
                      </span>
                    </div>

                    <TooltipProvider>
                      <div className="h-4 w-full rounded-full bg-surface-muted/60 border border-border/50 flex overflow-hidden p-0.5 gap-0.5 shadow-inner">
                      {[...estados].sort((a, b) => a.minPorcentaje - b.minPorcentaje).map((est) => {
                        const config = getEstadoBadgeConfig(est);
                        return (
                          <Tooltip key={est.id} delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div
                                style={{
                                  flex: Math.max(1, (est.maxPorcentaje - est.minPorcentaje) || 5),
                                }}
                                className={cn(
                                  "h-full rounded-full transition-all duration-200 relative cursor-pointer hover:opacity-80 hover:brightness-110",
                                  config.barBg
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={8}
                              className="flex flex-col gap-1 px-3.5 py-2 bg-slate-900 text-white dark:bg-slate-950 dark:text-slate-50 border border-slate-800 shadow-2xl rounded-xl z-50 !opacity-100 data-closed:animate-none data-closed:duration-0"
                            >
                              <div className="flex items-center gap-2 font-bold text-xs">
                                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-xs", config.barBg)} />
                                <span>{est.nombre}</span>
                              </div>
                              <div className="text-[11px] font-medium text-slate-300 pl-4.5 tabular-nums">
                                Rango: <span className="font-semibold text-white">{est.minPorcentaje}% a {est.maxPorcentaje}%</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      </div>
                    </TooltipProvider>
                  </motion.div>
                </div>

                <motion.div variants={cascadeItem} className="space-y-3 pb-4">
                  {estados.map((est, idx) => (
                    <div
                      key={est.id}
                      className="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm transition-all hover:border-primary/40 flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-text-secondary mt-[18px]">
                            {idx + 1}
                          </span>
                          <div className="flex-1 max-w-xs">
                            <label className="text-[11px] font-bold text-text-muted block mb-1">
                              Nombre del estado
                            </label>
                            <Input
                              value={est.nombre}
                              onChange={(e) => handleUpdateEstado(est.id, { nombre: e.target.value })}
                              className="h-9 font-bold text-[13px] border-border/70"
                              placeholder="Nombre del estado..."
                            />
                          </div>

                          <div className="w-32">
                            <label className="text-[11px] font-bold text-text-muted block mb-1">
                              Desde (%)
                            </label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={est.minPorcentaje}
                                onChange={(e) => {
                                  let val = Number(e.target.value);
                                  if (!allowNegativeResults && val < 0) val = 0;
                                  handleUpdateEstado(est.id, { minPorcentaje: val });
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
                                value={est.maxPorcentaje}
                                onChange={(e) => {
                                  let val = Number(e.target.value);
                                  if (!allowNegativeResults && val < 0) val = 0;
                                  handleUpdateEstado(est.id, { maxPorcentaje: val });
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
                                value={est.colorHex}
                                onValueChange={(val) => {
                                  const selectedColor = COLOR_VARIANTS.find(c => c.hex === val);
                                  if (selectedColor) {
                                    handleUpdateEstado(est.id, {
                                      variant: selectedColor.variant,
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
                                      <div className="flex items-center w-full min-w-[100px]">
                                        <div 
                                          className="h-5 w-full rounded-md border border-border/50 shrink-0" 
                                          style={{ backgroundColor: c.hex }} 
                                        />
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
                            onClick={() => handleDeleteEstado(est.id)}
                            disabled={estados.length <= 3}
                            className="h-8 w-8 text-text-muted hover:text-status-negative hover:bg-status-negative/10 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                            title={estados.length <= 3 ? "Debe haber mínimo 3 estados" : "Eliminar estado"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
                
                <div className="mt-2">
                  <Button
                    onClick={handleAddEstado}
                    variant="outline"
                    className="gap-2 font-semibold text-[13px]"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar estado
                  </Button>
                </div>
              </>
            )}"""

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Insert before {activeTab === "niveles" && (
content = content.replace("            {activeTab === \"niveles\" && (", permisos_estados + "\n\n            {activeTab === \"niveles\" && (")

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
