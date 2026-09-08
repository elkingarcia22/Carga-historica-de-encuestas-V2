import re

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'r') as f:
    content = f.read()

ailabel_regex = re.compile(
    r'const aiLabel = isAiWorking\s*\?\s*"Redactando…"\s*:\s*isAskingContext\s*\?\s*"Generar con IA"\s*:\s*"Mejorar con IA";',
    re.MULTILINE
)

new_ailabel = """const aiLabel = isAiWorking
    ? "Redactando…"
    : (objective.title.trim() === "" || isAskingContext)
      ? "Generar con IA"
      : "Mejorar con IA";"""

content = ailabel_regex.sub(new_ailabel, content)

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'w') as f:
    f.write(content)
