/**
 * token.mjs — 真实账单。
 *
 * 上一版按「3.2 字符 ≈ 1 token」估算，那是猜。DSH 的会话日志里，
 * 每条 `assistant/message` 都带 `data.usage = { inputTokens, outputTokens,
 * cacheReadTokens, cacheWriteTokens }`，所以这里直接读真数。
 *
 * 口径（不是价格，别拿它算钱）：
 *   等效输入 token = input + 0.10×cacheRead + 0.25×cacheWrite + 4×output
 * 权重表达的是「读缓存便宜、生成贵」这个相对关系，跨模型统一成一把尺子。
 *
 * 这批数字的意义：一次返工会多烧一整轮上下文，噪音却只显示为「又」一个字。
 * 所以真正要报的是「每轮 / 每次提示的等效 token」，不是字数。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeSessionFile, decodeDirName } from './audit.mjs';

/** 等效权重。改这里必须同步 README 的口径说明。 */
export const WEIGHTS = Object.freeze({ input: 1, cacheRead: 0.1, cacheWrite: 0.25, output: 4 });

/** 一条 usage 记录 → 等效输入 token。 */
export function eqTokens(u = {}) {
  const n = (v) => (Number.isFinite(v) ? v : 0);
  return (
    n(u.inputTokens) * WEIGHTS.input +
    n(u.cacheReadTokens) * WEIGHTS.cacheRead +
    n(u.cacheWriteTokens) * WEIGHTS.cacheWrite +
    n(u.outputTokens) * WEIGHTS.output
  );
}

function sessionsRootOf(p) {
  return p || path.join(os.homedir(), '.dsh', 'sessions');
}

function listSessionFiles(root) {
  const out = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return out;
  }
  for (const dir of dirs) {
    const full = path.join(root, dir.name);
    let entries = [];
    try {
      entries = fs.readdirSync(full);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith('session-')) continue;
      const file = path.join(full, entry, 'session.v4.jsonl.zstd');
      try {
        const st = fs.statSync(file);
        out.push({ file, project: decodeDirName(dir.name), session: entry, mtime: st.mtimeMs, size: st.size });
      } catch {
        /* 不是每个 session 目录都有终态日志 */
      }
    }
  }
  return out;
}

/**
 * 扫全部会话日志，抽 usage。
 * @returns {{requests:number, turns:number, prompts:number, eq:number,
 *   parts:{input:number,cacheRead:number,cacheWrite:number,output:number},
 *   rows:Array, files:number, badFrames:number}}
 */
export function collectUsage({ sessionsRoot } = {}) {
  const root = sessionsRootOf(sessionsRoot);
  const files = listSessionFiles(root);
  const rows = [];
  let badFrames = 0;
  let prompts = 0;

  for (const meta of files) {
    let text;
    try {
      const decoded = decodeSessionFile(meta.file);
      text = decoded.text;
      badFrames += decoded.bad || 0;
    } catch {
      continue;
    }
    let pending = '';
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === 'user/message') {
        if (ev.data?.source?.kind !== 'user') continue;
        const content = ev.data?.content;
        const text = Array.isArray(content)
          ? content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n').trim()
          : '';
        if (text.length >= 2) {
          pending = text;
          prompts += 1;
        }
        continue;
      }
      if (ev.type !== 'assistant/message') continue;
      const u = ev.data?.usage;
      if (!u) continue;
      rows.push({
        project: meta.project,
        session: meta.session,
        turn: Number(ev.data?.turn) || 0,
        step: Number(ev.data?.step) || 0,
        at: Number(ev.time) || 0,
        prompt: pending,
        promptChars: pending.length,
        input: Number(u.inputTokens) || 0,
        output: Number(u.outputTokens) || 0,
        cacheRead: Number(u.cacheReadTokens) || 0,
        cacheWrite: Number(u.cacheWriteTokens) || 0,
        eq: eqTokens(u),
      });
      pending = '';
    }
  }

  const parts = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  let eq = 0;
  for (const r of rows) {
    parts.input += r.input;
    parts.cacheRead += r.cacheRead;
    parts.cacheWrite += r.cacheWrite;
    parts.output += r.output;
    eq += r.eq;
  }

  const turnKeys = new Set(rows.map((r) => `${r.session}#${r.turn}`));

  return {
    requests: rows.length,
    turns: turnKeys.size,
    prompts,
    eq,
    parts,
    rows: rows.sort((a, b) => a.at - b.at),
    files: files.length,
    badFrames,
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;

function cachePath() {
  const dir = path.join(os.homedir(), '.dsh', 'prompt-doctor');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'usage-cache.json');
}

/** 5 分钟缓存：工具连续调用不重复解 45 个日志。 */
export function collectUsageCached({ sessionsRoot, ttlMs = CACHE_TTL_MS } = {}) {
  const file = cachePath();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw?.at && Date.now() - raw.at < ttlMs && raw.data) return raw.data;
  } catch {
    /* 没缓存或缓存坏了都走重算 */
  }
  const data = collectUsage({ sessionsRoot });
  const compact = { ...data, rows: data.rows.slice(-4000) };
  try {
    fs.writeFileSync(file, JSON.stringify({ at: Date.now(), data: compact }));
  } catch {
    /* 缓存写不进去不影响结果 */
  }
  return data;
}

/** 千分位，中文界面里比 12345678 好看。 */
export function n(v) {
  return Math.round(v).toLocaleString('en-US');
}

/** 把字节量级的 token 压成 K / M。 */
export function compact(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${Math.round(v / 1e3)}K`;
  return `${Math.round(v)}`;
}

/** 按项目汇总，降序。 */
export function byProject(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.project || '(未知)';
    const cur = map.get(key) || { project: key, requests: 0, eq: 0, prompts: 0 };
    cur.requests += 1;
    cur.eq += r.eq;
    if (r.prompt) cur.prompts += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.eq - a.eq);
}

/** 按天汇总（本地时区）。 */
export function byDay(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.at) continue;
    const d = new Date(r.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cur = map.get(key) || { day: key, requests: 0, eq: 0, prompts: 0 };
    cur.requests += 1;
    cur.eq += r.eq;
    if (r.prompt) cur.prompts += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/**
 * 每轮成本分布：真人提示那一轮的整轮成本，而不是单次请求。
 * 这才是「一次返工有多贵」的答案。
 */
export function perTurnCost(usage) {
  const map = new Map();
  for (const r of usage.rows) {
    const key = `${r.session}#${r.turn}`;
    const cur = map.get(key) || { key, eq: 0, requests: 0, prompt: '', at: r.at };
    cur.eq += r.eq;
    cur.requests += 1;
    if (r.prompt) cur.prompt = r.prompt;
    if (!cur.at) cur.at = r.at;
    map.set(key, cur);
  }
  const turns = [...map.values()].sort((a, b) => b.eq - a.eq);
  const sum = turns.reduce((a, b) => a + b.eq, 0);
  return {
    turns: turns.length,
    total: sum,
    avg: turns.length ? sum / turns.length : 0,
    top: turns.slice(0, 5),
  };
}
