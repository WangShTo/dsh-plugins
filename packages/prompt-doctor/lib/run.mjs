// 一条龙：体检 → 生成规则 → 写进指令文件（托管块）。
//
// 三个调用方共用这里，保证「页面显示的」「工具返回的」「CLI 打印的」是同一份结果：
//   - tools/fit.mjs     命令行
//   - index.js          agent 工具 prompt_fit / 启动时自动适配
//   - tools/gen-client.mjs  把结果烘进客户端页面
import { audit, collectEvents } from './audit.mjs';
import { deriveRules, renderBlock } from './fit.mjs';
import { buildIncidents } from './incidents.mjs';
import { applyBlock, readLastFit, defaultTarget, removeBlock } from './agents.mjs';

export function buildFit({ limitProjects = 8 } = {}) {
  const report = audit({ limitProjects });
  if (!report.ok) return { ok: false, reason: report.reason };
  const incidents = buildIncidents(collectEvents());
  const rules = deriveRules(report, incidents);
  const body = renderBlock(rules, { date: report.generatedAt.slice(0, 10) });
  return { ok: true, report, rules, body, incidents };
}

export function runFit({ dryRun = true, target } = {}) {
  const built = buildFit();
  if (!built.ok) return built;
  const res = applyBlock(built.body, { dryRun, target: target || defaultTarget() });
  return { ...built, ...res, dryRun };
}

export { readLastFit, defaultTarget, removeBlock };

/** 人读的一行摘要，工具输出与 CLI 都用它。 */
export function summarize(res) {
  if (!res.ok) return `体检失败：${res.reason}`;
  const r = res.report;
  const head = `体检：${r.prompts} 条提示 / ${r.projects} 个项目 / ${r.files} 份日志`;
  const fitLine = res.changed
    ? `适配：${res.dryRun ? '将写入' : '已写入'} ${res.target}（+${res.added.filter((l) => l.trim()).length} 行，替换旧块 ${res.hadBlock ? '是' : '否'}）`
    : `适配：内容与 ${res.target} 里现有块一致，未改动`;
  const rules = res.rules.map((x, i) => `  ${i + 1}. ${x.title} — ${x.line}`).join('\n');
  return `${head}\n${fitLine}\n\n本次生效的约定：\n${rules}`;
}
