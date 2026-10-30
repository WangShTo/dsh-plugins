// 提纯 · 会话考古：把 ~/.dsh/sessions 里的真人提示词挖出来，算一份"提问体检"。
//
// 两个必须记住的坑（都是踩过的）：
//   1. session.v4.jsonl.zstd 是**多帧 zstd 拼接**，不是单帧。zstdDecompressSync 只解第一帧，
//      用 streaming 解到第二帧会抛 "Unknown frame descriptor"。必须自己扫 magic(28 b5 2f fd)
//      逐帧解再拼起来。
//   2. user/message 里混着系统注入（运行环境快照、时间戳、QQ 网关注入的角色卡、
//      system-reminder 等），它们同样带 source.kind === 'user'。不过滤会把统计全带偏。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/** 多帧 zstd → 文本。坏帧跳过但计数，绝不整体失败。 */
export function decodeSessionFile(file) {
  const raw = fs.readFileSync(file);
  const offsets = [];
  for (let i = 0; i + 4 <= raw.length; i++) {
    if (raw[i] === MAGIC[0] && raw[i + 1] === MAGIC[1] && raw[i + 2] === MAGIC[2] && raw[i + 3] === MAGIC[3]) offsets.push(i);
  }
  if (offsets.length === 0) return { text: '', frames: 0, bad: 0 };
  const parts = [];
  let bad = 0;
  for (let k = 0; k < offsets.length; k++) {
    const start = offsets[k];
    const end = k + 1 < offsets.length ? offsets[k + 1] : raw.length;
    try {
      parts.push(zlib.zstdDecompressSync(raw.subarray(start, end)).toString('utf8'));
    } catch {
      bad++;
    }
  }
  return { text: parts.join(''), frames: offsets.length, bad };
}

// 注入 / 网关噪声：这些不是王世彤本人打的字。
const NOISE = [
  '【当前时间】', '【你的身份】', '# 角色卡：', '【你最近刷到的东西】', '【会话令牌】',
  'Current runtime context', 'Time sampled while preparing', 'The approval policy changed',
  '<system-reminder', '<hindsight_knowledge', 'Browser time zone for this request',
  '[Compressed conversation section]',
];

const isHuman = (text) => {
  const t = String(text || '').trim();
  if (t.length < 2) return false;
  return !NOISE.some((n) => t.includes(n));
};

const textOf = (data) => {
  const content = data?.content;
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c && c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n');
};

