import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make the outer container have the gray background
content = content.replace(
    '<div className="flex min-h-0 flex-1">',
    '<div className="flex min-h-0 flex-1 bg-background">'
)

# Remove the gray background from just the right panel wrapper, so it inherits it from the parent
content = content.replace(
    '<div className="flex min-w-0 flex-1 flex-col relative overflow-hidden bg-background">',
    '<div className="flex min-w-0 flex-1 flex-col relative overflow-hidden">'
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
