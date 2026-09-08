import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# For niveles tab, I will find the SelectItem for colorHex and modify it.
# Actually I can just remove <span>{c.label}</span> where it belongs to niveles.
# Let's replace the mapped SelectItem in the code I just inserted:
replacement = """                                      <SelectItem key={c.hex} value={c.hex} className="text-[12px]">
                                        <div className="flex items-center justify-center w-full">
                                          <div 
                                            className="h-4 w-full rounded-md border border-border/50 shrink-0" 
                                            style={{ backgroundColor: c.hex }} 
                                          />
                                        </div>
                                      </SelectItem>"""

content = re.sub(
    r"<SelectItem key=\{c\.hex\} value=\{c\.hex\} className=\"text-\[12px\]\">\s*<div className=\"flex items-center gap-2\">\s*<div\s*className=\"h-3\.5 w-3\.5 rounded-full border border-border/50 shrink-0\"\s*style=\{\{ backgroundColor: c\.hex \}\}\s*/>\s*<span>\{c\.label\}</span>\s*</div>\s*</SelectItem>",
    replacement,
    content
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
