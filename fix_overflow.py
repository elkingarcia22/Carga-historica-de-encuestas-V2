import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make the wrapper flex-wrap
content = content.replace('<div className="flex items-center gap-3 flex-1 min-w-0">', '<div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">')

# Shrink columns a bit to fit better
content = content.replace('className="flex-1 min-w-[200px]"', 'className="flex-1 min-w-[150px]"')
content = content.replace('className="w-32"', 'className="w-24 shrink-0"')
content = content.replace('className="w-36 shrink-0"', 'className="w-28 shrink-0"')

# Adjust color block fixed width
content = content.replace('className="h-5 w-[80px] sm:w-[90px] rounded-md border border-border/50 shrink-0"', 'className="h-5 w-[70px] sm:w-[80px] rounded-md border border-border/50 shrink-0"')

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
