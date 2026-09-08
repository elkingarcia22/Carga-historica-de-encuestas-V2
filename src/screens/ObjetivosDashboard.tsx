import * as React from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Eye,
  EyeOff,
  ListChecks,
  Search,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterSortHeader, SortOnlyHeader, SelectionHeaderMenu } from "@/components/data-display";
import { ShellRailSlot } from "@/components/app-shell";
import { motion } from "framer-motion";
import { cascadeContainer, cascadeItem } from "@/lib/cascadeAnimation";
import { ObjetivosListActionRail } from "@/components/objetivos/ObjetivosListActionRail";
import {
  CICLO_ACTIONS_BY_ESTADO,
  CicloDateCell,
  formatCicloDate,
  parseCicloDate,
  startOfToday,
  type CicloActionId,
} from "@/components/ciclo-list";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/feedback";
import { ConfirmDialog } from "@/components/overlays";
import { StatusBadge, type StatusState } from "@/components/status-badge";
import { CicloResults } from "@/screens/CicloResults";
import type { CicloListRow } from "@/components/ciclo-detail";
import { CargaObjetivosDrawer } from "@/components/carga-objetivos";
import { Progress } from "@/components/ui/progress";
import { useAnimatedValue } from "@/lib/useAnimatedValue";
import {
  CICLO_ESTADOS,
  CICLO_PERIODOS,
  USUARIOS_SIN_OBJETIVOS,
  type CicloRow,
} from "@/mocks/ciclos";
import {
  CLOSE_BUCKETS,
  NO_FILTERS,
  PROGRESS_BUCKETS,
  hasAnyFilter,
  matchesFilters,
  toggleFilterValue,
  type CicloListFilters,
} from "@/components/ciclo-list/cicloListFilters";

function mapEstadoToStatusState(estado: string): StatusState {
  if (estado === "Finalizado" || estado === "Completado") return "success";
  if (estado === "En curso") return "pending";
  if (estado === "Por iniciar" || estado === "Borrador") return "neutral";
  return "neutral";
}

const PAGE_SIZES = [10, 25, 50] as const;

/**
 * A ciclo's avance: the bar fills to it, the figure states it.
 *
 * The bar is capped at 100 % while the figure is not — a ciclo can overshoot
 * ("125 %"), and a bar that grew past its track would just break the column,
 * so the overshoot is told in words instead.
 */
function CicloAvanceCell({ progreso, avance }: { progreso: number; avance: string }) {
  const animated = useAnimatedValue(progreso, 1000);
  return (
    <div className="flex items-center justify-end gap-3">
      <Progress value={Math.min(animated, 100)} className="h-1.5 w-28 shrink-0 [&>div]:transition-none" />
      <span className="min-w-[52px] text-right text-[12px] font-medium tabular-nums text-text-secondary">
        {avance}
      </span>
    </div>
  );
}

