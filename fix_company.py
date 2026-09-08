with open("src/components/survey-builder/ParticipantsEditor.tsx", "r") as f:
    content = f.read()

# We need to replace the first instance of 'Grupos' which is in CompanySummary, 
# or more safely, replace the one that is near COLLABORATOR_COUNT.

import re
content = re.sub(
    r'<h3 className="text-\[13px\] font-bold text-text-primary">Grupos</h3>(\s*<div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-border/60 pb-5">\s*<div className="shrink-0">\s*<p className="text-\[13px\] text-text-secondary font-medium mb-1">\s*Se asignarán\s*</p>\s*<p className="text-3xl font-bold tracking-tight text-primary leading-none">\s*\{formatCount\(COLLABORATOR_COUNT\)\})',
    r'<h3 className="text-[13px] font-bold text-text-primary">Toda la empresa</h3>\1',
    content
)

with open("src/components/survey-builder/ParticipantsEditor.tsx", "w") as f:
    f.write(content)
