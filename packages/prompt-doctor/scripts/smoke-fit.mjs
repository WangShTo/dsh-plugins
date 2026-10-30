// 冒烟：规则生成 + 托管块写入（只动块内，可撤销）。
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveRules, renderBlock } from '../lib/fit.mjs';
import { applyBlock, removeBlock, BEGIN, END } from '../lib/agents.mjs';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };

const rules = deriveRules({ totalChars: 20000, median: 31, rates: { reference: 32, rework: 13, gate: 15, emotion: 30, tiny: 25, accept: 13 }, topProjects: [{ dir: 'x', n: 64 }] });
ok(rules.length >= 4, `生成 ${rules.length} 条规则`);
ok(rules.every((r) => r.title && r.line && r.why), '每条都有标题、规则、依据');

const block = renderBlock(rules, { date: '2026-10-30 08:00' });
ok(!block.includes('<!--'), '正文不带标记（标记由 applyBlock 包）');

const dir = mkdtempSync(join(tmpdir(), 'pd-fit-'));
const target = join(dir, 'AGENTS.md');
writeFileSync(target, '# 手写的\n\n不要动这一行。\n');
const r1 = applyBlock(block, { target });
const after = readFileSync(target, 'utf8');
ok(r1.changed && after.includes('不要动这一行'), '写入后手写内容仍在');
ok(after.includes(BEGIN) && after.includes(END), '写入后带托管标记');
ok(after.split(BEGIN).length === 2, '块只出现一次');
const r2 = applyBlock(block, { target });
ok(!r2.changed, '幂等：同样内容再写一次不落盘');
const r3 = removeBlock({ target });
ok(r3.changed && !readFileSync(target, 'utf8').includes(BEGIN), '--undo 能把块整段删掉');
process.exitCode = fail ? 1 : 0;
