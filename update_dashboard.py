import os
import re

target = "/Users/ub-col-pro-lf4/Documents/configuración objetivos/src/screens/ObjetivosDashboard.tsx"

with open(target, "r") as f:
    code = f.read()

# 1. Imports
if "LayoutList" not in code:
    code = code.replace("  X\n} from \"lucide-react\";", "  X,\n  LayoutList,\n  Table as TableIcon\n} from \"lucide-react\";")

if "Progress" not in code:
    code = code.replace('import { Badge } from "@/components/ui/badge";', 'import { Badge } from "@/components/ui/badge";\nimport { Progress } from "@/components/ui/progress";')

if "StatusBadge" not in code:
    code = code.replace('import { EmptyState } from "@/components/feedback";', 'import { EmptyState } from "@/components/feedback";\nimport { StatusBadge } from "@/components/status-badge";')

if "CICLO_ACTIONS_BY_ESTADO" not in code:
    code = code.replace('  formatCicloDate,\n  type CicloActionId,\n} from "@/components/ciclo-list";', '  formatCicloDate,\n  type CicloActionId,\n} from "@/components/ciclo-list";\nimport { CICLO_ACTIONS_BY_ESTADO } from "@/components/ciclo-list/cicloListActions";')

if "mapEstadoToStatusState" not in code:
    code = code.replace('  matchesFilters,\n  toggleFilterValue,\n  type CicloListFilters,\n} from "@/components/ciclo-list/cicloListFilters";', '  matchesFilters,\n  toggleFilterValue,\n  mapEstadoToStatusState,\n  type CicloListFilters,\n} from "@/components/ciclo-list/cicloListFilters";')


# 2. State
if "viewMode" not in code:
    code = code.replace('const [searchTerm, setSearchTerm] = React.useState("");', 'const [searchTerm, setSearchTerm] = React.useState("");\n  const [viewMode, setViewMode] = React.useState<"table" | "list">("table");')

# 3. Toolbar toggle
toggle_ui = """              <div className="flex bg-muted p-0.5 rounded-lg border border-border/50 items-center">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn("p-1.5 rounded-md transition-all", viewMode === "table" ? "bg-surface shadow-sm text-primary" : "text-muted-foreground hover:text-text-primary")}
                  title="Vista tabla"
                >
                  <TableIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-surface shadow-sm text-primary" : "text-muted-foreground hover:text-text-primary")}
                  title="Vista lista"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>

              <TableConfigButton config={ciclosConfig} noun="ciclos" />"""

code = code.replace('<TableConfigButton config={ciclosConfig} noun="ciclos" />', toggle_ui)

