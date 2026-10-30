# 更新记录

## 1.0.0 — 2026-10-30

重写注册层。0.5.x 的规则生成一直能跑，但四个工具**从来没有真正挂上过**，所以「自适应」实际上没人用。

### 修掉的三个真因

- **`import('@deepseek-ai/dsh-tools')` 必抛**：profile 里没有这个包，ERR_MODULE_NOT_FOUND 被 `catch` 吞成一条 warn，工具静默不注册。现在不 import 任何 `@deepseek-ai/*` 运行时值，工具定义是纯对象。
- **`parameters` 不是 JSON Schema**：0.5.x 写的是 `{ limitProjects: { type: 'integer' } }` 这种简写映射，注册器要的是 `{ type: 'object', properties: {...} }`。
- **注册作用域错了**：在根 ctx 上注册。DSH 的工具要发布到 agent 作用域，宿主级注册只是特例。

### 新增

- `lib/token.mjs`：直接读 `assistant/message` 里的真实 `usage`，不再用「3.2 字符 ≈ 1 token」估。给出等效 token、每轮均价、按项目/按天分布。
- `lib/style.mjs`：≤40 行的习惯画像，末尾一句结论。
- `tools/cli.mjs`：不启动 DSH 也能 `audit / style / trend / fit`，`fit` 默认不写盘。
- `scripts/install.mjs`：装/卸 profile 三件事（依赖、bundles、patch 行），带备份、幂等、`--dry-run`、`--revert`。
- **健康自检**：每个工具返回的第一行说明「工具几个注册上了、上次写入约定是多久前」。写 `~/.dsh/prompt-doctor/loaded.json`。
- **三档降级注册**：宿主不认 `output` / `isConcurrencySafe` 时逐级退到裸定义，而不是整组失效。
- **自动适配开关**：`autoFit: true` 才在启动 15 秒后自动写托管块，默认关。

### 改

- 写入目标固定 `~/.agents/AGENTS.md` 的托管块，不碰 `~/.dsh/AGENTS.md`，不碰任何项目里的 AGENTS.md。
- `prompt_fit` 默认预览，`apply=true` 才落盘。

### 已知

- 重启 DSH 后工具是否真的出现在列表里，尚未在真实会话里验证过——日志只能证明 `apply` 会被调用。
- 只在 Windows 11 + Node 24 上跑过。
