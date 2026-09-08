import re

with open("src/components/survey-builder/ParticipantsEditor.tsx", "r") as f:
    content = f.read()

# Remove AutoIncludeToggle from CompanySummary
company_summary_old = """  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/60 p-6 shadow-card bg-surface">

      <AutoIncludeToggle
        checked={autoInclude}
        onCheckedChange={onAutoIncludeChange}
        title="Incluir automáticamente nuevos colaboradores"
        description="Si alguien se une a la empresa después de lanzar la encuesta, se agrega solo a la lista de participantes."
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-border/60 pb-5">"""

company_summary_new = """  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/60 p-6 shadow-card bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-border/60 pb-5">"""

content = content.replace(company_summary_old, company_summary_new)

# Remove AutoIncludeToggle from GroupsPanel
groups_panel_old = """  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/60 p-6 shadow-card bg-surface">

      <AutoIncludeToggle
        checked={autoInclude}
        onCheckedChange={onAutoIncludeChange}
        title="Incluir automáticamente nuevos colaboradores"
        description={
          copy?.autoInclude ??
          "Si alguien se une a uno de los grupos seleccionados después de lanzar la encuesta, se agrega solo a la lista de participantes."
        }
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-border/60 pb-5">"""

groups_panel_new = """  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/60 p-6 shadow-card bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-border/60 pb-5">"""

content = content.replace(groups_panel_old, groups_panel_new)

# Add them to ParticipantsEditor
participant_modes_old = """        <div role="radiogroup" aria-label="Cómo asignar participantes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTICIPANT_MODES.map((mode) => {
            const hasInternalSelection =
              mode === "company" ? participants.mode === "company" :
              mode === "groups" ? participants.mode !== "company" && participants.selectedGroups.length > 0 :
              mode === "individual" ? participants.mode !== "company" && participants.selectedIds.length > 0 :
              mode === "import" ? participants.importedCount > 0 : false;

            return (
              <ModeCard
                key={mode}
                mode={mode}
                isActive={participants.mode === mode || hasInternalSelection}
                state={modeState(mode, participants)}
                onSelect={() => onChange({ mode })}
              />
            );
          })}
        </div>

        {participants.mode === "company" && ("""

participant_modes_new = """        <div role="radiogroup" aria-label="Cómo asignar participantes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTICIPANT_MODES.map((mode) => {
            const hasInternalSelection =
              mode === "company" ? participants.mode === "company" :
              mode === "groups" ? participants.mode !== "company" && participants.selectedGroups.length > 0 :
              mode === "individual" ? participants.mode !== "company" && participants.selectedIds.length > 0 :
              mode === "import" ? participants.importedCount > 0 : false;

            return (
              <ModeCard
                key={mode}
                mode={mode}
                isActive={participants.mode === mode || hasInternalSelection}
                state={modeState(mode, participants)}
                onSelect={() => onChange({ mode })}
              />
            );
          })}
        </div>

        {participants.mode === "company" && (
          <AutoIncludeToggle
            checked={participants.companyAutoInclude}
            onCheckedChange={(companyAutoInclude) => onChange({ companyAutoInclude })}
            title="Incluir automáticamente nuevos colaboradores"
            description="Si alguien se une a la empresa después de lanzar la encuesta, se agrega solo a la lista de participantes."
          />
        )}

        {participants.mode === "groups" && (
          <AutoIncludeToggle
            checked={participants.groupsAutoInclude}
            onCheckedChange={(groupsAutoInclude) => onChange({ groupsAutoInclude })}
            title="Incluir automáticamente nuevos colaboradores"
            description="Si alguien se une a uno de los grupos seleccionados después de lanzar la encuesta, se agrega solo a la lista de participantes."
          />
        )}

        {participants.mode === "company" && ("""

content = content.replace(participant_modes_old, participant_modes_new)

with open("src/components/survey-builder/ParticipantsEditor.tsx", "w") as f:
    f.write(content)
