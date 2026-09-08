with open("src/components/survey-builder/ParticipantsEditor.tsx", "r") as f:
    content = f.read()

content = content.replace(
    '<div className="flex flex-col gap-5">\n      <div className="flex flex-col sm:flex-row sm:items-center',
    '<div className="flex flex-col gap-5">\n      <h3 className="text-[13px] font-bold text-text-primary">Grupos</h3>\n      <div className="flex flex-col sm:flex-row sm:items-center'
)

with open("src/components/survey-builder/ParticipantsEditor.tsx", "w") as f:
    f.write(content)
