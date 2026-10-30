// test-all.mjs —— 一把跑完所有冒烟。
//
//   node scripts/test-all.mjs
//
// 任何一项非零退出，本脚本也跟着非零。CI 用同一条命令。

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PKG = path.join(ROOT, 'packages', 'prompt-doctor');

const suites = [
  { label: '工具注册闭环', file: path.join(ROOT, 'scripts', 'smoke-tools.mjs'), cwd: ROOT },
  ...['smoke-profile', 'smoke-sessions', 'smoke-incidents', 'smoke-fit', 'smoke-trend'].map((name) => ({
    label: name,
    file: path.join(PKG, 'scripts', `${name}.mjs`),
    cwd: PKG,
  })),
];

let failed = 0;
for (const suite of suites) {
  const started = Date.now();
  try {
    const out = execFileSync(process.execPath, [suite.file], { cwd: suite.cwd, encoding: 'utf8', timeout: 300000 });
    const lines = out.trim().split('\n').length;
    console.log(`PASS  ${suite.label}  ${lines} 行 / ${Date.now() - started}ms`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${suite.label}  ${Date.now() - started}ms`);
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    if (text) console.log(text.split('\n').slice(-15).join('\n'));
  }
}

console.log('');
console.log(failed === 0 ? `全部通过（${suites.length} 套）` : `${failed}/${suites.length} 套失败`);
process.exit(failed === 0 ? 0 : 1);
