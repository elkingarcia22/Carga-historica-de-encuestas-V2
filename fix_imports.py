import re

base = "src/components/ciclo-results/"
files = ["ResumenTab.tsx", "CumplimientoTab.tsx", "AlineacionTab.tsx", "ColaboradoresTab.tsx", "RankingTab.tsx"]

for f in files:
    file_path = base + f
    with open(file_path, "r") as file:
        content = file.read()
    
    # check if ResultsGlobalFilters or ResultsFilterChips are used
    if "ResultsFilterChips" not in content.replace("import {", "").replace("import", ""):
        content = re.sub(r'ResultsFilterChips\s*,?\s*', '', content)
    if "ResultsGlobalFilters" not in content.replace("import {", "").replace("import", ""):
        content = re.sub(r'ResultsGlobalFilters\s*,?\s*', '', content)

    # Clean up empty curly braces or leading/trailing commas left by removal
    content = re.sub(r'\{\s*,\s*', '{ ', content)
    content = re.sub(r'\s*,\s*\}', ' }', content)
    content = re.sub(r'import\s*\{\s*\}\s*from\s*["\'][^"\']+["\'];\n?', '', content)

    with open(file_path, "w") as file:
        file.write(content)

print("done")
