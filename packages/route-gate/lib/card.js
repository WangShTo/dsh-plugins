/**
 * Route-card rendering.
 *
 * A route card is the only thing a user reads before DSH is allowed to touch
 * the machine. Everything here is shaped by one test: can someone who has not
 * been following the conversation tell, in three seconds, what to click and
 * what each choice costs?
 *
 * So the card is built decision-first, not summary-first: the first line says
 * what to do, the next lines are 2–3 named routes with a cost each, and only
 * then the scope, the check and the risk. It renders in DSH's plan-review
 * panel — an amber card, visually separate from the chat — which accepts
 * exactly two decisions, so the routes live in the body and the second button
 * hands the choice back to the chat.
 *
 * @module dsh-route-gate/card
 */

/** Copy for both supported locales. */
const COPY = {
  zh: {
    header: '路线卡 · 等你选',
    question: '走哪条？',
    lead: (letters) => `点左边按 A 做；想走 ${letters}，点右边回一句「${letters.split(' / ')[0]}」。`,
    what: '做什么',
    how: '怎么做',
    letterMark: '推荐',
    scope: '只动',
    scopeEmpty: '未声明，按最小改动执行',
    acceptance: '验收',
    risks: '风险',
    approve: (letter) => `开工 · ${letter}`,
    approveHint: '按 A 路线执行；超出这张卡声明的范围会重新上闸。',
    revise: '换一条',
    reviseHint: '先不执行。下一句说「B」或「C」，我就换那条路线重出卡。',
    offText: '路线闸门：本会话已关闭（/route on 可恢复）。',
    onText: '路线闸门：已重新打开，下一次改动前要交路线卡。',
    statusText: '路线闸门：{phase}｜本回合 {calls}/{budget} 次调用｜已出卡 {cards} 张｜累计拦截 {denials} 次。',
  },
  en: {
    header: 'Route card · pick one',
    question: 'Which route?',
    lead: (letters) => `Press left to run A; for ${letters}, press right and reply with the letter.`,
    what: 'What',
    how: 'How',
    letterMark: 'recommended',
    scope: 'Touches',
    scopeEmpty: 'not declared — smallest change wins',
    acceptance: 'Done when',
    risks: 'Risk',
    approve: (letter) => `Run · ${letter}`,
    approveHint: 'Execute route A; anything outside this card re-arms the gate.',
    revise: 'Switch route',
    reviseHint: 'Do not execute. Reply with B or C and I re-issue the card on that route.',
    offText: 'Route gate: off for this session (use /route on to re-arm).',
    onText: 'Route gate: on again — a route card is required before the next change.',
    statusText: 'Route gate: {phase} | {calls}/{budget} calls this turn | {cards} cards | {denials} blocked.',
  },
};

/** Route letters, in order. The first route is the recommendation. */
const LETTERS = ['A', 'B', 'C'];

/** A stable id for the question so answers can be matched. */
export const ROUTE_QUESTION_ID = 'route-review';

/** How many routes a card must carry: one recommendation is not a choice. */
export const MIN_ROUTES = 2;
export const MAX_ROUTES = 3;

/**
 * Pick the copy bundle for a configured locale.
 *
 * @param {string} locale `zh` or `en`; anything else falls back to `zh`.
 * @returns {typeof COPY.zh} Copy bundle.
 */
export function copyFor(locale) {
  return locale === 'en' ? COPY.en : COPY.zh;
}

/**
 * Collapse any input to one trimmed line, cut at `max` characters.
 *
 * @param {unknown} value Raw value, possibly multi-line or not a string.
 * @param {number} max Hard limit in characters.
 * @returns {string} Single-line text.
 */
function oneLine(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Keep the first `limit` non-empty strings.
 *
 * @param {unknown} value Candidate list.
 * @param {number} limit How many to keep.
 * @returns {string[]} Trimmed entries.
 */
function take(value, limit) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim())
    .slice(0, limit);
}

/**
 * Validate and normalise the route list.
 *
 * Every route must say what it does; a route without a `what` is a label, not
 * a choice the user can weigh.
 *
 * @param {unknown} routes Raw `routes` argument.
 * @returns {{ name: string, what: string, how: string, cost: string }[]} Two or three routes.
 * @throws {Error} When the model did not offer a real choice.
 */
