import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# We need to restore the full RangeVisual function with collision logic.
# Wait, I can just replace the entire RangeVisual with the new version.

new_range_visual = """function RangeVisual({
  measure,
  isIncrease,
  start,
  isDerivedStart,
  target,
  min,
  max,
}: {
  measure: MeasureType;
  isIncrease: boolean;
  start: number;
  isDerivedStart: boolean;
  target: number;
  min: number | null;
  max: number | null;
}) {
  const span = target - start;
  const progressOf = (value: number) => (value - start) / span;

  const rawMin = min === null ? 0 : progressOf(min);
  const rawMax = max === null ? 1 : progressOf(max);
  const domain = Math.max(1, rawMax, rawMin) * 1.06;
  const at = (progress: number) => Math.max(0, Math.min(1, progress / domain)) * 100;

  const floor = Math.max(0, Math.min(rawMin, 1));
  const ceiling = Math.max(floor, rawMax);

  const markers = [
    { key: "start", percent: at(0), rawValue: start, label: "Inicio", color: "bg-text-secondary", textColor: "text-text-secondary" },
    ...(min !== null ? [{ key: "min", percent: at(rawMin), rawValue: min, label: "Piso", color: "bg-destructive", textColor: "text-destructive" }] : []),
    { key: "target", percent: at(1), rawValue: target, label: "Meta", color: "bg-primary", textColor: "text-primary" },
    ...(max !== null ? [{ key: "max", percent: at(rawMax), rawValue: max, label: "Techo", color: "bg-muted-foreground", textColor: "text-muted-foreground" }] : []),
  ];

  const COINCIDENT_VALUE_EPSILON = 1e-6;
  const consumed = new Set<string>();
  const merged = [];

  for (const marker of markers) {
    if (consumed.has(marker.key)) continue;
    const group = markers.filter((other) => Math.abs(other.rawValue - marker.rawValue) <= COINCIDENT_VALUE_EPSILON);
    group.forEach((member) => consumed.add(member.key));
    merged.push(
      group.length === 1
        ? marker
        : {
            key: group.map((m) => m.key).join("+"),
            percent: marker.percent,
            rawValue: marker.rawValue,
            label: group.map((m) => m.label).join(" y "),
            color: group.some((m) => m.key === "target") ? "bg-primary" : marker.color,
            textColor: group.some((m) => m.key === "target") ? "text-primary" : marker.textColor,
          }
    );
  }

  const ordered = [...merged].sort((a, b) => a.percent - b.percent);
  const rowEnds = [];
  const rows = new Map();
  const LABEL_COLLISION_GAP = 15;

  for (const marker of ordered) {
    let row = rowEnds.findIndex((lastPercent) => marker.percent - lastPercent >= LABEL_COLLISION_GAP);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(marker.percent);
    } else {
      rowEnds[row] = marker.percent;
    }
    rows.set(marker.key, row);
  }
  
  const rowCount = Math.max(0, ...merged.map((m) => rows.get(m.key) ?? 0)) + 1;

  return (
    <figure className="flex w-full flex-col justify-center px-2 pt-2">
      <div className="relative h-2 w-full rounded-full bg-border/60">
        {min !== null && (
          <span
            className="absolute inset-y-0 left-0 rounded-l-full bg-destructive/25"
            style={{ width: `${floor}%` }}
          />
        )}
        <span
          className="absolute inset-y-0 bg-primary/70"
          style={{ left: `${floor}%`, width: `${ceiling - floor}%` }}
        />
        {max !== null && (
          <span
            className="absolute inset-y-0 right-0 rounded-r-full bg-border-strong/40"
            style={{ left: `${ceiling}%` }}
          />
        )}

        {markers.map((marker) => (
          <span
            key={marker.key}
            aria-hidden
            className={cn(
              "absolute top-1/2 block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface",
              marker.color
            )}
            style={{ left: `${marker.percent}%` }}
          />
        ))}
      </div>
      
      <div className="relative mt-2" style={{ height: `${rowCount * 16}px` }}>
        {merged.map((marker) => {
          const row = rows.get(marker.key) ?? 0;
          const anchor = marker.percent <= 15 ? "start" : marker.percent >= 85 ? "end" : "center";
          return (
            <span
              key={marker.key}
              className={cn(
                "absolute top-0 flex flex-col whitespace-nowrap text-[10px] font-semibold",
                anchor === "start" && "items-start",
                anchor === "end" && "items-end",
                anchor === "center" && "-translate-x-1/2 items-center",
                marker.textColor
              )}
              style={{
                ...(anchor === "start" && { left: `${marker.percent}%` }),
                ...(anchor === "end" && { right: `${100 - marker.percent}%` }),
                ...(anchor === "center" && { left: `${marker.percent}%` }),
                top: `${row * 16}px`,
              }}
            >
              {marker.label}
            </span>
          );
        })}
      </div>
    </figure>
  );
}"""

range_visual_regex = re.compile(r'function RangeVisual\(\{.*?\}\) \{.*?return \(.*?</figure>\s*\);\s*\}', re.DOTALL)
content = range_visual_regex.sub(new_range_visual, content)

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'w') as f:
    f.write(content)
