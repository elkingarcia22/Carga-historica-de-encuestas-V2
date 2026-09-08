import re

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'r') as f:
    content = f.read()

# Replace the markers definition and mapping
markers_regex = re.compile(r'const markers = \[.*?\];\s*return \(\s*<figure.*?<figcaption.*?</figure>', re.DOTALL)

new_code = """const markers = [
    { key: "start", percent: at(0), color: "bg-text-secondary" },
    ...(min !== null ? [{ key: "min", percent: at(rawMin), color: "bg-destructive" }] : []),
    { key: "target", percent: at(1), color: "bg-primary" },
    ...(max !== null ? [{ key: "max", percent: at(rawMax), color: "bg-muted-foreground" }] : []),
  ];

  return (
    <figure className="flex h-10 w-full flex-col justify-center rounded-md border border-border/60 bg-surface-muted/40 px-3">
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
      
      <figcaption className="mt-1.5 flex items-center justify-between text-[9.5px] font-medium text-text-secondary">
        <div className="flex gap-2">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-text-secondary" /> Inicio</span>
          {min !== null && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-destructive" /> Piso</span>}
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" /> Meta</span>
          {max !== null && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground" /> Techo</span>}
        </div>
      </figcaption>
    </figure>"""

content = markers_regex.sub(new_code, content)

with open('src/components/ciclo-builder/ProgressRangeField.tsx', 'w') as f:
    f.write(content)
