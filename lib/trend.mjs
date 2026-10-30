// 用前用后：把「返工率」按周摊开，看看这套约定到底有没有让对话变顺。
//
// 这个模块只回答一个问题：写托管块之前 vs 之后，返工口气的比例变了没有。
// 样本按自然周切；一条提示算不算返工，用的是与 incidents 同一套词表。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { collectPrompts } from './audit.mjs';
import { defaultTarget, firstFitAt } from './agents.mjs';

const REWORK = /不是|不对|重新|又|为什么|怎么还|还没|我说过|第.次/;

const DAY = 86400000;

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const rate = (hit, n) => (n ? Math.round((hit / n) * 1000) / 10 : 0);

/** 周一 00:00（本地时区）作为一周的起点。 */
export function weekStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY;
}

const pad = (n) => String(n).padStart(2, '0');

export function weekLabel(start) {
  const d = new Date(start);
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - first) / DAY + first.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
}

/** @param {Array<{time:number,text:string,project?:string}>} prompts */
export function weekly(prompts) {
  const buckets = new Map();
  for (const p of prompts) {
    if (!p.time) continue;
    const start = weekStart(p.time);
    if (!buckets.has(start)) buckets.set(start, []);
    buckets.get(start).push(p);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, list]) => {
      const hit = list.filter((p) => REWORK.test(p.text)).length;
      return {
        start,
        week: weekLabel(start),
        n: list.length,
        rework: hit,
        reworkRate: rate(hit, list.length),
        median: median(list.map((p) => p.text.length)),
      };
    });
}

/** 托管块写入时间（没有就是 null）。 */
export function appliedAt(target = defaultTarget()) {
  const at = firstFitAt(target);
  if (at) return new Date(at).getTime();
  // 还没记过历史时，用目标文件的创建时间兜底：托管块第一次写入就是文件诞生的时刻。
  try {
    return fs.statSync(target).birthtimeMs || null;
  } catch {
    return null;
  }
}

/** 以 since 为界，比较前后两段的返工率。样本不足会说不足，不硬凑结论。 */
export function effect({ prompts, since = appliedAt(), minPerSide = 20 } = {}) {
  const list = prompts || collectPrompts();
  const cut = since || 0;
  const before = list.filter((p) => p.time && (!cut || p.time < cut));
  const after = cut ? list.filter((p) => p.time && p.time >= cut) : [];
  const stat = (arr) => ({
    n: arr.length,
    days: arr.length ? Math.max(1, Math.round((arr[arr.length - 1].time - arr[0].time) / DAY)) : 0,
    rework: rate(arr.filter((p) => REWORK.test(p.text)).length, arr.length),
    median: median(arr.map((p) => p.text.length)),
  });
  const b = stat(before);
  const a = stat(after);
  const enough = b.n >= minPerSide && a.n >= minPerSide;
  return {
    since: cut ? new Date(cut).toISOString() : null,
    before: b,
    after: a,
    delta: enough ? Math.round((a.rework - b.rework) * 10) / 10 : null,
    enough,
    minPerSide,
  };
}

const SPARK = '▁▂▃▄▅▆▇█';
const spark = (values) => {
  const max = Math.max(1, ...values);
  return values.map((v) => SPARK[Math.min(SPARK.length - 1, Math.round((v / max) * (SPARK.length - 1)))]).join('');
};

/** 人看的趋势表：每周条数 / 返工率 / 中位长度，末尾给用前用后。 */
export function formatTrend({ weekly: weeks, effect: eff }) {
  const L = [];
  L.push('返工率走势（按自然周）');
  L.push('');
  L.push('  周次        条数   返工率   中位长度');
  for (const w of weeks.slice(-8)) {
    L.push(`  ${w.week}  ${String(w.n).padStart(6)}  ${String(w.reworkRate).padStart(6)}%  ${String(w.median).padStart(8)}`);
  }
  L.push('');
  L.push(`  返工率  ${spark(weeks.slice(-12).map((w) => w.reworkRate))}  ${weeks.slice(-12).map((w) => w.week).join(' ')}`);
  L.push('');
  const { before: b, after: a, since, enough, delta } = eff;
  if (!since) {
    L.push('  还没有写入过约定，只有「用前」这一半：' + `${b.n} 条 / 返工率 ${b.rework}% / 中位 ${b.median} 字`);
  } else if (!enough) {
    L.push(`  用前 ${b.n} 条、返工率 ${b.rework}%；用后 ${a.n} 条、返工率 ${a.rework}%`);
    L.push(`  用后样本不足 ${eff.minPerSide} 条，不下结论（还差 ${Math.max(0, eff.minPerSide - a.n)} 条）。`);
  } else {
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    L.push(`  用前 ${b.n} 条、返工率 ${b.rework}%；用后 ${a.n} 条、返工率 ${a.rework}%，变化 ${arrow}${Math.abs(delta)} 个点`);
    L.push('  注意：这只是相关，不是因果——同期你也在换项目、换问法。');
  }
  return L.join('\n');
}

export function trend(opts = {}) {
  const prompts = opts.prompts || collectPrompts();
  const weeks = weekly(prompts);
  const eff = effect({ prompts, since: opts.since ?? appliedAt() });
  return { weekly: weeks, effect: eff };
}
