import re

with open("src/screens/ObjetivosDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'className=\{\`h-full rounded-full \$\{\n\s*ciclo\.tipoProgreso === "success"\n\s*\? "bg-status-positive"\n\s*: ciclo\.tipoProgreso === "warning"\n\s*\? "bg-status-warning"\n\s*: "bg-border/60"\n\s*\}\`\}'

replacement = 'className="h-full rounded-full bg-primary"'

content = re.sub(pattern, replacement, content)

with open("src/screens/ObjetivosDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
