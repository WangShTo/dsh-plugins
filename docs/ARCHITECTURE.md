# 提纯 · dsh-prompt-doctor 架构提案 v1.0

> 状态：**v1.0.0 已按本文实现**（2026-10-30）。本文留下的判断依据和口径不变，方便以后回头查「当初为什么这么定」。
> **路径说明**：仓库已重构成 monorepo，下文所有 `lib/…`、`tools/…`、`index.js` 路径都相对于 `packages/prompt-doctor/`。
> 依据：`G:\提纯\brief\01-提纯插件-BRIEF.md` + 45 个真实会话日志的实测 + GitHub 同类项目调研（2026-10-30）。

---

## 0. 一句话

**把「你的会话日志」变成「我的行为规则」，规则上线后能被量化验证，无效的自动下架——省的是来回返工烧掉的上下文，不是省你的输入字数。**

---

## 1. 上一版为什么没激活（§7 三条真因，已确证）

| # | 真因 | 证据 |
|---|---|---|
| 1 | `await import('@deepseek-ai/dsh-tools')` —— **这个包不存在**。profile 的 `node_modules/@deepseek-ai/` 里只有 `cosmokit`、`dsh-home-paths`、`schemastery`。import 抛错被 `catch` 吞成一条 warn，工具一个都没注册 | `C:\Users\wst21\.dsh\profiles\desktop\node_modules\@deepseek-ai\` 目录列表 |
| 2 | `parameters` 写成了简写映射 `{ limitProjects: { type:'integer' } }`，DSH 要求**完整 JSON Schema** `{ type:'object', properties:{…} }` | `dsh-ops/lib/capabilities/discovery.js:23-27` |
| 3 | profile 里**同一插件有两行插入**：包 `dsh.bundle.patch` 会自动插 `id: prompt-doctor`，`cordis.patch.yml` 里又手写了一行同 id | 参考实现只有前者（`dsh-plugin-memory/cordis.patch.yml`） |

顺带修正一个我之前的错判：**根 ctx 注册工具是对的**，不必按 agent 作用域注册。可对照的真实插件 `dsh-plugin-memory` 注释原话：「Raw host-plane registrations … every agent in every session sees them.」

---

## 2. 借鉴了谁（都是高星 + 2026 年仍在推）

| 项目 | ★ | 最近推送 | 借什么 |
|---|---|---|---|
| [tigerless-labs/autoharness](https://github.com/tigerless-labs/autoharness) | 10609 | 2026-10-29 | **主架构**：CAP → REF → promoter（唯一写入者）→ IDX（每会话开头注入索引），外加 MNG 生命周期、curator 合并、LED 账本；"提议者不写盘"、预热期、只归档不删除、容量竞争才淘汰 |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 105543 | 2026-10-30 | 采集→压缩→回注的产物形态；`skills/agent-cost-report` 里 behavior/costs/evidence 的拆分方式 |
| [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) | 19262 | 2026-10-30 | token/成本统计口径要单独成模块，别混进规则生成 |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | 180725 | 2026-10-29 | 约束要**写成 skill 一样的短规则**，整段散文没人执行；YAGNI 那条主线正好补我们缺的"少写代码=少烧 token" |
| [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | 59471 | 2026-10-19 | 输出侧格式规则同样是 token 杠杆（结论前置、砍客套） |
| [justhalfbit/dsh-plugin-memory](https://github.com/justhalfbit/dsh-plugin-memory) | 17 | 2026-09-30 | **DSH 原生落地参考**：`inject=['tools','llm','agents']`、`@deepseek-ai/schemastery` 配置、`agent/pre-step` 注入、`turn/end` 收尾、`dsh.client` 设置面板 |

**关键结论**：GitHub 上**没有**「读会话日志 → 学用户习惯 → 写 AGENTS.md → 省 token」这个形态的成熟项目。最接近的 autoharness 是给 Claude Code 蒸馏 *skill*，产物是技能库；ccusage 只算账不改行为。所以我们是**组合式原创**：autoharness 的闭环骨架 + ccusage 的账 + 提纯自己的证据链。

---

## 3. 整体架构

```
              ┌──────────── 离线批处理（读 ~/.dsh/sessions）────────────┐
日志/事件 ──▶ ①采集 CAP ──▶ ②归因 CLASSIFY ──▶ ③反思 REFLECT ──▶ ④提升 PROMOTE ──▶ ⑤注入 SURFACE
              audit.mjs      token.mjs            fit.mjs           promote.mjs        agents.mjs
              incidents.mjs  style.mjs                              redact.mjs         inject.mjs
                                                                        │                 │
                                       ⑦合并 CURATE ◀── ⑥轮换 LIFECYCLE ◀┘        （两层，见 §5）
                                       (容量上限竞争)      lifecycle.mjs
                                                            ledger.mjs
