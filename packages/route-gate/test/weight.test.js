import test from 'node:test';
import assert from 'node:assert/strict';

import { callTokens, DEFAULT_TOKEN_BUDGET, estimateTokens, resultText, resultTokens } from '../lib/weight.js';

test('result weight counts text parts and ignores the rest', () => {
  assert.equal(resultText({ content: [{ type: 'text', text: 'ab' }, { type: 'image', data: 'zzz' }] }), 'ab');
  assert.equal(resultTokens({ content: [{ type: 'text', text: 'a'.repeat(400) }] }), 100);
  assert.equal(resultTokens({ content: [{ type: 'text', text: '' }] }), 0);
  assert.equal(resultTokens(undefined), 0);
  assert.equal(resultTokens({ content: 'not an array' }), 0);
});

test('call weight counts the arguments the model had to write', () => {
  const args = { path: 'lib/index.js', content: 'x'.repeat(80) };
  assert.equal(callTokens({ arguments: args }), estimateTokens(JSON.stringify(args).length));
  assert.equal(callTokens({}), 0);
  assert.equal(callTokens(undefined), 0);
});

test('estimates stay finite for junk input', () => {
  assert.equal(estimateTokens(0), 0);
  assert.equal(estimateTokens(-10), 0);
  assert.equal(estimateTokens(Number.NaN), 0);
  // Circular arguments must not throw.
  const circular = {};
  circular.self = circular;
  assert.equal(callTokens({ arguments: circular }), 0);
});

test('the default allowance is large enough to be a backstop, not a nuisance', () => {
  assert.ok(DEFAULT_TOKEN_BUDGET >= 20000);
});
