// 冒烟：翻车事件重建 + 聚类（用合成事件，不依赖本机日志）。
import { buildIncidents, cluster, redact } from '../lib/incidents.mjs';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };

const T = 1_760_000_000_000;
const events = [
  { kind: 'assistant', at: T, text: '修好了，列宽已经从左铺到右边缘 ✅' },
  { kind: 'user', at: T + 1, text: '怎么又这样了，重新改！！' },
  { kind: 'assistant', at: T + 2, text: '做好了，实测通了。' },
  { kind: 'user', at: T + 3, text: '组件创建出来为什么是空白的' },
  { kind: 'user', at: T + 4, text: 'Current runtime context 这是注入，不该算' },
];
const inc = buildIncidents(events);
ok(inc.length === 2, `识别出 ${inc.length} 次翻车（注入被剔除）`);
ok(inc[0].claim.includes('列宽'), '对上了上一句「说完成了」');
ok(inc[0].domains.includes('表格/列宽'), `领域=${inc[0].domains}`);
ok(inc[1].domains.includes('组件/小部件'), `领域=${inc[1].domains}`);
const g = cluster(inc, { min: 1 });
ok(g.length >= 2, `聚成 ${g.length} 类`);

// 脱敏：绝对路径与密钥都要变成占位符（用 String.raw 保证反斜杠原样）
const sample = String.raw`C:\Users\wst21\a.png 打开看 sk-abcdefgh12345678`;
const cleaned = redact(sample);
ok(cleaned === '<路径> 打开看 <密钥>', `脱敏结果=${JSON.stringify(cleaned)}`);
ok(!/wst21/.test(cleaned), '清掉了个人路径片段');
process.exitCode = fail ? 1 : 0;
