const fs = require('fs');
const file = 'src/components/ciclo-builder/ObjectiveCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import Switch
if (!content.includes('import { Switch }')) {
  content = content.replace('import { cn } from "@/lib/utils";', 'import { cn } from "@/lib/utils";\nimport { Switch } from "@/components/ui/switch";');
}

// 2. Add state for showDescription
if (!content.includes('const [showDescription')) {
  content = content.replace('const descriptionRef = React.useRef<HTMLTextAreaElement>(null);', 'const descriptionRef = React.useRef<HTMLTextAreaElement>(null);\n  const [showDescription, setShowDescription] = React.useState(!!objective.description);');
}

// 3. Header textarea
const headerTextarea = `<textarea
            ref={descriptionRef}
            value={objective.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Descripción (opcional): contexto, cómo se va a medir, de dónde sale el dato."
            aria-label="Descripción del objetivo"
            rows={1}
            className="mt-0.5 w-full resize-none overflow-hidden rounded-lg bg-transparent px-1.5 py-0.5 text-[13px] font-medium leading-relaxed text-muted-foreground/90 outline-none transition-colors hover:bg-border/30 focus:bg-border/40 placeholder:text-muted-foreground/50"
          />`;
const headerTextareaReplacement = `{showDescription && (
          <textarea
            ref={descriptionRef}
            value={objective.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Descripción: contexto, cómo se va a medir, de dónde sale el dato."
            aria-label="Descripción del objetivo"
            rows={1}
            className="mt-0.5 w-full resize-none overflow-hidden rounded-lg bg-transparent px-1.5 py-0.5 text-[13px] font-medium leading-relaxed text-muted-foreground/90 outline-none transition-colors hover:bg-border/30 focus:bg-border/40 placeholder:text-muted-foreground/50"
          />
          )}`;
content = content.replace(headerTextarea, headerTextareaReplacement);

// 4. Step 1 layout
const step1Input = `<input
                    value={objective.title}
                    onChange={(event) =>
                      onChange({ title: event.target.value.slice(0, MAX_TITLE_LENGTH) })
                    }
                    placeholder="Por ejemplo: Aumentar las ventas del canal digital"
                    aria-label="Título del objetivo"
                    aria-invalid={showValidation && objective.title.trim() === ""}
                    className={cn(
                      "h-10 w-full rounded-md border bg-surface px-3 text-[13px] text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
                      showValidation && objective.title.trim() === ""
                        ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                        : "border-border focus:border-primary focus:ring-primary/25"
                    )}
                  />`;
const step1InputReplacement = `<div className="flex items-center gap-3">
                  <input
                    value={objective.title}
                    onChange={(event) =>
                      onChange({ title: event.target.value.slice(0, MAX_TITLE_LENGTH) })
                    }
                    placeholder="Por ejemplo: Aumentar las ventas del canal digital"
                    aria-label="Título del objetivo"
                    aria-invalid={showValidation && objective.title.trim() === ""}
                    className={cn(
                      "flex-1 h-10 min-w-0 rounded-md border bg-surface px-3 text-[13px] text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
                      showValidation && objective.title.trim() === ""
                        ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                        : "border-border focus:border-primary focus:ring-primary/25"
                    )}
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
                    <span>Añadir descripción</span>
                    <Switch
                      checked={showDescription}
                      onCheckedChange={(checked) => {
                        setShowDescription(checked);
                        if (!checked && objective.description) {
                          onChange({ description: "" });
                        }
                      }}
                      className="data-[state=checked]:bg-status-positive"
                    />
                  </label>
                  </div>`;
content = content.replace(step1Input, step1InputReplacement);

const step1Textarea = `<textarea
                    value={objective.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    rows={2}
                    placeholder="Descripción (opcional): contexto, cómo se va a medir, de dónde sale el dato."
                    aria-label="Descripción del objetivo"
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
                  />`;
const step1TextareaReplacement = `{showDescription && (
                  <textarea
                    value={objective.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    rows={2}
                    placeholder="Descripción: contexto, cómo se va a medir, de dónde sale el dato."
                    aria-label="Descripción del objetivo"
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
                  />
                  )}`;
content = content.replace(step1Textarea, step1TextareaReplacement);

fs.writeFileSync(file, content);
