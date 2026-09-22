import os
import re

target_dir = "/Users/ub-col-pro-lf4/Documents/configuración objetivos/src/components/ciclo-builder"
table_file = os.path.join(target_dir, "AssignmentRowsTable.tsx")

with open(table_file, 'r') as f:
    table_code = f.read()

# Add X import
if "import { Search, X } from" not in table_code:
    table_code = table_code.replace('import { Search } from "lucide-react";', 'import { Search, X } from "lucide-react";')

# Add state and ref
state_setup = """  const [query, setQuery] = React.useState("");
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = React.useState<AssignmentSortKey | null>(null);"""

table_code = re.sub(r'  const \[query, setQuery\] = React.useState\(""\);\n  const \[sortKey, setSortKey\] = React.useState<AssignmentSortKey \| null>\(null\);', state_setup, table_code)

# Replace the search UI
search_ui = """      <div className="flex items-center justify-end gap-3">
        <div
          className={cn(
            "relative flex h-9 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-lg border bg-surface",
            (isSearchExpanded || query !== "")
              ? "w-[300px] border-primary/50 ring-1 ring-primary/15"
              : "w-9 border-border hover:bg-border/50 cursor-pointer"
          )}
          onClick={() => {
            if (!isSearchExpanded && query === "") {
              setIsSearchExpanded(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget) && query === "") {
              setIsSearchExpanded(false);
            }
          }}
        >
          <div
            className={cn(
              "absolute left-0 -ml-px -mt-px flex h-9 w-9 items-center justify-center transition-colors",
              (isSearchExpanded || query !== "") ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Search className="h-4 w-4 translate-x-[0.667px] translate-y-[0.667px]" strokeWidth={2} />
          </div>
          
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${noun}...`}
            aria-label={`Buscar ${noun}`}
            className={cn(
              "h-full w-[300px] bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70",
              (isSearchExpanded || query !== "") ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <TableConfigButton config={config} noun={noun} />
      </div>"""

# Remove old search UI (using regex)
old_ui_pattern = re.compile(r'<div className="flex items-center justify-between">\s*<div className="relative w-72">\s*<Search.*?</Input>\s*</div>\s*<TableConfigButton config={config} noun={noun} />\s*</div>', re.DOTALL)
table_code = old_ui_pattern.sub(search_ui, table_code)

with open(table_file, 'w') as f:
    f.write(table_code)

