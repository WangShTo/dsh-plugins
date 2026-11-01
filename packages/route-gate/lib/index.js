/**
 * dsh-route-gate — route first, work second.
 *
 * Three cooperating parts:
 * 1. a system-prompt section that tells the model to plan before acting;
 * 2. a `tools/pre-execute` gate that hard-blocks mutating tools until the user
 *    approves a route card (prompt text alone can be ignored — this cannot);
 * 3. a per-turn tool budget that makes long tool-chains stop and report.
 *
 * @module dsh-route-gate
 */

import z from '@deepseek-ai/schemastery';
import { buildCard, copyFor, decisionFromAnswer, ROUTE_QUESTION_ID } from './card.js';
import { classify, compileLists, overBudget, overPlanReads, overTokenBudget } from './policy.js';
import { policyText } from './prompt.js';
import { approve, createState, PHASE, setTrusted, startTurn } from './state.js';
import { callTokens, resultTokens } from './weight.js';

/**
 * `defineTool` is provided by the host: it compiles the shorthand parameter
 * spec into JSON Schema and wraps `execute` with argument validation. Unit
 * tests run outside DSH where that package is not installed, so fall back to
 * identity there — the tests cover the gate logic, not the host's schema
 * compiler.
 */
const { defineTool } = await import('@deepseek-ai/dsh-tools').catch(() => ({
  defineTool: (options) => options,
}));

/** Cordis plugin name. */
export const name = 'route-gate';

/** Services this row needs before it can register its behaviour. */
export const inject = ['tools', 'systemPrompt'];

/** Runtime schema for the route-gate row. */
export const Config = z.object({
  trigger: z
    .string()
    .default('auto')
    .description('auto gates mutating tools until a route card is approved; strict also caps planning reads; off disables the gate.'),
  turnToolBudget: z
    .number()
    .default(12)
    .description('Executed tool calls allowed per turn before the gate forces a report.'),
  turnTokenBudget: z
    .number()
    .default(60000)
    .description(
      'Estimated tokens of tool output allowed per turn (4 characters ≈ 1 token). 0 disables the token bound.',
    ),
  planReadBudget: z
    .number()
    .default(4)
    .description('Read-only calls allowed before a route card. Only enforced when trigger is strict.'),
  locale: z.string().default('zh').description('Copy language for cards, denials and command output: zh or en.'),
  extraMutating: z
    .array(z.string())
    .default([])
    .description('Extra tool-name patterns (glob) to treat as mutating, on top of the built-in list.'),
  extraReadonly: z
    .array(z.string())
    .default([])
    .description('Extra tool-name patterns (glob) to treat as read-only, on top of the built-in list.'),
});

/** Denial copy, keyed by locale then by reason. */
const DENIALS = {
  zh: {
    gate: (tool, budget) =>
      `【路线闸门】路线还没确认，\`${tool}\` 被挡下了。先调 route_card 交一张路线卡（目的 / 交付物 / 验收 / 步骤 / 范围 / 风险），等用户点「开工」。不要换个工具绕。本轮执行预算 ${budget} 次。`,
    budget: (budget) =>
      `【路线闸门】本回合 ${budget} 次工具预算用完了。停下手上的调用，向用户汇报：做完了什么、卡在哪、下一步建议。`,
    budgetTokens: (spent, budget) =>
      `【路线闸门】本回合工具输出已经累计约 ${spent} token（上限 ${budget}），再调下去只是烧钱。停手，向用户汇报：做完了什么、卡在哪、下一步建议。`,
    planReads: (reads) =>
      `【路线闸门】计划期只读额度（${reads} 次）用完了。别再探了，现在调 route_card 交路线卡，等用户确认。`,
  },
  en: {
    gate: (tool, budget) =>
      `[route-gate] No approved route yet, so \`${tool}\` was blocked. Call route_card first (goal / deliverable / acceptance / steps / scope / risks) and wait for the user to choose Start. Do not route around this with another tool. Budget this turn: ${budget}.`,
    budget: (budget) =>
      `[route-gate] The ${budget}-call budget for this turn is spent. Stop calling tools and report: what is done, what is blocked, what you suggest next.`,
    budgetTokens: (spent, budget) =>
      `[route-gate] Tool output this turn has reached ~${spent} tokens (limit ${budget}); further calls only spend money. Stop and report: what is done, what is blocked, what you suggest next.`,
    planReads: (reads) =>
      `[route-gate] The ${reads}-read planning allowance is spent. Stop probing and call route_card now.`,
  },
};

