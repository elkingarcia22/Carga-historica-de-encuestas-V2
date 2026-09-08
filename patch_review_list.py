import re

with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'r') as f:
    content = f.read()

# 1. Update Props
props_old = r"""  onEdit: \(id: string, instruction: string\) => void;
  /\*\* Fuera de la propuesta, no solo sin marcar\. \*/
  onRemove: \(id: string\) => void;
}"""
props_new = """  onEdit: (id: string, instruction: string) => void;
  /** Fuera de la propuesta, no solo sin marcar. */
  onRemove: (id: string) => void;
  editingId?: string | null;
  onEditingIdChange?: (id: string | null) => void;
}"""
content = re.sub(props_old, props_new, content)

# 2. Update AiObjectiveReviewList function signature
func_old = r"""  onRegenerate,
  onEdit,
  onRemove,
}: AiObjectiveReviewListProps\) \{"""
func_new = """  onRegenerate,
  onEdit,
  onRemove,
  editingId = null,
  onEditingIdChange,
}: AiObjectiveReviewListProps) {"""
content = re.sub(func_old, func_new, content)

# 3. Pass props to ReviewCard
card_old = r"""        <ReviewCard
          objective=\{objective\}
          isSelected=\{selectedIds\.has\(objective\.id\)\}
          isPending=\{pendingId === objective\.id\}
          pendingLabel=\{pendingLabel\}
          pendingProgress=\{pendingProgress\}
          onToggle=\{\(\) => onToggle\(objective\.id\)\}
          onRegenerate=\{\(\) => onRegenerate\(objective\.id\)\}
          onEdit=\{\(instruction\) => onEdit\(objective\.id, instruction\)\}
          onRemove=\{\(\) => onRemove\(objective\.id\)\}
        />"""
card_new = """        <ReviewCard
          objective={objective}
          isSelected={selectedIds.has(objective.id)}
          isPending={pendingId === objective.id}
          pendingLabel={pendingLabel}
          pendingProgress={pendingProgress}
          isEditorOpen={editingId === objective.id}
          onEditorOpenChange={(open) => onEditingIdChange?.(open ? objective.id : null)}
          onToggle={() => onToggle(objective.id)}
          onRegenerate={() => onRegenerate(objective.id)}
          onEdit={(instruction) => onEdit(objective.id, instruction)}
          onRemove={() => onRemove(objective.id)}
        />"""
content = re.sub(card_old, card_new, content)

# 4. Update ReviewCard props
rc_props_old = r"""  onRegenerate: \(\) => void;
  onEdit: \(instruction: string\) => void;
  onRemove: \(\) => void;
}\) \{
  const \[isEditorOpen, setEditorOpen\] = React\.useState\(false\);"""
rc_props_new = """  onRegenerate: () => void;
  onEdit: (instruction: string) => void;
  onRemove: () => void;
  isEditorOpen: boolean;
  onEditorOpenChange: (open: boolean) => void;
}) {
  const setEditorOpen = onEditorOpenChange;"""
content = re.sub(rc_props_old, rc_props_new, content)

with open('src/components/ciclo-builder/AiObjectiveReviewList.tsx', 'w') as f:
    f.write(content)
