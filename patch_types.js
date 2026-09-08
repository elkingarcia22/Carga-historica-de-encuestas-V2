const fs = require('fs');
const file = 'src/components/ciclo-builder/cicloBuilderTypes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'import type { ParticipantsSelection } from "@/components/survey-builder";',
  'import type { ParticipantsSelection, SegmentKey } from "@/components/survey-builder";'
);

code = code.replace(
  /export interface CicloAssignment \{[\s\S]*?\}/,
  `export interface CicloAssignment {
  modes: readonly AssignmentMode[];
  groupSegmentBy: SegmentKey;
  groupIds: readonly string[];
  groupsAutoInclude: boolean;
  userIds: readonly string[];
}`
);

fs.writeFileSync(file, code);
