with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "r") as f:
    content = f.read()

import re

old_count_picker = re.search(r'export function CountPicker.*?return \(\s*<div className="flex flex-wrap items-center gap-4">.*?</div>\s*\);\s*}', content, re.DOTALL)

new_count_picker = """export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  // If value is null, treat it as 0.
  const numericValue = value ?? 0;

  const handleDecrease = () => {
    if (numericValue > 0) {
      onChange(numericValue - 1);
    }
  };

  const handleIncrease = () => {
    if (max === undefined || numericValue < max) {
      onChange(numericValue + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      onChange(0);
      return;
    }
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      const boundedVal = max !== undefined ? Math.min(Math.max(0, val), max) : Math.max(0, val);
      onChange(boundedVal);
    }
  };

  return (
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
        value={numericValue === 0 && value === null ? "" : numericValue}
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
  );
}"""

content = content.replace(old_count_picker.group(0), new_count_picker)

with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "w") as f:
    f.write(content)
