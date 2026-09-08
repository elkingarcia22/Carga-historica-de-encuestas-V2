import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# Remove everything after RangeVisual
visual_regex = re.compile(r'(function RangeVisual.*?</figure>\s*\);\s*\})[\s\S]*', re.DOTALL)
content = visual_regex.sub(r'\1', content)

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'w') as f:
    f.write(content)
