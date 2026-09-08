import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Modify handleAddEstado
replacement_add = """  const handleAddEstado = () => {
    if (estados.length >= 8) {
      toast.error("Máximo 8 estados permitidos");
      return;
    }"""
content = content.replace("  const handleAddEstado = () => {", replacement_add)

# Make sure handleAddNivel also has toast if not already
replacement_add_nivel = """  const handleAddNivel = () => {
    if (niveles.length >= 5) {
      toast.error("Máximo 5 niveles permitidos");
      return;
    }"""
content = content.replace("  const handleAddNivel = () => {\n    if (niveles.length >= 5) return;", replacement_add_nivel)

# Modify button in UI for estados
# It currently has: onClick={handleAddEstado} \n variant="outline"
button_pattern = r'onClick=\{handleAddEstado\}\s*variant="outline"\s*className="gap-2 font-semibold text-\[13px\]"'
button_replacement = 'onClick={handleAddEstado}\n                    variant="outline"\n                    disabled={estados.length >= 8}\n                    className="gap-2 font-semibold text-[13px]"'
content = re.sub(button_pattern, button_replacement, content)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
