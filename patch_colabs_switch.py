import re

file_path = "src/components/ciclo-results/ColaboradoresTab.tsx"
with open(file_path, "r") as f: content = f.read()

# 1. Update ColaboradoresView type
content = re.sub(
    r'export type ColaboradoresView = "detalle" \| "alineacion";',
    r'export type ColaboradoresView = "persona" | "grupos" | "alineacion";',
    content
)

# 2. Add an import for Folders icon (for Grupos)
content = re.sub(
    r'import \{ Compass, Users \} from "lucide-react";',
    r'import { Compass, Users, FolderTree } from "lucide-react";',
    content
)

# 3. Update the TabsList in ColaboradoresViewSwitch
tabs_list_old = r"""      <TabsList>
        <TabsTrigger value="detalle">
          <Users className="h-3.5 w-3.5" />
          Colaboradores
        </TabsTrigger>
        <TabsTrigger value="alineacion">
          <Compass className="h-3.5 w-3.5" />
          Alineación estratégica
        </TabsTrigger>
      </TabsList>"""

tabs_list_new = """      <TabsList>
        <TabsTrigger value="persona">
          <Users className="h-3.5 w-3.5" />
          Por persona
        </TabsTrigger>
        <TabsTrigger value="grupos">
          <FolderTree className="h-3.5 w-3.5" />
          Grupos
        </TabsTrigger>
        <TabsTrigger value="alineacion">
          <Compass className="h-3.5 w-3.5" />
          Alineación estratégica
        </TabsTrigger>
      </TabsList>"""

content = content.replace(tabs_list_old, tabs_list_new)

with open(file_path, "w") as f: f.write(content)
print("done")
