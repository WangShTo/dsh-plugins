import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, Config, inject, name } from '../lib/index.js';

/**
 * Minimal stand-in for the parts of a cordis context this plugin touches, so
 * the gate can be exercised end to end without booting a harness.
 *
 * @param {{ answer?: { label?: string, custom?: string }, questions?: boolean }} options
 *   How the questions channel should answer.
 */
function makeCtx(options = {}) {
  const handlers = new Map();
  const tools = [];
  const commands = [];
  const sections = [];
  const disposers = [];
  const asked = [];

  const ctx = {
    effect(fn, _label) {
      const dispose = fn();
      disposers.push(dispose);
      return dispose;
    },
    on(event, handler, _options) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return () => {};
    },
    get(service) {
      if (service !== 'userQuestions') return undefined;
      if (options.questions === false) return undefined;
      return {
        ask: async (payload) => {
          asked.push(payload);
          const question = payload.questions[0];
          const picked = options.pick === 2 ? question.options[1] : question.options[0];
          const label = options.answer?.label ?? picked.label;
          return { answers: [{ id: 'route-review', selected: label ? [label] : [], custom: options.answer?.custom }] };
        },
      };
    },
    inject(_deps, callback) {
      callback(ctx);
    },
    tools: {
      register(definition) {
        tools.push(definition);
        return () => {};
      },
    },
    systemPrompt: {
      getSectionOrder: () => 500,
      section(section) {
        sections.push(section);
        return () => {};
      },
    },
    commands: {
      register(command) {
        commands.push(command);
        return () => {};
      },
    },
  };

  return { ctx, handlers, tools, commands, sections, disposers, asked };
}

/**
 * Fire one waterfall event the way the runtime does.
 *
 * @param {Map<string, Function[]>} handlers Registered handlers.
 * @param {string} event Event name.
 * @param {any} payload First argument.
 * @param {Function} inner Terminal implementation of the chain.
 */
async function fire(handlers, event, payload, inner) {
  const list = handlers.get(event) ?? [];
  const run = (index) => {
    if (index >= list.length) return inner();
    return list[index](payload, () => run(index + 1));
  };
  return run(0);
}

const allow = async () => ({ kind: 'allow' });

/** Two routes, the minimum a card accepts. */
const ROUTES = [
  { name: '快点', what: '只改一个文件', how: '改 → 跑测试' },
  { name: '稳点', what: '先补测试', how: '写测试 → 改 → 跑绿', cost: '多 5 分钟' },
];

/**
 * Fire a `tools/post-execute` chain: handlers receive `(exec, result, next)`.
 *
 * @param {Map<string, Function[]>} handlers Registered handlers.
 * @param {any} exec Tool execution.
 * @param {any} result Tool result.
 */
async function firePost(handlers, exec, result) {
  const list = handlers.get('tools/post-execute') ?? [];
  const run = (index) => {
    if (index >= list.length) return result;
    return list[index](exec, result, () => run(index + 1));
  };
  return run(0);
}

test('plugin exports a cordis row', () => {
  assert.equal(name, 'route-gate');
  assert.deepEqual(inject, ['tools', 'systemPrompt']);
});

test('mutating tools are denied until a route card is approved', async () => {
  const { ctx, handlers } = makeCtx();
  apply(ctx, Config({}));

  await fire(handlers, 'agent/pre-step', { agent: {}, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));

  const denied = await fire(handlers, 'tools/pre-execute', { agent: {}, name: 'write' }, allow);
  assert.equal(denied.kind, 'deny');
  assert.match(denied.reason, /路线/);

  const readAllowed = await fire(handlers, 'tools/pre-execute', { agent: {}, name: 'grep' }, allow);
  assert.equal(readAllowed.kind, 'allow');

  const unknownAllowed = await fire(handlers, 'tools/pre-execute', { agent: {}, name: 'vendor_tool' }, allow);
  assert.equal(unknownAllowed.kind, 'allow');
});

test('approving the card opens the gate and resets the budget', async () => {
  const { ctx, handlers, tools, asked } = makeCtx();
  apply(ctx, Config({}));

  const agent = {};
  await fire(handlers, 'agent/pre-step', { agent, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));

  const card = tools.find((item) => item.name === 'route_card');
  const result = await card.execute(
    { goal: '把插件装上', routes: ROUTES },
    { agent },
  );
  assert.equal(result.decision, 'approved');
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].questions[0].intent, { kind: 'plan-review', approve: '开工 · A' });
  assert.equal(asked[0].questions[0].options.length, 2);

  const gate = await fire(handlers, 'tools/pre-execute', { agent, name: 'edit' }, allow);
  assert.equal(gate.kind, 'allow');
});

