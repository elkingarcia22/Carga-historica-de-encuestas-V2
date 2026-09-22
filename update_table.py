import os
import re

target_dir = "/Users/ub-col-pro-lf4/Documents/configuración objetivos/src/components/ciclo-builder"

# Update assignmentTableColumns.tsx
cols_file = os.path.join(target_dir, "assignmentTableColumns.tsx")
with open(cols_file, 'r') as f:
    cols_code = f.read()

deps_import = """import { FilterMenu, SortableHeader, type SortDir, type SortKey } from "@/components/survey-builder/CollaboratorTableParts";"""

if "FilterMenu" not in cols_code:
    cols_code = cols_code.replace('import { ListChecks, UserRound, UsersRound } from "lucide-react";', 
                                  'import { ListChecks, UserRound, UsersRound } from "lucide-react";\n' + deps_import)

deps_interface = """
export type AssignmentSortKey = "destinatario" | "objetivos" | "peso";

export interface AssignmentCellsDeps {
  sortKey: AssignmentSortKey | null;
  sortDir: SortDir;
  onToggleSort: (key: AssignmentSortKey) => void;
  agrupaciones: readonly string[];
  agrupacionFilter: ReadonlySet<string>;
  onToggleAgrupacion: (value: string) => void;
  onClearAgrupacion: () => void;
  estados: readonly string[];
  estadoFilter: ReadonlySet<string>;
  onToggleEstado: (value: string) => void;
  onClearEstado: () => void;
}
"""

if "export type AssignmentSortKey" not in cols_code:
    cols_code = cols_code.replace("export function assignmentTableCells(", deps_interface + "\nexport function assignmentTableCells(")

cols_code = cols_code.replace("export function assignmentTableCells(\n  kind: ObjectiveSetKind,\n  showValidation: boolean\n)", 
                              "export function assignmentTableCells(\n  kind: ObjectiveSetKind,\n  showValidation: boolean,\n  deps: AssignmentCellsDeps\n)")

cols_code = cols_code.replace("""    destinatario: {
      headClassName: "min-w-[220px]",
      head: isGroup ? "Grupo" : "Persona",""",
"""    destinatario: {
      headClassName: "min-w-[220px]",
      head: (
        <SortableHeader
          label={isGroup ? "Grupo" : "Persona"}
          active={deps.sortKey === "destinatario"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("destinatario")}
        />
      ),""")

cols_code = cols_code.replace("""    agrupacion: {
      headClassName: "min-w-[170px]",
      head: "Agrupación",""",
"""    agrupacion: {
      headClassName: "min-w-[170px]",
      head: (
        <FilterMenu
          label="Agrupación"
          options={deps.agrupaciones}
          selected={deps.agrupacionFilter}
          onToggle={deps.onToggleAgrupacion}
          onClear={deps.onClearAgrupacion}
        />
      ),""")

cols_code = cols_code.replace("""    objetivos: {
      headClassName: "w-[120px]",
      head: "Objetivos",""",
"""    objetivos: {
      headClassName: "w-[120px]",
      head: (
        <SortableHeader
          label="Objetivos"
          active={deps.sortKey === "objetivos"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("objetivos")}
        />
      ),""")

cols_code = cols_code.replace("""    peso: {
      headClassName: "w-[180px]",
      head: "Peso repartido",""",
"""    peso: {
      headClassName: "w-[180px]",
      head: (
        <SortableHeader
          label="Peso repartido"
          active={deps.sortKey === "peso"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("peso")}
        />
      ),""")

cols_code = cols_code.replace("""    estado: {
      headClassName: "min-w-[150px]",
      head: "Estado",""",
"""    estado: {
      headClassName: "min-w-[150px]",
      head: (
        <FilterMenu
          label="Estado"
          options={deps.estados}
          selected={deps.estadoFilter}
          onToggle={deps.onToggleEstado}
          onClear={deps.onClearEstado}
        />
      ),""")

with open(cols_file, 'w') as f:
    f.write(cols_code)

# Update AssignmentRowsTable.tsx
table_file = os.path.join(target_dir, "AssignmentRowsTable.tsx")
with open(table_file, 'r') as f:
    table_code = f.read()

import_search = 'import { Search } from "lucide-react";'
if "Search" not in table_code:
    table_code = table_code.replace('import { cn } from "@/lib/utils";', 'import { Search } from "lucide-react";\nimport { cn } from "@/lib/utils";')
    table_code = table_code.replace('import { Checkbox } from "@/components/ui/checkbox";', 'import { Checkbox } from "@/components/ui/checkbox";\nimport { Input } from "@/components/ui/input";')

table_code = table_code.replace('import type { AssignmentRow } from "./assignmentRows";', 'import type { AssignmentRow } from "./assignmentRows";\nimport type { SortDir } from "@/components/survey-builder/CollaboratorTableParts";')
table_code = table_code.replace('import { assignmentColumns, assignmentTableCells } from "./assignmentTableColumns";', 'import { assignmentColumns, assignmentTableCells, type AssignmentSortKey } from "./assignmentTableColumns";')

fold_helper = """
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
"""

if "function fold(" not in table_code:
    table_code = table_code.replace('export interface AssignmentRowsTableProps', fold_helper + '\nexport interface AssignmentRowsTableProps')


state_setup = """
  const [query, setQuery] = React.useState("");
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
"""

table_code = table_code.replace("const config = useTableConfig(`constructor-asignaciones-${kind}`, columns);", state_setup + "\n  const config = useTableConfig(`constructor-asignaciones-${kind}`, columns);")

table_code = table_code.replace("const lazy = useLazyRows({ total: rows.length, enabled: config.isLazy, step: 25, resetKey: rows });", "const lazy = useLazyRows({ total: sorted.length, enabled: config.isLazy, step: 25, resetKey: sorted });")
table_code = table_code.replace("const shown = config.isLazy ? rows.slice(0, lazy.count) : rows;", "const shown = config.isLazy ? sorted.slice(0, lazy.count) : sorted;")
table_code = table_code.replace("const shown = config.isLazy ? rows.slice(0, lazy.count) : sorted;", "const shown = config.isLazy ? sorted.slice(0, lazy.count) : sorted;")

cells_setup = """
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
"""

table_code = re.sub(r'const cells = React\.useMemo\(\s*\(\) => assignmentTableCells\(kind, showValidation\),\s*\[kind, showValidation\]\s*\);', cells_setup, table_code)

table_code = table_code.replace('const allIds = React.useMemo(() => rows.map((row) => row.id), [rows]);', 'const allIds = React.useMemo(() => sorted.map((row) => row.id), [sorted]);')

search_ui = """
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${noun}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 text-[13px] transition-colors focus-visible:border-primary/50"
          />
        </div>
        <TableConfigButton config={config} noun={noun} />
      </div>
"""

table_code = re.sub(r'<div className="flex items-center justify-end">\s*<TableConfigButton config={config} noun={noun} />\s*</div>', search_ui, table_code)

with open(table_file, 'w') as f:
    f.write(table_code)

