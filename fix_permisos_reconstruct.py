import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """              <>
                <motion.header variants={cascadeItem} className="shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-sm">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">
                        Configuración de permisos
                      </h2>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Habilita y deshabilita permisos a los supervisores y a los colaboradores para que puedan gestionar sus objetivos.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-border/40 w-full my-5" />

                  {/* Permisos Líderes */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Permisos líderes
                      </h3>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura que acciones pueden hacer los líderes con sus objetivos propios o los objetivos de su equipo.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Líderes - Objetivos Propios */}
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
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Eliminar</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Subir sin aprobación</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Inactivar / Activar</span>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>

                      {/* Líderes - Objetivos del equipo */}
                      <div className="border border-border/50 rounded-xl bg-surface-muted/20 p-5">
                        <h4 className="text-[13px] font-bold text-text-primary mb-4 pb-3 border-b border-border/50">Objetivos del equipo</h4>
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
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Aprobar / Denegar</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Inactivar / Activar</span>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border/40 w-full my-6" />

                  {/* Permisos Colaboradores */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Permisos colaboradores
                      </h3>
                      <p className="text-[13px] text-text-secondary mt-1">
                        Configura que acciones pueden hacer tus colaboradores para poder gestionar sus objetivos
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
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Subir sin aprobación</span>
                            <Switch />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-text-secondary">Inactivar / Activar</span>
                            <Switch />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </motion.header>
              </>"""

# Using regex to replace everything between {activeTab === "permisos" && ( and {activeTab === "estados" && (
pattern = r"              <>\n                <motion\.header variants=\{cascadeItem\}.*?</motion\.header>\n              </>"
content = re.sub(pattern, replacement, content, count=1, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
