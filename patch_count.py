with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "r") as f:
    content = f.read()

# Add Minus to imports
if "Minus," not in content:
    content = content.replace("Plus,", "Minus,\n  Plus,")

old_count_picker = """export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  return (
    <input
      type="number"
      min={1}
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "") {
          onChange(null);
          return;
        }
        const val = parseInt(event.target.value, 10);
        if (!isNaN(val) && val > 0) onChange(val);
      }}
      placeholder="Ej: 5"
      className="h-10 w-full max-w-[200px] rounded-lg border border-border bg-surface px-3 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
    />
  );
}"""

new_count_picker = """export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  const currentValue = value ?? 1;

  const handleDecrease = () => {
    if (currentValue > 1) {
      onChange(currentValue - 1);
    }
  };

  const handleIncrease = () => {
    if (max === undefined || currentValue < max) {
      onChange(currentValue + 1);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handleDecrease}
        disabled={currentValue <= 1}
        className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      
      <span className="min-w-[1.5rem] text-center text-[18px] font-semibold text-text-primary tabular-nums">
        {currentValue}
      </span>
      
      <button
        type="button"
        onClick={handleIncrease}
        disabled={max !== undefined && currentValue >= max}
        className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}"""

content = content.replace(old_count_picker, new_count_picker)

with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "w") as f:
    f.write(content)
