import re

with open("src/components/survey-builder/ParticipantsEditor.tsx", "r") as f:
    content = f.read()

# Remove autoInclude from GroupsPanel definition
groups_panel_def_old = """export function GroupsPanel({
  segmentBy,
  onSegmentByChange,
  selectedGroups,
  onToggleGroup,
  onSelectAll,
  onClearAll,
  autoInclude,
  onAutoIncludeChange,
  onSelectionChange,
  copy,
}: {
  segmentBy: SegmentKey;
  onSegmentByChange: (value: SegmentKey) => void;
  selectedGroups: readonly string[];
  onToggleGroup: (value: string) => void;
  onSelectAll: (values: readonly string[]) => void;
  onClearAll: () => void;
  autoInclude: boolean;
  onAutoIncludeChange: (value: boolean) => void;
  onSelectionChange?: (count: number, actions: TableSelectionActions) => void;
  /** Overrides for the two lines that name what the groups are being picked
   * for. The panel is shared with the ciclo builder, where nobody is being
   * invited to a survey. */
  copy?: { autoInclude?: string; lead?: string };
}) {"""

groups_panel_def_new = """export function GroupsPanel({
  segmentBy,
  onSegmentByChange,
  selectedGroups,
  onToggleGroup,
  onSelectAll,
  onClearAll,
  onSelectionChange,
  copy,
}: {
  segmentBy: SegmentKey;
  onSegmentByChange: (value: SegmentKey) => void;
  selectedGroups: readonly string[];
  onToggleGroup: (value: string) => void;
  onSelectAll: (values: readonly string[]) => void;
  onClearAll: () => void;
  onSelectionChange?: (count: number, actions: TableSelectionActions) => void;
  /** Overrides for the two lines that name what the groups are being picked
   * for. The panel is shared with the ciclo builder, where nobody is being
   * invited to a survey. */
  copy?: { lead?: string };
}) {"""

content = content.replace(groups_panel_def_old, groups_panel_def_new)

# Also remove autoInclude from CompanySummary definition
company_summary_def_old = """function CompanySummary({
  autoInclude,
  onAutoIncludeChange,
}: {
  autoInclude: boolean;
  onAutoIncludeChange: (value: boolean) => void;
}) {"""

company_summary_def_new = """function CompanySummary() {"""

content = content.replace(company_summary_def_old, company_summary_def_new)

# In ParticipantsEditor.tsx, it renders <CompanySummary autoInclude=... />
content = content.replace("""        {participants.mode === "company" && (
          <CompanySummary
            autoInclude={participants.companyAutoInclude}
            onAutoIncludeChange={(companyAutoInclude) => onChange({ companyAutoInclude })}
          />
        )}""", """        {participants.mode === "company" && (
          <CompanySummary />
        )}""")

# In ParticipantsEditor.tsx, it renders <GroupsPanel autoInclude=... />
groups_panel_use_old = """        {participants.mode === "groups" && (
          <GroupsPanel
            segmentBy={participants.groupSegmentBy}
            onSegmentByChange={(groupSegmentBy) => onChange({ groupSegmentBy, ...clearedGroupSelection() })}
            selectedGroups={participants.selectedGroups}
            onToggleGroup={(value) => {
              onChange(
                participants.selectedGroups.includes(value)
                  ? withGroupDeselected(participants, value)
                  : { selectedGroups: [...participants.selectedGroups, value] }
              );
            }}
            onSelectAll={(values) => onChange({ selectedGroups: values })}
            onClearAll={() => onChange(clearedGroupSelection())}
            autoInclude={participants.groupsAutoInclude}
            onAutoIncludeChange={(groupsAutoInclude) => onChange({ groupsAutoInclude })}
            onSelectionChange={onSelectionChange}
          />
        )}"""

groups_panel_use_new = """        {participants.mode === "groups" && (
          <GroupsPanel
            segmentBy={participants.groupSegmentBy}
            onSegmentByChange={(groupSegmentBy) => onChange({ groupSegmentBy, ...clearedGroupSelection() })}
            selectedGroups={participants.selectedGroups}
            onToggleGroup={(value) => {
              onChange(
                participants.selectedGroups.includes(value)
                  ? withGroupDeselected(participants, value)
                  : { selectedGroups: [...participants.selectedGroups, value] }
              );
            }}
            onSelectAll={(values) => onChange({ selectedGroups: values })}
            onClearAll={() => onChange(clearedGroupSelection())}
            onSelectionChange={onSelectionChange}
          />
        )}"""

content = content.replace(groups_panel_use_old, groups_panel_use_new)

with open("src/components/survey-builder/ParticipantsEditor.tsx", "w") as f:
    f.write(content)
