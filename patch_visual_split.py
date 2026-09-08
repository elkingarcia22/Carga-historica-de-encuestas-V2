import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

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
    { key: "start", percent: at(0), rawValue: start, label: "Inicio", value: formatMeasureValue(start, measure), color: "bg-text-secondary", textColor: "text-text-secondary", side: "bottom" },
    ...(min !== null ? [{ key: "min", percent: at(rawMin), rawValue: min, label: "Piso", value: formatMeasureValue(min, measure), color: "bg-destructive", textColor: "text-destructive", side: "top" }] : []),
    { key: "target", percent: at(1), rawValue: target, label: "Meta", value: formatMeasureValue(target, measure), color: "bg-primary", textColor: "text-primary", side: "bottom" },
    ...(max !== null ? [{ key: "max", percent: at(rawMax), rawValue: max, label: "Techo", value: formatMeasureValue(max, measure), color: "bg-muted-foreground", textColor: "text-muted-foreground", side: "top" }] : []),
  ];

  const COINCIDENT_VALUE_EPSILON = 1e-6;
  
  const processGroup = (groupMarkers) => {
    const consumed = new Set();
    const merged = [];
    for (const marker of groupMarkers) {
      if (consumed.has(marker.key)) continue;
      const group = groupMarkers.filter((other) => Math.abs(other.rawValue - marker.rawValue) <= COINCIDENT_VALUE_EPSILON);
      group.forEach((member) => consumed.add(member.key));
      merged.push(
        group.length === 1
          ? marker
          : {
              key: group.map((m) => m.key).join("+"),
              percent: marker.percent,
              rawValue: marker.rawValue,
              label: group.map((m) => m.label).join(" y "),
              value: marker.value,
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
    return { merged, rows, rowCount: Math.max(0, ...merged.map((m) => rows.get(m.key) ?? 0)) + 1 };
  };

  const topGroup = processGroup(markers.filter(m => m.side === "top"));
  const bottomGroup = processGroup(markers.filter(m => m.side === "bottom"));

  return (
    <figure className="flex w-full flex-col justify-center px-2 py-2">
      <div className="relative mb-2" style={{ height: `${(topGroup.rowCount === 0 ? 1 : topGroup.rowCount) * 16}px` }}>
        {topGroup.merged.map((marker) => {
          const row = topGroup.rows.get(marker.key) ?? 0;
          const anchor = marker.percent <= 15 ? "start" : marker.percent >= 85 ? "end" : "center";
          return (
            <span
              key={marker.key}
              className={cn(
                "absolute bottom-0 flex flex-col whitespace-nowrap text-[10px] font-semibold",
                anchor === "start" && "items-start",
                anchor === "end" && "items-end",
                anchor === "center" && "-translate-x-1/2 items-center",
                marker.textColor
              )}
              style={{
                ...(anchor === "start" && { left: `${marker.percent}%` }),
                ...(anchor === "end" && { right: `${100 - marker.percent}%` }),
                ...(anchor === "center" && { left: `${marker.percent}%` }),
                bottom: `${row * 16}px`,
              }}
            >
              <span>{marker.label} {marker.value}</span>
            </span>
          );
        })}
      </div>

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
      
      <div className="relative mt-2" style={{ height: `${bottomGroup.rowCount * 16}px` }}>
        {bottomGroup.merged.map((marker) => {
          const row = bottomGroup.rows.get(marker.key) ?? 0;
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
              <span>{marker.label} {marker.value}</span>
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
