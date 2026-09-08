import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# 1. Add Tooltip imports if not there
if "TooltipProvider" not in content:
    content = content.replace(
        'import { Switch } from "@/components/ui/switch";',
        'import { Switch } from "@/components/ui/switch";\nimport { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";\nimport { Info } from "lucide-react";'
    )

# 2. Update the layout grid to be 3 flex-1 columns
layout_regex = re.compile(r'<div className="grid gap-3 sm:grid-cols-2">.*?<RangeInput[\s\S]*?/>\s*</div>', re.DOTALL)
content = re.sub(
    r'<div className="grid gap-3 sm:grid-cols-2">([\s\S]*?)</div>\s*\{startLine !== null.*?<RangeVisual([\s\S]*?)/>\s*\)',
    r'''<TooltipProvider delayDuration={200}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">\1</div> <!-- Wait, the \1 contains two RangeInputs! We need to split them -->''',
    content
)
# Let's do it manually since regex is tricky for this.
