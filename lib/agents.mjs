// 把自动适配结果写进真正的指令文件（默认 ~/.dsh/AGENTS.md）。
//
// 规则：
// - 只动 `<!-- prompt-doctor:begin -->` 与 `<!-- prompt-doctor:end -->` 之间的托管块；
// - 块外的内容一个字节都不碰；
// - 每次写之前备份到 ~/.dsh/prompt-doctor/backup/，并把「上次写了什么」留在 last-fit.json；
// - 内容没变就不写文件，返回 changed=false，方便调用方跳过。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const BEGIN = '<!-- prompt-doctor:begin -->';
export const END = '<!-- prompt-doctor:end -->';

export function defaultTarget() {
  // 放在 shared-agents 层：手写人格留在 ~/.dsh/AGENTS.md，自动适配单独一层，
  // 谁写的改谁，互不覆盖。注入顺序：.dsh/AGENTS.md → ~/.agents/AGENTS.md → 项目 AGENTS.md。
  return path.join(os.homedir(), '.agents', 'AGENTS.md');
}

export function stateDir() {
  return path.join(os.homedir(), '.dsh', 'prompt-doctor');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 从文件内容里切出托管块（含标记行）；没有则返回 null。 */
export function extractBlock(text) {
  const b = text.indexOf(BEGIN);
  const e = text.indexOf(END);
  if (b < 0 || e < 0 || e < b) return null;
  return text.slice(b, e + END.length);
}

/**
 * 写入托管块。
 * @param {string} body  块内正文（不含标记行）
 * @param {{target?: string, dryRun?: boolean}} opts
 */
export function applyBlock(body, opts = {}) {
  const target = opts.target || defaultTarget();
  const prev = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const block = `${BEGIN}\n${body.trim()}\n${END}`;
  const had = extractBlock(prev);

  let next;
  if (had) next = prev.replace(had, block);
  else next = `${prev.replace(/\s*$/, '')}${prev.trim() ? '\n\n' : ''}${block}\n`;

  const changed = next.trim() !== prev.trim();
  const added = had ? block.split('\n').filter((l) => !had.includes(l)) : block.split('\n');
  const removed = had ? had.split('\n').filter((l) => !block.includes(l)) : [];

  const dir = stateDir();
  if (!opts.dryRun && changed) {
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'backup'), { recursive: true });
    if (prev) fs.writeFileSync(path.join(dir, 'backup', `AGENTS-${stamp()}.md`), prev);
    fs.writeFileSync(target, next);
    fs.writeFileSync(path.join(dir, 'last-fit.json'), JSON.stringify({
      at: new Date().toISOString(),
      target,
      block,
      added,
      removed,
    }, null, 2));
  }

  return { target, changed, added, removed, block, hadBlock: Boolean(had) };
}

/** 只取出上次写的内容，给页面用。 */
export function readLastFit() {
  const f = path.join(stateDir(), 'last-fit.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/** 撤销：把托管块整段删掉（块外内容保留）。 */
export function removeBlock(opts = {}) {
  const target = opts.target || defaultTarget();
  if (!fs.existsSync(target)) return { target, changed: false };
  const prev = fs.readFileSync(target, 'utf8');
  const had = extractBlock(prev);
  if (!had) return { target, changed: false };
  const next = prev.replace(had, '').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  if (!opts.dryRun) fs.writeFileSync(target, next);
  return { target, changed: true };
}
