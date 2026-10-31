/**
 * Per-agent gate state.
 *
 * One state object per live agent. It survives across turns because the agent
 * does; {@link startTurn} re-arms it at the start of every user turn.
 *
 * @module dsh-route-gate/state
 */

/**
 * Gate phases.
 *
 * - `open`     — no card approved yet in this turn; mutating tools are blocked.
 * - `approved` — the user approved a route card; mutating tools pass.
 * - `trusted`  — the user opted this whole session out of the gate.
 */
export const PHASE = Object.freeze({
  OPEN: 'open',
  APPROVED: 'approved',
  TRUSTED: 'trusted',
});

/**
 * @typedef {object} GateState
 * @property {string} phase One of {@link PHASE}.
 * @property {boolean} trusted Session-wide opt-out flag.
 * @property {number} calls Tool calls actually executed in this turn.
 * @property {number} reads Read-only calls made while planning in this turn.
 * @property {number | undefined} turn Turn number this state is tracking.
 * @property {number} cards Route cards shown in this session.
 * @property {number} denials Tool calls blocked by the gate in this session.
 */

/**
 * Create the initial state for a fresh agent.
 *
 * @returns {GateState} A gate state in the `open` phase.
 */
export function createState() {
  return {
    phase: PHASE.OPEN,
    trusted: false,
    calls: 0,
    reads: 0,
    turn: undefined,
    cards: 0,
    denials: 0,
  };
}

/**
 * Begin a new user turn: reset counters and re-arm the gate unless the user
 * opted the session out.
 *
 * @param {GateState} state State to mutate.
 * @param {number | undefined} turn Turn number reported by the runtime.
 * @returns {GateState} The same state, for chaining.
 */
export function startTurn(state, turn) {
  state.calls = 0;
  state.reads = 0;
  state.turn = turn;
  state.phase = state.trusted ? PHASE.TRUSTED : PHASE.OPEN;
  return state;
}

/**
 * Record an approved route card. The budget window restarts so that planning
 * reads do not eat into the execution allowance.
 *
 * @param {GateState} state State to mutate.
 * @returns {GateState} The same state, for chaining.
 */
export function approve(state) {
  state.phase = PHASE.TRUSTED === state.phase ? PHASE.TRUSTED : PHASE.APPROVED;
  state.calls = 0;
  state.reads = 0;
  return state;
}

/**
 * Record a session-wide opt-out (or opt back in).
 *
 * @param {GateState} state State to mutate.
 * @param {boolean} trusted True to skip the gate for the rest of the session.
 * @returns {GateState} The same state, for chaining.
 */
export function setTrusted(state, trusted) {
  state.trusted = trusted;
  if (trusted) {
    state.phase = PHASE.TRUSTED;
    state.calls = 0;
    state.reads = 0;
  } else {
    state.phase = PHASE.OPEN;
  }
  return state;
}
