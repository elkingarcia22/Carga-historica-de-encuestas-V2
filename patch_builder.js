const fs = require('fs');
const file = 'src/screens/CicloBuilder.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'assignment: { mode: null, groupIds: [], userIds: [] },',
  'assignment: { modes: [], groupSegmentBy: "area", groupIds: [], groupsAutoInclude: false, userIds: [] },'
);

fs.writeFileSync(file, code);
