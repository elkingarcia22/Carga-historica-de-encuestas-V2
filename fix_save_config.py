import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """  const handleSaveConfig = () => {
    // Validar Estados
    const estadoNames = new Set<string>();
    const estadoColors = new Set<string>();
    
    for (const est of estados) {
      const nombreTrimmed = est.nombre.trim();
      if (!nombreTrimmed) {
        toast.error("Todos los estados deben tener un nombre.");
        return;
      }
      
      if (nombreTrimmed.toLowerCase() === "nuevo estado") {
        toast.error("Debes asignarle un nombre real al nuevo estado que creaste.");
        return;
      }
      
      const nombreLower = nombreTrimmed.toLowerCase();
      if (estadoNames.has(nombreLower)) {
        toast.error(`El nombre de estado "${nombreTrimmed}" está repetido.`);
        return;
      }
      estadoNames.add(nombreLower);

      if (estadoColors.has(est.colorHex)) {
        toast.error(`El color de "${nombreTrimmed}" ya está siendo usado. Cada estado debe tener un color único.`);
        return;
      }
      estadoColors.add(est.colorHex);

      if (est.minPorcentaje > est.maxPorcentaje) {
        toast.error(`En "${nombreTrimmed}", el porcentaje "Desde" (${est.minPorcentaje}%) no puede ser mayor que "Hasta" (${est.maxPorcentaje}%).`);
        return;
      }
    }

    // Validar Niveles
    const nivelNames = new Set<string>();
    const nivelColors = new Set<string>();
    
    for (const nivel of niveles) {
      const nombreTrimmed = nivel.nombre.trim();
      if (!nombreTrimmed) {
        toast.error("Todos los niveles deben tener un nombre.");
        return;
      }
      
      if (nombreTrimmed.toLowerCase() === "nuevo nivel") {
        toast.error("Debes asignarle un nombre real al nuevo nivel que creaste.");
        return;
      }
      
      const nombreLower = nombreTrimmed.toLowerCase();
      if (nivelNames.has(nombreLower)) {
        toast.error(`El nombre de nivel "${nombreTrimmed}" está repetido.`);
        return;
      }
      nivelNames.add(nombreLower);

      if (nivelColors.has(nivel.colorHex)) {
        toast.error(`El color de "${nombreTrimmed}" ya está siendo usado. Cada nivel debe tener un color único.`);
        return;
      }
      nivelColors.add(nivel.colorHex);

      if (nivel.minPorcentaje > nivel.maxPorcentaje) {
        toast.error(`En "${nombreTrimmed}", el porcentaje "Desde" (${nivel.minPorcentaje}%) no puede ser mayor que "Hasta" (${nivel.maxPorcentaje}%).`);
        return;
      }
    }

    toast.success("Configuración de objetivos guardada correctamente");
    onOpenChange(false);
  };"""

# Replace the existing handleSaveConfig
pattern = r"  const handleSaveConfig = \(\) => \{.*?onOpenChange\(false\);\n  \};"
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
