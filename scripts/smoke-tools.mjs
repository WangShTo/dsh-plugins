// smoke-tools.mjs —— 不装进 profile 也能验的最小闭环。
//
// 验的是「apply 被调用 → 四个工具真的进了注册表 → 每个都能返回中文人话」，
// 以及宿主不认 output/isConcurrencySafe 时会降级注册而不是整组失效。
//
// 跑：node scripts/smoke-tools.mjs

import { apply, name, inject } from '../packages/prompt-doctor/lib/index.js';

let failed = 0;
const say = (ok, label, extra = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);
};

// ── 1. 全功能注册器 ────────────────────────────────────────────────────────
const registered = [];
const fullCtx = {
  tools: {
    register(definition) {
      if (!definition?.name) throw new Error('definition 缺 name');
      if (definition.parameters?.type !== 'object') throw new Error('parameters 不是 JSON Schema');
      registered.push(definition);
      return () => {};
    },
  },
  logger: { warn: (m) => console.log('  warn:', m) },
};

apply(fullCtx, {});

say(name === 'dsh-prompt-doctor', '插件名正确', name);
say(Array.isArray(inject) && inject.includes('tools'), 'inject 声明了 tools');
say(registered.length === 4, `四个工具都注册上了（实际 ${registered.length}）`);
say(
  ['prompt_audit', 'prompt_fit', 'prompt_trend', 'prompt_style'].every((n) => registered.some((d) => d.name === n)),
  '工具名一个不差',
  registered.map((d) => d.name).join(','),
);
say(
  registered.every((d) => typeof d.execute === 'function'),
  '每个都有 execute',
);

// ── 2. 每个工具真的跑一次，输出必须是中文人话 ──────────────────────────────
for (const definition of registered) {
  const started = Date.now();
  let out = '';
  try {
    out = await definition.execute({});
  } catch (error) {
    say(false, `${definition.name} 抛异常`, error?.message);
    continue;
  }
  const ms = Date.now() - started;
  const isText = typeof out === 'string' && out.trim().length > 20;
  const isChinese = /[\u4e00-\u9fa5]/.test(out);
  say(isText && isChinese, `${definition.name} 返回中文人话`, `${ms}ms / ${out.length} 字`);
  if (!isText || !isChinese) console.log('  ----\n' + String(out).slice(0, 300) + '\n  ----');
}

// ── 3. 只认裸定义的宿主：必须降级成功，不许整组失效 ────────────────────────
const bare = [];
const strictCtx = {
  tools: {
    register(definition) {
      if ('output' in definition || 'isConcurrencySafe' in definition) throw new Error('unsupported field');
      bare.push(definition);
      return () => {};
    },
  },
};
apply(strictCtx, {});
say(bare.length === 4, `旧宿主降级注册仍然四个都上（实际 ${bare.length}）`);

// ── 4. 没有 tools 服务：只许 warn，不许抛 ──────────────────────────────────
let threw = false;
try {
  apply({}, {});
} catch {
  threw = true;
}
say(!threw, '宿主没有 tools 服务时 apply 不抛');

console.log('');
console.log(failed === 0 ? '全部通过' : `${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
