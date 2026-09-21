import re

file_path = "src/components/ciclo-results/GruposTab.tsx"
with open(file_path, "r") as f: content = f.read()

content = content.replace(
    'import { riskFor } from "./ResultsChips";',
    'import { riskFor } from "./resultsModel";'
)

with open(file_path, "w") as f: f.write(content)
print("done")
