import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """                                      <SelectItem key={c.hex} value={c.hex} className="text-[12px]">
                                        <div className="flex items-center w-full min-w-[100px]">
                                          <div 
                                            className="h-5 w-full rounded-md border border-border/50" 
                                            style={{ backgroundColor: c.hex }} 
                                          />
                                        </div>
                                      </SelectItem>"""

content = re.sub(
    r"<SelectItem key=\{c\.hex\} value=\{c\.hex\} className=\"text-\[12px\]\">\s*<div className=\"flex items-center justify-center w-full\">\s*<div\s*className=\"h-4 w-full rounded-md border border-border/50 shrink-0\"\s*style=\{\{ backgroundColor: c\.hex \}\}\s*/>\s*</div>\s*</SelectItem>",
    replacement,
    content
)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
