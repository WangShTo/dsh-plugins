# dsh-route-gate 设计说明

这份文档记录「为什么这样写」，代码怎么跑见 README。所有 DSH 内部契约都标注了源码位置，升级 DSH 后先核对这些行。

## 1. 目标与非目标

目标：

1. 每个用户回合在第一次改机器之前，产出一份人类可读、可拒绝的路线（目的/交付物/验收/步骤/范围/风险）。
2. 拒绝必须真的挡住工具，而不是「提示词请求模型停手」。
3. 单回合的工具调用有硬上限，超出后强制收尾，降低长尾 token 消耗。
4. 不引入新的界面：确认走 DSH 原生问题弹窗，状态走 DSH 原生命令。

非目标：

- 不做计划模式的替代品（plan-mode 仍在，二者互补）。
- 不做 token 精确计费（按调用次数，不折算 token）。
- 不做跨会话持久化（状态挂在 agent 上，会话结束即丢）。

## 2. 三个落点

### 2.1 提示词段

`ctx.systemPrompt.section({ name: 'route-gate:policy', order: getSectionOrder('PLAN_POLICY') + 10, text })`。

- 位置紧贴内置 `PLAN_POLICY`（`SECTION_ORDERS.PLAN_POLICY = 500`），意图和官方计划策略相邻。
- `trigger: off` 时不注册，保证「关掉」是彻底的。
- 文本由 `lib/prompt.js` 生成，把卡字段、只读额度、预算数字写进去，模型不用猜。

### 2.2 `tools/pre-execute` 闸门

契约（`@deepseek-ai/dsh-tools` 的 `lib/index.js`）：

```js
// :3112
const gate = await this.ctx.waterfall(carrier, "tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }))
// :3123
const denialReason = decision.kind === "allow" ? this.guardReason(exec) : decision.reason
// :3124
// 拒绝 → { content: [{ type: "text", text: "Error: " + denialReason }], isError: true }
```

所以：

- 拒绝 = 返回 `{ kind: 'deny', reason }`，**不调用 `next()`**，瀑布链在这里短路；
- 理由会原样出现在模型的工具结果里（前缀 `Error: `），也会出现在界面上，所以文案要同时给模型和用户看；
- 放行 = 调 `next()`，并把它的结果返回，保证其他插件的闸门（比如官方 approval）仍然生效。

判定顺序（先 token、再次数、再分类）：

```
trigger === 'off'                       → next()
无 agent（非会话调用）                    → next()
phase === 'trusted'                     → next()
turnTokenBudget > 0 且 tokens >= 预算     → deny(token 预算)
calls >= turnToolBudget                 → deny(预算)
classify === 'read'                     → strict 且 reads >= planReadBudget ? deny : next()
classify === 'write'                    → phase === 'approved' ? next() : deny(路线)
classify === 'unknown'                  → next()
```

### 2.3 `tools/post-execute` 计数

```js
ctx.on('tools/post-execute', async (exec, result, next) => { ... })
```

- 只在 `result.isError !== true` 时计数：被拒的调用没执行，不该吃预算，否则模型被拦一次就少一次额度，越拦越死。
- 预算在「下一次调用前」判定，所以是「最多执行 N 次」，不是「第 N+1 次失败」。
- `tokens += resultTokens(result) + callTokens(exec)`：结果里只算 `type: 'text'` 的字符数，参数按 JSON 长度算——参数也进上下文，一次 `write` 写两百行，读回来还要再花一遍。折算按 `4 字符 ≈ 1 token`，只用于判「这条链是不是在烧钱」，不对账。

### 2.4 回合边界

```js
ctx.on('agent/pre-step', (payload, next) => { ... })
```

载荷是 `{ messages, turn, step, signal }`（`@deepseek-ai/dsh-agent-loop` 里 `inbox.claim(target, turn)` 之后派发），`messages` 是**本回合新认领的消息**，不是全量历史。因此：

- `messages.some(m => m.source?.kind === 'user')` 为真 ⇒ 这个 step 就是用户新回合的第一步；
- 再拿 `turn !== state.turn` 兜底（不同版本对 turn 的编号可能不同）；
- 两者都不成立时不动状态，避免同一回合里反复重置。

## 3. 状态机

| 状态 | 含义 | 进入方式 | 退出方式 |
| --- | --- | --- | --- |
| `open` | 本回合还没批卡 | 新 agent / 新回合 / 用户点「先改路线」/ `/route on` | 批准 → `approved`；`/route off` → `trusted` |
| `approved` | 已批准，可动工具 | 卡片返回「开工 · A」 | 新回合 → `open`；`/route off` → `trusted` |
| `trusted` | 会话级旁路 | `/route off` | `/route on` → `open` |

计数：`calls`（本回合已执行）、`reads`（本回合计划期只读）、`cards`（出卡次数）、`denials`（本会话拦截次数）。批准时 `calls`/`reads` 清零——计划期的读不该吃掉执行额度。

## 4. 交互契约

`route_card` 走 `userQuestions.ask`：

```js
{ questions: [{ id: 'route-review', header, question, detail, options: [{ label, description }], intent }], agent, signal }
```

