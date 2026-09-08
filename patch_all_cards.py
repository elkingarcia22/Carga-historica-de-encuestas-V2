import re

files_to_patch = [
    "src/components/ciclo-builder/MeasureTypePicker.tsx",
    "src/components/ciclo-builder/DirectionPicker.tsx",
    "src/components/ciclo-builder/AiObjectiveControls.tsx"
]

replacement = r'''contentClassName="relative w-full h-full flex-col items-start justify-between gap-3"
\g<1>>
\g<1>  <span
\g<1>    aria-hidden
\g<1>    className={cn(
\g<1>      "absolute top-0 right-0 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
\g<1>      isSelected
\g<1>        ? "border-primary bg-primary"
\g<1>        : "border-input dark:bg-input/30"
\g<1>    )}
\g<1>  >
\g<1>    {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
\g<1>  </span>'''

for filename in files_to_patch:
    with open(filename, "r") as f:
        content = f.read()
    
    content = re.sub(
        r'contentClassName="h-full flex-col items-start justify-between gap-3"\s*(\n\s*)>',
        replacement,
        content
    )
    
    with open(filename, "w") as f:
        f.write(content)

