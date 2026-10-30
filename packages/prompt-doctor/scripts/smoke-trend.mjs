// trend 是「用前用后」的唯一口径，算错了会得出反向结论，所以单独冒烟。
import assert from 'node:assert/strict';
import { weekStart, weekLabel, weekly, effect, formatTrend } from '../lib/trend.mjs';

const DAY = 86400000;
const base = new Date('2026-10-05T09:00:00'); // 周一
const at = (d, h = 9) => new Date(new Date(base).getTime() + d * DAY + (h - 9) * 3600000).getTime();

// 1) 同一周里的提示归到同一个桶，周一为起点
const prompts = [
  { time: at(0), text: '这个表格怎么还没铺满' },
  { time: at(1), text: '不是，你怎么又改回去了' },
  { time: at(2), text: '好的' },
  { time: at(7), text: '为什么又自启动了' },
];
const weeks = weekly(prompts);
assert.equal(weeks.length, 2, '两周应该切成两个桶');
assert.equal(weeks[0].n, 3);
assert.equal(weeks[0].rework, 2, '还没/不是 两条命中返工词，好的 不命中');
assert.equal(weeks[1].n, 1);
assert.equal(new Date(weeks[0].start).getDay(), 1, '桶起点必须是周一');
assert.match(weekLabel(weeks[0].start), /^2026-W\d\d$/);

// 2) 样本不足时 enough=false 且 delta=null（不许硬下结论）
const eff = effect({ prompts, since: at(5), minPerSide: 20 });
assert.equal(eff.enough, false);
assert.equal(eff.delta, null);
assert.equal(eff.before.n, 3);
assert.equal(eff.after.n, 1);

// 3) 样本够时才算 delta
const many = [];
for (let i = 0; i < 40; i++) many.push({ time: at(i * 0.5), text: i % 4 === 0 ? '不是，又错了' : '继续' });
for (let i = 0; i < 40; i++) many.push({ time: at(30 + i * 0.5), text: '继续' });
const eff2 = effect({ prompts: many, since: at(29), minPerSide: 20 });
assert.equal(eff2.enough, true);
assert.equal(eff2.delta, -25, '返工率从 25% 降到 0%，差 25 个点');

// 4) 文本输出里必须有「用前」「用后」
const text = formatTrend({ weekly: weeks, effect: eff });
assert.ok(text.includes('用前') && text.includes('用后'));
assert.ok(text.includes('返工率'));

console.log('smoke-trend ok');
