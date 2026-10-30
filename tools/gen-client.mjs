// 生成 client.js：把当前体检快照烘进客户端页面。
//
// 为什么是"烘"：Client 半是浏览器里的 lazy CJS 工厂，只能 require 模块表里的包（react），
// 读不了文件、也 import 不了同目录模块。所以页面显示的是**生成时的快照**；
// 实时数字走 Host 的 agent 工具 `prompt_audit`。改了语料就重跑这个脚本，然后 Ctrl+R 刷新界面。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, decodeDirName } from '../lib/audit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'client.js');
const r = audit({ limitProjects: 8 });
if (!r.ok) throw new Error(r.reason);

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
};

const template = fs.readFileSync(path.join(here, 'report.view.js'), 'utf8');
fs.writeFileSync(out, template.replace('/*__SNAPSHOT__*/', JSON.stringify(snap, null, 2)));
console.log('client.js written:', out, 'prompts=', snap.prompts, 'projects=', snap.projects);
