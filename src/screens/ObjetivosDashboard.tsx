import * as React from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ListChecks,
  Search,
  X,
  LayoutList,
  Table as TableIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
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
import { SelectionHeaderMenu } from "@/components/data-display";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  LazyRowsSentinel,
  LazyRowsSummary,
  TableConfigButton,
  useColumnDrag,
  useLazyRows,
  useTableConfig,
} from "@/components/data-display/table-config";
import { ShellRailSlot } from "@/components/app-shell";
import { motion } from "framer-motion";
import { cascadeContainer, cascadeItem } from "@/lib/cascadeAnimation";
import { ObjetivosListActionRail } from "@/components/objetivos/ObjetivosListActionRail";
import { ObjetivosConfigDrawerWide } from "@/components/objetivos/ObjetivosConfigDrawerWide";
import {
  CICLOS_COLUMNS,
  ciclosTableCells,
  formatCicloDate,
  type CicloActionId,
} from "@/components/ciclo-list";
import { CICLO_ACTIONS_BY_ESTADO } from "@/components/ciclo-list/cicloListActions";
import { USUARIOS_COLUMNS, usuariosTableCells } from "@/components/objetivos";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/feedback";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/overlays";
import { CicloResults } from "@/screens/CicloResults";
import { CargaObjetivosDrawer } from "@/components/carga-objetivos";
import { USUARIOS_SIN_OBJETIVOS, type CicloRow } from "@/mocks/ciclos";
import {
  NO_FILTERS,
  hasAnyFilter,
  matchesFilters,
  toggleFilterValue,
  mapEstadoToStatusState,
  type CicloListFilters,
} from "@/components/ciclo-list/cicloListFilters";

const PAGE_SIZES = [10, 25, 50] as const;

