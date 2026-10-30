/**
 * lib/index.js — 插件的真身。
 *
 * 上一版挂不上的原因（三处，全部已修）：
 *   1. `import('@deepseek-ai/dsh-tools')` —— profile 里根本没这个包，抛出的错被 catch 吞了；
 *   2. `parameters` 写成了 `{ limitProjects: { type: 'integer' } }` 这种简写映射，注册器要的是 JSON Schema；
 *   3. 在根 ctx 上注册，但 DSH 的工具是要发布到 agent 作用域的。
 *
 * 现在只依赖宿主已经提供的服务：`ctx.tools`。工具定义是纯对象，
 * 不 import 任何 `@deepseek-ai/*` 运行时值，所以不会再因为版本/路径对不上而静默失效。
 *
 * 注册失败不允许拖垮 apply：每个工具单独 try，失败记进 loaded.json，
 * 少一个工具也要让另外三个活着。
 */

import fs from 'node:fs';
import path from 'node:path';

import { audit, formatReport } from './audit.mjs';
import { buildFit, runFit, summarize as summarizeFit, readLastFit, defaultTarget } from './run.mjs';
import { trend, formatTrend } from './trend.mjs';
import { styleProfile, formatStyle } from './style.mjs';
import { stateDir } from './agents.mjs';
import { collectUsageCached, perTurnCost, byProject, byDay, compact, n as num } from './token.mjs';

/** 插件名，与 cordis.patch.yml 里的 `name` 必须一致。 */
export const name = 'dsh-prompt-doctor';

/** 需要宿主注入的服务。只声明用得到的，少一个依赖就少一种挂不掉的理由。 */
export const inject = ['tools'];

const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

// ── 健康自检 ────────────────────────────────────────────────────────────────
// 写在 stateDir 里而不是内存里：模块级变量只能证明「文件被 import 过」，
// 证明不了「apply 真的被调用、工具真的注册上了」。上一版就是栽在这里。

function loadStatePath() {
  return path.join(stateDir(), 'loaded.json');
}

function writeLoadState(patch) {
  try {
    const dir = stateDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = loadStatePath();
    let prev = {};
    try {
      prev = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      /* 第一次或坏了，都用空对象 */
    }
    fs.writeFileSync(file, JSON.stringify({ ...prev, ...patch }, null, 2));
  } catch {
    /* 自检写不进去不影响工具本身 */
  }
}

function readLoadState() {
  try {
    return JSON.parse(fs.readFileSync(loadStatePath(), 'utf8'));
  } catch {
    return null;
  }
}

function ago(iso) {
  if (!iso) return '从未';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '刚刚';
  const min = Math.round(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.round(min / 60);
  if (hour < 48) return `${hour} 小时前`;
  return `${Math.round(hour / 24)} 天前`;
}

/** 工具返回的第一行永远是自检，不是数据——上一版无法分辨「没数据」和「没装上」。 */
function healthLine() {
  const st = readLoadState();
  const last = readLastFit();
  const tools = st?.tools?.length ? st.tools.join('/') : '无';
  const failed = st?.failed?.length ? ` · 注册失败 ${st.failed.join('; ')}` : '';
  const fit = last?.at ? `上次写入约定 ${ago(last.at)}` : '还没写入过约定';
  return `插件 dsh-prompt-doctor v${VERSION} · 工具 ${st?.tools?.length ?? 0}/4 已注册（${tools}）· ${fit}${failed}`;
}

// ── 工具定义 ────────────────────────────────────────────────────────────────
// 形状照抢宿主的 dsh-ops（`ptc/contract.js`：name/description/parameters/execute，
// 可选 output.schema+render、isConcurrencySafe、timeoutMs）。

const TEXT_SCHEMA = { type: 'string' };

/** 返回一条纯文本，不走 JSON —— BRIEF 要求「中文人话」。 */
function textTool({ name: toolName, description, parameters, timeoutMs = 120000, run }) {
  return {
    name: toolName,
    description,
    parameters,
    timeoutMs,
    isConcurrencySafe: () => true,
    output: {
      schema: TEXT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args = {}) {
      try {
        return await run(args);
      } catch (error) {
        return `${healthLine()}\n\n执行失败：${error?.message || error}`;
      }
    },
  };
}

function auditTool() {
  return textTool({
    name: 'prompt_audit',
    description:
      '体检我的提问习惯：扫本机会话日志，给出提示条数、长度分位、指代/返工/闸门/情绪/验收五类句式占比，以及最常待的项目。只读，不写任何文件。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limitProjects: { type: 'integer', description: '最多列几个项目，默认 5' },
      },
    },
    async run(args) {
      const report = audit({ limitProjects: clampInt(args.limitProjects, 5, 1, 20) });
      if (!report.ok) return `${healthLine()}\n\n体检失败：${report.reason}`;
      const lines = [healthLine(), '', formatReport(report)];
      if (report.badFrames) lines.push(`（${report.badFrames} 个坏帧被跳过，不影响统计）`);
      return lines.join('\n');
    },
  });
}

