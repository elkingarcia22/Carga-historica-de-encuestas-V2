with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'r') as f:
    content = f.read()

target = """              <AiObjectiveReviewList
                objectives={proposal}
                selectedIds={selectedIds}
                pendingId={pending?.id ?? null}
                pendingLabel={pending?.label}
                pendingProgress={cardProgress}
                onToggle={toggleSelected}
                onRegenerate={regenerateOne}
                onEdit={editOne}
                onRemove={removeOne}
              />"""

replacement = """              <AiObjectiveReviewList
                objectives={proposal}
                selectedIds={selectedIds}
                pendingId={pending?.id ?? null}
                pendingLabel={pending?.label}
                pendingProgress={cardProgress}
                editingId={editingId}
                onEditingIdChange={setEditingId}
                onToggle={toggleSelected}
                onRegenerate={regenerateOne}
                onEdit={editOne}
                onRemove={removeOne}
              />"""

content = content.replace(target, replacement)

with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'w') as f:
    f.write(content)
