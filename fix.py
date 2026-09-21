import os
import re

def fix_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Generic replaces
    content = re.sub(r'\s*/\*\* Los filtros globales[\s\S]*?\*/\n\s*globalControls\??:\s*React\.ReactNode;', '', content)
    content = re.sub(r'\s*/\*\* Las fichas de lo que está filtrado[\s\S]*?\*/\n\s*globalChips\??:\s*React\.ReactNode;', '', content)
    content = re.sub(r'\s*globalControls,?', '', content)
    content = re.sub(r'\s*globalChips,?', '', content)
    content = re.sub(r'\s*chips=\{globalChips\}', '', content)
    content = re.sub(r'\s*\{globalControls\}', '', content)

    # ResumenTab block
    content = re.sub(r'\{\s*/\*\s*Los filtros, bajo los pendientes.*?\*/\s*\}\s*\{globalControls.*?</ResumenBoardBlock>\s*\}', '', content, flags=re.DOTALL)
    
    with open(file_path, "w") as f:
        f.write(content)

base = "src/components/ciclo-results/"
for f in ["ResumenTab.tsx", "CumplimientoTab.tsx", "AlineacionTab.tsx", "ColaboradoresTab.tsx", "RankingTab.tsx"]:
    try:
        fix_file(base + f)
        print("fixed", f)
    except Exception as e:
        print("error", f, e)

print("done")