function fitTool() {
  return textTool({
    name: 'prompt_fit',
    description:
      '根据体检结果生成个性化约定，并写进 ~/.agents/AGENTS.md 的托管块（幂等、写前备份）。默认只预览不落盘；要真正写入必须显式传 apply=true。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        apply: { type: 'boolean', description: 'true=真的写入；省略或 false=只预览' },
        limitProjects: { type: 'integer', description: '最多统计几个项目，默认 8' },
      },
    },
    async run(args) {
      const res = runFit({ dryRun: !args.apply });
      if (!res.ok) return `${healthLine()}\n\n生成失败：${res.reason}`;
      const lines = [healthLine(), '', summarizeFit(res)];
      lines.push('');
      lines.push(
        res.dryRun
          ? `预览模式，没动盘。确认要写就说「应用」，我会带上 apply=true 再调一次。目标文件：${res.target}`
          : `已写入 ${res.target}，原内容备份在 ${path.join(stateDir(), 'backup')}。`,
      );
      return lines.join('\n');
    },
  });
}

function trendTool() {
  return textTool({
    name: 'prompt_trend',
    description:
      '看趋势和账单：按周看返工率与提示长度，用前/用后对比；再给真实 token 账（等效 token、每轮均价、烧得最多的项目、最近几天）。只读。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    async run() {
      const lines = [healthLine(), ''];
      try {
        const usage = collectUsageCached();
        const per = perTurnCost(usage);
        lines.push('真实账单（按 DSH 日志里的 usage 字段，不是估算）');
        lines.push(
          `  累计等效 token ${compact(usage.eq)} · ${num(usage.requests)} 次请求 / ${num(per.turns)} 轮 / ${num(usage.prompts)} 条真人提示`,
        );
        lines.push(`  平均每轮 ${compact(per.avg)}，最贵一轮 ${compact(per.top[0]?.eq ?? 0)}`);
        const top = byProject(usage.rows).slice(0, 3);
        if (top.length) lines.push(`  最烧的三个项目：${top.map((p) => `${p.project} ${compact(p.eq)}`).join(' · ')}`);
        const days = byDay(usage.rows).slice(-3);
        if (days.length) {
          lines.push(`  最近：${days.map((d) => `${d.day.slice(5)} ${compact(d.eq)}`).join(' · ')}（${days.reduce((a, d) => a + d.prompts, 0)} 条提示）`);
        }
        lines.push('');
      } catch (error) {
        lines.push(`账单读不到：${error?.message || error}`, '');
      }
      try {
        lines.push(formatTrend(trend()));
      } catch (error) {
        lines.push(`趋势读不到：${error?.message || error}`);
      }
      return lines.join('\n');
    },
  });
}

function styleTool() {
  return textTool({
    name: 'prompt_style',
    description:
      '生成我的习惯画像（≤40 行）：说话方式、五类句式占比、提示有多短、最常待的项目、上下文花在哪，最后一句结论。只读，不写文件。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    async run() {
      const report = audit({ limitProjects: 5 });
      let usage = null;
      try {
        usage = collectUsageCached();
      } catch {
        /* 账单缺了也能出画像，只是少一节 */
      }
      const profile = styleProfile({ report, usage });
      return [healthLine(), '', formatStyle(profile)].join('\n');
    },
  });
}

function clampInt(v, fallback, min, max) {
  const x = Number(v);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

// ── 注册 ────────────────────────────────────────────────────────────────────

/**
 * 三档降级注册。宿主版本不同，`output` / `isConcurrencySafe` 未必都认；
 * 只要有一档进了，工具就能用，具体降到了哪一档会记进 loaded.json。
 */
function registerWithFallback(registry, definition) {
  const { output, isConcurrencySafe, ...bare } = definition;
  const attempts = [
    ['full', definition],
    ['no-output', { ...bare, isConcurrencySafe }],
    ['bare', bare],
  ];
  const errors = [];
  for (const [tier, candidate] of attempts) {
    try {
      registry.register(candidate);
      return { ok: true, tier };
    } catch (error) {
      errors.push(`${tier}: ${error?.message || error}`);
    }
  }
  return { ok: false, error: errors.join(' | ') };
}

export function apply(ctx, config = {}) {
  const registry = ctx?.tools ?? ctx?.get?.('tools');

  if (!registry || typeof registry.register !== 'function') {
    writeLoadState({ version: VERSION, tools: [], failed: ['宿主没有可用的 tools 服务'], at: new Date().toISOString() });
    ctx?.logger?.warn?.('dsh-prompt-doctor: 宿主没有 tools 服务，工具未注册（插件本身仍在运行）');
    return;
  }

  const ok = [];
  const failed = [];
  const tiers = {};

  for (const make of [auditTool, fitTool, trendTool, styleTool]) {
    const definition = make();
    const res = registerWithFallback(registry, definition);
    if (res.ok) {
      ok.push(definition.name);
      if (res.tier !== 'full') tiers[definition.name] = res.tier;
    } else {
      failed.push(`${definition.name}: ${res.error}`);
    }
  }

  writeLoadState({
    version: VERSION,
    tools: ok,
    failed,
    tiers,
    pid: process.pid,
    at: new Date().toISOString(),
  });

  if (failed.length) {
    ctx?.logger?.warn?.(`dsh-prompt-doctor: ${failed.length} 个工具没注册上：${failed.join('; ')}`);
  }

  // 自动适配默认关：写用户的指令文件属于改别人东西，必须显式开。
  if (config?.autoFit) {
    const timer = setTimeout(() => {
      try {
        const res = runFit({ dryRun: false, target: config.target || defaultTarget() });
        writeLoadState({ autoFit: { at: new Date().toISOString(), ok: !!res.ok, changed: !!res.changed } });
      } catch (error) {
        writeLoadState({ autoFit: { at: new Date().toISOString(), ok: false, error: String(error?.message || error) } });
      }
    }, Number(config.autoFitDelayMs) || 15000);
    timer.unref?.();
  }
}

export { healthLine };
