// 生成 client.js：把当前体检 + 自动适配结果烘进客户端页面。
//
// 为什么是"烘"：Client 半是浏览器里的 lazy CJS 工厂，只能 require 模块表里的包（react），
// 读不了文件、也 import 不了同目录模块。所以页面显示的是**生成时的快照**；
// 实时数字与重新适配走 Host 的 agent 工具 `prompt_audit` / `prompt_fit`。
// 改了语料或规则就重跑这个脚本，然后 Ctrl+R 刷新界面。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, decodeDirName } from '../lib/audit.mjs';
import { runFit, readLastFit, defaultTarget } from '../lib/run.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'client/client.js');
const r = audit({ limitProjects: 8 });
if (!r.ok) throw new Error(r.reason);

// dryRun：页面只展示"现在这套规则"，不替用户写文件；真正写盘的是 prompt_fit / 启动自动适配。
const fit = runFit({ dryRun: true });
const last = readLastFit();

const snap = {
  generatedAt: r.generatedAt.slice(0, 10),
  prompts: r.prompts,
  projects: r.projects,
  files: r.files,
  median: r.median,
  p90: r.p90,
  longest: r.longest,
  chars: r.chars,
  rates: r.rates,
  bucket: r.bucket,
  topProjects: r.topProjects.map((p) => ({ name: decodeDirName(p.dir), n: p.n })),
  fit: {
    target: fit.target || defaultTarget(),
    changed: Boolean(fit.changed),
    rules: (fit.rules || []).map((x) => ({
      key: x.key, title: x.title, line: x.line, why: x.why, evidence: x.evidence,
    })),
    lastAppliedAt: last ? last.at.slice(0, 16).replace('T', ' ') : null,
    lastAdded: last ? last.added.filter((l) => l.trim()).length : 0,
  },
};

const template = fs.readFileSync(path.join(here, 'report.view.js'), 'utf8');
fs.writeFileSync(out, template.replace('/*__SNAPSHOT__*/', JSON.stringify(snap, null, 2)));
console.log(
  'client.js written:', out,
  'prompts=', snap.prompts,
  'projects=', snap.projects,
  'rules=', snap.fit.rules.length,
  'pending_write=', snap.fit.changed,
);
