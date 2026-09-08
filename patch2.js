const fs = require('fs');
const file = 'src/components/ciclo-builder/MeasureTypePicker.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<motion\.div[\s\S]*?<\/motion\.div>/;
const replacement = `<motion.div
            key={previewed}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-surface-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-[12.5px] leading-snug">
              <span className="font-semibold text-text-primary">{meta.what}</span>{" "}
              <span className="text-text-secondary">{meta.when}</span>
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <span className="hidden text-[11px] font-medium text-muted-foreground xl:inline-block">
                Ej:
              </span>
              {meta.examples.map((example) => (
                <span
                  key={example}
                  className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  {example}
                </span>
              ))}
            </div>
          </motion.div>`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