/**
 * Register the route gate on a cordis context.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx Plugin context.
 * @param {object} config Validated {@link Config} values.
 */
export function apply(ctx, config) {
  const turnToolBudget = Math.max(1, Math.floor(config.turnToolBudget));
  const turnTokenBudget = Math.max(0, Math.floor(config.turnTokenBudget ?? 0));
  const planReadBudget = Math.max(0, Math.floor(config.planReadBudget));
  const denials = DENIALS[config.locale === 'en' ? 'en' : 'zh'];
  const lists = compileLists(config);
  /** @type {WeakMap<object, import('./state.js').GateState>} */
  const states = new WeakMap();

  const stateOf = (agent) => {
    let state = states.get(agent);
    if (state === undefined) {
      state = createState();
      states.set(agent, state);
    }
    return state;
  };

  const locale = config.locale === 'en' ? 'en' : 'zh';

  if (config.trigger !== 'off') {
    ctx.effect(
      () =>
        ctx.systemPrompt.section({
          name: 'route-gate:policy',
          order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY') + 10,
          text: () => policyText({ locale, turnToolBudget, planReadBudget }),
        }),
      'route-gate.policy()',
    );
  }

  ctx.on('agent/pre-step', (payload, next) => {
    const agent = payload?.agent;
    if (agent !== undefined) {
      const state = stateOf(agent);
      const turn = typeof payload.turn === 'number' ? payload.turn : undefined;
      const userMessage = Array.isArray(payload.messages) && payload.messages.some(isUserMessage);
      const nextTurn = turn !== undefined && state.turn !== undefined && turn !== state.turn;
      if (userMessage || nextTurn) startTurn(state, turn);
      else if (state.turn === undefined) state.turn = turn;
    }
    return next();
  });

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const agent = exec.agent;
    if (agent !== undefined && result?.isError !== true) {
      const state = stateOf(agent);
      state.calls += 1;
      state.tokens += resultTokens(result) + callTokens(exec);
      if (classify(exec.name, lists) === 'read') state.reads += 1;
    }
    return next();
  });

  ctx.on('tools/pre-execute', async (exec, next) => {
    if (config.trigger === 'off') return next();
    const agent = exec.agent;
    if (agent === undefined) return next();

    const state = stateOf(agent);
    if (state.phase === PHASE.TRUSTED) return next();

    if (turnTokenBudget > 0 && overTokenBudget(state, turnTokenBudget)) {
      state.denials += 1;
      return { kind: 'deny', reason: denials.budgetTokens(formatTokens(state.tokens), formatTokens(turnTokenBudget)) };
    }

    if (overBudget(state, turnToolBudget)) {
      state.denials += 1;
      return { kind: 'deny', reason: denials.budget(turnToolBudget) };
    }

    const kind = classify(exec.name, lists);
    if (kind === 'read') {
      if (config.trigger === 'strict' && overPlanReads(state, planReadBudget)) {
        state.denials += 1;
        return { kind: 'deny', reason: denials.planReads(planReadBudget) };
      }
      return next();
    }
    if (kind !== 'write') return next();
    if (state.phase === PHASE.APPROVED) return next();

    state.denials += 1;
    return { kind: 'deny', reason: denials.gate(exec.name, turnToolBudget) };
  });

  ctx.tools.register(
    defineTool({
          name: 'route_card',
          description:
            'Present the route for the current task and wait for the user to approve it. Call this before any write, edit, shell command or subagent while the route gate is closed.',
          parameters: {
            goal: {
              type: 'string',
              required: true,
              description: 'What the user actually wants, in one sentence.',
            },
            routes: {
              type: 'array',
              required: true,
              description:
                'Two or three real routes, recommended first. Each route says what it does and how it does it, so the user can weigh them.',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', required: true, description: 'Short route name, at most 24 characters.' },
                  what: {
                    type: 'string',
                    required: true,
                    description: 'What this route changes, in one line — the deliverable, not the benefit.',
                  },
                  how: {
                    type: 'string',
                    description: 'How you will do it: the concrete moves, joined with arrows (read → change → test → commit).',
                  },
                  cost: { type: 'string', description: 'What it costs: time, files touched, risk.' },
                },
              },
            },
            scope: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths you expect to modify.',
            },
            acceptance: {
              type: 'string',
              description: 'What the user will see on screen when this is done.',
            },
            risks: {
              type: 'string',
              description: 'What could break, in one line.',
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                decision: {
                  type: 'string',
                  required: true,
                  description: 'approved | revise | trusted | dismissed',
                },
              },
            },
            render: (_args, value) => [{ type: 'text', text: renderDecision(value.decision, locale) }],
          },
          execute: async (args, exec) => {
            const agent = exec.agent;
            if (agent === undefined) throw new Error('route_card needs a live agent.');
            const questions = ctx.get('userQuestions');
            if (questions === undefined) {
              throw new Error(
                'route_card needs the userQuestions service; this deployment has no questions channel, so set trigger:off instead.',
              );
            }

            const state = stateOf(agent);
            state.cards += 1;
            const card = buildCard(args, { locale, turnToolBudget });

            let answer;
            try {
              answer = await questions.ask({
                questions: [
                  {
                    id: ROUTE_QUESTION_ID,
                    header: card.title,
                    question: card.question,
                    detail: card.detail,
                    options: card.options,
                    intent: card.intent,
                  },
                ],
                agent,
                signal: exec.signal,
              });
            } catch (error) {
              if (error?.code === 'ASK_CANCELLED') return { decision: 'dismissed' };
              throw error;
            }

            const picked = answer?.answers?.find((item) => item.id === ROUTE_QUESTION_ID);
            const label = Array.isArray(picked?.selected) ? picked.selected[0] : undefined;
            if (typeof picked?.custom === 'string' && picked.custom.trim() !== '') {
              return { decision: 'revise' };
            }

            const decision = decisionFromAnswer({ label, approveLabel: card.approveLabel });
            if (decision === 'approved') approve(state);
            return { decision };
          },
        }),
  );

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'route',
      description: 'Show or change the route gate (on | off)',
      input: { hint: '[on|off]', attachments: false },
      handler: ({ agent, rawInput }) => {
        const state = stateOf(agent);
        const arg = rawInput.trim().toLowerCase();
        if (arg === 'off') {
          setTrusted(state, true);
          return { kind: 'success', text: copyFor(locale).offText };
        }
        if (arg === 'on') {
          setTrusted(state, false);
          return { kind: 'success', text: copyFor(locale).onText };
        }
        return {
          kind: 'success',
          text: copyFor(locale).statusText
            .replace('{phase}', state.phase)
            .replace('{calls}', String(state.calls))
            .replace('{budget}', String(turnToolBudget))
            .replace('{tokens}', formatTokens(state.tokens))
            .replace('{tokenBudget}', formatTokens(turnTokenBudget))
            .replace('{cards}', String(state.cards))
            .replace('{denials}', String(state.denials)),
        };
      },
    });
  });
}

