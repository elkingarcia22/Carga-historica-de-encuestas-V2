import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  HeaderSelectAllCheckbox,
  LazyRowsSentinel,
  LazyRowsSummary,
  TableBleedBox,
  TableConfigButton,
  useColumnDrag,
  useLazyRows,
  useTableConfig,
} from "@/components/data-display";
import type { ObjectiveSetKind } from "./cicloBuilderTypes";
import type { AssignmentRow } from "./assignmentRows";
import type { SortDir } from "@/components/survey-builder/CollaboratorTableParts";
import { assignmentColumns, assignmentTableCells, type AssignmentSortKey } from "./assignmentTableColumns";


function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface AssignmentRowsTableProps {
  kind: ObjectiveSetKind;
  rows: readonly AssignmentRow[];
  showValidation: boolean;
  selectedRowIds: ReadonlySet<string>;
  onToggleRow: (rowId: string) => void;
  /** Marca o desmarca la lista entera desde la casilla del encabezado. */
  onSetSelection: (rowIds: readonly string[], selected: boolean) => void;
}

/**
 * La lista de corrido: todos los grupos, o todas las personas, en una tabla.
 *
 * La otra vista agrupa por quién comparte objetivos, que es la forma correcta
 * de *editar*; esta es la forma correcta de *buscar*. Son la misma selección
 * —marcar aquí es marcar allá— y las acciones siguen estando en la barra
 * flotante, así que cambiar de vista nunca pierde lo que ya estaba marcado.
 */
