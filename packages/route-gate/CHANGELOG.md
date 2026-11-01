# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] — 2026-11-01

### Added

- **Token budget**: the per-turn bound is now spent in estimated tool-output
  tokens as well as calls — `turnTokenBudget`, default 60000, `0` disables.
  Weight counts the text of a result plus the JSON of its arguments (4
  characters ≈ 1 token), so one command that dumps a file costs what it should
  instead of counting the same as twenty greps. Denial copy states the spend
  ("约 62k token / 上限 60k") so the model knows it is over money, not over
  count.
- `/route` status now shows `calls/budget · tokens/tokenBudget`.

### Changed

- `lib/weight.js` (pure functions) owns the estimate; `lib/state.js` carries
  `tokens` and resets it with the other counters; `lib/policy.js` exposes
  `overTokenBudget`.
- `npm test` now runs the weight suite too (25 cases).

## [0.4.0] — 2026-11-01

### Changed

- Every route now carries **what it does and how it does it**: `routes[].what`
  (the change) and `routes[].how` (the concrete moves — read → change → test →
  commit), rendered under each route header. A route without `what` is rejected
  (`has no "what"`): a name alone is a label, not a choice.
- The one-screen bound moved with the extra detail: the test now allows ~16
  short lines instead of 9, and the doc example is regenerated from the same
  `what` / `how` fields.

## [0.3.0] — 2026-10-31

### Changed

- The card offers **two or three routes** (`routes`: name + one line + cost),
  recommended first. A single recommendation is no longer accepted: `route_card`
  fails with `needs 2–3 routes` instead of pretending there is a choice.
- The card is decision-first. Line one tells the user what to click; then one
  line per route; then scope / acceptance / risk. The budget line left the card
  (it is still in the prompt section, the denial reasons and `/route`).
- The primary key names the recommendation (`开工 · A` / `Run · A`) and the
  second key is `换一条` / `Switch route`, which hands B and C back to the chat —
  the native review panel accepts exactly two options, so extra routes live in
  the body.

### Tests

- Route cardinality, the one-screen bound, and approve-label mapping.

## [0.2.0] — 2026-10-31

### Changed

- The route card now renders in DSH's native plan-review panel instead of a
  generic option list: amber card, two decisions, primary action first, body
  rendered as Markdown. `ask()` passes `intent: { kind: 'plan-review', approve }`.
- Card body is compressed to one screen: goal, recommended route, at most five
  steps, at most four paths, then risk / acceptance / budget. Every line is
  truncated instead of wrapped.
- Approve label is now `开工 · 按推荐` / `Start · as proposed`; the revise label
  is `先改路线` / `Change the route`.
- `recommend` replaces `deliverable` in the `route_card` schema: the card states
  why this route beats the obvious alternative, and the landing spot moves into
  `acceptance`.
- The per-session opt-out is no longer a third card button (the panel accepts
  exactly two); it is only `/route off`.

### Removed

- `trusted` as a card decision. `decisionFromAnswer` now returns only
  `approved` or `revise`; the `trusted` phase is reachable only via `/route off`.

## [0.1.0] — 2026-10-30

### Added

- Route card tool (`route_card`) rendered in the native questions channel with
  three decisions: approve, revise, skip this session.
- `tools/pre-execute` gate: mutating tools (write, edit, shell, subagent,
  workflow, desktop, messaging) are denied until a card is approved.
- `tools/post-execute` accounting with a per-turn tool budget (default 12
  executed calls); denials are not charged against the budget.
- `agent/pre-step` turn tracking that re-arms the gate on every user turn while
  keeping a session-wide opt-out.
- System-prompt policy section next to the built-in `PLAN_POLICY`.
- `strict` mode that also caps planning-time read-only calls (default 4).
- `/route` command: status, `on`, `off`.
- zh/en copy for cards, denials and command output.
- Tool classification lists plus `extraMutating` / `extraReadonly` patterns with
  `*` wildcards; unknown tools pass through to avoid deadlock.
- Unit tests for classification, budget and card rendering, plus end-to-end
  tests against a fake cordis context.

[0.1.0]: https://github.com/WangShTo/dsh-route-gate/releases/tag/v0.1.0
