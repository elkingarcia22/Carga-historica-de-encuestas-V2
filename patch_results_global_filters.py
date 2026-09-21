import re

file_path = "src/components/ciclo-results/ResultsGlobalFilters.tsx"
with open(file_path, "r") as f: content = f.read()

# Add excludeBreakdowns to the prop type
content = content.replace(
    'searchSlot?: React.ReactNode;',
    'searchSlot?: React.ReactNode;\n  excludeBreakdowns?: BreakdownKey[];'
)
# Add excludeBreakdowns to the prop signature
content = content.replace(
    'searchSlot,',
    'searchSlot,\n  excludeBreakdowns = [],'
)

# Update the map over BREAKDOWN_ORDER
content = content.replace(
    '{BREAKDOWN_ORDER.map((key) => (',
    '{BREAKDOWN_ORDER.filter((k) => !excludeBreakdowns.includes(k)).map((key) => ('
)

with open(file_path, "w") as f: f.write(content)
print("done")
