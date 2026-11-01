/**
 * Tool-output weight.
 *
 * A call budget counted in calls is a poor proxy for cost: one `bash` that
 * dumps 40k characters costs more than twenty `grep` calls. This module
 * estimates what a call and its result add to the context, so the gate can
 * stop on money instead of on count.
 *
 * Pure functions only — no Cordis context, no I/O.
 *
 * @module dsh-route-gate/weight
 */

/** Characters per token, for the rough estimate used across the gate. */
export const CHARS_PER_TOKEN = 4;

/** Default per-turn allowance, in estimated tokens of tool output. */
export const DEFAULT_TOKEN_BUDGET = 60000;

/**
 * Join the text parts of a tool result.
 *
 * @param {{ content?: Array<{ type?: string, text?: string }> } | undefined} result Tool result.
 * @returns {string} Text the model will read.
 */
export function resultText(result) {
  const content = result?.content;
  if (!Array.isArray(content)) return '';
  let text = '';
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') text += part.text;
  }
  return text;
}

/**
 * Estimate tokens for a character count.
 *
 * @param {number} chars Characters.
 * @returns {number} Estimated tokens, rounded up.
 */
export function estimateTokens(chars) {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Estimate what a tool result adds to the context.
 *
 * @param {object | undefined} result Tool result.
 * @returns {number} Estimated tokens.
 */
export function resultTokens(result) {
  return estimateTokens(resultText(result).length);
}

/**
 * Estimate what the call's own arguments add to the context.
 *
 * Arguments travel with the call, so a 200-line file written by `write` costs
 * twice: once on the way in, once when it is read back.
 *
 * @param {{ arguments?: unknown } | undefined} exec Tool call.
 * @returns {number} Estimated tokens.
 */
export function callTokens(exec) {
  const args = exec?.arguments;
  if (args === undefined || args === null) return 0;
  let json;
  try {
    json = JSON.stringify(args);
  } catch {
    return 0;
  }
  return estimateTokens(typeof json === 'string' ? json.length : 0);
}
