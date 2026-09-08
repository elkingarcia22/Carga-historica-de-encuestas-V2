with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'r') as f:
    content = f.read()

target = """  onToggle,
  onRegenerate,
  onEdit,
  onRemove,
}: {"""

replacement = """  onToggle,
  onRegenerate,
  onEdit,
  onRemove,
  isEditorOpen,
  onEditorOpenChange,
}: {"""

content = content.replace(target, replacement)

with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'w') as f:
    f.write(content)
