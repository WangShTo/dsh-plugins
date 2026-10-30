// 命令行：node tools/fit.mjs [--apply|--dry|--undo]
//
// 默认 --dry：只算规则、打印 diff，不动任何文件。
// --apply ：写进 ~/.agents/AGENTS.md 的托管块（先备份）。
// --undo  ：把托管块整段删掉，块外内容不动。
import { runFit, summarize, defaultTarget, removeBlock } from '../lib/run.mjs';

const args = process.argv.slice(2);
const target = defaultTarget();

if (args.includes('--undo')) {
  const res = removeBlock({ target });
  console.log(res.changed ? `已撤掉托管块：${target}` : '没有找到托管块，未改动');
} else {
  const apply = args.includes('--apply');
  const res = runFit({ dryRun: !apply, target });
  console.log(summarize(res));
  console.log(`\n目标文件：${target}`);
  if (!apply) console.log('（dry-run，未写文件；要写入加 --apply）');
  if (res.changed) {
    console.log('\n将新增的行：');
    for (const line of res.added) console.log('  + ' + line);
    if (res.removed.length) {
      console.log('\n将移除的行：');
      for (const line of res.removed) console.log('  - ' + line);
    }
  }
}
