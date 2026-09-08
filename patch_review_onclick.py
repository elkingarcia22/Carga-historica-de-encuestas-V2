import re

with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'r') as f:
    content = f.read()

target = """          <CardAction
            label={isEditorOpen ? "Cerrar la edición" : "Editar con IA"}
            onClick={() => setEditorOpen((open) => !open)}
            disabled={isPending}
            isActive={isEditorOpen}
          >"""

replacement = """          <CardAction
            label={isEditorOpen ? "Cerrar la edición" : "Editar con IA"}
            onClick={() => setEditorOpen(!isEditorOpen)}
            disabled={isPending}
            isActive={isEditorOpen}
          >"""

content = content.replace(target, replacement)

with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'w') as f:
    f.write(content)
