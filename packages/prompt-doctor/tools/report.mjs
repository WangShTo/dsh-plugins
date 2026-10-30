// 命令行版体检：node tools/report.mjs
import { audit, formatReport } from '../lib/audit.mjs';
const r = audit({ limitProjects: 10 });
console.log(formatReport(r));