export function normaliseRoutes(routes) {
  const list = Array.isArray(routes) ? routes : [];
  const named = list
    .filter((route) => route && typeof route === 'object' && typeof route.name === 'string')
    .map((route) => ({
      name: oneLine(route.name, 24),
      what: oneLine(route.what ?? '', 60),
      how: oneLine(route.how ?? '', 90),
      cost: oneLine(route.cost ?? '', 24),
    }))
    .filter((route) => route.name !== '');

  if (named.length < MIN_ROUTES) {
    throw new Error(
      `route_card needs ${MIN_ROUTES}–${MAX_ROUTES} routes so the user has a real choice; got ${named.length}. Put the recommended one first.`,
    );
  }
  const vague = named.find((route) => route.what === '');
  if (vague !== undefined) {
    throw new Error(
      `route "${vague.name}" has no "what": say what you will do on that route, and put the concrete moves in "how".`,
    );
  }
  return named.slice(0, MAX_ROUTES);
}

/**
 * Render a route card into the pieces the review panel needs.
 *
 * @param {object} args Tool arguments from `route_card`.
 * @param {string} args.goal One sentence: what the user actually wants.
 * @param {{ name: string, what: string, how?: string, cost?: string }[]} args.routes Two or three routes, recommended first.
 * @param {string[]} [args.scope] Paths expected to change.
 * @param {string} [args.acceptance] How the user verifies it on screen.
 * @param {string} [args.risks] What could break.
 * @param {{ locale?: string, turnToolBudget: number }} options Rendering options.
 * @returns {{
 *   title: string,
 *   question: string,
 *   detail: string,
 *   options: { label: string, description: string }[],
 *   intent: { kind: string, approve: string },
 *   approveLabel: string,
 * }} Ready-to-ask question payload plus the exact approve label.
 */
export function buildCard(args, options) {
  const copy = copyFor(options.locale ?? 'zh');
  const routes = normaliseRoutes(args.routes);
  const others = routes.slice(1).map((_, index) => LETTERS[index + 1]);

  const lines = [`**${copy.lead(others.join(' / '))}**`, ''];

  routes.forEach((route, index) => {
    const letter = LETTERS[index];
    const mark = index === 0 ? `（${copy.letterMark}）` : '';
    const cost = route.cost ? ` · ${route.cost}` : '';
    if (index > 0) lines.push('');
    lines.push(`**${letter} · ${route.name}**${mark}${cost}`);
    lines.push(`${copy.what}：${route.what}`);
    if (route.how) lines.push(`${copy.how}：${route.how}`);
  });
  lines.push('');

  const scope = take(args.scope, 4);
  lines.push(
    `**${copy.scope}** ${scope.length > 0 ? scope.map((item) => `\`${oneLine(item, 40)}\``).join(' · ') : copy.scopeEmpty}`,
  );
  if (args.acceptance) lines.push(`**${copy.acceptance}** ${oneLine(args.acceptance, 80)}`);
  if (args.risks) lines.push(`**${copy.risks}** ${oneLine(args.risks, 80)}`);

  const approveLabel = copy.approve(LETTERS[0]);

  return {
    title: copy.header,
    question: `${copy.question} ${oneLine(args.goal, 50)}`,
    detail: lines.join('\n'),
    options: [
      { label: approveLabel, description: copy.approveHint },
      { label: copy.revise, description: copy.reviseHint },
    ],
    // `plan-review` upgrades the ask from a generic option list to the amber
    // decision panel. That panel accepts exactly two options — hence the
    // routes in the body and a two-key frame.
    intent: { kind: 'plan-review', approve: approveLabel },
    approveLabel,
  };
}

/**
 * Map the user's answer back to a decision.
 *
 * Only the approve label opens the gate; the second key and any custom answer
 * mean "not route A".
 *
 * @param {{ label?: string, approveLabel: string }} input Answer label and the approve label of the card that was shown.
 * @returns {'approved' | 'revise'} Gate decision.
 */
export function decisionFromAnswer({ label, approveLabel }) {
  return label === approveLabel ? 'approved' : 'revise';
}
