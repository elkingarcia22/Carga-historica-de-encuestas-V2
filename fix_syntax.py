import re

def fix(file):
    with open(file, 'r') as f: content = f.read()
    content = re.sub(r'chips=\{\}', '', content)
    
    if "AlineacionTab.tsx" in file:
        content = re.sub(r'\s*\?: React\.ReactNode;', '', content)
        
    with open(file, 'w') as f: f.write(content)

base = "src/components/ciclo-results/"
files = ["ResumenTab.tsx", "CumplimientoTab.tsx", "AlineacionTab.tsx", "ColaboradoresTab.tsx", "RankingTab.tsx"]

for f in files: fix(base + f)
print("done")
