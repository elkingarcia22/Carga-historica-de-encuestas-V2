import re

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I want to restore the className for that wrapper if it's missing.
# Let's search for:
#                 <motion.div variants={cascadeItem}>
#                   <div className="space-y-3 pb-4">
# And replace with:
#                 <motion.div variants={cascadeItem}>
#                   <div className="space-y-3 pb-4">
# Wait, let's just make it simpler.
content = content.replace("                <motion.div variants={cascadeItem}>\n\n                  <div className=\"space-y-3 pb-4\">", "                <motion.div variants={cascadeItem}>\n                  <div className=\"space-y-3 pb-4\">")

with open("src/components/objetivos/ObjetivosConfigDrawer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