# 4. View mode rendering
list_view = """            ) : viewMode === "table" ? (
              <div className="relative w-full flex-1 min-h-0">
                {/* Una `<table>` a secas y no el `Table` del sistema: ese la
                    envuelve en un `div` con `overflow-x` propio, y el
                    `sticky` del encabezado se anclaría a ese `div` —que crece
                    con el contenido y nunca desborda— en vez de a la región
                    con scroll de arriba. `bg-muted-solid` es el mismo color
                    de `bg-muted/40` resuelto contra la superficie: al 40 % las
                    filas se verían pasar a través del encabezado que las
                    tapa. */}
                <table className="w-full caption-bottom border-collapse text-sm">
                  <TableHeader className="[&_tr]:border-b-0">
                    <TableRow className="sticky top-[var(--home-sticky-top,60px)] z-10 border-b-0 bg-muted-solid shadow-[0_1px_0_0_hsl(var(--border)/0.6)] hover:bg-muted-solid">
                      <TableHead className="pl-7 pr-5 w-[50px]">
                        <SelectionHeaderMenu
                          state={selectedCiclos.size === filteredCiclos.length && filteredCiclos.length > 0 ? true : selectedCiclos.size > 0 ? "indeterminate" : false}
                          paged={!ciclosConfig.isLazy}
                          pageCount={pagedCiclos.length}
                          matchCount={filteredCiclos.length}
                          showSelectPage={pagedCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                          showSelectAll={filteredCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                          showDeselectPage={selectedCiclos.size > 0}
                          showDeselectAll={selectedCiclos.size > 0}
                          onSelectPage={() => setSelectedCiclos(new Set([...selectedCiclos, ...pagedCiclos.map(c => c.id)]))}
                          onSelectAll={() => setSelectedCiclos(new Set(filteredCiclos.map(c => c.id)))}
                          onDeselectPage={() => setSelectedCiclos(new Set([...selectedCiclos].filter(id => !pagedCiclos.find(c => c.id === id))))}
                          onDeselectAll={() => setSelectedCiclos(new Set())}
                          formatCount={formatCount}
                          align="start"
                        />
                      </TableHead>
                      <ConfigurableHeaderCells
                        config={ciclosConfig}
                        drag={ciclosDrag}
                        cells={ciclosCells}
                        className="px-4 py-3.5"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownCiclos.map((ciclo) => (
                      <TableRow
                        key={ciclo.id}
                        className="cursor-pointer border-border/60 transition-colors hover:bg-muted/30"
                        data-state={selectedCiclos.has(ciclo.id) ? "selected" : undefined}
                        onClick={
                          dateEditCicloId === ciclo.id ? undefined : () => handleToggleCiclo(ciclo.id)
                        }
                      >
                        <TableCell className="pl-7 pr-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedCiclos.has(ciclo.id)}
                            onCheckedChange={() => handleToggleCiclo(ciclo.id)}
                            // Deselecting mid-edit would take the rail — and with
                            // it the edit's only owner — out from under an
                            // unsaved date.
                            disabled={dateEditCicloId === ciclo.id}
                          />
                        </TableCell>
                        <ConfigurableRowCells config={ciclosConfig} cells={ciclosCells} row={ciclo} />
                      </TableRow>
                    ))}
                    <LazyRowsSentinel
                      lazy={ciclosLazy}
                      colSpan={ciclosConfig.columns.length + 1}
                      noun="ciclos"
                    />
                  </TableBody>
                </table>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 bg-surface">
                <div className="flex items-center gap-3 px-2 mb-1">
                  <SelectionHeaderMenu
                    state={selectedCiclos.size === filteredCiclos.length && filteredCiclos.length > 0 ? true : selectedCiclos.size > 0 ? "indeterminate" : false}
                    paged={!ciclosConfig.isLazy}
                    pageCount={pagedCiclos.length}
                    matchCount={filteredCiclos.length}
                    showSelectPage={pagedCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                    showSelectAll={filteredCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                    showDeselectPage={selectedCiclos.size > 0}
                    showDeselectAll={selectedCiclos.size > 0}
                    onSelectPage={() => setSelectedCiclos(new Set([...selectedCiclos, ...pagedCiclos.map(c => c.id)]))}
                    onSelectAll={() => setSelectedCiclos(new Set(filteredCiclos.map(c => c.id)))}
                    onDeselectPage={() => setSelectedCiclos(new Set([...selectedCiclos].filter(id => !pagedCiclos.find(c => c.id === id))))}
                    onDeselectAll={() => setSelectedCiclos(new Set())}
                    formatCount={formatCount}
                    align="start"
                  />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seleccionar todos</span>
                </div>
                {shownCiclos.map((ciclo) => {
                  const selected = selectedCiclos.has(ciclo.id);
                  return (
                    <div key={ciclo.id} className={cn("flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl border transition-colors cursor-pointer", selected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border/60 bg-surface hover:bg-muted/30")} onClick={() => handleToggleCiclo(ciclo.id)}>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected} onCheckedChange={() => handleToggleCiclo(ciclo.id)} disabled={dateEditCicloId === ciclo.id} />
                      </div>
                      <div className="flex flex-col gap-1 min-w-[220px] flex-1">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (ciclo.estado === "Borrador") onEditCiclo?.(ciclo);
                            else onViewResults?.(ciclo);
                          }}
                          disabled={
                            dateEditCicloId === ciclo.id ||
                            (!CICLO_ACTIONS_BY_ESTADO[ciclo.estado]?.includes("results") &&
                              ciclo.estado !== "Borrador")
                          }
                          className="text-left font-bold text-text-primary text-[14px] transition-colors hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-text-primary w-fit"
                        >
                          {ciclo.nombre}
                        </button>
                        <span className="text-muted-foreground text-[12px]">{ciclo.periodo} • {ciclo.fechaInicio} a {ciclo.fechaCierre}</span>
                      </div>
                      
                      <div className="w-[120px] flex shrink-0 items-center">
                        <StatusBadge state={mapEstadoToStatusState(ciclo.estado)} labels={{ [mapEstadoToStatusState(ciclo.estado)]: ciclo.estado }} />
                      </div>
                      
                      <div className="w-[180px] shrink-0 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground font-bold tracking-wider">
                          <span className="uppercase">Avance</span>
                          <span>{ciclo.avance}</span>
                        </div>
                        <Progress value={Math.min(ciclo.progreso, 100)} className="h-1.5 w-full [&>div]:transition-none" />
                      </div>
                      
                      <div className="w-[120px] shrink-0 flex flex-col gap-0.5">
                        <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Participación</span>
                        <span className="text-[13px] font-semibold text-text-secondary">{ciclo.participacion}</span>
                      </div>
                    </div>
                  );
                })}
                <LazyRowsSentinel lazy={ciclosLazy} colSpan={1} noun="ciclos" />
              </div>"""

