import re

file_path = "src/components/ciclo-results/ResumenBoard.tsx"
with open(file_path, "r") as f: content = f.read()

# 1. Add sticky to ResumenBoardBlockProps
content = re.sub(
    r'(\s*fixed\?: boolean;)',
    r'\1\n  /** Si la pieza debe quedarse fija al hacer scroll. */\n  sticky?: boolean;',
    content
)

# 2. Extract sticky in ResumenBoardBlock map
content = re.sub(
    r'const \{ id, label, fixed, heading, hint \} = block\.props;',
    r'const { id, label, fixed, sticky, heading, hint } = block.props;',
    content
)

# 3. Apply layout={!isDragging && !isTravelling && !sticky} and sticky classes
content = re.sub(
    r'layout=\{!isDragging && !isTravelling\}',
    r'layout={!isDragging && !isTravelling && !sticky}',
    content
)

content = re.sub(
    r'className="flex min-w-0 flex-col"',
    r'className={cn("flex min-w-0 flex-col", sticky && "sticky top-4 z-40 bg-surface/95 backdrop-blur-sm shadow-sm -mx-2 px-2 py-2 rounded-xl")}',
    content
)

with open(file_path, "w") as f: f.write(content)
print("done")
