import re

file_path = "src/screens/CicloResults.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update the tabs row and filter chips row.
# We replace it so that filters are unconditionally rendered under the tabs.

search_block = r"""      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2">
        <UbitsTabs
          tabs={\[\.\.\.TABS\]}
          activeTabId=\{tab\}
          onTabChange=\{\(id\) => changeTab\(id as ResultsTab\)\}
          variant="page"
          fitContent
          className="mb-0 w-auto"
        />
        \{filtersOnTabsRow && globalFilters\}
      </div>

      \{/\* Las fichas de lo que está puesto.*?\*/\}
      \{filtersOnTabsRow && <ResultsFilterChips results=\{results\} state=\{filters\} />\}"""

replace_block = """      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2">
        <UbitsTabs
          tabs={[...TABS]}
          activeTabId={tab}
          onTabChange={(id) => changeTab(id as ResultsTab)}
          variant="page"
          fitContent
          className="mb-0 w-auto"
        />
      </div>

      {/* Filtros siempre fijos debajo de los tabs, como solicitó el usuario */}
      <div className="flex shrink-0 flex-col gap-2 pb-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {tab === "colaboradores" && colaboradoresView === "alineacion" ? alignmentFilters : globalFilters}
        </div>
        {filters.filters.length > 0 && <ResultsFilterChips results={results} state={filters} />}
      </div>"""

content = re.sub(search_block, replace_block, content, flags=re.DOTALL)

# 2. Remove filtersOnTabsRow declaration
content = re.sub(r'const filtersOnTabsRow = tab === "ia";\n\s*', '', content)

# 3. Remove globalControls={...} and globalChips={...} from all tabs
content = re.sub(r'\s*globalControls=\{globalFilters\}', '', content)
content = re.sub(r'\s*globalControls=\{alignmentFilters\}', '', content)
content = re.sub(r'\s*globalChips=\{globalChips\}', '', content)

# 4. Remove "filtros" from boardOrder initial state
content = re.sub(r'\s*"filtros",', '', content)

with open(file_path, "w") as f:
    f.write(content)

print("done")
