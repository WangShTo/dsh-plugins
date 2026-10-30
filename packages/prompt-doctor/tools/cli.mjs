#!/usr/bin/env node
// 命令行入口：不启动 DSH 也能体检、生成、写入、看趋势。
//
//   node tools/cli.mjs audit            # 只读体检
//   node tools/cli.mjs style            # 习惯画像
//   node tools/cli.mjs trend            # 趋势 + 真实 token 账
//   node tools/cli.mjs fit              # 预览要写的约定（不动盘）
//   node tools/cli.mjs fit --apply      # 真的写进 ~/.agents/AGENTS.md
//
// 退出码：0 成功；1 参数错或执行失败。写盘失败一律非零，方便接 CI。

import { audit, formatReport } from '../lib/audit.mjs';
import { runFit, summarize } from '../lib/run.mjs';
import { trend, formatTrend } from '../lib/trend.mjs';
import { styleProfile, formatStyle } from '../lib/style.mjs';
import { collectUsageCached, perTurnCost, byProject, compact, n as num } from '../lib/token.mjs';

const [, , command = 'audit', ...rest] = process.argv;
const apply = rest.includes('--apply');

function usage() {
  console.log('用法: node tools/cli.mjs <audit|style|trend|fit> [--apply]');
  process.exit(1);
}

function auditLine() {
  const report = audit({ limitProjects: 5 });
  if (!report.ok) {
    console.error(`体检失败：${report.reason}`);
    process.exit(1);
  }
  return report;
}

switch (command) {
  case 'audit': {
    const report = auditLine();
    console.log(formatReport(report));
    if (report.badFrames) console.log(`（${report.badFrames} 个坏帧被跳过）`);
    break;
  }

  case 'style': {
    const report = auditLine();
    let usage = null;
    try {
      usage = collectUsageCached();
    } catch {
      /* 账单读不到不影响画像 */
    }
    console.log(formatStyle(styleProfile({ report, usage })));
    break;
  }

  case 'trend': {
    try {
      const usage = collectUsageCached();
      const per = perTurnCost(usage);
      console.log(`真实账单：累计等效 token ${compact(usage.eq)} · ${num(usage.requests)} 次请求 / ${num(per.turns)} 轮`);
      console.log(`平均每轮 ${compact(per.avg)}，最贵一轮 ${compact(per.top[0]?.eq ?? 0)}`);
      const top = byProject(usage.rows).slice(0, 3);
      if (top.length) console.log(`最烧：${top.map((p) => `${p.project} ${compact(p.eq)}`).join(' · ')}`);
      console.log('');
    } catch (error) {
      console.log(`账单读不到：${error?.message || error}`, '');
    }
    console.log(formatTrend(trend()));
    break;
  }

  case 'fit': {
    const res = runFit({ dryRun: !apply });
    if (!res.ok) {
      console.error(`生成失败：${res.reason}`);
      process.exit(1);
    }
    console.log(summarize(res));
    console.log('');
    console.log(res.dryRun ? `预览完成，没动盘。加 --apply 才会写 ${res.target}` : `已写入 ${res.target}`);
    break;
  }

  default:
    usage();
}
