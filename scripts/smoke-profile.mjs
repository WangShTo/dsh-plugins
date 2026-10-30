// 冒烟：包清单与 profile 行。
//
// 2026-10-30 两次把 DSH 弄挂，都出在这几行上，所以这里逐条钉死：
//   1. 入口/客户端必须能被 exports 解析到真实文件（挪进子目录那次 → web boot 12 entries did not activate）
//   2. package.json 不能有 BOM（PowerShell Set-Content 那次 → DesktopHostFatalError: Unexpected token '\ufeff'）
//   3. 入口必须真的能被 import 出 apply
import { readFileSync, existsSync } from 'node:fs';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };

const raw = readFileSync('package.json');
ok(!(raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF), 'package.json 无 BOM');

let pkg;
try { pkg = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')); ok(true, 'package.json 可解析'); }
catch (e) { ok(false, `package.json 可解析（${e.message}）`); process.exit(1); }

const patchRaw = readFileSync('cordis.patch.yml');
ok(!(patchRaw[0] === 0xEF && patchRaw[1] === 0xBB && patchRaw[2] === 0xBF), 'cordis.patch.yml 无 BOM');
const patch = patchRaw.toString('utf8');

ok(pkg.name === 'dsh-prompt-doctor', '包名');
ok(pkg.main === './index.js', 'main 指向根 index.js');
ok(pkg.exports['.'] === './index.js', 'exports["."] 指向根 index.js');
ok(pkg.exports['./client'] === './client.js', 'exports["./client"] 指向根 client.js');
ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch');
ok(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform');
ok(Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'), 'dsh.client.inject 含对话包');

// 每个 exports 目标都必须是真实存在的文件
for (const [key, target] of Object.entries(pkg.exports)) {
  if (key.includes('*')) continue;
  const file = String(target).replace(/^\.\//, '');
  ok(existsSync(file), `exports ${key} → ${target} 存在`);
}

// files 里列的文件必须存在（发到 npm 时会被 whitelist）
for (const pattern of pkg.files ?? []) {
  if (pattern.includes('*')) continue;
  ok(existsSync(pattern), `files 项 ${pattern} 存在`);
}

ok(!existsSync('client/client.js'), '没有残留的 client/ 子目录入口');

ok(patch.includes('dsh-prompt-doctor'), 'patch 里有本包');
ok(patch.includes('insert:') && patch.includes('id:'), 'patch 是 insert 行格式');

// 入口真能 import 出 apply（不是只看字符串）
try {
  const mod = await import('../index.js');
  ok(typeof mod.apply === 'function', '根入口可 import 且导出 apply');
} catch (e) {
  ok(false, `根入口可 import（${e.message}）`);
}

process.exitCode = fail ? 1 : 0;
