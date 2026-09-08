import re

with open('src/components/survey-builder/ParticipantsEditor.tsx', 'r') as f:
    content = f.read()

# Remove the inline error block
inline_error_pattern = re.compile(
    r'(\s*)\{showValidation && total === 0 && \(\s*<p className="flex items-center gap-1\.5 text-\[12px\] font-medium text-destructive animate-in fade-in duration-200">\s*<TriangleAlert className="h-3\.5 w-3\.5 shrink-0" strokeWidth=\{2\} />\s*Selecciona al menos un participante para poder continuar\.\s*</p>\s*\)\}',
    re.MULTILINE
)

content = inline_error_pattern.sub('', content)

with open('src/components/survey-builder/ParticipantsEditor.tsx', 'w') as f:
    f.write(content)
