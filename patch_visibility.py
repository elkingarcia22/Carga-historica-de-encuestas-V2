import re

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'r') as f:
    content = f.read()

visibility_regex = re.compile(
    r'const hasTitle = objective\.title\.trim\(\) !== "";\n\s*const showMeasureType = hasTitle;',
    re.MULTILINE
)

new_visibility = """const hasTitle = objective.title.trim() !== "";
  const showMeasureType = hasTitle && aiPhase === "idle";"""

content = visibility_regex.sub(new_visibility, content)

with open('src/components/ciclo-builder/ObjectiveCard.tsx', 'w') as f:
    f.write(content)