old_table = """            ) : (
              <div className="relative w-full flex-1 min-h-0">
                {/* Una `<table>` a secas y no el `Table` del sistema: ese la
                    envuelve en un `div` con `overflow-x` propio, y el
                    `sticky` del encabezado se anclaría a ese `div` —que crece
                    con el contenido y nunca desborda— en vez de a la región
                    con scroll de arriba. `bg-muted-solid` es el mismo color
                    de `bg-muted/40` resuelto contra la superficie: al 40 % las
                    filas se verían pasar a través del encabezado que las
                    tapa. */}
                <table className="w-full caption-bottom border-collapse text-sm">
                  <TableHeader className="[&_tr]:border-b-0">
                    <TableRow className="sticky top-[var(--home-sticky-top,60px)] z-10 border-b-0 bg-muted-solid shadow-[0_1px_0_0_hsl(var(--border)/0.6)] hover:bg-muted-solid">
                      <TableHead className="pl-7 pr-5 w-[50px]">
                        <SelectionHeaderMenu
                          state={selectedCiclos.size === filteredCiclos.length && filteredCiclos.length > 0 ? true : selectedCiclos.size > 0 ? "indeterminate" : false}
                          paged={!ciclosConfig.isLazy}
                          pageCount={pagedCiclos.length}
                          matchCount={filteredCiclos.length}
                          showSelectPage={pagedCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                          showSelectAll={filteredCiclos.length > 0 && selectedCiclos.size < filteredCiclos.length}
                          showDeselectPage={selectedCiclos.size > 0}
                          showDeselectAll={selectedCiclos.size > 0}
                          onSelectPage={() => setSelectedCiclos(new Set([...selectedCiclos, ...pagedCiclos.map(c => c.id)]))}
                          onSelectAll={() => setSelectedCiclos(new Set(filteredCiclos.map(c => c.id)))}
                          onDeselectPage={() => setSelectedCiclos(new Set([...selectedCiclos].filter(id => !pagedCiclos.find(c => c.id === id))))}
                          onDeselectAll={() => setSelectedCiclos(new Set())}
                          formatCount={formatCount}
                          align="start"
                        />
                      </TableHead>
                      <ConfigurableHeaderCells
                        config={ciclosConfig}
                        drag={ciclosDrag}
                        cells={ciclosCells}
                        className="px-4 py-3.5"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownCiclos.map((ciclo) => (
                      <TableRow
                        key={ciclo.id}
                        className="cursor-pointer border-border/60 transition-colors hover:bg-muted/30"
                        data-state={selectedCiclos.has(ciclo.id) ? "selected" : undefined}
                        onClick={
                          dateEditCicloId === ciclo.id ? undefined : () => handleToggleCiclo(ciclo.id)
                        }
                      >
                        <TableCell className="pl-7 pr-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedCiclos.has(ciclo.id)}
                            onCheckedChange={() => handleToggleCiclo(ciclo.id)}
                            // Deselecting mid-edit would take the rail — and with
                            // it the edit's only owner — out from under an
                            // unsaved date.
                            disabled={dateEditCicloId === ciclo.id}
                          />
                        </TableCell>
                        <ConfigurableRowCells config={ciclosConfig} cells={ciclosCells} row={ciclo} />
                      </TableRow>
                    ))}
                    <LazyRowsSentinel
                      lazy={ciclosLazy}
                      colSpan={ciclosConfig.columns.length + 1}
                      noun="ciclos"
                    />
                  </TableBody>
                </table>
              </div>"""

if "viewMode === \"table\" ?" not in code:
    code = code.replace(old_table, list_view)

with open(target, "w") as f:
    f.write(code)

