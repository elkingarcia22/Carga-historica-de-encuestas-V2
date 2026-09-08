import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I will find '} else {' in handleSaveConfig
replacement = """    } else if (activeTab === "niveles") {
      const names = new Set<string>();
      
      for (const nivel of niveles) {
        const nombreTrimmed = nivel.nombre.trim();
        if (!nombreTrimmed) {
          toast.error("Todos los niveles deben tener un nombre.");
          return;
        }
        if (names.has(nombreTrimmed.toLowerCase())) {
          toast.error(`El nombre del nivel "${nombreTrimmed}" está duplicado.`);
          return;
        }
        names.add(nombreTrimmed.toLowerCase());
      }
      toast.success("Niveles de desempeño guardados correctamente.");
      onOpenChange(false);
    } else {"""

# Find the end of handleSaveConfig to do replacement safely
content = content.replace("    } else {\n      toast.success(\"Permisos guardados correctamente.\");", replacement + "\n      toast.success(\"Permisos guardados correctamente.\");")

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
