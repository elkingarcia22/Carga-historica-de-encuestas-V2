import re

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'r') as f:
    content = f.read()

aria_label_regex = re.compile(
    r'aria-label=\{\s*isAskingContext\s*\?\s*"Generar el objetivo con IA a partir del contexto"\s*:\s*"Mejorar la redacción del objetivo con IA"\s*\}',
    re.MULTILINE
)

new_aria_label = """aria-label={
                        (objective.title.trim() === "" || isAskingContext)
                          ? "Generar el objetivo con IA a partir del contexto"
                          : "Mejorar la redacción del objetivo con IA"
                      }"""

content = aria_label_regex.sub(new_aria_label, content)

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'w') as f:
    f.write(content)