- **传 `intent: { kind: 'plan-review', approve: <开工标签> }`**：这是唯一受支持的 intent，客户端据此把通用选项列表升级成原生评审面板（琥珀色卡片、两个键、主键在前、正文按 Markdown 渲染）。代价是**只认两个选项**，所以「本会话免确认」从卡片里拿掉，改成 `/route off`；**多条路线也只能进正文**（A/B/C 写在 `detail` 里，主键只答应 A，次键把 B/C 交回聊天）。服务端还会校验 `approve` 必须命中某个选项的 label，否则 `BAD_INTENT`。
- 卡片是决策不是总结：第一行写「点左边按 A 做；想走 B / C，点右边回一句」，然后每条路线一行（名字 + 做什么 + 代价），最后才是只动 / 验收 / 风险。预算行从卡面删掉（还在提示词、拒绝理由和 `/route` 里），整卡控制在九行以内。
- `route_card` 要求 **2–3 条**路线，一条也拒收（`needs 2–3 routes` 的可读错误）——只有一条推荐不叫选择。
- 每条路线必须写 `what`（会改什么），可选 `how`（具体怎么改：读 → 改 → 跑 → 提交）。缺 `what` 直接拒收（`has no "what"`）：一个名字是标签，不是可权衡的选择。卡面按「路线头 / 做什么 / 怎么做」三行渲染。
- `detail` 是卡片正文（Markdown），面板里只渲染它；`question` 事实上只进 `aria-label`，所以真正的信息必须写在 `detail` 里（`lib/card.js` 已按这个约束生成）。
- 面板的三个键：主键「确认执行」→ 我们给 approve 标签；次键「拒绝」→ 我们给 revise 标签；ghost 键「去聊天里说」→ 关闭弹窗，抛 `ASK_CANCELLED`。
- 用户关掉弹窗抛 `UserQuestionError`，`code === 'ASK_CANCELLED'` → 记为 `dismissed`，闸门保持关闭，不报错。
- 用户在弹窗里自填了内容（`answer.custom` 非空）→ 按「先改路线」处理，先把话听进去。
- 没有 `userQuestions` 服务（headless 部署）→ 抛可读错误，并在 README 写明用 `trigger: off`。

## 5. 工具分类

两份模式表（`lib/policy.js`）：

- `DEFAULT_READONLY`：读文件、搜内容、联网查、看屏幕、压缩上下文、调度查询、只读 MCP；
- `DEFAULT_MUTATING`：写文件、跑 shell、起子 agent/workflow、操作桌面、发消息、建定时、会写数据的 MCP。

规则：

1. 只读匹配优先于可写匹配（同名工具系列里 `qq_get_*` 不能被误判）；
2. 两份都不中 ⇒ `unknown` ⇒ 放行。宁可漏拦，不可让第三方工具把会话锁死；
3. 部署级补充：`extraMutating` / `extraReadonly`，支持 `*` 通配（`mcp__*__qq_send*`）。

通配实现把除 `*` 外的正则元字符全部转义，模式整体加 `^$` 锚定，防止 `a.b` 误配 `axb`。

## 6. 失败模式

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 所有工具都被拦，包括 `read` | `trigger` 配了非法值走 strict 分支，或 `turnToolBudget` 被配成 0 | 配置校验在 `apply` 里用 `Math.max(1, …)` 兜底；非法 `trigger` 按 `auto` 行为（只有 `strict` 分支命中只读额度） |
| 批了卡还是被拦 | 批准后开了新回合（新回合重新上闸） | 设计如此：一回合一批 |
| `route_card` 报「needs userQuestions」 | headless 部署没有问答通道 | 设 `trigger: off` |
| 卡片没弹窗 | `userQuestions.ask` 的 `agent` 不是活着的根 agent（子 agent 里调用） | 由父会话出卡；必要时在子任务提示里写明「先让父会话批」 |
| 预算到点后模型仍反复尝试 | 模型没读懂拒绝文案 | 拒绝文案明确写「停下汇报」，并复用官方重复调用提醒插件兜底 |

## 7. 升级核对清单

升级 DSH 后按顺序核对，任何一处变了都要改代码：

1. `tools/pre-execute` 的瀑布签名与 `deny` 结果形状（`dsh-tools/lib/index.js`，搜 `tools/pre-execute`）；
2. `tools/post-execute` 的 `(exec, result, next)` 参数顺序；
3. `agent/pre-step` 载荷里 `messages` 的语义（是否只含本回合新消息）与 `turn` 字段；
4. `AskUserQuestionIntent` 是否仍只支持 `plan-review`；
5. `SECTION_ORDERS.PLAN_POLICY` 是否仍存在；
6. schemastery 的 `z.array(z.string())` 与 `.default([])` 行为。

## 8. 路线图

- **P2 降本**：按工具类型加权预算（`bash` 记 2，`read` 记 1）；预算耗尽时自动生成一段「已做/未做/建议」汇报模板。
- **P3 隔离**：把「计划期只读」做成独立子 agent（借 Roo 的 boomerang 思路），探查结果只回摘要，父会话上下文零污染。
- **P3 持久化**：路线卡写入会话事件，重启后仍能看到「这张卡是谁批的、批的什么范围」。
