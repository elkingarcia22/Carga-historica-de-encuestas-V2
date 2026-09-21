import re

file_path = "src/screens/CicloResults.tsx"
with open(file_path, "r") as f: content = f.read()

# Update GruposTab call to include breakdown and onBreakdownChange
grupos_tab_old = """          {tab === "colaboradores" && colaboradoresView === "grupos" && (
            <GruposTab
              results={viewResults}
              baseResults={results}
              filters={filters}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}"""

grupos_tab_new = """          {tab === "colaboradores" && colaboradoresView === "grupos" && (
            <GruposTab
              results={viewResults}
              baseResults={results}
              filters={filters}
              breakdown={breakdown}
              onBreakdownChange={setBreakdown}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}"""

content = content.replace(grupos_tab_old, grupos_tab_new)

with open(file_path, "w") as f: f.write(content)
print("done")