function formatCount(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-text-secondary transition-all hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

interface ObjetivosDashboardProps {
  activeTab: "ciclos" | "usuarios";
  /** The whole list, owned above so the home cards count the same rows. */
  ciclos: readonly CicloRow[];
  onCiclosChange: (ciclos: readonly CicloRow[]) => void;
  /**
   * The column narrowing in force. Lifted because the home alert buttons set
   * it too — a button's count and the rows it reveals must come from one
   * predicate.
   */
  filters: CicloListFilters;
  onFiltersChange: (filters: CicloListFilters) => void;
  /** El ciclo cuya vista de resultados está abierta — la única que tiene. */
  resultsCiclo?: CicloListRow | null;
  onViewResults?: (ciclo: CicloListRow) => void;
  /** Opens the ciclo creation wizard from the list's action rail. */
  onCreateCiclo?: () => void;
  /** Reopens the wizard on the single selected ciclo, at Participantes. */
  onAddUsersToCiclo?: (ciclo: CicloListRow) => void;
  /** Reopens the wizard on the single selected ciclo, at Datos generales. */
  onEditCiclo?: (ciclo: CicloListRow) => void;
}

export const ObjetivosDashboard: React.FC<ObjetivosDashboardProps> = ({
  activeTab,
  ciclos,
  onCiclosChange,
  filters,
  onFiltersChange,
  resultsCiclo,
  onViewResults,
  onCreateCiclo,
  onAddUsersToCiclo,
  onEditCiclo,
}) => {
  const nextCicloIdRef = React.useRef(ciclos.length + 1);

  // "Cargar objetivos" abre el asistente sin un ciclo fijo: el propio drawer
  // pide elegir uno (o crear uno nuevo) como su primer paso.
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  const [sortKey, setSortKey] = React.useState<string>("nombre");
  const [sortAscending, setSortAscending] = React.useState<boolean>(true);

  const [areaFilter, setAreaFilter] = React.useState<Set<string>>(new Set());
  const [isPermisosOpen, setIsPermisosOpen] = React.useState(false);
  
  const [selectedCiclos, setSelectedCiclos] = React.useState<Set<string>>(new Set());
  const [selectedUsuarios, setSelectedUsuarios] = React.useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = React.useState(false);
  // Ciclo ids awaiting the delete confirmation. A single ciclo makes the
  // reader type its name back before the button unlocks — a bulk delete just
  // asks once, the same split DatosDemograficosDashboard uses.
  const [pendingDeleteIds, setPendingDeleteIds] = React.useState<readonly string[] | null>(null);
  // The row whose fecha de cierre "Editar fechas" is changing, in place —
  // mirrors the encuestas list's own date edit.
  const [dateEditCicloId, setDateEditCicloId] = React.useState<string | null>(null);
  // Finishing asks first, in a modal — it is irreversible, unlike the
  // in-place date edit above. Held as an id rather than a boolean so the
  // dialog can name the ciclo it is about.
  const [pendingFinishId, setPendingFinishId] = React.useState<string | null>(null);

  const [ciclosPage, setCiclosPage] = React.useState(1);
  const [usuariosPage, setUsuariosPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  const handleToggleSort = (key: string) => {
    if (sortKey === key) {
      setSortAscending(!sortAscending);
    } else {
      setSortKey(key);
      setSortAscending(true);
    }
  };

  const handleToggleCiclo = (id: string) => {
    const next = new Set(selectedCiclos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCiclos(next);
  };

  const handleToggleUsuario = (id: string) => {
    const next = new Set(selectedUsuarios);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsuarios(next);
  };

  const currentSelectionCount = activeTab === "ciclos" ? selectedCiclos.size : selectedUsuarios.size;
  const handleClearSelection = () => {
    if (activeTab === "ciclos") setSelectedCiclos(new Set());
    else setSelectedUsuarios(new Set());
  };

  // The rail's own action set — which icons it shows and what they do —
  // comes entirely from this one ciclo's estado, so it only exists while
  // exactly one row is selected.
  const singleSelectedCiclo = React.useMemo(() => {
    if (selectedCiclos.size !== 1) return null;
    const [id] = selectedCiclos;
    return ciclos.find((c) => c.id === id) ?? null;
  }, [ciclos, selectedCiclos]);

  const handleCicloAction = (action: CicloActionId) => {
    if (!singleSelectedCiclo) return;
    switch (action) {
      case "results":
        onViewResults?.(singleSelectedCiclo);
        break;
      case "edit":
        onEditCiclo?.(singleSelectedCiclo);
        break;
      case "editParticipants":
        onAddUsersToCiclo?.(singleSelectedCiclo);
        break;
      case "duplicate":
        handleDuplicateCiclos([singleSelectedCiclo.id]);
        break;
      case "delete":
        requestDeleteCiclos([singleSelectedCiclo.id]);
        break;
      case "editDates":
        setDateEditCicloId(singleSelectedCiclo.id);
        break;
      case "finish":
        setPendingFinishId(singleSelectedCiclo.id);
        break;
      case "share":
        toast.success(`Enlace de “${singleSelectedCiclo.nombre}” copiado al portapapeles`);
        break;
      default:
        break;
    }
  };

  const pendingFinishCiclo = React.useMemo(
    () => ciclos.find((c) => c.id === pendingFinishId) ?? null,
    [ciclos, pendingFinishId]
  );

  const confirmFinishCiclo = () => {
    if (!pendingFinishCiclo) return;
    const { id, nombre } = pendingFinishCiclo;
    onCiclosChange(ciclos.map((c) => (c.id === id ? { ...c, estado: "Finalizado" } : c)));
    setPendingFinishId(null);
    toast.success(`“${nombre}” finalizado`, {
      description: "El ciclo deja de admitir avances. Sus resultados siguen disponibles.",
    });
  };

  // Resolved once per render so every row lands in the same date bucket the
  // home alerts counted it in.
  const today = React.useMemo(() => new Date(), []);

  const toggleColumn = (column: keyof CicloListFilters, value: string) => {
    onFiltersChange(toggleFilterValue(filters, column, value));
    setCiclosPage(1);
  };

  const clearColumn = (column: keyof CicloListFilters) => {
    onFiltersChange({ ...filters, [column]: [] });
    setCiclosPage(1);
  };

  // Filtered and Sorted Ciclos
  const filteredCiclos = React.useMemo(() => {
    return ciclos.filter((c) => {
      if (onlySelected && !selectedCiclos.has(c.id)) return false;
      if (!matchesFilters(c, filters, today)) return false;
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        return (
          c.nombre.toLowerCase().includes(query) ||
          c.periodo.toLowerCase().includes(query) ||
          c.estado.toLowerCase().includes(query)
        );
      }
      return true;
    }).sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? "";
      const bVal = (b as any)[sortKey] ?? "";
      const cmp = typeof aVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortAscending ? cmp : -cmp;
    });
  }, [ciclos, searchTerm, filters, today, onlySelected, selectedCiclos, sortKey, sortAscending]);

  const handleDuplicateCiclos = React.useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const sourceCiclos = ciclos.filter((c) => idSet.has(c.id));
    if (sourceCiclos.length === 0) return;

    const duplicates = sourceCiclos.map((c) => ({
      ...c,
      id: String(nextCicloIdRef.current++),
      nombre: `${c.nombre} (copia)`,
      estado: "Borrador",
      progreso: 0,
      avance: "0%",
    }));

    onCiclosChange([...duplicates, ...ciclos]);
    setSelectedCiclos(new Set());
    setCiclosPage(1);

    const lastLabel = sourceCiclos[sourceCiclos.length - 1].nombre;
    toast.success(duplicates.length === 1 ? "Ciclo duplicado" : `${duplicates.length} ciclos duplicados`, {
      description: duplicates.length === 1 ? `“${lastLabel}” se guardó como borrador.` : undefined,
    });
  }, [ciclos, onCiclosChange]);

  const requestDeleteCiclos = (ids: readonly string[]) => {
    if (ids.length > 0) setPendingDeleteIds(ids);
  };

  const pendingDeleteCiclos = React.useMemo(
    () => ciclos.filter((c) => pendingDeleteIds?.includes(c.id)),
    [ciclos, pendingDeleteIds]
  );

  const confirmDeleteCiclos = () => {
    if (!pendingDeleteIds) return;
    const idSet = new Set(pendingDeleteIds);
    const deletedLabel = pendingDeleteCiclos.length === 1 ? pendingDeleteCiclos[0].nombre : null;
    onCiclosChange(ciclos.filter((c) => !idSet.has(c.id)));
    setSelectedCiclos((current) => new Set([...current].filter((id) => !idSet.has(id))));
    setPendingDeleteIds(null);

    toast.success(
      pendingDeleteCiclos.length === 1 ? "Ciclo eliminado" : `${pendingDeleteCiclos.length} ciclos eliminados`,
      { description: deletedLabel ? `“${deletedLabel}” se eliminó del listado.` : undefined }
    );
  };

  // Filtered and Sorted Usuarios
  const filteredUsuarios = React.useMemo(() => {
    return USUARIOS_SIN_OBJETIVOS.filter((u) => {
      if (onlySelected && !selectedUsuarios.has(u.id)) return false;
      if (areaFilter.size > 0 && !areaFilter.has(u.area)) return false;
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        return (
          u.nombre.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          u.correo.toLowerCase().includes(query) ||
          u.area.toLowerCase().includes(query)
        );
      }
      return true;
    }).sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? "";
      const bVal = (b as any)[sortKey] ?? "";
      const cmp = typeof aVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortAscending ? cmp : -cmp;
    });
  }, [searchTerm, areaFilter, onlySelected, selectedUsuarios, sortKey, sortAscending]);

  // Pagination for Ciclos
  const ciclosPageCount = Math.max(1, Math.ceil(filteredCiclos.length / pageSize));
  const currentCiclosPage = Math.min(ciclosPage, ciclosPageCount);
  const ciclosFirstIndex = (currentCiclosPage - 1) * pageSize;
  const pagedCiclos = filteredCiclos.slice(ciclosFirstIndex, ciclosFirstIndex + pageSize);

  // Pagination for Usuarios
  const usuariosPageCount = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));
  const currentUsuariosPage = Math.min(usuariosPage, usuariosPageCount);
  const usuariosFirstIndex = (currentUsuariosPage - 1) * pageSize;
  const pagedUsuarios = filteredUsuarios.slice(usuariosFirstIndex, usuariosFirstIndex + pageSize);

  if (resultsCiclo) {
    return <CicloResults key={`results-${resultsCiclo.id}`} ciclo={resultsCiclo} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full font-sans">
      <ShellRailSlot>
        <ObjetivosListActionRail
          // A row already committed to an in-place date edit cannot also take
          // an action from the rail; the menu closes rather than let the two
          // compete.
          locked={dateEditCicloId !== null}
          // La carga masiva se lleva la pantalla entera: la barra se recoge
          // mientras su panel está abierto y vuelve al cerrarlo.
          isBlocked={isUploadOpen}
          selectedCount={currentSelectionCount}
          onClearSelection={handleClearSelection}
          isPermisosOpen={isPermisosOpen}
          setIsPermisosOpen={setIsPermisosOpen}
          activeTab={activeTab}
          selectedCicloEstado={singleSelectedCiclo?.estado}
          onCreateCiclo={onCreateCiclo}
          onCicloAction={handleCicloAction}
          onDuplicateCiclos={() => handleDuplicateCiclos(Array.from(selectedCiclos))}
          onDeleteCiclos={() => requestDeleteCiclos(Array.from(selectedCiclos))}
          onUploadObjectives={() => setIsUploadOpen(true)}
        />
      </ShellRailSlot>

      {/*
        "Cargar objetivos" es una acción persistente del home: no hay un ciclo
        abierto todavía, así que el asistente mismo pide elegir uno (o crear
        uno nuevo) antes de seguir con la operación y el archivo.
      */}
      <CargaObjetivosDrawer open={isUploadOpen} onOpenChange={setIsUploadOpen} ciclos={ciclos} />

      {/* Closing a ciclo stops reporting for good — the avances that would
          have arrived after it simply never do — so it is asked before it is
          done, in a modal rather than in the row. */}
      <ConfirmDialog
        open={pendingFinishId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFinishId(null);
        }}
        title="¿Finalizar este ciclo?"
        description={
          pendingFinishCiclo
            ? `${pendingFinishCiclo.nombre} dejará de admitir avances de inmediato. Podrás consultar sus resultados, pero quienes aún no hayan reportado ya no podrán hacerlo.`
            : undefined
        }
        confirmLabel="Finalizar ciclo"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={confirmFinishCiclo}
      />

      <ConfirmDialog
        open={pendingDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds(null);
        }}
        title={
          pendingDeleteCiclos.length === 1
            ? "¿Eliminar este ciclo?"
            : `¿Eliminar ${pendingDeleteCiclos.length} ciclos?`
        }
        description={
          pendingDeleteCiclos.length === 1
            ? `${pendingDeleteCiclos[0].nombre} y sus objetivos, participantes y avances se eliminarán definitivamente. Esta acción no se puede deshacer.`
            : "Los ciclos seleccionados y sus objetivos, participantes y avances se eliminarán definitivamente. Esta acción no se puede deshacer."
        }
        variant="destructive"
        confirmLabel="Eliminar"
        confirmationText={pendingDeleteCiclos.length === 1 ? pendingDeleteCiclos[0].nombre : undefined}
        onConfirm={confirmDeleteCiclos}
      />

      {/* TAB 1: CICLOS DE OBJETIVOS */}
      {activeTab === "ciclos" && (
        <motion.div variants={cascadeContainer} initial="hidden" animate="show" className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">
          <motion.div variants={cascadeItem} className="flex flex-wrap items-center gap-4 shrink-0 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-text-primary">Lista de ciclos</h3>
              <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
                {filteredCiclos.length}
              </Badge>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <div
                className={cn(
                  "relative flex h-9 overflow-hidden rounded-lg border bg-surface transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isSearchExpanded || searchTerm !== ""
                    ? "w-[300px] border-primary/50 ring-1 ring-primary/15"
                    : "w-9 cursor-pointer border-border hover:bg-border/50"
                )}
                onClick={() => {
                  if (!isSearchExpanded && searchTerm === "") {
                    setIsSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget) && searchTerm === "") {
                    setIsSearchExpanded(false);
                  }
                }}
              >
                <div
                  className={cn(
                    "absolute left-0 -ml-px -mt-px flex h-9 w-9 items-center justify-center transition-colors",
                    isSearchExpanded || searchTerm !== "" ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Search className="h-4 w-4 translate-x-[0.667px] translate-y-[0.667px]" strokeWidth={2} />
                </div>
                <input
                  ref={searchInputRef}
                  className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70"
                  placeholder="Buscar ciclo..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCiclosPage(1);
                  }}
                />
                {searchTerm !== "" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm("");
                      setCiclosPage(1);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "flex shrink-0 items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  selectedCiclos.size > 0 || onlySelected
                    ? "max-w-[220px] opacity-100"
                    : "pointer-events-none max-w-0 opacity-0"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOnlySelected((value) => !value);
                    setCiclosPage(1);
                  }}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition-colors",
                    onlySelected
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border text-text-secondary hover:border-primary/30 hover:text-primary"
                  )}
                >
                  {onlySelected ? (
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {onlySelected ? "Ver todos" : `Ver seleccionados (${formatCount(selectedCiclos.size)})`}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={cascadeItem} className="flex-1 min-h-0 flex flex-col overflow-hidden border-y border-border/60">
            {filteredCiclos.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ListChecks}
                  title={onlySelected ? "Aún no has seleccionado nada" : "Sin ciclos que coincidan"}
                  description={
                    onlySelected
                      ? "Vuelve a la lista completa para seleccionar ciclos."
                      : "Prueba con otro término de búsqueda o limpia los filtros."
                  }
                  className="border-none bg-transparent shadow-none"
                  action={
                    !onlySelected && (searchTerm !== "" || hasAnyFilter(filters)) ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchTerm("");
                          onFiltersChange(NO_FILTERS);
                          setCiclosPage(1);
                          setIsSearchExpanded(false);
                        }}
                      >
                        Limpiar búsqueda y filtros
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="relative w-full flex-1 min-h-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-7 pr-5 w-[50px]">
                        <SelectionHeaderMenu
                          state={selectedCiclos.size === filteredCiclos.length && filteredCiclos.length > 0 ? true : selectedCiclos.size > 0 ? "indeterminate" : false}
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
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Nombre"
                          sortActive={sortKey === "nombre"}
                          onSort={() => handleToggleSort("nombre")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <FilterSortHeader
                          label="Periodo"
                          options={CICLO_PERIODOS}
                          selected={new Set(filters.periodo)}
                          onToggleFilter={(value) => toggleColumn("periodo", value)}
                          onClearFilter={() => clearColumn("periodo")}
                          sortActive={sortKey === "periodo"}
                          onSort={() => handleToggleSort("periodo")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Fecha inicio"
                          sortActive={sortKey === "fechaInicio"}
                          onSort={() => handleToggleSort("fechaInicio")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <FilterSortHeader
                          label="Fecha cierre"
                          options={CLOSE_BUCKETS}
                          selected={new Set(filters.close)}
                          onToggleFilter={(value) => toggleColumn("close", value)}
                          onClearFilter={() => clearColumn("close")}
                          sortActive={sortKey === "fechaCierre"}
                          onSort={() => handleToggleSort("fechaCierre")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <FilterSortHeader
                          label="Estado"
                          options={CICLO_ESTADOS}
                          selected={new Set(filters.estado)}
                          onToggleFilter={(value) => toggleColumn("estado", value)}
                          onClearFilter={() => clearColumn("estado")}
                          sortActive={sortKey === "estado"}
                          onSort={() => handleToggleSort("estado")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        # objetivos
                      </TableHead>
                      <TableHead className="w-[200px] px-4 py-3.5">
                        <FilterSortHeader
                          label="Avance"
                          options={PROGRESS_BUCKETS}
                          selected={new Set(filters.progress)}
                          onToggleFilter={(value) => toggleColumn("progress", value)}
                          onClearFilter={() => clearColumn("progress")}
                          sortActive={sortKey === "progreso"}
                          onSort={() => handleToggleSort("progreso")}
                          align="right"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCiclos.map((ciclo) => {
                      const isEditingDate = dateEditCicloId === ciclo.id;
                      // A ciclo cannot close before it starts, nor in the past.
                      const closeDateFloor = (() => {
                        const today = startOfToday();
                        const start = parseCicloDate(ciclo.fechaInicio);
                        return start && start > today ? start : today;
                      })();

                      return (
                        <TableRow
                          key={ciclo.id}
                          className="hover:bg-muted/30 transition-colors border-border/60 cursor-pointer"
                          data-state={selectedCiclos.has(ciclo.id) ? "selected" : undefined}
                          onClick={isEditingDate ? undefined : () => handleToggleCiclo(ciclo.id)}
                        >
                          <TableCell className="pl-7 pr-5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedCiclos.has(ciclo.id)}
                              onCheckedChange={() => handleToggleCiclo(ciclo.id)}
                              // Deselecting mid-edit would take the rail — and with
                              // it the edit's only owner — out from under an
                              // unsaved date.
                              disabled={isEditingDate}
                            />
                          </TableCell>
                          <TableCell className="py-3 px-4 font-bold text-[13px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewResults?.(ciclo);
                              }}
                              // Un ciclo sin resultados que leer —borrador o por
                              // iniciar— no lleva a ninguna parte: su nombre se
                              // queda como texto en vez de fingir un enlace. Antes
                              // esos abrían el seguimiento, que ya no existe.
                              disabled={
                                isEditingDate ||
                                !CICLO_ACTIONS_BY_ESTADO[ciclo.estado]?.includes("results")
                              }
                              className="text-left text-text-primary hover:text-primary hover:underline transition-colors disabled:cursor-default disabled:no-underline disabled:hover:text-text-primary"
                            >
                              {ciclo.nombre}
                            </button>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{ciclo.periodo}</TableCell>
                          <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{ciclo.fechaInicio}</TableCell>
                          <TableCell className="px-4 py-3 text-text-secondary text-[13px]">
                            {isEditingDate ? (
                              <CicloDateCell
                                value={ciclo.fechaCierre}
                                minDate={closeDateFloor}
                                onCancel={() => setDateEditCicloId(null)}
                                onSave={(date) => {
                                  const nuevaFecha = formatCicloDate(date);
                                  onCiclosChange(
                                    ciclos.map((c) => (c.id === ciclo.id ? { ...c, fechaCierre: nuevaFecha } : c))
                                  );
                                  setDateEditCicloId(null);
                                  toast.success(`“${ciclo.nombre}” ahora cierra el ${nuevaFecha}`);
                                }}
                              />
                            ) : (
                              ciclo.fechaCierre
                            )}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <StatusBadge
                              state={mapEstadoToStatusState(ciclo.estado)}
                              labels={{ [mapEstadoToStatusState(ciclo.estado)]: ciclo.estado }}
                            />
                          </TableCell>
                          <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{ciclo.numObjetivos}</TableCell>
                          <TableCell className="py-3 px-4">
                            <CicloAvanceCell progreso={ciclo.progreso} avance={ciclo.avance} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
          
          <motion.div variants={cascadeItem} className="flex flex-wrap items-center justify-between gap-3 shrink-0 p-4">
            <p className="text-[12px] text-muted-foreground">
              {filteredCiclos.length === 0
                ? "0 ciclos"
                : `${formatCount(ciclosFirstIndex + 1)}–${formatCount(ciclosFirstIndex + pagedCiclos.length)} de ${formatCount(filteredCiclos.length)}`}
            </p>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCiclosPage(1);
                  setUsuariosPage(1);
                }}
              >
                <SelectTrigger
                  aria-label="Ciclos por página"
                  className="h-8 w-[130px] rounded-lg px-2.5 text-[12px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6}>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-[13px]">
                      {size} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PagerButton
                label="Página anterior"
                disabled={currentCiclosPage <= 1}
                onClick={() => setCiclosPage(currentCiclosPage - 1)}
              >
                Anterior
              </PagerButton>
              <span className="text-[12px] tabular-nums text-text-secondary">
                {formatCount(currentCiclosPage)} / {formatCount(ciclosPageCount)}
              </span>
              <PagerButton
                label="Página siguiente"
                disabled={currentCiclosPage >= ciclosPageCount}
                onClick={() => setCiclosPage(currentCiclosPage + 1)}
              >
                Siguiente
              </PagerButton>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* TAB 2: USUARIOS SIN OBJETIVOS */}
      {activeTab === "usuarios" && (
        <motion.div variants={cascadeContainer} initial="hidden" animate="show" className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">
          <motion.div variants={cascadeItem} className="flex flex-wrap items-center gap-4 shrink-0 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-text-primary">Lista de usuarios sin objetivos</h3>
              <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
                {filteredUsuarios.length}
              </Badge>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <div
                className={cn(
                  "relative flex h-9 overflow-hidden rounded-lg border bg-surface transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isSearchExpanded || searchTerm !== ""
                    ? "w-[300px] border-primary/50 ring-1 ring-primary/15"
                    : "w-9 cursor-pointer border-border hover:bg-border/50"
                )}
                onClick={() => {
                  if (!isSearchExpanded && searchTerm === "") {
                    setIsSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget) && searchTerm === "") {
                    setIsSearchExpanded(false);
                  }
                }}
              >
                <div
                  className={cn(
                    "absolute left-0 -ml-px -mt-px flex h-9 w-9 items-center justify-center transition-colors",
                    isSearchExpanded || searchTerm !== "" ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Search className="h-4 w-4 translate-x-[0.667px] translate-y-[0.667px]" strokeWidth={2} />
                </div>
                <input
                  ref={searchInputRef}
                  className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70"
                  placeholder="Buscar usuario..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setUsuariosPage(1);
                  }}
                />
                {searchTerm !== "" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm("");
                      setUsuariosPage(1);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>

              <div
                className={cn(
                  "flex shrink-0 items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  selectedUsuarios.size > 0 || onlySelected
                    ? "max-w-[220px] opacity-100"
                    : "pointer-events-none max-w-0 opacity-0"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOnlySelected((value) => !value);
                    setUsuariosPage(1);
                  }}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition-colors",
                    onlySelected
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border text-text-secondary hover:border-primary/30 hover:text-primary"
                  )}
                >
                  {onlySelected ? (
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {onlySelected ? "Ver todos" : `Ver seleccionados (${formatCount(selectedUsuarios.size)})`}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={cascadeItem} className="flex-1 min-h-0 flex flex-col overflow-hidden border-y border-border/60">
            {filteredUsuarios.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ListChecks}
                  title={onlySelected ? "Aún no has seleccionado nada" : "Sin usuarios que coincidan"}
                  description={
                    onlySelected
                      ? "Vuelve a la lista completa para seleccionar usuarios."
                      : "Prueba con otro término de búsqueda o limpia los filtros."
                  }
                  className="border-none bg-transparent shadow-none"
                  action={
                    !onlySelected && (searchTerm !== "" || areaFilter.size > 0) ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchTerm("");
                          setAreaFilter(new Set());
                          setUsuariosPage(1);
                          setIsSearchExpanded(false);
                        }}
                      >
                        Limpiar búsqueda y filtros
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="relative w-full flex-1 min-h-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-7 pr-5 w-[50px]">
                        <SelectionHeaderMenu
                          state={selectedUsuarios.size === filteredUsuarios.length && filteredUsuarios.length > 0 ? true : selectedUsuarios.size > 0 ? "indeterminate" : false}
                          pageCount={pagedUsuarios.length}
                          matchCount={filteredUsuarios.length}
                          showSelectPage={pagedUsuarios.length > 0 && selectedUsuarios.size < filteredUsuarios.length}
                          showSelectAll={filteredUsuarios.length > 0 && selectedUsuarios.size < filteredUsuarios.length}
                          showDeselectPage={selectedUsuarios.size > 0}
                          showDeselectAll={selectedUsuarios.size > 0}
                          onSelectPage={() => setSelectedUsuarios(new Set([...selectedUsuarios, ...pagedUsuarios.map(u => u.id)]))}
                          onSelectAll={() => setSelectedUsuarios(new Set(filteredUsuarios.map(u => u.id)))}
                          onDeselectPage={() => setSelectedUsuarios(new Set([...selectedUsuarios].filter(id => !pagedUsuarios.find(u => u.id === id))))}
                          onDeselectAll={() => setSelectedUsuarios(new Set())}
                          formatCount={formatCount}
                          align="start"
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Username"
                          sortActive={sortKey === "username"}
                          onSort={() => handleToggleSort("username")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Nombre"
                          sortActive={sortKey === "nombre"}
                          onSort={() => handleToggleSort("nombre")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Correo"
                          sortActive={sortKey === "correo"}
                          onSort={() => handleToggleSort("correo")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <FilterSortHeader
                          label="Área"
                          options={["Ventas", "Servicio", "Almacen", "Pruebas"]}
                          selected={areaFilter}
                          onToggleFilter={(val) => {
                            const next = new Set(areaFilter);
                            if (next.has(val)) next.delete(val);
                            else next.add(val);
                            setAreaFilter(next);
                            setUsuariosPage(1);
                          }}
                          onClearFilter={() => {
                            setAreaFilter(new Set());
                            setUsuariosPage(1);
                          }}
                          sortActive={sortKey === "area"}
                          onSort={() => handleToggleSort("area")}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3.5">
                        <SortOnlyHeader
                          label="Líder"
                          sortActive={sortKey === "lider"}
                          onSort={() => handleToggleSort("lider")}
                        />
                      </TableHead>
                      <TableHead className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedUsuarios.map((user) => (
                      <TableRow 
                        key={user.id} 
                        className="hover:bg-muted/30 transition-colors border-border/60 cursor-pointer" 
                        data-state={selectedUsuarios.has(user.id) ? "selected" : undefined}
                        onClick={() => handleToggleUsuario(user.id)}
                      >
                        <TableCell className="pl-7 pr-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedUsuarios.has(user.id)}
                            onCheckedChange={() => handleToggleUsuario(user.id)}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{user.username}</TableCell>
                        <TableCell className="py-3 px-4 font-bold text-text-primary text-[13px]">{user.nombre}</TableCell>
                        <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{user.correo}</TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge variant="neutral" className="text-[11px] h-6 px-2.5">{user.area}</Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-text-secondary text-[13px]">{user.lider}</TableCell>
                        <TableCell className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 text-[12px] font-semibold text-text-secondary hover:text-text-primary px-3 rounded-lg gap-2">
                                Acciones <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border-border/50">
                              <DropdownMenuItem className="text-[13px] gap-2 p-2 rounded-lg cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-muted">
                                Ver detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[13px] gap-2 p-2 rounded-lg cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-muted">
                                Asignar líder
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>

          <motion.div variants={cascadeItem} className="flex flex-wrap items-center justify-between gap-3 shrink-0 p-4">
            <p className="text-[12px] text-muted-foreground">
              {filteredUsuarios.length === 0
                ? "0 usuarios"
                : `${formatCount(usuariosFirstIndex + 1)}–${formatCount(usuariosFirstIndex + pagedUsuarios.length)} de ${formatCount(filteredUsuarios.length)}`}
            </p>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCiclosPage(1);
                  setUsuariosPage(1);
                }}
              >
                <SelectTrigger
                  aria-label="Usuarios por página"
                  className="h-8 w-[130px] rounded-lg px-2.5 text-[12px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6}>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-[13px]">
                      {size} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PagerButton
                label="Página anterior"
                disabled={currentUsuariosPage <= 1}
                onClick={() => setUsuariosPage(currentUsuariosPage - 1)}
              >
                Anterior
              </PagerButton>
              <span className="text-[12px] tabular-nums text-text-secondary">
                {formatCount(currentUsuariosPage)} / {formatCount(usuariosPageCount)}
              </span>
              <PagerButton
                label="Página siguiente"
                disabled={currentUsuariosPage >= usuariosPageCount}
                onClick={() => setUsuariosPage(currentUsuariosPage + 1)}
              >
                Siguiente
              </PagerButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
