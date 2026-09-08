import re

with open("src/components/ciclo-builder/AssignmentPicker.tsx", "r") as f:
    content = f.read()

# Replace hasGrupal block
old_grupal = """      {hasGrupal && (
        <div className="rounded-xl border border-border/60 bg-surface shadow-card overflow-hidden cascade-enter">
          <div className="bg-surface-muted px-6 py-4 border-b border-border/60">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración de grupos</h3>
            <p className="text-[12.5px] text-text-secondary mt-0.5">Elige los grupos a evaluar de forma unificada.</p>
          </div>
          <div className="p-6">
            <GroupsPanel"""

new_grupal = """      {hasGrupal && (
        <div className="flex flex-col gap-4 cascade-enter">
          <div className="flex flex-col gap-1 px-1">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración de grupos</h3>
            <p className="text-[12.5px] text-text-secondary">Elige los grupos a evaluar de forma unificada.</p>
          </div>
          <GroupsPanel"""

content = content.replace(old_grupal, new_grupal)
content = content.replace("""              onAutoIncludeChange={(groupsAutoInclude) => onChange({ groupsAutoInclude })}
            />
          </div>
        </div>
      )}""", """              onAutoIncludeChange={(groupsAutoInclude) => onChange({ groupsAutoInclude })}
            />
        </div>
      )}""")

old_individual = """      {hasIndividual && (
        <div className="rounded-xl border border-border/60 bg-surface shadow-card overflow-hidden cascade-enter">
          <div className="bg-surface-muted px-6 py-4 border-b border-border/60">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración individual</h3>
            <p className="text-[12.5px] text-text-secondary mt-0.5">Elige las personas que tendrán objetivos propios.</p>
          </div>
          <div className="p-0 border-x-0 border-b-0">
            <CollaboratorTable"""

new_individual = """      {hasIndividual && (
        <div className="flex flex-col gap-4 cascade-enter mt-2">
          <div className="flex flex-col gap-1 px-1">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración individual</h3>
            <p className="text-[12.5px] text-text-secondary">Elige las personas que tendrán objetivos propios.</p>
          </div>
          <CollaboratorTable"""

content = content.replace(old_individual, new_individual)
content = content.replace("""              onKeepGroupRestIndividually={(groupValue, personId) => {
                const rest = COLLABORATORS.filter(c => c[assignment.groupSegmentBy] === groupValue && c.id !== personId).map(c => c.id);
                onChange({
                  groupIds: assignment.groupIds.filter(v => v !== groupValue),
                  userIds: Array.from(new Set([...assignment.userIds, ...rest]))
                });
              }}
            />
          </div>
        </div>
      )}""", """              onKeepGroupRestIndividually={(groupValue, personId) => {
                const rest = COLLABORATORS.filter(c => c[assignment.groupSegmentBy] === groupValue && c.id !== personId).map(c => c.id);
                onChange({
                  groupIds: assignment.groupIds.filter(v => v !== groupValue),
                  userIds: Array.from(new Set([...assignment.userIds, ...rest]))
                });
              }}
            />
        </div>
      )}""")


with open("src/components/ciclo-builder/AssignmentPicker.tsx", "w") as f:
    f.write(content)
