import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCard, copyFor, decisionFromAnswer } from '../lib/card.js';
import { classify, compileLists, overBudget, overPlanReads, wildcardToRegExp } from '../lib/policy.js';
import { approve, createState, PHASE, setTrusted, startTurn } from '../lib/state.js';

test('wildcardToRegExp anchors and escapes metacharacters', () => {
  assert.equal(wildcardToRegExp('read').test('read'), true);
  assert.equal(wildcardToRegExp('read').test('read_file'), false);
  assert.equal(wildcardToRegExp('mcp__*__qq_send*').test('mcp__snowluma__qq_send_message'), true);
  assert.equal(wildcardToRegExp('a.b').test('axb'), false);
  assert.equal(wildcardToRegExp('a.b').test('a.b'), true);
});

test('classify prefers read-only, then mutating, then unknown', () => {
  const lists = compileLists();
  assert.equal(classify('read', lists), 'read');
  assert.equal(classify('grep', lists), 'read');
  assert.equal(classify('write', lists), 'write');
  assert.equal(classify('bash', lists), 'write');
  assert.equal(classify('mcp__snowluma__qq_send_message', lists), 'write');
  assert.equal(classify('mcp__snowluma__qq_get_recent_messages', lists), 'unknown');
  assert.equal(classify('some_vendor_tool', lists), 'unknown');
});

test('deployment extras extend both lists without breaking defaults', () => {
  const lists = compileLists({ extraMutating: ['mcp__*__do_thing'], extraReadonly: ['mcp__*__get_thing'] });
  assert.equal(classify('mcp__x__do_thing', lists), 'write');
  assert.equal(classify('mcp__x__get_thing', lists), 'read');
  assert.equal(classify('write', lists), 'write');
});

test('budget helpers are inclusive caps', () => {
  assert.equal(overBudget({ calls: 11 }, 12), false);
  assert.equal(overBudget({ calls: 12 }, 12), true);
  assert.equal(overPlanReads({ reads: 3 }, 4), false);
  assert.equal(overPlanReads({ reads: 4 }, 4), true);
});

test('a new turn re-arms the gate but keeps a session opt-out', () => {
  const state = createState();
  approve(state);
  assert.equal(state.phase, PHASE.APPROVED);
  startTurn(state, 2);
  assert.equal(state.phase, PHASE.OPEN);

  setTrusted(state, true);
  startTurn(state, 3);
  assert.equal(state.phase, PHASE.TRUSTED);

  setTrusted(state, false);
  assert.equal(state.phase, PHASE.OPEN);
});

test('approve resets the budget window and counts cards only once', () => {
  const state = createState();
  state.calls = 9;
  state.reads = 3;
  state.cards = 1;
  approve(state);
  assert.equal(state.calls, 0);
  assert.equal(state.reads, 0);
  assert.equal(state.cards, 1);
  assert.equal(state.phase, PHASE.APPROVED);
});

test('card leads with what to click, then says what and how per route', () => {
  const card = buildCard(
    {
      goal: '把插件装上',
      routes: [
        {
          name: '最小改动',
          what: '换卡片正文渲染和工具参数',
          how: '读 card.js → 改 routes → 补测试 → 提交',
          cost: '3 分钟',
        },
        { name: '稳妥', what: '先加测试再动渲染', how: '写测试 → 跑红 → 改渲染 → 跑绿', cost: '多 5 分钟' },
      ],
      scope: ['lib/index.js'],
      acceptance: '屏幕上是琥珀色两键卡',
    },
    { locale: 'zh', turnToolBudget: 12 },
  );

  const [first] = card.detail.split('\n');
  assert.match(first, /点左边按 A 做/);
  assert.match(card.detail, /A · 最小改动\*\*（推荐） · 3 分钟/);
  assert.match(card.detail, /做什么：换卡片正文渲染和工具参数/);
  assert.match(card.detail, /怎么做：读 card\.js → 改 routes → 补测试 → 提交/);
  assert.match(card.detail, /B · 稳妥\*\* · 多 5 分钟/);
  assert.match(card.detail, /只动.*lib\/index\.js/);
  assert.match(card.detail, /验收.*琥珀色/);
  assert.equal(card.options.length, 2);
  assert.equal(card.approveLabel, '开工 · A');
  assert.equal(card.options[0].label, card.approveLabel);
  assert.deepEqual(card.intent, { kind: 'plan-review', approve: card.approveLabel });
});

test('card refuses to present a single route', () => {
  assert.throws(
    () => buildCard({ goal: 'g', routes: [{ name: '只有一条', what: 'x' }] }, { locale: 'zh', turnToolBudget: 12 }),
    /needs 2–3 routes/,
  );
});

test('card refuses a route that does not say what it does', () => {
  assert.throws(
    () => buildCard({ goal: 'g', routes: [{ name: '有名字', what: 'x' }, { name: '没内容' }] }, { locale: 'zh', turnToolBudget: 12 }),
    /has no "what"/,
  );
});

test('card body stays about one screen even for noisy routes', () => {
  const card = buildCard(
    {
      goal: '把 '.repeat(200),
      routes: [
        { name: '长'.repeat(80), what: '这样做 '.repeat(60), how: '这样改 '.repeat(60), cost: '很久 '.repeat(40) },
        { name: 'B'.repeat(80), what: '那样做 '.repeat(60), how: '那样改 '.repeat(60) },
        { name: 'C'.repeat(80), what: '再那样 '.repeat(60), how: '再那样改 '.repeat(60) },
      ],
      scope: Array.from({ length: 8 }, (_, index) => `lib/file-${index}.js`),
      risks: '全丢了 '.repeat(60),
      acceptance: '屏幕 '.repeat(60),
    },
    { locale: 'zh', turnToolBudget: 12 },
  );
  assert.ok(card.detail.length <= 1400, `card body was ${card.detail.length} chars`);
  assert.ok(card.detail.split('\n').length <= 18, 'card should stay about one screen');
  assert.equal(card.options.length, 2);
});

test('card falls back to an explicit "not declared" scope', () => {
  const card = buildCard(
    { goal: 'g', routes: [{ name: 'quick', what: 'x' }, { name: 'safe', what: 'y' }] },
    { locale: 'en', turnToolBudget: 5 },
  );
  assert.match(card.detail, /not declared/);
  assert.match(card.detail, /for B, press right/);
});

test('only the approve label opens the gate', () => {
  const card = buildCard(
    { goal: 'g', routes: [{ name: 'a', what: 'x' }, { name: 'b', what: 'y' }] },
    { locale: 'zh', turnToolBudget: 12 },
  );
  assert.equal(decisionFromAnswer({ label: card.approveLabel, approveLabel: card.approveLabel }), 'approved');
  assert.equal(decisionFromAnswer({ label: '换一条', approveLabel: card.approveLabel }), 'revise');
  assert.equal(decisionFromAnswer({ label: 'something else', approveLabel: card.approveLabel }), 'revise');
  assert.equal(decisionFromAnswer({ label: undefined, approveLabel: card.approveLabel }), 'revise');
});
