import re

file_path = "src/components/ciclo-results/GruposTab.tsx"
with open(file_path, "r") as f: content = f.read()

# 1. Remove fixed: true from nombre
content = content.replace(
    '{ id: "nombre", label: BREAKDOWN_META[breakdown].label, fixed: true }',
    '{ id: "nombre", label: BREAKDOWN_META[breakdown].label }'
)

# 2. Extract search box to be before ResultsGlobalFilters
old_controls = """      <ResultsGlobalFilters
        results={baseResults}
        state={filters}
        showBreakdown={true}
        breakdown={breakdown}
        onBreakdownChange={onBreakdownChange}
        showSegmentation={false}
        excludeBreakdowns={["persona"]}
        segmentationAfterSearch
        searchSlot={
          <CollapsibleSearchBox
            value={filters.filters.search}
            onChange={filters.setSearch}
            placeholder={`Buscar por ${BREAKDOWN_META[breakdown].label.toLowerCase()}...`}
          />
        }
      />"""

new_controls = """      <CollapsibleSearchBox
        value={filters.filters.search}
        onChange={filters.setSearch}
        placeholder={`Buscar por ${BREAKDOWN_META[breakdown].label.toLowerCase()}...`}
      />
      <ResultsGlobalFilters
        results={baseResults}
        state={filters}
        showBreakdown={true}
        breakdown={breakdown}
        onBreakdownChange={onBreakdownChange}
        showSegmentation={false}
        excludeBreakdowns={["persona"]}
      />"""

content = content.replace(old_controls, new_controls)

with open(file_path, "w") as f: f.write(content)
print("done")
