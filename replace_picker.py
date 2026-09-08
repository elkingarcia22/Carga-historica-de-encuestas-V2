with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "r") as f:
    content = f.read()

import re

old_count_picker = re.search(r'export function CountPicker.*?return \(\s*<div className="flex flex-wrap items-center gap-4">.*?</div>\s*\);\s*}', content, re.DOTALL)

if not old_count_picker:
    print("Could not find old count picker")
    exit(1)

new_count_picker = """export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  const [localValue, setLocalValue] = React.useState<number | "">(0);
  const isConfirmed = value !== null;
  const displayValue = isConfirmed ? (value ?? 0) : localValue;

  const numericValue = typeof displayValue === "number" ? displayValue : 0;

  const handleDecrease = () => {
    if (numericValue > 0) {
      if (isConfirmed) onChange(numericValue - 1);
      else setLocalValue(numericValue - 1);
    }
  };

  const handleIncrease = () => {
    if (max === undefined || numericValue < max) {
      if (isConfirmed) onChange(numericValue + 1);
      else setLocalValue(numericValue + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      if (isConfirmed) onChange(0);
      else setLocalValue("");
      return;
    }
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      const boundedVal = max !== undefined ? Math.min(Math.max(0, val), max) : Math.max(0, val);
      if (isConfirmed) onChange(boundedVal);
      else setLocalValue(boundedVal);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrease}
          disabled={numericValue <= 0}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Minus className="size-4" strokeWidth={2.5} />
        </button>
        
        <input
          type="number"
          min={0}
          max={max}
          value={displayValue}
          onChange={handleInputChange}
          className="w-14 text-center h-10 rounded-xl border-transparent bg-transparent px-1 text-[18px] font-semibold text-text-primary tabular-nums outline-none transition-colors focus:border-border focus:bg-surface focus:ring-2 focus:ring-primary/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        
        <button
          type="button"
          onClick={handleIncrease}
          disabled={max !== undefined && numericValue >= max}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      {!isConfirmed && (
        <button
          type="button"
          onClick={() => onChange(numericValue > 0 ? numericValue : 1)}
          disabled={numericValue <= 0}
          className="rounded-lg bg-primary px-4 py-2 h-10 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          Continuar
        </button>
      )}
    </div>
  );
}"""

content = content.replace(old_count_picker.group(0), new_count_picker)

with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "w") as f:
    f.write(content)
