import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add margin-right to the flex container inside SelectItem so there's space before the chevron
content = content.replace('<div className="flex items-center">', '<div className="flex items-center mr-1.5">')

# Slightly reduce the width of the color block so it doesn't squish against the chevron
content = content.replace('className="h-5 w-[70px] sm:w-[80px] rounded-md border border-border/50 shrink-0"', 'className="h-5 w-full min-w-[60px] max-w-[70px] rounded-md border border-border/50 shrink-0"')

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
