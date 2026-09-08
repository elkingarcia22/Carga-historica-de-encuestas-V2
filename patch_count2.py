with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "r") as f:
    content = f.read()

old_count_picker = """export function CountPicker({
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

new_count_picker = """export function CountPicker({
  value,
  onChange,
  max,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  const [localValue, setLocalValue] = React.useState(1);
  const isConfirmed = value !== null;
  const displayValue = isConfirmed ? value : localValue;

  const handleDecrease = () => {
    if (displayValue > 1) {
      if (isConfirmed) onChange(displayValue - 1);
      else setLocalValue(displayValue - 1);
    }
  };

  const handleIncrease = () => {
    if (max === undefined || displayValue < max) {
      if (isConfirmed) onChange(displayValue + 1);
      else setLocalValue(displayValue + 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleDecrease}
          disabled={displayValue <= 1}
          className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Minus className="size-4" strokeWidth={2.5} />
        </button>
        
        <span className="min-w-[1.5rem] text-center text-[18px] font-semibold text-text-primary tabular-nums">
          {displayValue}
        </span>
        
        <button
          type="button"
          onClick={handleIncrease}
          disabled={max !== undefined && displayValue >= max}
          className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-all hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      {!isConfirmed && (
        <button
          type="button"
          onClick={() => onChange(localValue)}
          className="rounded-lg bg-primary px-4 py-2 h-10 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 transition-all"
        >
          Continuar
        </button>
      )}
    </div>
  );
}"""

content = content.replace(old_count_picker, new_count_picker)

with open("src/components/ciclo-builder/AiObjectiveControls.tsx", "w") as f:
    f.write(content)
