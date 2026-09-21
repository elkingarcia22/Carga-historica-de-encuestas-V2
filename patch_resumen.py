import re

file_path = "src/components/ciclo-results/ResumenTab.tsx"
with open(file_path, "r") as f: content = f.read()

# Add sticky to the filtros block
content = re.sub(
    r'<ResumenBoardBlock id="filtros" label="Filtros del reporte" span=\{6\} fixed>',
    r'<ResumenBoardBlock id="filtros" label="Filtros del reporte" span={6} fixed sticky>',
    content
)

with open(file_path, "w") as f: f.write(content)
print("done")
