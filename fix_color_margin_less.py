import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Reduce the right margin
content = content.replace('className="flex items-center mr-1.5"', 'className="flex items-center mr-0.5"')

# Increase the max width a bit so it takes up more space again
content = content.replace('className="h-5 w-full min-w-[60px] max-w-[70px] rounded-md border border-border/50 shrink-0"', 'className="h-5 w-full min-w-[70px] max-w-[80px] rounded-md border border-border/50 shrink-0"')

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
