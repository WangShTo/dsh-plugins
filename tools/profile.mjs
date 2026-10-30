// 安装 / 卸载 / 自检：把本包挂进某个 DSH profile。
//
// 为什么要有这个脚本：2026-10-30 两次把 DSH 弄挂，都是手改 profile 文件——
//   1) 用 PowerShell `Set-Content -Encoding UTF8` 写 package.json → 带了 BOM →
//      DesktopHostFatalError: Unexpected token '\ufeff'
//   2) 把客户端入口挪进子目录 → web boot: 12 entries did not activate
// 所以这里所有写盘都走 node（无 BOM），并在写完后再读回来按宿主的方式校验一遍。
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..');
const PKG = 'dsh-prompt-doctor';

const arg = process.argv[2] ?? 'status';
const profileArg = process.argv[3];
const profile = profileArg
  ?? join(process.env.USERPROFILE ?? '', '.dsh', 'profiles', 'desktop');

const pkgJsonPath = join(profile, 'package.json');
const patchPath = join(profile, 'cordis.patch.yml');
const linkPath = join(profile, 'node_modules', PKG);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const writeJson = (p, obj) => writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8'); // 无 BOM

function backup(file) {
  if (!existsSync(file)) return null;
  const dst = `${file}.bak-${Date.now()}`;
  copyFileSync(file, dst);
  return dst;
}

function status() {
  const pkg = readJson(pkgJsonPath);
  const bundles = pkg.dsh?.profile?.bundles ?? [];
  const patch = readFileSync(patchPath, 'utf8');
  const linked = existsSync(linkPath);
  const inBundles = bundles.includes(PKG);
  const inPatch = new RegExp(`name:\\s*"?${PKG}"?`).test(patch);
  console.log(`profile      ${profile}`);
  console.log(`bundles      ${bundles.length} 个${inBundles ? '（含本包）' : '（不含本包）'}`);
  console.log(`patch 行     ${inPatch ? '有' : '无'}`);
  console.log(`node_modules ${linked ? '有路径（junction/副本）' : '无'}`);
  console.log(`结论         ${inBundles && inPatch && linked ? '已安装' : '未安装'}`);
}

function verify() {
  let fail = 0;
  const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };

  for (const f of [pkgJsonPath, patchPath]) {
    if (!existsSync(f)) { ok(false, `${f} 存在`); continue; }
    const raw = readFileSync(f);
    const bom = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;
    ok(!bom, `${f.split(/[\\/]/).pop()} 无 BOM`);
  }

  // 宿主第一件事就是 JSON.parse 这份清单，BOM 会让它直接 fatal
  try { readJson(pkgJsonPath); ok(true, 'package.json 可 JSON.parse'); }
  catch (e) { ok(false, `package.json 可 JSON.parse（${e.message}）`); process.exit(1); }

  const pkg = readJson(pkgJsonPath);
  const bundles = pkg.dsh?.profile?.bundles ?? [];
  ok(new Set(bundles).size === bundles.length, 'bundles 无重复项');

  const manifest = readJson(join(pkgDir, 'package.json'));
  ok(manifest.name === PKG, `本包名 ${PKG}`);
  for (const [key, target] of Object.entries(manifest.exports ?? {})) {
    if (key.includes('*')) continue;
    ok(existsSync(join(pkgDir, String(target).replace(/^\.\//, ''))), `本包 exports ${key} 存在`);
  }

  if (existsSync(linkPath)) {
    for (const f of ['index.js', 'client.js']) {
      ok(existsSync(join(linkPath, f)), `profile 里能看到 ${f}`);
    }
  }

  console.log(fail ? `\n${fail} 项不通过` : '\nprofile 结构正常');
  process.exitCode = fail ? 1 : 0;
}

function install() {
  const b1 = backup(pkgJsonPath);
  const b2 = backup(patchPath);
  console.log(`备份: ${b1 ? b1.split(/[\\/]/).pop() : '-'}, ${b2 ? b2.split(/[\\/]/).pop() : '-'}`);

  const pkg = readJson(pkgJsonPath);
  pkg.dependencies ??= {};
  pkg.dependencies[PKG] = `link:${pkgDir.replace(/\\/g, '/')}`;
  pkg.dsh ??= {};
  pkg.dsh.profile ??= {};
  const bundles = new Set(pkg.dsh.profile.bundles ?? []);
  bundles.add(PKG);
  pkg.dsh.profile.bundles = [...bundles];
  writeJson(pkgJsonPath, pkg);

  let patch = readFileSync(patchPath, 'utf8');
  if (!new RegExp(`name:\\s*"?${PKG}"?`).test(patch)) {
    const row = `- insert:\n    - id: prompt-doctor\n      name: ${PKG}\n`;
    patch = `${patch.replace(/\s*$/, '')}\n${row}`;
    writeFileSync(patchPath, patch, 'utf8');
    console.log('patch 行已追加');
  } else {
    console.log('patch 行已存在，跳过');
  }

  mkdirSync(linkPath, { recursive: true });
  if (!existsSync(join(linkPath, 'package.json'))) {
    rmSync(linkPath, { recursive: true, force: true });
    console.log(`注意：node_modules/${PKG} 需要指向 ${pkgDir} 的目录联接`);
    console.log(`  New-Item -ItemType Junction -Path "${linkPath}" -Target "${pkgDir}"`);
  }

  verify();
}

function uninstall() {
  backup(pkgJsonPath);
  backup(patchPath);
  const pkg = readJson(pkgJsonPath);
  if (pkg.dependencies) delete pkg.dependencies[PKG];
  if (Array.isArray(pkg.dsh?.profile?.bundles)) {
    pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((x) => x !== PKG);
  }
  writeJson(pkgJsonPath, pkg);

  const patch = readFileSync(patchPath, 'utf8')
    .replace(new RegExp(`- insert:\\s*\\n\\s*- id: prompt-doctor\\s*\\n\\s*name: ${PKG}\\s*\\n?`, 'g'), '');
  writeFileSync(patchPath, patch, 'utf8');
  console.log('已从 profile 摘除（node_modules 里的联接保留，可复装）');
  status();
}

if (arg === 'status') status();
else if (arg === 'verify') verify();
else if (arg === 'install') install();
else if (arg === 'uninstall') uninstall();
else { console.error('用法: node tools/profile.mjs status|verify|install|uninstall [profileDir]'); process.exit(2); }

// 目录联接检查：Windows 上 ln -s 会退化成复制，这里只提示不自动做
if (arg === 'status' && existsSync(linkPath)) {
  const pj = join(linkPath, 'package.json');
  if (existsSync(pj) && readFileSync(pj, 'utf8') !== readFileSync(join(pkgDir, 'package.json'), 'utf8')) {
    console.log('警告：profile 里的副本与源码不一致（可能是复制而非联接）');
  }
}
void readdirSync;
