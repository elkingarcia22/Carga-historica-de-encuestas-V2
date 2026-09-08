import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update NivelDesempenoConfig interface and DEFAULT_NIVELES
replacement_interface = """export interface NivelDesempenoConfig {
  id: string;
  nombre: string;
  minPorcentaje: number;
  maxPorcentaje: number;
  colorHex: string;
}

const DEFAULT_NIVELES: NivelDesempenoConfig[] = [
  { id: "nivel-1", nombre: "Por mejorar", minPorcentaje: 0, maxPorcentaje: 33, colorHex: "#FCA5A5" },
  { id: "nivel-2", nombre: "Bueno", minPorcentaje: 34, maxPorcentaje: 66, colorHex: "#FCD34D" },
  { id: "nivel-3", nombre: "Excelente", minPorcentaje: 67, maxPorcentaje: 100, colorHex: "#86EFAC" },
];"""
pattern_interface = r"export interface NivelDesempenoConfig \{.*?\];"
content = re.sub(pattern_interface, replacement_interface, content, flags=re.DOTALL)

# 2. Update handleAddEstado logic
replacement_add_estado = """  const handleAddEstado = () => {
    if (estados.length >= 8) {
      toast.error("Máximo 8 estados permitidos");
      return;
    }
    const highest = estados.length > 0 ? Math.max(...estados.map(e => e.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newMax = newMin + 49;
    const newId = `custom-estado-${Date.now()}`;
    const newEstado: ObjetivoEstadoConfig = {
      id: newId,
      nombre: "Nuevo estado",
      minPorcentaje: newMin,
      maxPorcentaje: newMax,
      variant: "info",
      colorHex: COLOR_VARIANTS[estados.length % COLOR_VARIANTS.length].hex,
      descripcion: "Estado personalizado para seguimiento de objetivos.",
    };
    setEstados((prev) => [...prev, newEstado]);
    toast.success("Nuevo estado agregado");
  };"""
pattern_add_estado = r"  const handleAddEstado = \(\) => \{.*?toast\.success\(\"Nuevo estado agregado\"\);\n  \};"
content = re.sub(pattern_add_estado, replacement_add_estado, content, flags=re.DOTALL)

# 3. Update handleAddNivel logic
replacement_add_nivel = """  const handleAddNivel = () => {
    if (niveles.length >= 5) {
      toast.error("Máximo 5 niveles permitidos");
      return;
    }
    const highest = niveles.length > 0 ? Math.max(...niveles.map(n => n.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newMax = newMin + 49;
    const newId = `nivel-${Date.now()}`;
    const newColor = COLOR_VARIANTS[niveles.length % COLOR_VARIANTS.length].hex;
    setNiveles((prev) => [
      ...prev,
      { id: newId, nombre: "Nuevo nivel", minPorcentaje: newMin, maxPorcentaje: newMax, colorHex: newColor },
    ].sort((a, b) => a.minPorcentaje - b.minPorcentaje));
    toast.success("Nuevo nivel agregado");
  };"""
pattern_add_nivel = r"  const handleAddNivel = \(\) => \{.*?\]\.sort\(\(a, b\) => a\.maxPorcentaje - b\.maxPorcentaje\)\);\n  \};"
content = re.sub(pattern_add_nivel, replacement_add_nivel, content, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
