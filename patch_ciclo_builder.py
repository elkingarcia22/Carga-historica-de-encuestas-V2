import re

with open('src/screens/CicloBuilder.tsx', 'r') as f:
    content = f.read()

# Replace the conditional logic
old_logic = r"""const onAddObjectiveAi =
    activeStep === "company"
      \? draft\.useCompanyObjectives
        \? \(\) => setCompanyComposerMode\(draft\.companyObjectives\.length === 0 \? "set" : "single"\)
        : null
      : activeStep === "objectives"
        \? \(\) => setAssignedComposerMode\(draft\.objectives\.length === 0 \? "set" : "single"\)
        : null;"""

new_logic = """const onAddObjectiveAi =
    activeStep === "company"
      ? draft.useCompanyObjectives
        ? () => setCompanyComposerMode("set")
        : null
      : activeStep === "objectives"
        ? () => setAssignedComposerMode("set")
        : null;"""

content = re.sub(old_logic, new_logic, content)

with open('src/screens/CicloBuilder.tsx', 'w') as f:
    f.write(content)
