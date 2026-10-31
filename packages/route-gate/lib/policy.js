/**
 * Tool classification and budget arithmetic.
 *
 * Pure functions only — no Cordis context, no I/O — so the gate's decisions are
 * unit-testable without booting a harness.
 *
 * @module dsh-route-gate/policy
 */

/** Tool names that mutate the workspace, a process, or the user's desktop. */
export const DEFAULT_MUTATING = [
  'write',
  'edit',
  'bash',
  'pwsh',
  'ops_bash',
  'subagent',
  'subagent_fork',
  'workflow',
  'desktop_control',
  'unlag_refresh',
  'schedule_create',
  'schedule_update',
  'schedule_delete',
  'qq_send*',
  'qq_reply',
  'qq_mark_read',
  'qq_set_wake_config',
  'mcp__*__qq_send*',
  'mcp__*__qq_reply',
];

/** Tool names that only read state. A read-only match always wins over a mutating match. */
export const DEFAULT_READONLY = [
  'read',
  'read_image',
  'glob',
  'grep',
  'ops_read_files',
  'ops_discover_tools',
  'web_search',
  'web_fetch',
  'skill',
  'todo_write',
  'present',
  'compress',
  'decompress',
  'search_context',
  'acp_status',
  'acp_cache',
  'schedule_list',
  'list_agents',
  'windows',
  'screen_view',
  'mcp__web-search-safe__*',
];

/**
 * Compile one `*`-wildcard pattern to an anchored RegExp. Every other regex
 * metacharacter is matched literally, so a tool name stays a tool name.
 *
 * @param {string} pattern Wildcard pattern such as `mcp__*__qq_send*`.
 * @returns {RegExp} Anchored matcher.
 */
export function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`);
}

/**
 * Merge deployment extras into the built-in lists and compile them once.
 *
 * @param {{ extraMutating?: string[], extraReadonly?: string[] }} config Plugin config.
 * @returns {{ mutating: RegExp[], readonly: RegExp[] }} Compiled matchers.
 */
export function compileLists(config = {}) {
  const mutating = [...DEFAULT_MUTATING, ...(config.extraMutating ?? [])].map(wildcardToRegExp);
  const readonly = [...DEFAULT_READONLY, ...(config.extraReadonly ?? [])].map(wildcardToRegExp);
  return { mutating, readonly };
}

/**
 * Classify one tool call.
 *
 * `read` and `write` are gated differently; `unknown` passes the gate untouched
 * so that a third-party tool this build has never heard of cannot deadlock a
 * session (list it in `extraMutating` to gate it).
 *
 * @param {string} toolName Tool name reported by the runtime.
 * @param {{ mutating: RegExp[], readonly: RegExp[] }} lists Compiled matchers.
 * @returns {'read' | 'write' | 'unknown'} The tool's class.
 */
export function classify(toolName, lists) {
  if (lists.readonly.some((pattern) => pattern.test(toolName))) return 'read';
  if (lists.mutating.some((pattern) => pattern.test(toolName))) return 'write';
  return 'unknown';
}

/**
 * Decide whether this call is over budget before it runs.
 *
 * @param {{ calls: number }} state Per-agent gate state.
 * @param {number} turnToolBudget Maximum tool calls in one execution window.
 * @returns {boolean} True when the call must be denied.
 */
export function overBudget(state, turnToolBudget) {
  return state.calls >= turnToolBudget;
}

/**
 * Decide whether the planning allowance for read-only probes is spent.
 *
 * @param {{ reads: number }} state Per-agent gate state.
 * @param {number} planReadBudget Maximum read-only calls before a route card.
 * @returns {boolean} True when further reads need an approved card.
 */
export function overPlanReads(state, planReadBudget) {
  return state.reads >= planReadBudget;
}
