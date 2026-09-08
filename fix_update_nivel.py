import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """  const handleUpdateNivel = (id: string, patch: Partial<NivelDesempenoConfig>) => {
    setNiveles((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const oldState = prev[index];
      const nextStates = [...prev];
      nextStates[index] = { ...oldState, ...patch };

      // Auto-adjust topology downwards
      if (patch.maxPorcentaje !== undefined && patch.maxPorcentaje !== oldState.maxPorcentaje) {
        let currentMax = patch.maxPorcentaje;
        for (let i = index + 1; i < nextStates.length; i++) {
          const wasConnected = prev[i].minPorcentaje === prev[i - 1].maxPorcentaje + 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], minPorcentaje: currentMax + 1 };
            if (nextStates[i].maxPorcentaje < nextStates[i].minPorcentaje) {
              nextStates[i].maxPorcentaje = nextStates[i].minPorcentaje;
            }
            currentMax = nextStates[i].maxPorcentaje;
          } else {
            break;
          }
        }
      }

      // Auto-adjust topology upwards
      if (patch.minPorcentaje !== undefined && patch.minPorcentaje !== oldState.minPorcentaje) {
        let currentMin = patch.minPorcentaje;
        for (let i = index - 1; i >= 0; i--) {
          const wasConnected = prev[i].maxPorcentaje === prev[i + 1].minPorcentaje - 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], maxPorcentaje: currentMin - 1 };
            if (nextStates[i].minPorcentaje > nextStates[i].maxPorcentaje) {
              nextStates[i].minPorcentaje = nextStates[i].maxPorcentaje;
            }
            currentMin = nextStates[i].minPorcentaje;
          } else {
            break;
          }
        }
      }

      return nextStates;
    });
  };"""

# Replace the current handleUpdateNivel
content = re.sub(r"  const handleUpdateNivel = \(id: string, patch: Partial<NivelDesempenoConfig>\) => \{.*?\n  \};\n", replacement + "\n", content, flags=re.DOTALL)

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
