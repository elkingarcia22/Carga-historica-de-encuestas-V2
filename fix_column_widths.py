import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix Nombre column width
content = content.replace('className="flex-1 max-w-xs"', 'className="flex-1 min-w-[200px]"')

# Fix Color column width
content = content.replace('className="flex-1 min-w-[180px]"', 'className="w-36 shrink-0"')

# Ensure SelectTrigger is full width and padding is minimal so color fills it
content = content.replace('<SelectTrigger className="h-9 w-full min-w-[140px] text-[13px] font-semibold">', '<SelectTrigger className="h-9 w-full text-[13px] font-semibold px-2">')

# Make sure the color block fills 100% width
# Currently it is: <div className="flex items-center w-full min-w-[100px]">
content = content.replace('<div className="flex items-center w-full min-w-[100px]">', '<div className="flex items-center w-full">')
content = content.replace('className="h-5 w-full rounded-md border border-border/50 shrink-0"', 'className="h-5 w-full rounded-md border border-border/50"')
content = content.replace('className="h-5 w-full rounded-md border border-border/50"', 'className="h-5 w-full rounded-md border border-border/50"')

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