/**
 * Format a token count for copy: 60000 → "60k".
 *
 * @param {number} value Tokens.
 * @returns {string} Short human form.
 */
function formatTokens(value) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

/**
 * Does this message come from the user?
 *
 * @param {any} message Message from the agent inbox.
 * @returns {boolean} True for real user messages, not tool results or notices.
 */
function isUserMessage(message) {
  if (message?.source?.kind === 'user') return true;
  return message?.role === 'user' && message?.source?.kind === undefined;
}

/**
 * Render the tool result text for one decision.
 *
 * @param {string} decision Gate decision.
 * @param {'zh' | 'en'} locale Copy bundle to use.
 * @returns {string} One line for the transcript.
 */
function renderDecision(decision, locale) {
  const zh = {
    approved: '路线已确认，开始执行。',
    revise: '用户要先改路线，停在计划阶段。',
    trusted: '用户本会话免确认，闸门已放开。',
    dismissed: '用户关掉了路线卡，仍在计划阶段。',
  };
  const en = {
    approved: 'Route approved — executing.',
    revise: 'User wants to revise the route; still planning.',
    trusted: 'User skipped the gate for this session.',
    dismissed: 'User dismissed the route card; still planning.',
  };
  const table = locale === 'en' ? en : zh;
  return table[decision] ?? (locale === 'en' ? 'Route decision recorded.' : '路线决定已记录。');
}
