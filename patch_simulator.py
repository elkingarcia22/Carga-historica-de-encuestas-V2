import re

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-muted/40 px-3.5 py-3">',
    '<div className="flex flex-col gap-2">'
)

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'w') as f:
    f.write(content)
