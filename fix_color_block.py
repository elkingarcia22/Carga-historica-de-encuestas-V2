import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace inner div w-full with exact fixed width that fills the container
content = content.replace('<div className="flex items-center w-full">', '<div className="flex items-center">')
content = content.replace('className="h-5 w-full rounded-md border border-border/50"', 'className="h-5 w-[80px] sm:w-[90px] rounded-md border border-border/50 shrink-0"')

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