```

| 段 | 职责 | 明确不做 |
|---|---|---|
| ① 采集 | 多帧 zstd 解码、剔除注入噪声、抽出真人提示 + 每个 LLM 请求的 usage | 不判断内容好坏 |
| ② 归因 | 四类浪费 + 返工轮 + 真实 token 成本 + 习惯画像 | 不写任何文件 |
| ③ 反思 | 把证据翻译成**规则候选（intent）**：`create / patch / retire` | **没有写盘权限** |
| ④ 提升 | 唯一写入者：脱敏、去重、行数上限、与旧规则冲突则必须同批改写、原子写 + 备份 | 不自己编规则 |
| ⑤ 注入 | 持久层写 AGENTS.md 托管块；动态层每轮 pre-step 注入 | 不改托管块以外的字节 |
| ⑥ 轮换 | 每条规则记命中/被违反次数，预热期→毕业/改写/归档 | 不删文件，只移出 |
| ⑦ 合并 | 看整库，折叠近重复 | 只在明确重复时动 |

---

## 4. 产物与状态目录（`~/.dsh/prompt-doctor/`）

```
rules.json          # 规则库：id / 正文 / signal / baseline / after / 状态 / 证据
ledger.jsonl        # 只追加：每条规则的出生、改写、毕业、归档，带证据与水位
runs/<run-id>.json  # 每次运行的账：提了什么、落了什么、拒了什么、为什么
last_run.json       # 上一轮一行摘要，下次会话开头跟着索引一起露出
fits.jsonl          # 已有：托管块每次写入的时间线
backup/             # 已有：写前备份
templates/          # 风格模板三份（electron-vue3 / spring-boot / node-script）
```

借鉴 autoharness 的一条硬规则：**上一轮被拒的提议也要露出来**。只报"落库"的流水账等于骗自己。

---

## 5. 两层注入（这是本版最大的结构改动）

| 层 | 位置 | 容量 | 生效 | 谁写 |
|---|---|---|---|---|
| 持久层 | `~/.agents/AGENTS.md` 托管块 | ≤ 12 条 | 重启后仍在，人可读可改 | promoter |
| 动态层 | `agent/pre-step` 的 `<system-reminder>` | 每轮 ≤ 3 条 / ≤ 600 字 | 下一轮立刻生效，不用重启 | inject.mjs |

动态层只注**这一轮命中的**规则（按提示里的指代词/闸门词/返工词匹配），不是把 12 条全塞进去。已实测本机 DSH 构建里存在 `agent/pre-step`（asar 内 60 处）与 `turn/end`（299 处）。

**动态层必须自我了断**：某条规则连续 N 个会话没有降低对应违规率 → 停止注入 → 归档。否则 600 字/轮就是纯亏，自己也成了浪费。

---

## 6. 效果闭环：规则是活物，不是一次性文案

每条规则带一个 **signal 探测器**，用来数"这条规则管的事又发生了没"：

| 规则 | signal | 基线 |
|---|---|---|
| 指代句先定位 | 含「这个/那个/它/又」，且 2 轮内出现返工口气 | 历史上 31% 的提示带指代，返工轮 57 次 |
| 闸门句手停 | 出现「先别/不要/暂停」而我在同一轮里有写盘/构建动作 | 闸门句占比 |
| 第二次返工换方法 | 同一文件/同一话题连续 3 轮被否 | 返工率 |
| 验收按他的口径 | 他说「能用/跑起来」而上一轮没有证据行 | 验收词占比 |

终身状态机：

```
candidate ──落地──▶ probation（预热：≥5 个有数据的会话）
                        ├─ after 率比 baseline 低 ≥5pp ──▶ active
                        ├─ 持平/更差 ──▶ retune（改一次措辞，最多 2 次）──▶ 仍无效 ──▶ archived
                        └─ 从未被触发且从未被违反 ──▶ archived（"没证据用过"≠"证明没用"，所以只在成熟后才判）
