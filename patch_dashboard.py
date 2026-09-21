import re

file_path = "src/screens/ObjetivosDashboard.tsx"
with open(file_path, "r") as f: content = f.read()

# Create a no-transform cascade item
new_variant = """
const cascadeItemNoTransform = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};
"""

content = re.sub(
    r'(const PAGE_SIZES = \[10, 25, 50\] as const;)',
    r'\1\n' + new_variant,
    content
)

# Apply it only to the table containers
content = re.sub(
    r'(<motion\.div variants=\{)cascadeItem(\} className="flex-1 min-h-0 flex flex-col border-y border-border/60">)',
    r'\1cascadeItemNoTransform\2',
    content
)

# Wait! The parent `motion.div` ALSO has `cascadeContainer`, which doesn't set `transform`. BUT does it?
# cascadeContainer has `hidden: {}, show: { transition: ... }`. No transform.

# But wait, what if the PARENT is animated in `App.tsx`?
# In App.tsx: `<div key={...} className="contents">` - no animation there.

with open(file_path, "w") as f: f.write(content)
print("done")
