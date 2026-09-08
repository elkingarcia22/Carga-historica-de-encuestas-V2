const fs = require('fs');
const file = 'src/components/ciclo-builder/ProgressRangeField.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldHeader = `<div className="flex items-start gap-3 px-4 py-3.5">
        <Switch
          id="range-toggle"
          checked={enabled}
          onCheckedChange={(checked) => onChange({ rangeEnabled: checked })}
          aria-label="Activar mínimos y máximos de avance"
          className="mt-0.5"
        />
        <label htmlFor="range-toggle" className="min-w-0 flex-1 cursor-pointer">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
            <Gauge className="size-3.5 text-text-secondary" strokeWidth={2} />
            Activar mínimos y máximos de avance
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              Opcional
            </span>
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-text-secondary">
            El avance será 0 % antes del piso y dejará de sumar al llegar al techo. Sin esto, el cálculo es libre.
          </span>
        </label>
      </div>`;

const newHeader = `<div className="flex items-center gap-3 px-4 py-3.5">
        <Switch
          id="range-toggle"
          checked={enabled}
          onCheckedChange={(checked) => onChange({ rangeEnabled: checked })}
          aria-label="Activar mínimos y máximos de avance"
        />
        <label htmlFor="range-toggle" className="min-w-0 flex-1 cursor-pointer">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
            <Gauge className="size-3.5 text-text-secondary" strokeWidth={2} />
            Activar mínimos y máximos de avance
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              Opcional
            </span>
          </span>
        </label>
      </div>`;

content = content.replace(oldHeader, newHeader);
fs.writeFileSync(file, content);
