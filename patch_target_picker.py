import re

with open("src/components/ciclo-builder/TargetPickerDrawer.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'import { GroupsPanel } from "@/components/survey-builder/ParticipantsEditor";',
    'import { GroupsPanel, AutoIncludeToggle } from "@/components/survey-builder/ParticipantsEditor";'
)

old_group_panel = """        {isGroup ? (
          <GroupsPanel
            segmentBy={segmentBy}
            onSegmentByChange={(value) => {
              onSegmentByChange(value);
              setSelection([]);
            }}
            selectedGroups={selection}
            onToggleGroup={toggleGroup}
            onSelectAll={(values) =>
              setSelection(values.filter((v) => !takenIds.has(v) || initialSelection.includes(v)))
            }
            onClearAll={() => setSelection([])}
            autoInclude={autoInclude}
            onAutoIncludeChange={onAutoIncludeChange}
            copy={{
              autoInclude:
                "Si alguien entra a uno de estos grupos durante el ciclo, hereda sus objetivos automáticamente.",
              lead: "Elige cómo agrupar a tus colaboradores y marca los grupos que compartirán este set de objetivos.",
            }}
          />
        ) : ("""

new_group_panel = """        {isGroup ? (
          <div className="flex flex-col gap-6">
            <AutoIncludeToggle
              checked={autoInclude}
              onCheckedChange={onAutoIncludeChange}
              title="Incluir automáticamente nuevos colaboradores"
              description="Si alguien entra a uno de estos grupos durante el ciclo, hereda sus objetivos automáticamente."
            />
            <GroupsPanel
              segmentBy={segmentBy}
              onSegmentByChange={(value) => {
                onSegmentByChange(value);
                setSelection([]);
              }}
              selectedGroups={selection}
              onToggleGroup={toggleGroup}
              onSelectAll={(values) =>
                setSelection(values.filter((v) => !takenIds.has(v) || initialSelection.includes(v)))
              }
              onClearAll={() => setSelection([])}
              copy={{
                lead: "Elige cómo agrupar a tus colaboradores y marca los grupos que compartirán este set de objetivos.",
              }}
            />
          </div>
        ) : ("""

content = content.replace(old_group_panel, new_group_panel)

with open("src/components/ciclo-builder/TargetPickerDrawer.tsx", "w") as f:
    f.write(content)