active ── 某层超过容量上限 ──▶ 命中率最低的先归档（容量竞争是唯一死法）
archived ── 移回来即复活（只归档不删除）
```

---

## 7. token 口径：用真实账单，不用字数猜

真实数据（45 个会话、7300 次 LLM 请求、250 个真人轮次）已确认会话日志里有 `assistant/message.data.usage = {inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}`。

**等效输入 token** = `input + 0.10×cacheRead + 0.25×cacheWrite + 4×output`（权重写在代码注释里，标为口径不标为价格）。

| 实测 | 数值 |
|---|---|
| 累计等效 token | ≈ 211M |
| 其中 cacheRead | 1682M 原始 → 168M 等效（占 80%） |
| 真人提示总计 | 225 条 / 20053 字 |
| 提示中位长度 | 32 字；>800 字的仅 4 条 |
| 烧得最多的项目 | `G:\dsh\workspace` 4836K、`G:\提纯` 3288K、`G:\RuoYi` 2175K |

**这组数字直接否掉 BRIEF 原口径的一条判据**：原要求「整段粘贴 = >800 字且代码块 >40%」，本机命中数是 **0**，报出来就是假的。所以四类浪费改判据，并且把主指标换成**返工轮的整轮成本**——那才是真正在烧的东西（一次返工 = 多整轮上下文）。

省了多少，用 `fits.jsonl` 的首次写入时间切分，比较"每次提示的平均等效 token 用前 vs 用后"。**没数据就写未验证，不套公式。**

---

## 8. 模块表

| 文件 | 职责 | 来源 |
|---|---|---|
| `lib/audit.mjs` | 多帧 zstd 解码、噪声过滤、抽提示 | 已有，沿用 |
| `lib/incidents.mjs` | 翻车事件抽取（用户原话 ← 我上一句宣称完成） | 已有，沿用 |
| `lib/token.mjs` | 真实 usage 账单 + 四类浪费（新判据） | 新写 |
| `lib/style.mjs` | 习惯画像 + 三份模板 | 新写 |
| `lib/fit.mjs` | 证据 → 规则候选 intent | 已有，改成产出 intent |
| `lib/promote.mjs` | 唯一写入者：校验/脱敏/冲突改写/原子写 | 新写（借鉴 autoharness promoter） |
| `lib/redact.mjs` | 路径/密钥/QQ/邮箱/手机号脱敏 | 新写（BRIEF 要求） |
| `lib/agents.mjs` | 托管块读写 + 备份 + 幂等（加锁） | 已有，升级 |
| `lib/inject.mjs` | `agent/pre-step` 动态层 | 新写（借鉴 dsh-plugin-memory） |
| `lib/lifecycle.mjs` | 状态机 + 计数 + 容量 | 新写（借鉴 MNG） |
| `lib/ledger.mjs` | 只追加账本 + runs | 新写（借鉴 LED） |
| `lib/trend.mjs` | 用前/用后趋势 | 已有，接真实 usage |
| `lib/index.js` | 宿主半：配置 + 注册 4 个工具 + pre-step | 重写 |

四个工具名不变：`prompt_audit` / `prompt_fit` / `prompt_trend` / `prompt_style`，中文人话返回。

---

## 9. 里程碑与验收（每条都要证据）

| 里程碑 | 做完的判据 | 证据形态 |
|---|---|---|
| **M1 真激活** | 重启后四个工具都能被我调到 | 工具返回原文 + 截图 |
| **M2 真账单** | `prompt_trend` 报出上述真实数字，且能按项目/时间切 | 命令输出贴进对话 |
| **M3 风格** | 三份模板落盘 + 画像 ≤40 行 | `ls` + 文件内容 |
| **M4 闭环** | 跑一轮 `fit`，规则带 baseline，`rules.json` 有状态字段；模拟一次无效规则归档 | `runs/<id>.json` diff |
| **M5 动态层** | 改完不重启，下一轮就看到注入 | 两轮对话截图对比 |
| **M6 发布** | GitHub 上能 `git clone` + 按 README 装 | 仓库链接 |

**页面（BRIEF 的 M4）我建议挪到最后、甚至 v1.1 再做**：它是展示层，不影响"省 token"这个主线；而 `dsh.client` 设置面板在 17★ 的参考实现里是能吃到的，不是做不到，只是先做闭环更值。

---

## 10. 风险与未验证

| 项 | 状态 |
|---|---|
| 宿主半改动要重启 DSH 才生效 | 已知，不是风险，只是慢 |
| 动态注入 `agent/pre-step` 的具体 payload | **未验证**：只用 grep 确认事件名存在于本机构建；装好后第一次跑就要验，跑不通就退回单层（只写 AGENTS.md），主线不受影响 |
| profile 里重复的 `id: prompt-doctor` 那行要删 | 需要你授权写 `~/.dsh`（沙箱外） |
| 现在装的指向 `G:\提纯\plugin` | 新版本装好后要改指向本工作区或直接 `npm` 打包装 |
| 真实节省幅度 | **未验证**，必须靠 M2/M4 跑出来，我不会先写一个好看的百分比 |

---

## 11. 不做什么（防止范围膨胀）

- 不做自动开新会话（那是 BRIEF 02 的另一件事，独立插件）。
- 不做 embedding / 向量库：跨会话记忆已有 Hindsight 和 dsh-plugin-memory，重复造会抢工作区上下文。
- 不碰 `~/.dsh/AGENTS.md`（手写人格），只写 `~/.agents/AGENTS.md` 的托管块。
- 不注册 `conversation.composer.dock`（BRIEF 明令禁止，会和输入框打架）。
- `lib/` 继续零第三方依赖（`schemastery` 只在做设置面板时才引入，v1.0 不引）。
