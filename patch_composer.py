import re

with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'r') as f:
    content = f.read()

# 1. Add editingId state
state_injection = r"""  const \[pending, setPending\] = React\.useState<\{ id: string; label: string \} \| null>\(null\);"""
state_replacement = """  const [pending, setPending] = React.useState<{ id: string; label: string } | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);"""
content = re.sub(state_injection, state_replacement, content)

# 2. Pass props to AiObjectiveReviewList
list_injection = r"""              <AiObjectiveReviewList
                objectives=\{proposal\}
                selectedIds=\{selectedIds\}
                pendingId=\{pending\?\.id \?\? null\}
                pendingLabel=\{pending\?\.label\}
                pendingProgress=\{cardProgress\}
                onToggle=\{toggleSelected\}
                onRegenerate=\{regenerateOne\}
                onEdit=\{editOne\}
                onRemove=\{removeOne\}
              />"""
list_replacement = """              <AiObjectiveReviewList
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
content = re.sub(list_injection, list_replacement, content)

# 3. Hide refresh button when editingId is not null
btn_refresh = r"""              <button
                type="button"
                onClick=\{\(\) => void startGeneration\(\)\}
                disabled=\{pending !== null\}
                className="flex h-8 items-center gap-1\.5 rounded-full border border-border bg-surface px-3 text-\[12px\] font-semibold text-text-secondary transition-all hover:border-ai-gradient-start/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 disabled:opacity-40"
              >
                <RefreshCw className="size-3\.5" strokeWidth=\{2\.2\} />
                \{proposal\.length === 1 \? "Otra propuesta" : "Generar otra propuesta"\}
              </button>"""
btn_refresh_new = """              {editingId === null && (
                <button
                  type="button"
                  onClick={() => void startGeneration()}
                  disabled={pending !== null}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary transition-all hover:border-ai-gradient-start/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 disabled:opacity-40"
                >
                  <RefreshCw className="size-3.5" strokeWidth={2.2} />
                  {proposal.length === 1 ? "Otra propuesta" : "Generar otra propuesta"}
                </button>
              )}"""
content = re.sub(btn_refresh, btn_refresh_new, content)

# 4. Hide footer buttons when editingId is not null
# We need to wrap the contents of <div className="flex items-center gap-2"> inside the footer
# Wait, let's see how the footer looks
