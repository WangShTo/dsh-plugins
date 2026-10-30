// 冒烟：client 半的静态约束（不注册对话页 UI，只注册顶栏入口 + 整页 + 命令）。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
const src = readFileSync('client.js', 'utf8');

ok(!src.includes('conversation.composer.dock'), '不再占用输入框上方');
ok(src.includes('conversation.header'), '注册了顶栏入口');
ok(src.includes('shell.overlay'), '注册了整页');
ok(src.includes('commandUi') && src.includes('tijian'), '注册了斜杠命令');
ok(!/https?:\/\//.test(src), '没有外链请求（纯本地渲染）');
try { execFileSync(process.execPath, ['--check', 'client.js']); ok(true, '语法检查通过'); } catch { ok(false, '语法检查'); }
process.exitCode = fail ? 1 : 0;