test('"先改路线" keeps the gate closed, /route off opens it for the session', async () => {
  const reviseRun = makeCtx({ pick: 2 });
  apply(reviseRun.ctx, Config({}));
  const agentA = {};
  const cardA = reviseRun.tools.find((item) => item.name === 'route_card');
  assert.equal((await cardA.execute({ goal: 'g', routes: ROUTES }, { agent: agentA })).decision, 'revise');
  assert.equal((await fire(reviseRun.handlers, 'tools/pre-execute', { agent: agentA, name: 'write' }, allow)).kind, 'deny');

  const offRun = makeCtx({ pick: 2 });
  apply(offRun.ctx, Config({}));
  const agentB = {};
  offRun.commands[0].handler({ agent: agentB, rawInput: 'off' });
  assert.equal((await fire(offRun.handlers, 'tools/pre-execute', { agent: agentB, name: 'bash' }, allow)).kind, 'allow');
});

test('the turn budget stops the chain and counts only executed calls', async () => {
  const { ctx, handlers, tools } = makeCtx();
  apply(ctx, Config({ turnToolBudget: 3 }));

  const agent = {};
  await fire(handlers, 'agent/pre-step', { agent, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));
  const card = tools.find((item) => item.name === 'route_card');
  await card.execute({ goal: 'g', routes: ROUTES }, { agent });

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await fire(handlers, 'tools/pre-execute', { agent, name: 'read' }, allow)).kind, 'allow');
    await firePost(handlers, { agent, name: 'read' }, { isError: false });
  }

  const blocked = await fire(handlers, 'tools/pre-execute', { agent, name: 'read' }, allow);
  assert.equal(blocked.kind, 'deny');
  assert.match(blocked.reason, /预算/);

  // A denied call never reached execution, so it must not count against the budget.
  await firePost(handlers, { agent, name: 'read' }, { isError: true });
  const stillBlocked = await fire(handlers, 'tools/pre-execute', { agent, name: 'read' }, allow);
  assert.equal(stillBlocked.kind, 'deny');
});

test('a chatty tool is stopped by the token budget, not the call count', async () => {
  const { ctx, handlers, tools } = makeCtx();
  apply(ctx, Config({ turnToolBudget: 99, turnTokenBudget: 1000 }));

  const agent = {};
  await fire(handlers, 'agent/pre-step', { agent, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));
  const card = tools.find((item) => item.name === 'route_card');
  await card.execute({ goal: 'g', routes: ROUTES }, { agent });

  // One 8000-character dump ≈ 2000 tokens: over the allowance, under the call cap.
  await firePost(
    handlers,
    { agent, name: 'read', arguments: { path: 'big.log' } },
    { isError: false, content: [{ type: 'text', text: 'x'.repeat(8000) }] },
  );

  const blocked = await fire(handlers, 'tools/pre-execute', { agent, name: 'read' }, allow);
  assert.equal(blocked.kind, 'deny');
  assert.match(blocked.reason, /token/);
  assert.match(blocked.reason, /2k|2000/);
});

test('strict mode caps planning reads, auto mode does not', async () => {
  const strict = makeCtx();
  apply(strict.ctx, Config({ trigger: 'strict', planReadBudget: 1 }));
  const agent = {};
  await fire(strict.handlers, 'agent/pre-step', { agent, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));
  assert.equal((await fire(strict.handlers, 'tools/pre-execute', { agent, name: 'read' }, allow)).kind, 'allow');
  await firePost(strict.handlers, { agent, name: 'read' }, { isError: false });
  assert.equal((await fire(strict.handlers, 'tools/pre-execute', { agent, name: 'read' }, allow)).kind, 'deny');

  const auto = makeCtx();
  apply(auto.ctx, Config({ trigger: 'auto', planReadBudget: 1 }));
  const agent2 = {};
  await fire(auto.handlers, 'agent/pre-step', { agent: agent2, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));
  await firePost(auto.handlers, { agent: agent2, name: 'read' }, { isError: false });
  assert.equal((await fire(auto.handlers, 'tools/pre-execute', { agent: agent2, name: 'read' }, allow)).kind, 'allow');
});

test('trigger off disables every interception', async () => {
  const { ctx, handlers, sections } = makeCtx();
  apply(ctx, Config({ trigger: 'off' }));
  const agent = {};
  assert.equal((await fire(handlers, 'tools/pre-execute', { agent, name: 'write' }, allow)).kind, 'allow');
  assert.equal(sections.length, 0);
});

test('/route off and /route on toggle the session', async () => {
  const { ctx, handlers, commands } = makeCtx();
  apply(ctx, Config({}));
  const agent = {};
  await fire(handlers, 'agent/pre-step', { agent, messages: [{ source: { kind: 'user' } }], turn: 1 }, async () => ({
    kind: 'enter',
    messages: [],
  }));
  const route = commands.find((command) => command.name === 'route');

  assert.match(route.handler({ agent, rawInput: 'off' }).text, /关闭/);
  assert.equal((await fire(handlers, 'tools/pre-execute', { agent, name: 'write' }, allow)).kind, 'allow');

  assert.match(route.handler({ agent, rawInput: 'on' }).text, /打开/);
  assert.equal((await fire(handlers, 'tools/pre-execute', { agent, name: 'write' }, allow)).kind, 'deny');

  assert.match(route.handler({ agent, rawInput: '' }).text, /路线闸门/);
});
