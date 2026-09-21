import re

file_path = "src/components/ciclo-results/GruposTab.tsx"
with open(file_path, "r") as f: content = f.read()

content = content.replace("results.config.estados", "results.estados")
content = content.replace("results.config.niveles", "results.niveles")
content = content.replace("results.config", "results") # catch any remaining config properties? wait, let's just do explicit replaces.

with open(file_path, "w") as f: f.write(content)
print("done")
