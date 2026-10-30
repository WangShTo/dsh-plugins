/**
 * style.mjs — 习惯画像。
 *
 * 只做一件事：把统计数字翻译成人能读的「你就是这么说话的」。
 * 不生成规则（那是 fit.mjs 的活），不写盘。
 *
 * 上限 40 行：画像比规则更长就没人看，而没人看的画像等于不存在。
 */

import { decodeDirName } from './audit.mjs';
import { byProject, compact, perTurnCost } from './token.mjs';

const pct = (v) => `${Math.round(v * 10) / 10}%`;

function bucketLine(report) {
  const b = report.bucket || {};
  const total = report.prompts || 1;
  const share = (v) => Math.round(((v || 0) / total) * 100);
  return `长度分档：≤15字 ${share(b.tiny)}% · 16-40 ${share(b.short)}% · 41-200 ${share(b.mid)}% · >200 ${share(b.long)}%`;
}

/**
 * @param {{report: object, usage?: object}} input
 * @returns {{lines: string[], verdict: string}}
 */
export function styleProfile({ report, usage } = {}) {
  if (!report || report.ok === false) {
    return { lines: [`画像读不到会话日志：${report?.reason || '未知原因'}`], verdict: '无数据' };
  }

  const r = report.rates || {};
  const lines = [];

  lines.push(`### 说话方式（${report.prompts} 条提示 / ${report.projects} 个项目 / ${report.files} 个会话）`);
  lines.push(`中位 ${report.median} 字，p90 ${report.p90} 字，最长 ${report.longest} 字`);
  lines.push(bucketLine(report));
  lines.push('');

  const traits = [
    ['指代句', r.reference, '这个/那个/它/又 —— 不点名，默认我知道指哪'],
    ['闸门句', r.gate, '先别/不要/暂停 —— 一句话就该让我停手'],
    ['返工标记', r.rework, '不是/不对/重新/为什么/又'],
    ['情绪', r.emotion, '感叹号和口语词，多半是催或骂'],
    ['验收词', r.accept, '跑起来/能用/对得上 —— 按这个口径验收'],
  ];
  lines.push('### 五种句式占比');
  for (const [label, value, note] of traits) {
    lines.push(`- ${label} ${pct(value)}：${note}`);
  }
  lines.push('');

  lines.push('### 提示有多短');
  const tiny = r.tiny || 0;
  lines.push(
    tiny >= 20
      ? `极短句（≤15 字）占 ${pct(tiny)}，是主流量级。这意味着「一句话一个新需求」是常态，我该默认按「在上一轮产物上改一个点」理解。`
      : `极短句占 ${pct(tiny)}，不算主导，指令多半带上下文，不用过度脑补。`,
  );
  lines.push('');

  if (report.topProjects?.length) {
    lines.push('### 最常待的项目');
    for (const p of report.topProjects.slice(0, 5)) {
      lines.push(`- ${decodeDirName(p.dir)}：${p.n} 条，平均 ${p.avg} 字`);
    }
    lines.push('');
  }

  if (usage?.rows?.length) {
    const top = byProject(usage.rows).slice(0, 3);
    const turn = perTurnCost(usage);
    lines.push('### 上下文去哪了');
    lines.push(`累计等效 token ${compact(usage.eq)}，${usage.requests} 次请求 / ${turn.turns} 轮，平均每轮 ${compact(turn.avg)}`);
    for (const p of top) lines.push(`- ${p.project}：${compact(p.eq)}`);
    lines.push('');
  }

  // 结论只留一句：这句话才是他要的。
  const verdict =
    (r.tiny || 0) >= 20 && (r.reference || 0) >= 20
      ? '短句 + 指代是主模式：少问「你说哪个」，多按上文定位。'
      : (r.rework || 0) >= 15
        ? '返工标记偏高：验收口径要先对齐，再动手。'
        : '句式比较平，没有单一主导模式，别硬套模板。';
  lines.push('### 一句话');
  lines.push(verdict);

  return { lines: lines.slice(0, 40), verdict };
}

/** 工具返回用：纯文本。 */
export function formatStyle(profile) {
  return profile.lines.join('\n');
}