// 会话目录名是"编码过的路径"：盘符去冒号、分隔符变 '-'、每个非 ASCII 与空格字符变成 ~HEX4。
// 解回来才能看懂是哪个项目：--G-~63D0~7EAF-- → G:\提纯
export function decodeDirName(dir) {
  return String(dir)
    .replace(/^--|--$/g, '')
    .replace(/~([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/^([A-Za-z])-/, '$1:\\')
    .replace(/-/g, '\\');
}

const median = (sorted) => {
  if (!sorted.length) return 0;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0);

// 特征词表：来源是 209 条语料上人工核对过的分类，不改口径。
const RULES = {
  reference: /这个|那个|这儿|那儿|这里|那里|它|还是|又|刚才|上面|下面|前面/g,
  rework: /不是|不对|重新|又|为什么|怎么还|还没|我说过|第.次/g,
  gate: /先别|别急|不要|不用|暂停|停止|禁止|等等|先不/g,
  emotion: /[!！]{1,}|啊|吧|呢|哎|卧槽|服了/g,
  accept: /跑起来|能用|打开|成功|正常|对得上|不报错|能点/g,
};

export function summarize(prompts) {
  const lens = prompts.map((p) => p.length).sort((a, b) => a - b);
  const hit = { reference: 0, rework: 0, gate: 0, emotion: 0, accept: 0 };
  const bucket = { tiny: 0, short: 0, mid: 0, long: 0 };
  for (const p of prompts) {
    for (const [k, re] of Object.entries(RULES)) {
      re.lastIndex = 0;
      if (re.test(p)) hit[k]++;
    }
    if (p.length <= 15) bucket.tiny++;
    else if (p.length <= 40) bucket.short++;
    else if (p.length <= 200) bucket.mid++;
    else bucket.long++;
  }
  const n = prompts.length || 1;
  const rate = (v) => Math.round((v / n) * 1000) / 10;
  return {
    prompts: prompts.length,
    chars: prompts.reduce((a, p) => a + p.length, 0),
    median: median(lens),
    p90: pct(lens, 0.9),
    longest: lens.length ? lens[lens.length - 1] : 0,
    rates: {
      reference: rate(hit.reference),
      rework: rate(hit.rework),
      gate: rate(hit.gate),
      emotion: rate(hit.emotion),
      accept: rate(hit.accept),
      tiny: rate(bucket.tiny),
      long: rate(bucket.long),
    },
    bucket,
  };
}

/** 带时间戳的全量真人提示（trend / incidents 共用）。 */
export function collectPrompts({ sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions') } = {}) {
  const out = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(sessionsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(sessionsRoot, d.name));
  } catch {
    return out;
  }
  for (const dir of dirs) {
    let subs = [];
    try {
      subs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('session-')).map((d) => path.join(dir, d.name));
    } catch { continue; }
    for (const sub of subs) {
      const file = path.join(sub, 'session.v4.jsonl.zstd');
      if (!fs.existsSync(file)) continue;
      const { text } = decodeSessionFile(file);
      for (const line of text.split(String.fromCharCode(10))) {
        if (!line.trim()) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type !== 'user/message') continue;
        if (ev.data?.source?.kind !== 'user') continue;
        const t = textOf(ev.data).trim();
        if (!isHuman(t)) continue;
        out.push({ time: Number(ev.time) || 0, text: t, project: decodeDirName(path.basename(dir)), session: path.basename(sub) });
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** 给 incidents 用的事件流：用户原话 + 我的回复，按时间排序。 */
export function collectEvents({ sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions') } = {}) {
  const out = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(sessionsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(sessionsRoot, d.name));
  } catch {
    return out;
  }
  for (const dir of dirs) {
    let subs = [];
    try {
      subs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('session-')).map((d) => path.join(dir, d.name));
    } catch { continue; }
    for (const sub of subs) {
      const file = path.join(sub, 'session.v4.jsonl.zstd');
      if (!fs.existsSync(file)) continue;
      const { text } = decodeSessionFile(file);
      for (const line of text.split(String.fromCharCode(10))) {
        if (!line.trim()) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        const at = Number(ev.time) || 0;
        if (ev.type === 'user/message') {
          if (ev.data && ev.data.source && ev.data.source.kind === 'user') {
            const t = textOf(ev.data).trim();
            if (isHuman(t)) out.push({ kind: 'user', text: t, at, project: decodeDirName(path.basename(dir)) });
          }
        } else if (ev.type === 'assistant/message') {
          const content = ev.data && ev.data.message && ev.data.message.content;
          if (!Array.isArray(content)) continue;
          const t = content.filter((c) => c && c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join(String.fromCharCode(10)).trim();
          if (t) out.push({ kind: 'assistant', text: t, at, project: decodeDirName(path.basename(dir)) });
        }
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** 全量扫描。返回体检结果 + 每个项目目录的计数。 */
export function audit({ sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions'), limitProjects = 8 } = {}) {
  const projects = [];
  let files = 0;
  let badFrames = 0;
  const prompts = [];
  const perProject = [];

  let dirs = [];
  try {
    dirs = fs.readdirSync(sessionsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(sessionsRoot, d.name));
  } catch {
    return { ok: false, reason: `sessions root not readable: ${sessionsRoot}` };
  }

  for (const dir of dirs) {
    const local = [];
    let subs = [];
    try {
      subs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('session-')).map((d) => path.join(dir, d.name));
    } catch { continue; }
    for (const sub of subs) {
      const file = path.join(sub, 'session.v4.jsonl.zstd');
      if (!fs.existsSync(file)) continue;
      files++;
      const { text, bad } = decodeSessionFile(file);
      badFrames += bad;
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type !== 'user/message') continue;
        if (ev.data?.source?.kind !== 'user') continue;
        const t = textOf(ev.data);
        if (!isHuman(t)) continue;
        prompts.push(t.trim());
        local.push(t.trim());
      }
    }
    if (local.length) perProject.push({ dir: path.basename(dir), n: local.length, avg: Math.round(local.join('').length / local.length) });
  }

  perProject.sort((a, b) => b.n - a.n);
  const stats = summarize(prompts);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    sessionsRoot,
    files,
    badFrames,
    projects: perProject.length,
    ...stats,
    topProjects: perProject.slice(0, limitProjects),
    samples: prompts.filter((p) => p.length <= 40).slice(-6),
  };
}

/** 人看的短报告（工具返回用）。 */
export function formatReport(r) {
  if (!r.ok) return `提问体检失败：${r.reason}`;
  const L = [];
  L.push(`提问体检 · ${r.prompts} 条真人提示 / ${r.projects} 个项目 / ${r.files} 个会话文件`);
  L.push(`中位 ${r.median} 字，p90 ${r.p90} 字，最长 ${r.longest} 字，合计 ${r.chars} 字`);
  L.push(`指代 ${r.rates.reference}% · 返工标记 ${r.rates.rework}% · 闸门句 ${r.rates.gate}% · 情绪 ${r.rates.emotion}% · 极短(≤15字) ${r.rates.tiny}%`);
  L.push('项目分布：' + r.topProjects.map((p) => `${decodeDirName(p.dir)} ${p.n}条`).join(' / '));
  return L.join('\n');
}
