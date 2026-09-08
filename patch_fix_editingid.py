with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'r') as f:
    content = f.read()

target = "const [pending, setPending] = React.useState<{ id: string; label: string } | null>(null);"
replacement = target + "\n  const [editingId, setEditingId] = React.useState<string | null>(null);"

content = content.replace(target, replacement)

with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'w') as f:
    f.write(content)
