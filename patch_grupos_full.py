import re

file_path = "src/components/ciclo-results/GruposTab.tsx"
with open(file_path, "r") as f: content = f.read()

# Add formatRelativeDate import
content = content.replace(
    'import {\n  NivelChip,\n  formatPercent,\n} from "@/components/ciclo-detail";',
    'import {\n  NivelChip,\n  formatPercent,\n  formatRelativeDate,\n} from "@/components/ciclo-detail";'
)

# Add ACTUALIZACION_BUCKETS and actualizacionBucketOf imports
content = content.replace(
    'import {\n  AVANCE_BUCKETS,\n  OBJETIVOS_BUCKETS,\n  clearColumnFilter,\n  countColumnFilters,\n  matchesColumnFilters,\n  toggleColumnFilter,\n  type ColumnFilterKey,\n  type ColumnFilters,\n} from "./colaboradoresColumns";',
    'import {\n  ACTUALIZACION_BUCKETS,\n  AVANCE_BUCKETS,\n  OBJETIVOS_BUCKETS,\n  clearColumnFilter,\n  countColumnFilters,\n  matchesColumnFilters,\n  toggleColumnFilter,\n  actualizacionBucketOf,\n  type ColumnFilterKey,\n  type ColumnFilters,\n} from "./colaboradoresColumns";'
)

# Update SortKey type
content = content.replace(
    '  | "riesgo";',
    '  | "riesgo"\n  | "actualizacion";'
)

# Update groupData buckets initialization
content = content.replace(
    '      const bucket = buckets.get(label) || {\n        label,\n        percentSum: 0,\n        people: new Set(),\n        entries: [],\n      };',
    '      const bucket = buckets.get(label) || {\n        label,\n        percentSum: 0,\n        people: new Set(),\n        entries: [],\n        lastUpdate: null,\n      };'
)

# Update groupData iteration for lastUpdate
content = content.replace(
    '      bucket.percentSum += row.percent;\n      bucket.people.add(row.person.id);\n      bucket.entries.push(...row.entries);\n      \n      buckets.set(label, bucket);',
    '      bucket.percentSum += row.percent;\n      bucket.people.add(row.person.id);\n      bucket.entries.push(...row.entries);\n      if (row.lastUpdate) {\n        if (!bucket.lastUpdate || new Date(row.lastUpdate.date) > new Date(bucket.lastUpdate.date)) {\n          bucket.lastUpdate = row.lastUpdate;\n        }\n      }\n      buckets.set(label, bucket);'
)

# Update return map of groupData
content = content.replace(
    '        estadoCounts,\n      };',
    '        estadoCounts,\n        lastUpdate: bucket.lastUpdate,\n      };'
)

# Add now for actualizacionBucketOf
content = content.replace(
    '  const clearColumn = (column: ColumnFilterKey) => {\n    setColumns((current) => clearColumnFilter(current, column));\n    setPage(1);\n  };',
    '  const clearColumn = (column: ColumnFilterKey) => {\n    setColumns((current) => clearColumnFilter(current, column));\n    setPage(1);\n  };\n\n  const now = React.useMemo(() => new Date(), []);'
)

# Update visible filter to include actualizacion
content = content.replace(
    '        if (!columns.avance.has(bucket)) return false;\n      }\n      return true;',
    '        if (!columns.avance.has(bucket)) return false;\n      }\n      if (columns.actualizacion.size > 0) {\n        if (!columns.actualizacion.has(actualizacionBucketOf(group as any, now))) return false;\n      }\n      return true;'
)

# Update sorted byName fallback for actualizacion
content = content.replace(
    '        case "avance": return factor * (a.percent - b.percent) || byName(a, b);',
    '        case "avance": return factor * (a.percent - b.percent) || byName(a, b);\n        case "actualizacion":\n          const aDate = a.lastUpdate ? new Date(a.lastUpdate.date).getTime() : 0;\n          const bDate = b.lastUpdate ? new Date(b.lastUpdate.date).getTime() : 0;\n          return factor * (aDate - bDate) || byName(a, b);'
)

# Update columnSpecs
content = content.replace(
    '    { id: "riesgo", label: "Riesgo promedio", available: showsRisk },',
    '    { id: "riesgo", label: "Riesgo promedio", available: showsRisk },\n    { id: "actualizacion", label: "Última actualización" },'
)

# Update useTableConfig key to bust cache
content = content.replace(
    'useTableConfig("ciclo-resultados-grupos", columnSpecs)',
    'useTableConfig("ciclo-resultados-grupos-v2", columnSpecs)'
)

# Add actualizacion cell
content = content.replace(
    '    riesgo: {\n      headClassName: "px-4",\n      head: <SortOnlyHeader label="Riesgo" sortActive={sort.key === "riesgo"} onSort={() => toggleSort("riesgo")} />,\n      cell: (row) => <RiskChip risk={row.risk} />,\n    },',
    '    riesgo: {\n      headClassName: "px-4",\n      head: <SortOnlyHeader label="Riesgo" sortActive={sort.key === "riesgo"} onSort={() => toggleSort("riesgo")} />,\n      cell: (row) => <RiskChip risk={row.risk} />,\n    },\n    actualizacion: {\n      headClassName: "px-4",\n      cellClassName: "text-[12.5px] text-text-secondary",\n      head: (\n        <FilterSortHeader\n          label="Última actualización"\n          options={ACTUALIZACION_BUCKETS}\n          selected={columns.actualizacion}\n          onToggleFilter={(value) => toggleColumn("actualizacion", value)}\n          onClearFilter={() => clearColumn("actualizacion")}\n          sortActive={sort.key === "actualizacion"}\n          onSort={() => toggleSort("actualizacion")}\n        />\n      ),\n      cell: (row) => row.lastUpdate ? formatRelativeDate(row.lastUpdate.date) : "Sin reportes",\n    },'
)

# Update ResultsGlobalFilters for hide segmentation and persona breakdown
content = content.replace(
    '        showBreakdown={true}\n        breakdown={breakdown}\n        onBreakdownChange={onBreakdownChange}\n        showSegmentation\n        segmentationAfterSearch',
    '        showBreakdown={true}\n        breakdown={breakdown}\n        onBreakdownChange={onBreakdownChange}\n        showSegmentation={false}\n        excludeBreakdowns={["persona"]}\n        segmentationAfterSearch'
)

with open(file_path, "w") as f: f.write(content)
print("done")
