#!/usr/bin/env node
// 打印翻车事件的领域聚类。用法：
//   node tools/incidents.mjs            # 只看摘要
//   node tools/incidents.mjs --all      # 连样本句子一起打印
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { decodeSessionFile } from '../lib/audit.mjs';
import { buildIncidents, cluster } from '../lib/incidents.mjs';

const root = join(homedir(), '.dsh', 'sessions');
const showAll = process.argv.includes('--all');

function eventsOf(dir) {
  const file = join(root, dir[0], dir[1], 'session.v4.jsonl.zstd');
  if (!existsSync(file)) return [];
  const { text } = decodeSessionFile(file);
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.includes('user/message') && !line.includes('assistant/message')) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const at = rec.time || 0;
    if (rec.type === 'user/message') {
      const src = rec.data?.source?.kind;
      if (src !== 'user') continue;
      const body = (rec.data.content || []).map((c) => c.text || '').join('\n');
      if (body.trim()) events.push({ kind: 'user', text: body, at });
    } else if (rec.type === 'assistant/message') {
      const body = (rec.data?.message?.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n');
      if (body.trim()) events.push({ kind: 'assistant', text: body, at });
    }
  }
  return events;
}

const dirs = [];
for (const a of readdirSync(root)) {
  for (const b of readdirSync(join(root, a))) {
    if (!b.startsWith('session-')) continue; // 子代理目录，首条提示是我写的任务书，不算他的话
    if (existsSync(join(root, a, b, 'session.v4.jsonl.zstd'))) dirs.push([a, b]);
  }
}

const all = [];
for (const d of dirs) all.push(...buildIncidents(eventsOf(d)));
all.sort((a, b) => a.at - b.at);

console.log(`翻车事件：${all.length} 次 / ${dirs.length} 份会话日志`);
const groups = cluster(all);
console.log(`聚成 ${groups.length} 类（≥2 次）\n`);
for (const g of groups) {
  const days = ((g.lastAt - g.firstAt) / 86400000).toFixed(0);
  console.log(`- ${g.domain}：${g.count} 次，跨度 ${days} 天`);
  if (showAll) {
    for (const s of g.samples) console.log(`    · 他说：${s.user}${s.claim ? `\n      我上一句说：${s.claim}` : ''}`);
  }
}
const covered = new Set();
for (const g of groups) for (const s2 of g.samples) covered.add(s2.user);
