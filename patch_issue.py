import re

with open('src/components/ciclo-builder/cicloBuilderTypes.ts', 'r') as f:
    content = f.read()

issue_fn_regex = re.compile(r'export function objectiveIssue\(.*?\) \{.*?return null;\n\}', re.DOTALL)
new_issue_fn = """export function objectiveIssue(objective: Objective, options: { requireWeight: boolean }): string | null {
  if (
    objective.title.trim() === "" ||
    objective.measure === null ||
    (objective.measure !== "boolean" && objective.direction === null) ||
    (objective.measure !== "boolean" && parseAmount(objective.targetValue) === null)
  ) {
    return "Faltan campos obligatorios";
  }

  if (objective.measure !== "boolean") {
    const target = parseAmount(objective.targetValue);
    const initial = parseAmount(objective.initialValue);
    const blocking = trackBlockingIssue(objective.direction, target!, initial);
    if (blocking !== null) return blocking;
  }

  if (options.requireWeight && objective.weight < MIN_OBJECTIVE_WEIGHT) {
    return `El peso no puede ser inferior al ${MIN_OBJECTIVE_WEIGHT} %`;
  }

  return null;
}"""

content = issue_fn_regex.sub(new_issue_fn, content)

with open('src/components/ciclo-builder/cicloBuilderTypes.ts', 'w') as f:
    f.write(content)
