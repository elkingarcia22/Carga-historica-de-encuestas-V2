import re

file_path = "src/screens/CicloResults.tsx"
with open(file_path, "r") as f: content = f.read()

# Add the import
import_statement = 'import { GruposTab } from "@/components/ciclo-results/GruposTab";\n'
if "GruposTab" not in content[:content.find("export function")]:
    # find where to inject it. Just after ColaboradoresTab
    content = content.replace(
        'import { ColaboradoresTab } from "@/components/ciclo-results/ColaboradoresTab";',
        'import { ColaboradoresTab } from "@/components/ciclo-results/ColaboradoresTab";\nimport { GruposTab } from "@/components/ciclo-results/GruposTab";'
    )

with open(file_path, "w") as f: f.write(content)
print("done")