const cascadeItemNoTransform = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};


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
  resultsCiclo?: CicloRow | null;
  onViewResults?: (ciclo: CicloRow) => void;
  /** Opens the ciclo creation wizard from the list's action rail. */
  onCreateCiclo?: () => void;
  /** Reopens the wizard on the single selected ciclo, at Participantes. */
  onAddUsersToCiclo?: (ciclo: CicloRow) => void;
  /** Reopens the wizard on the single selected ciclo, at Datos generales. */
  onEditCiclo?: (ciclo: CicloRow) => void;
  /** Reopens the wizard on the ciclo shown in results, at Objetivos — the
   *  drawer's global "Editar" button, without a selection. */
  onEditCicloObjectives?: (ciclo: CicloRow, tab?: "groups" | "individual") => void;
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
  onEditCicloObjectives,
}) => {
  const nextCicloIdRef = React.useRef(ciclos.length + 1);

  // "Cargar objetivos" abre el asistente sin un ciclo fijo: el propio drawer
  // pide elegir uno (o crear uno nuevo) como su primer paso.
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"table" | "list">("table");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  
  const [sortKey, setSortKey] = React.useState<string>("nombre");
  const [sortAscending, setSortAscending] = React.useState<boolean>(true);

  const [areaFilter, setAreaFilter] = React.useState<Set<string>>(new Set());
  
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
      case "configure":
        setIsConfigDrawerOpen(true);
        break;
      case "edit":
        onEditCiclo?.(singleSelectedCiclo);
        break;
      case "editParticipants":
        onAddUsersToCiclo?.(singleSelectedCiclo);
        break;
      case "addObjectivesGroup":
        onEditCicloObjectives?.(singleSelectedCiclo, "groups");
        break;
      case "addObjectivesIndividual":
        onEditCicloObjectives?.(singleSelectedCiclo, "individual");
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

  /*
   * Cada pestaña recuerda su propia configuración —columnas, orden y cómo
   * llegan las filas—, porque son dos listas distintas: quien esconde el
   * líder en los usuarios no está diciendo nada sobre los ciclos.
   */
  const ciclosConfig = useTableConfig("objetivos-home-ciclos", CICLOS_COLUMNS);
  const ciclosDrag = useColumnDrag({ axis: "x", onReorder: ciclosConfig.moveColumn });
  const ciclosLazy = useLazyRows({
    total: filteredCiclos.length,
    enabled: ciclosConfig.isLazy,
    step: pageSize,
    resetKey: filteredCiclos,
  });
  const shownCiclos = ciclosConfig.isLazy
    ? filteredCiclos.slice(0, ciclosLazy.count)
    : pagedCiclos;

  const usuariosConfig = useTableConfig("objetivos-home-usuarios", USUARIOS_COLUMNS);
  const usuariosDrag = useColumnDrag({ axis: "x", onReorder: usuariosConfig.moveColumn });
  const usuariosLazy = useLazyRows({
    total: filteredUsuarios.length,
    enabled: usuariosConfig.isLazy,
    step: pageSize,
    resetKey: filteredUsuarios,
  });
  const shownUsuarios = usuariosConfig.isLazy
    ? filteredUsuarios.slice(0, usuariosLazy.count)
    : pagedUsuarios;

  const ciclosCells = ciclosTableCells({
    sortKey,
    onSort: handleToggleSort,
    filters,
    onToggleFilter: toggleColumn,
    onClearFilter: clearColumn,
    dateEditCicloId,
    onCancelCloseDate: () => setDateEditCicloId(null),
    onSaveCloseDate: (ciclo, date) => {
      const nuevaFecha = formatCicloDate(date);
      onCiclosChange(
        ciclos.map((c) => (c.id === ciclo.id ? { ...c, fechaCierre: nuevaFecha } : c))
      );
      setDateEditCicloId(null);
      toast.success(`“${ciclo.nombre}” ahora cierra el ${nuevaFecha}`);
    },
    onOpenCiclo: (ciclo) => {
      if (ciclo.estado === "Borrador") onEditCiclo?.(ciclo);
      else onViewResults?.(ciclo);
    },
  });

  const usuariosCells = usuariosTableCells({
    sortKey,
    onSort: handleToggleSort,
    areaFilter,
    onToggleArea: (value) => {
      const next = new Set(areaFilter);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setAreaFilter(next);
      setUsuariosPage(1);
    },
    onClearArea: () => {
      setAreaFilter(new Set());
      setUsuariosPage(1);
    },
  });

  if (resultsCiclo) {
    return (
      <CicloResults
        key={`results-${resultsCiclo.id}`}
        ciclo={resultsCiclo}
        onEditObjectives={
          onEditCicloObjectives ? (target) => onEditCicloObjectives(resultsCiclo, target) : undefined
        }
        onEditParticipants={
          onAddUsersToCiclo ? () => onAddUsersToCiclo(resultsCiclo) : undefined
        }
      />
    );
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
      <ObjetivosConfigDrawerWide
        open={isConfigDrawerOpen}
        onOpenChange={setIsConfigDrawerOpen}
        initialTab="estados"
      />

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
        <motion.div variants={cascadeContainer} initial="hidden" animate="show" className="flex w-fit min-w-full flex-col flex-1 min-h-0 rounded-2xl border border-border/60 bg-surface shadow-card">
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

              {/* Junto al buscador y a los embudos de las columnas: filtrar
                  cambia qué filas se miran, configurar cambia cómo se mira la
                  tabla, y se contestan en el mismo momento. */}
                            <div className="flex bg-muted p-0.5 rounded-lg border border-border/50 items-center">
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

              <TableConfigButton config={ciclosConfig} noun="ciclos" />

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

          <motion.div variants={cascadeItemNoTransform} className="flex-1 min-h-0 flex flex-col border-y border-border/60">
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
            ) : viewMode === "table" ? (
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
                {shownCiclos.map((ciclo) => {
                  const selected = selectedCiclos.has(ciclo.id);
                  return (
                    <div key={ciclo.id} className={cn("flex flex-col sm:flex-row sm:items-center gap-4 py-3 px-4 rounded-xl border transition-colors cursor-pointer", selected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border/60 bg-surface hover:border-primary/30")} onClick={() => handleToggleCiclo(ciclo.id)}>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected} onCheckedChange={() => handleToggleCiclo(ciclo.id)} disabled={dateEditCicloId === ciclo.id} />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-[220px] flex-1">
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
                          className="text-left font-bold text-text-primary text-[13px] transition-colors hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-text-primary w-fit"
                        >
                          {ciclo.nombre}
                        </button>
                        <span className="text-muted-foreground text-[12px] font-medium">{ciclo.periodo} • {ciclo.fechaInicio} a {ciclo.fechaCierre}</span>
                      </div>
                      
                      <div className="w-[120px] flex shrink-0 items-center">
                        <StatusBadge state={mapEstadoToStatusState(ciclo.estado)} labels={{ [mapEstadoToStatusState(ciclo.estado)]: ciclo.estado }} />
                      </div>
                      
                      <div className="w-[180px] shrink-0 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold tracking-wider">
                          <span className="uppercase">Avance</span>
                          <span>{ciclo.avance}</span>
                        </div>
                        <Progress value={Math.min(ciclo.progreso, 100)} className="h-1.5 w-full [&>div]:transition-none" />
                      </div>
                    </div>
                  );
                })}
                <LazyRowsSentinel lazy={ciclosLazy} colSpan={1} noun="ciclos" />
              </div>
            )}
          </motion.div>
          
          <motion.div variants={cascadeItem} className="flex flex-wrap items-center justify-between gap-3 shrink-0 p-4">
            {/* De corrido el paginador no dice nada útil: lo que hace falta
                saber es por dónde va la carga. El otro modo está a un clic en
                "Configurar". */}
            {ciclosConfig.isLazy ? (
              <LazyRowsSummary lazy={ciclosLazy} total={filteredCiclos.length} noun="ciclos" />
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* TAB 2: USUARIOS SIN OBJETIVOS */}
      {activeTab === "usuarios" && (
        <motion.div variants={cascadeContainer} initial="hidden" animate="show" className="flex w-fit min-w-full flex-col flex-1 min-h-0 rounded-2xl border border-border/60 bg-surface shadow-card">
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

              <TableConfigButton config={usuariosConfig} noun="usuarios" />

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

          <motion.div variants={cascadeItemNoTransform} className="flex-1 min-h-0 flex flex-col border-y border-border/60">
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
                          state={selectedUsuarios.size === filteredUsuarios.length && filteredUsuarios.length > 0 ? true : selectedUsuarios.size > 0 ? "indeterminate" : false}
                          paged={!usuariosConfig.isLazy}
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
                      <ConfigurableHeaderCells
                        config={usuariosConfig}
                        drag={usuariosDrag}
                        cells={usuariosCells}
                        className="px-4 py-3.5"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownUsuarios.map((user) => (
                      <TableRow
                        key={user.id}
                        className="cursor-pointer border-border/60 transition-colors hover:bg-muted/30"
                        data-state={selectedUsuarios.has(user.id) ? "selected" : undefined}
                        onClick={() => handleToggleUsuario(user.id)}
                      >
                        <TableCell className="pl-7 pr-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedUsuarios.has(user.id)}
                            onCheckedChange={() => handleToggleUsuario(user.id)}
                          />
                        </TableCell>
                        <ConfigurableRowCells
                          config={usuariosConfig}
                          cells={usuariosCells}
                          row={user}
                        />
                      </TableRow>
                    ))}
                    <LazyRowsSentinel
                      lazy={usuariosLazy}
                      colSpan={usuariosConfig.columns.length + 1}
                      noun="usuarios"
                    />
                  </TableBody>
                </table>
              </div>
            )}
          </motion.div>

          <motion.div variants={cascadeItem} className="flex flex-wrap items-center justify-between gap-3 shrink-0 p-4">
            {usuariosConfig.isLazy ? (
              <LazyRowsSummary
                lazy={usuariosLazy}
                total={filteredUsuarios.length}
                noun="usuarios"
              />
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
