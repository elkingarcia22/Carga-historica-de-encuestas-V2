import re

file_path = "src/screens/CicloResults.tsx"
with open(file_path, "r") as f: content = f.read()

content = content.replace(
    'React.useState<ColaboradoresView>("detalle")',
    'React.useState<ColaboradoresView>("persona")'
)

with open(file_path, "w") as f: f.write(content)
print("done")
