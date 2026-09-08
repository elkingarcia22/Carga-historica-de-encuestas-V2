import re

with open('src/components/ciclo-builder/CicloBuilderRail.tsx', 'r') as f:
    content = f.read()

# 1. Add state for Popover
# We will insert it after: const [stepChangeKey, setStepChangeKey] = React.useState(0);
state_injection = r"""  const \[stepChangeKey, setStepChangeKey\] = React.useState\(0\);"""
state_replacement = """  const [stepChangeKey, setStepChangeKey] = React.useState(0);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);"""

content = re.sub(state_injection, state_replacement, content)

# 2. Add open/onOpenChange to Popover
popover_injection = r"""<Popover>
                        <PopoverTrigger asChild>"""
popover_replacement = """<Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                        <PopoverTrigger asChild>"""
content = re.sub(popover_injection, popover_replacement, content)

# 3. Modify onClick handlers inside the Popover
button_ai_injection = r"""onClick=\{onAddObjectiveAi\}"""
button_ai_replacement = """onClick={() => { setAddMenuOpen(false); onAddObjectiveAi(); }}"""
# Only replace the one inside the popover (first match should be line 256, but let's replace all inside the popover)
# Wait, `onAddObjectiveAi` is only passed to that button anyway! So a global replace is fine.
content = content.replace("onClick={onAddObjectiveAi}", "onClick={() => { setAddMenuOpen(false); onAddObjectiveAi(); }}")

button_manual_injection = r"""onClick=\{onAddObjective\}
                              className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2\.5 text-left transition-colors hover:bg-white/5" """
button_manual_replacement = """onClick={() => { setAddMenuOpen(false); onAddObjective(); }}
                              className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5" """
content = re.sub(button_manual_injection, button_manual_replacement, content)

with open('src/components/ciclo-builder/CicloBuilderRail.tsx', 'w') as f:
    f.write(content)
