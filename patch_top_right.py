import re

with open("src/components/ciclo-builder/CicloGeneralEditor.tsx", "r") as f:
    content = f.read()

old_card = """                <MagicCard
                  key={option}
                  isSelected={isSelected}
                  onClick={() => applyPeriod(option)}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-[64px] p-3",
                    periodError && !isSelected && "border-destructive/40"
                  )}
                  contentClassName="flex flex-row items-center gap-3 h-full text-left"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-input dark:bg-input/30"
                    )}
                  >
                    {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                  </span>

                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-[12.5px] font-semibold leading-tight",
                        isSelected ? "text-primary" : "text-text-primary group-hover:text-primary/80"
                      )}
                    >
                      {CICLO_PERIOD_LABELS[option]}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium leading-tight",
                        isSelected ? "text-primary/80" : "text-muted-foreground"
                      )}
                    >
                      {Value}
                    </span>
                  </div>
                </MagicCard>"""

new_card = """                <MagicCard
                  key={option}
                  isSelected={isSelected}
                  onClick={() => applyPeriod(option)}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-[64px] p-2",
                    periodError && !isSelected && "border-destructive/40"
                  )}
                  contentClassName="relative flex flex-col items-center justify-center gap-1 h-full text-center w-full"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 right-0 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-input dark:bg-input/30"
                    )}
                  >
                    {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                  </span>

                  <span
                    className={cn(
                      "text-[12.5px] font-semibold leading-tight mt-1",
                      isSelected ? "text-primary" : "text-text-primary group-hover:text-primary/80"
                    )}
                  >
                    {CICLO_PERIOD_LABELS[option]}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      isSelected ? "text-primary/80" : "text-muted-foreground"
                    )}
                  >
                    {Value}
                  </span>
                </MagicCard>"""

content = content.replace(old_card, new_card)

with open("src/components/ciclo-builder/CicloGeneralEditor.tsx", "w") as f:
    f.write(content)
