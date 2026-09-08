with open("src/components/survey-builder/ParticipantsEditor.tsx", "r") as f:
    content = f.read()

import re

# We want to insert the header before the radiogroup
content = content.replace(
    '<div role="radiogroup" aria-label="Cómo asignar participantes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">',
    """<header className="flex flex-col gap-0.5">
          <h3 className="text-[13px] font-bold text-text-primary">¿A quiénes quieres incluir?</h3>
          <p className="text-[12px] leading-relaxed text-text-secondary">
            Elige si esta encuesta va para toda la empresa o solo para segmentos o personas específicas.
          </p>
        </header>

        <div role="radiogroup" aria-label="Cómo asignar participantes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">"""
)

with open("src/components/survey-builder/ParticipantsEditor.tsx", "w") as f:
    f.write(content)
