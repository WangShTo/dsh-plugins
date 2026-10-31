/**
 * System-prompt policy text.
 *
 * The gate alone produces refusals; this section is what makes the model plan
 * *before* it runs into one. It sits next to the built-in plan policy and is
 * disabled together with the plugin (`trigger: off`).
 *
 * @module dsh-route-gate/prompt
 */

/**
 * Render the policy section.
 *
 * @param {{ locale?: string, turnToolBudget: number, planReadBudget: number, strict?: boolean }} config Plugin config.
 * @returns {string} Markdown policy text, or an empty string when disabled.
 */
export function policyText(config) {
  const budget = String(config.turnToolBudget);
  const reads = String(config.planReadBudget);

  if (config.locale === 'en') {
    return [
      '## Route gate',
      '',
      'This session is gated. Before you change anything, present a route card with the `route_card` tool:',
      '- `goal` — what the user actually wants, in one sentence;',
      '- `routes` — **two or three** routes, recommended first, each with `name`, `what` (what changes) and `how` (read → change → test → commit);',
      '- `scope` — the paths you expect to modify;',
      '- `acceptance` — what the user will see on screen;',
      '- `risks` — what could break.',
      '',
      'The card is the decision, not a summary: first line says what to click, then the routes. Keep it under eight short lines so it fits on one screen without scrolling. Then wait. Until the card is approved, `write`, `edit`, `bash`, `pwsh` and `subagent` are rejected by the tool gate.',
      `While planning you may read (read, grep, glob, web) — at most ${reads} calls. Batch independent reads into one step instead of probing one file at a time.`,
      '',
      `Budget: ${budget} executed tool calls per turn. When a call is denied, do not retry it — either call \`route_card\`, or stop and report what is blocked.`,
    ].join('\n');
  }

  return [
    '## 路线闸门',
    '',
    '本会话开着路线闸门。动任何东西之前，先用 `route_card` 工具交一张路线卡：',
    '- `goal` 一句话说清用户真正要什么；',
    '- `routes` **两到三条**路线，推荐的那条排第一，每条写 `name`（名字）、`what`（会改什么）、`how`（具体怎么改：读什么 → 改什么 → 跑什么 → 提交）；',
    '- `scope` 预计要改的路径；',
    '- `acceptance` 用户屏幕上看到什么算完成；',
    '- `risks` 可能出问题的地方。',
    '',
    '卡片是决策不是总结：第一行就说点什么，然后列路线。整卡不超过八行，一屏读完不滚动。然后等用户决定。卡片没批之前，`write`、`edit`、`bash`、`pwsh`、`subagent` 会被工具闸门拒掉。',
    `计划期可以读（read / grep / glob / web），最多 ${reads} 次；能并行的读要一次发完，不要一个文件一个文件探。`,
    '',
    `预算：每个回合最多 ${budget} 次实际执行的工具调用。被拒的工具不要原样重试——要么调 \`route_card\`，要么停下来说清卡在哪。`,
  ].join('\n');
}