export function AssignmentRowsTable({
  kind,
  rows,
  showValidation,
  selectedRowIds,
  onToggleRow,
  onSetSelection,
}: AssignmentRowsTableProps) {
  const isGroup = kind === "grupal";
  const noun = isGroup ? "grupos" : "personas";
  const columns = React.useMemo(() => assignmentColumns(kind), [kind]);
  
  const [query, setQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = React.useState<AssignmentSortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [agrupacionFilter, setAgrupacionFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const [estadoFilter, setEstadoFilter] = React.useState<ReadonlySet<string>>(() => new Set());

  const terms = React.useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);

  const agrupaciones = React.useMemo(
    () => [...new Set(rows.map((row) => row.summary.name))].sort((a, b) => a.localeCompare(b, "es")),
    [rows]
  );
  
  const issueToEstado = (issue: string | null) => issue === null ? "Listo" : issue;
  
  const estados = React.useMemo(
    () => [...new Set(rows.map((row) => issueToEstado(row.summary.issue)))].sort((a, b) => a.localeCompare(b, "es")),
    [rows]
  );

  const filtered = React.useMemo(() => {
    return rows.filter((row) => {
      if (terms.length > 0) {
        const haystack = fold(`${row.label} ${row.hint} ${row.summary.name}`);
        if (!terms.every((term) => haystack.includes(term))) return false;
      }
      if (agrupacionFilter.size > 0 && !agrupacionFilter.has(row.summary.name)) return false;
      if (estadoFilter.size > 0 && !estadoFilter.has(issueToEstado(row.summary.issue))) return false;
      return true;
    });
  }, [rows, terms, agrupacionFilter, estadoFilter]);

  const sorted = React.useMemo(() => {
    if (sortKey === null) return filtered;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "destinatario") return direction * a.label.localeCompare(b.label, "es");
      if (sortKey === "objetivos") return direction * (a.summary.set.objectives.length - b.summary.set.objectives.length);
      if (sortKey === "peso") return direction * (a.summary.weight - b.summary.weight);
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const onToggleSort = (key: AssignmentSortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const config = useTableConfig(`constructor-asignaciones-${kind}`, columns);
  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });
  const lazy = useLazyRows({ total: sorted.length, enabled: config.isLazy, step: 25, resetKey: sorted });
  const shown = config.isLazy ? sorted.slice(0, lazy.count) : sorted;
  
  const cells = React.useMemo(
    () => assignmentTableCells(kind, showValidation, {
      sortKey, sortDir, onToggleSort,
      agrupaciones, agrupacionFilter,
      onToggleAgrupacion: (val) => {
        setAgrupacionFilter(prev => {
          const next = new Set(prev);
          if (next.has(val)) next.delete(val);
          else next.add(val);
          return next;
        });
      },
      onClearAgrupacion: () => setAgrupacionFilter(new Set()),
      estados, estadoFilter,
      onToggleEstado: (val) => {
        setEstadoFilter(prev => {
          const next = new Set(prev);
          if (next.has(val)) next.delete(val);
          else next.add(val);
          return next;
        });
      },
      onClearEstado: () => setEstadoFilter(new Set())
    }),
    [kind, showValidation, sortKey, sortDir, agrupaciones, agrupacionFilter, estados, estadoFilter]
  );


  const allIds = React.useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selectedHere = allIds.filter((id) => selectedRowIds.has(id)).length;
  const headerState: boolean | "indeterminate" =
    selectedHere === 0 ? false : selectedHere === allIds.length ? true : "indeterminate";

  return (
    <div className="flex flex-col gap-3">
      
      <div className="flex items-center justify-end gap-3">
        <div
          className={cn(
            "relative flex h-9 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-lg border bg-surface",
            (isSearchExpanded || query !== "")
              ? "w-[300px] border-primary/50 ring-1 ring-primary/15"
              : "w-9 border-border hover:bg-border/50 cursor-pointer"
          )}
          onClick={() => {
            if (!isSearchExpanded && query === "") {
              setIsSearchExpanded(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget) && query === "") {
              setIsSearchExpanded(false);
            }
          }}
        >
          <div
            className={cn(
              "absolute left-0 -ml-px -mt-px flex h-9 w-9 items-center justify-center transition-colors",
              (isSearchExpanded || query !== "") ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Search className="h-4 w-4 translate-x-[0.667px] translate-y-[0.667px]" strokeWidth={2} />
          </div>
          
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${noun}...`}
            aria-label={`Buscar ${noun}`}
            className={cn(
              "h-full w-[300px] bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70",
              (isSearchExpanded || query !== "") ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <TableConfigButton config={config} noun={noun} />
      </div>


      <TableBleedBox bleed="-mx-6">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[52px] pl-6 pr-0">
                <HeaderSelectAllCheckbox
                  state={headerState}
                  disabled={allIds.length === 0}
                  onSelectAll={() => onSetSelection(allIds, true)}
                  onDeselectAll={() => onSetSelection(allIds, false)}
                  align="start"
                  label={`Seleccionar ${isGroup ? "todos los grupos" : "todas las personas"}`}
                />
              </TableHead>
              <ConfigurableHeaderCells
                config={config}
                drag={drag}
                cells={cells}
                className="px-4 py-3 text-[11.5px] font-bold uppercase tracking-wide text-text-secondary"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => {
              const selected = selectedRowIds.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? "selected" : undefined}
                  onClick={() => onToggleRow(row.id)}
                  className={cn(
                    "cursor-pointer border-border/60 transition-colors",
                    selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                  )}
                >
                  <TableCell className="py-3 pl-6 pr-0" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleRow(row.id)}
                      aria-label={`Seleccionar ${row.label}`}
                    />
                  </TableCell>
                  <ConfigurableRowCells
                    config={config}
                    cells={cells}
                    row={row}
                    className="px-4 py-3 align-middle"
                  />
                </TableRow>
              );
            })}
            <LazyRowsSentinel lazy={lazy} colSpan={config.columns.length + 1} noun={noun} />
          </TableBody>
        </Table>
      </TableBleedBox>

      {config.isLazy && (
        <LazyRowsSummary lazy={lazy} total={rows.length} noun={noun} className="self-end" />
      )}
    </div>
  );
}
