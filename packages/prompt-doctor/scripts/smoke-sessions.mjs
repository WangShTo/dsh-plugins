// 冒烟：会话日志解码 + 真人提示过滤。
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { decodeSessionFile, decodeDirName } from '../lib/audit.mjs';

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };

// 1) 多帧 zstd：两帧拼接，两个魔数
const lines = [
  JSON.stringify({ type: 'user/message', time: 1, data: { source: { kind: 'user' }, content: [{ text: '这个表格怎么还没铺满' }] } }),
  JSON.stringify({ type: 'user/message', time: 2, data: { source: { kind: 'system' }, content: [{ text: 'Current runtime context' }] } }),
];
const dir = mkdtempSync(join(tmpdir(), 'pd-'));
const file = join(dir, 'session.v4.jsonl.zstd');
writeFileSync(file, Buffer.concat([
  zlib.zstdCompressSync(Buffer.from(lines[0] + '\n')),
  zlib.zstdCompressSync(Buffer.from(lines[1] + '\n')),
]));
const res = decodeSessionFile(file);
ok(res.frames === 2, `多帧解码：frames=${res.frames} bad=${res.bad}`);
ok(res.bad === 0, '没有坏帧');
ok(res.text.includes('铺满') && res.text.includes('Current runtime context'), '两帧内容都读到了');

// 2) 目录名解码：~HEX4
ok(decodeDirName('--G-~63D0~7EAF--').includes('提纯'), '代码目录名还原');
process.exitCode = fail ? 1 : 0;
