import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '<div className="shrink-0 p-4 m-4 border border-border/40 bg-surface flex items-center justify-end rounded-2xl shadow-sm">',
    '<div className="shrink-0 p-4 mx-6 mb-6 mt-2 border border-border/40 bg-surface flex items-center justify-end rounded-2xl shadow-sm">'
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
