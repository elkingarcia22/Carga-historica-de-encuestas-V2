import re

file_path = "src/components/ciclo-results/GruposTab.tsx"
with open(file_path, "r") as f: content = f.read()

bad_import = 'import { resolveEstado, resolveNivel, countEstados, getEstadoBadgeConfig } from "./resultsConfig";'
good_imports = """import { resolveEstado, resolveNivel } from "@/components/ciclo-detail";
import { countEstados } from "./resultsModel";
import { getEstadoBadgeConfig } from "@/components/objetivos/objetivosConfigStore";"""

content = content.replace(bad_import, good_imports)

with open(file_path, "w") as f: f.write(content)
print("done")
