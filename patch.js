const fs = require('fs');
const file = 'src/components/ciclo-builder/CicloStepsPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// Change items-start to items-center
content = content.replace('w-full items-start gap-3', 'w-full items-center gap-3');

// Remove the hint span
const hintSpanRegex = /<span\s+className=\{cn\(\s*"truncate text-\[11\.5px\] leading-snug",\s*state === "locked" \? "text-muted-foreground\/50" : "text-text-secondary"\s*\)\}\s*>\s*\{CICLO_STEP_HINTS\[step\]\}\s*<\/span>/g;
content = content.replace(hintSpanRegex, '');

fs.writeFileSync(file, content);
