// 冒烟：包清单与 profile 行（安装靠这两处，写错了插件不会出现）。
import { readFileSync } from 'node:fs';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const patch = readFileSync('cordis.patch.yml', 'utf8');

ok(pkg.name === 'dsh-prompt-doctor', '包名');
ok(pkg.main === './lib/index.js', 'main 指向 lib/index.js');
ok(pkg.exports['.'] === './lib/index.js', 'exports["."]');
ok(pkg.exports['./client'] === './client/client.js', 'exports["./client"]');
ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch');
ok(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform');
ok(patch.includes('dsh-prompt-doctor'), 'patch 里有本包');
ok(patch.includes('insert:') && patch.includes('id:'), 'patch 是 insert 行格式');
process.exitCode = fail ? 1 : 0;
