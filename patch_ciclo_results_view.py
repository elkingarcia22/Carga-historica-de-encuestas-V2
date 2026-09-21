import re

file_path = "src/screens/CicloResults.tsx"
with open(file_path, "r") as f: content = f.read()

# Change the default state
content = re.sub(
    r'const \[colaboradoresView, setColaboradoresView\] = React\.useState<ColaboradoresView>\(\s*"detalle"\s*\);',
    r'const [colaboradoresView, setColaboradoresView] = React.useState<ColaboradoresView>("persona");',
    content
)

# Change the check for `colaboradoresView === "detalle"`
content = re.sub(
    r'colaboradoresView === "detalle"',
    r'colaboradoresView === "persona"',
    content
)

# Import GruposTab (assuming we will create it)
content = re.sub(
    r'import \{ ColaboradoresTab, ColaboradoresViewSwitch, type ColaboradoresView \} from "@/components/ciclo-results/ColaboradoresTab";',
    r'import { ColaboradoresTab, ColaboradoresViewSwitch, type ColaboradoresView } from "@/components/ciclo-results/ColaboradoresTab";\nimport { GruposTab } from "@/components/ciclo-results/GruposTab";',
    content
)

# Add the GruposTab render block
grupos_block = """

          {tab === "colaboradores" && colaboradoresView === "grupos" && (
            <GruposTab
              results={viewResults}
              baseResults={results}
              filters={filters}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}"""

content = re.sub(
    r'(<ColaboradoresTab[\s\S]*?/>\n\s*\)}ळ?)',
    r'\1' + grupos_block,
    content
)
content = content.replace("ळ?", "") # just a hack for regex replace if any

with open(file_path, "w") as f: f.write(content)
print("done")
