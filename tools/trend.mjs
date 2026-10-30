// prompt-doctor trend —— 用前用后对比：托管块写入之后，返工率变了没有。
//
//   node tools/trend.mjs                 # 用 ~/.dsh/prompt-doctor/last-fit.json 的写入时间切
//   node tools/trend.mjs --since 2026-10-30
//   node tools/trend.mjs --json          # 给别的程序吃

import { trend, formatTrend } from '../lib/trend.mjs';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const sinceArg = flag('--since');
const since = sinceArg ? new Date(`${sinceArg}T00:00:00`).getTime() : undefined;

const result = trend({ since });

if (argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(formatTrend(result));
}
