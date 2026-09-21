import re

file_path = "src/components/ciclo-results/ResumenTab.tsx"
with open(file_path, "r") as f: content = f.read()

content = re.sub(r'\{\s*/\*\s*Los filtros, bajo los pendientes.*?</ResumenBoardBlock>\n\s*\)\}\n*', '', content, flags=re.DOTALL)

with open(file_path, "w") as f: f.write(content)
