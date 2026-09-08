import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add margin to the sidebar
content = content.replace(
    '<aside className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">',
    '<aside className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card m-6 mr-2">'
)

# Increase padding on the main panel to match
content = content.replace(
    '<div className="flex-1 overflow-y-auto p-4 space-y-4">',
    '<div className="flex-1 overflow-y-auto p-6 space-y-4">'
)

# Also update the sticky header for the continuum bar to match the new p-6 padding
content = content.replace(
    '<div className="sticky -top-4 z-20 pt-4 pb-2 -mx-4 px-4 bg-background">',
    '<div className="sticky -top-6 z-20 pt-6 pb-2 -mx-6 px-6 bg-background">'
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
