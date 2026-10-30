// install.mjs —— 把某个插件挂进 DSH 的 profile。
//
// 只做三件事，且都可逆：
//   1. profile/package.json 的 dependencies 加一条 file: 指向本仓库里的包
//   2. profile/dsh.profile.bundles 加这个包名
//   3. profile/cordis.patch.yml 末尾插一块 insert（同 id 已存在就跳过，重复会让整组失效）
//
// 不跑 npm install：本机 profile 的 node_modules 是手工管的，
// 让 npm 重算一遍依赖树风险比收益大。这里直接建 junction（Windows 免管理员）。
//
//   node scripts/install.mjs --package prompt-doctor
//   node scripts/install.mjs --package prompt-doctor --revert
//   node scripts/install.mjs --package prompt-doctor --dry-run

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const PACKAGE_IDS = {
  'prompt-doctor': { name: 'dsh-prompt-doctor', dir: 'packages/prompt-doctor', patchId: 'prompt-doctor' },
  'route-gate': { name: 'dsh-route-gate', dir: 'packages/route-gate', patchId: 'route-gate' },
  'auto-session': { name: 'dsh-auto-session', dir: 'packages/auto-session', patchId: 'auto-session' },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const key = arg('package', 'prompt-doctor');
const spec = PACKAGE_IDS[key];
if (!spec) {
  console.error(`不认识的包：${key}。可选：${Object.keys(PACKAGE_IDS).join(' / ')}`);
  process.exit(1);
}

const pkgDir = path.join(REPO, spec.dir);
if (!fs.existsSync(path.join(pkgDir, 'package.json'))) {
  console.error(`包里没有 package.json：${pkgDir}`);
  process.exit(1);
}

const dshHome = arg('dsh-home', path.join(os.homedir(), '.dsh'));
const profilesRoot = path.join(dshHome, 'profiles');
const profile = arg('profile', findProfile());
function findProfile() {
  let names = [];
  try {
    names = fs.readdirSync(profilesRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return null;
  }
  return names.includes('desktop') ? 'desktop' : names[0] ?? null;
}
if (!profile) {
  console.error(`找不到 profile：${profilesRoot}`);
  process.exit(1);
}

const profileDir = path.join(profilesRoot, profile);
const pkgFile = path.join(profileDir, 'package.json');
const patchFile = path.join(profileDir, 'cordis.patch.yml');
const linkDir = path.join(profileDir, 'node_modules', spec.name);
const dryRun = flag('dry-run');
const revert = flag('revert');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const output = [];
const out = (s) => output.push(s);

// ── 读 ──────────────────────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const patchText = fs.existsSync(patchFile) ? fs.readFileSync(patchFile, 'utf8') : '';
const alreadyLinked = patchText.includes(`id: ${spec.patchId}`);

out(`profile      ${profileDir}`);
out(`包           ${spec.name} → ${pkgDir}`);
out(`patch        ${alreadyLinked ? '已存在同 id（不再追加）' : '没有同 id，将追加一块'}`);
out('');

if (revert) {
  if (!dryRun) {
    // 1. 托管块里那段路径不影响，这里只摘 profile 的接线
    delete pkg.dependencies?.[spec.name];
    const bundles = pkg.dsh?.profile?.bundles;
    if (Array.isArray(bundles)) pkg.dsh.profile.bundles = bundles.filter((b) => b !== spec.name);
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
    fs.writeFileSync(patchFile, stripPatchBlock(patchText, spec.patchId));
    try {
      if (fs.existsSync(linkDir) || fs.lstatSync(linkDir).isSymbolicLink()) fs.rmSync(linkDir, { recursive: true, force: true });
    } catch {
      /* link 本来就不在 */
    }
  }
  out(dryRun ? '（dry-run）会取消接线并删掉 patch 里那块' : '已取消接线。user 的 AGENTS.md 托管块没动，要删请手动 removeBlock 或跑 CLI。');
  out('');
  out('重启 DSH 之后生效。');
  console.log(output.join('\n'));
  process.exit(0);
}

// ── 写 ──────────────────────────────────────────────────────────────────────
if (!dryRun) {
  fs.copyFileSync(pkgFile, `${pkgFile}.bak-${stamp}`);
  if (fs.existsSync(patchFile)) fs.copyFileSync(patchFile, `${patchFile}.bak-${stamp}`);
  if (!fs.existsSync(path.join(profileDir, 'node_modules'))) fs.mkdirSync(path.join(profileDir, 'node_modules'), { recursive: true });
}

// 1. 依赖
pkg.dependencies = pkg.dependencies || {};
const wanted = 'file:' + pkgDir.replace(/\\/g, '/');
const prev = pkg.dependencies[spec.name];
if (prev !== wanted) {
  pkg.dependencies[spec.name] = wanted;
  out(`enlace      ${spec.name}: ${prev ?? '(无)'} → ${wanted}`);
} else {
  out(`enlace      ${spec.name} 已经指向同一个包`);
}

// 2. bundles
const bundles = (pkg.dsh ??= {}).profile ??= {};
bundles.bundles = Array.isArray(bundles.bundles) ? bundles.bundles : [];
if (!bundles.bundles.includes(spec.name)) {
  bundles.bundles.push(spec.name);
  out(`bundles     +${spec.name}（共 ${bundles.bundles.length} 个）`);
} else {
  out(`bundles     已包含 ${spec.name}`);
}

// 3. patch
let nextPatch = patchText;
if (!alreadyLinked) {
  nextPatch = patchText.replace(/\s*$/, '') + `\n\n- insert:\n    - id: ${spec.patchId}\n      name: ${spec.name}\n`;
  out(`patch       + insert id: ${spec.patchId}`);
}

// 4. junction
if (!dryRun) {
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  if (nextPatch !== patchText) fs.writeFileSync(patchFile, nextPatch);
  let current = null;
  try {
    current = fs.realpathSync(linkDir);
  } catch {
    current = null;
  }
  const target = fs.realpathSync(pkgDir);
  if (current && samePath(current, target)) {
    out('junction    已指向本仓库');
  } else {
    if (current !== null) {
      removeLink(linkDir);
      out(`junction    原来指向 ${current}，已断开`);
    }
    fs.symlinkSync(pkgDir, linkDir, 'junction');
    out('junction    建好了');
  }
  out('');
  out(`备份        ${path.basename(pkgFile)}.bak-${stamp} / ${path.basename(patchFile)}.bak-${stamp}`);
}

out('');
out(dryRun ? '（dry-run）上面这些都没真的做。去掉 --dry-run 才会写。' : '下一步：重启 DSH，然后在对话里用 prompt_audit 看第一行是不是「工具 4/4 已注册」。');
console.log(output.join('\n'));

/** Windows 的盘符大小写和斜杠方向不统一，比较前先归一。 */
function samePath(a, b) {
  const norm = (p) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
}

/** 只拆链接本身，绝不动目标目录里的东西。 */
function removeLink(link) {
  try {
    fs.unlinkSync(link);
    return;
  } catch {
    /* junction 在个别 Node 版本上要按目录删 */
  }
  fs.rmSync(link, { recursive: true, force: true });
}

function stripPatchBlock(text, id) {  const lines = text.split(/\r?\n/);
  const keep = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '- insert:') {
      // 找到这块 insert 的边界：下一行起缩进更深且直到下一个顶层 `- `
      let end = i + 1;
      while (end < lines.length && (lines[end].trim() === '' || /^\s{4,}/.test(lines[end]))) end += 1;
      const block = lines.slice(i, end).join('\n');
      if (block.includes(`id: ${id}`)) {
        i = end - 1;
        continue;
      }
    }
    keep.push(lines[i]);
  }
  return keep.join('\n');
}
