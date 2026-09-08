import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Outer container: give it padding, gap, and the gray background
content = content.replace(
    '<div className="flex min-h-0 flex-1 bg-background">',
    '<div className="flex min-h-0 flex-1 bg-[#F4F4F5] p-6 gap-6">'
)

# 2. Sidebar: remove margin
content = content.replace(
    '<aside className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card m-6 mr-2">',
    '<aside className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">'
)

# 3. Main panel scroll area: change p-6 to pb-6 (we want bottom padding for scrolling, but left/right is handled by parent p-6)
content = content.replace(
    '<div className="flex-1 overflow-y-auto p-6 space-y-4">',
    '<div className="flex-1 overflow-y-auto pb-6 space-y-4">'
)
# Wait, we need to ensure right side padding for scrollbar? If parent has p-6, the scrollbar is inside the parent's padding, so it's 24px from the right edge. That's fine.

# 4. Sticky headers: they used to have negative margins to offset the padding. Since we removed the padding from the scroll area, we don't need negative margins!
content = content.replace(
    '<div className="sticky -top-6 z-20 pt-6 pb-2 -mx-6 px-6 bg-background">',
    '<div className="sticky top-0 z-20 pb-2 bg-[#F4F4F5]">'
)

# 5. "Guardar cambios" button wrapper: remove margins because the parent has padding, just keep it aligned
content = content.replace(
    '<div className="shrink-0 p-4 mx-6 mb-6 mt-2 border border-border/40 bg-surface flex items-center justify-end rounded-2xl shadow-sm">',
    '<div className="shrink-0 p-4 mt-2 border border-border/40 bg-surface flex items-center justify-end rounded-2xl shadow-sm">'
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
