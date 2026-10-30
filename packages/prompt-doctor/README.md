# 提纯 · dsh-prompt-doctor

把 DSH 的会话日志变成**可验证的行为规则**。

它不改你说的每句话，它改的是我接下来怎么干活——少让你说第二遍，才是真的省 token。

- 读本机 `~/.dsh/sessions/**` 里的会话日志（只读）
- 统计你真实的提问习惯：多短、多爱用「这个/那个」、多少句带情绪、常在哪翻车
- 生成一批规则，写进 `~/.agents/AGENTS.md` 里一个**带标记的托管块**（写前备份、幂等、可一键删除）
- 每次启动都按同一份口径重算，用前用后做对比，而不是凭感觉说「好像变好了」

---

## 为什么不是「压缩提示词」

我在本机 46 份日志、232 条真人提示、7513 次请求上量了一遍：

| 事实 | 数字 |
|---|---|
| 你的提示中位长度 | **34 字**（p90 111 字） |
| 每条提示后面跟着的模型请求 | **约 29 次** |
| 累计等效 token | **214.6M**（按下面的口径折算） |
| 平均每一轮 | **479K** |
| 最贵的一轮 | **3.7M** |

结论很直接：**成本不在你打了多少字，在一轮里塞了多少上下文、以及因为一句话没对齐而多跑的那几轮。**
所以这个插件省的不是你的输入，是返工。

---

## 装

需要 Node ≥ 22.15，DSH 已装好。

```bash
git clone https://github.com/WangShTo/dsh-plugins.git
cd dsh-plugins
node scripts/install.mjs --package prompt-doctor
```

装完**重启 DSH**。然后在对话里说一句「体检一下」，或者直接看工具列表里有没有 `prompt_audit`。

不装也可以用命令行：

```bash
cd packages/prompt-doctor
node tools/cli.mjs audit      # 只读体检
node tools/cli.mjs style      # 习惯画像（≤40 行）
node tools/cli.mjs trend      # 趋势 + 真实 token 账
node tools/cli.mjs fit        # 预览要写的约定，不动盘
node tools/cli.mjs fit --apply  # 真的写进 ~/.agents/AGENTS.md
```

卸载：`node scripts/install.mjs --package prompt-doctor --revert`，或手动把 `~/.agents/AGENTS.md` 里 `<!-- prompt-doctor:begin -->` 到 `<!-- prompt-doctor:end -->` 之间删掉。

---

## 四个工具

| 工具 | 干什么 | 写盘 |
|---|---|---|
| `prompt_audit` | 体检：条数、长度分位、五类句式占比、项目分布 | 否 |
| `prompt_style` | 习惯画像 ≤40 行，末尾一句结论 | 否 |
| `prompt_trend` | 按周返工率 + 真实 token 账 + 用前/用后对比 | 否 |
| `prompt_fit` | 生成规则并写托管块；**默认只预览**，`apply=true` 才落盘 | 是 |

每个工具返回的第一行都是自检：

```
插件 dsh-prompt-doctor v1.0.0 · 工具 4/4 已注册（…）· 上次写入约定 49 分钟前
```

这一行不是装饰。上一版插件的工具永远注册不上，而它自己完全不知道——现在它会说出来。

---

## 规则是怎么来的

`fit` 不是让模型自由发挥，是一组**阈值**触发的固定规则，可复现、可审查：

| 触发条件 | 生成的规则 |
|---|---|
| 指代句 ≥ 15% | 先在上文产物里定位对象，定位不到就列 2 个候选问一句 |
| 闸门句 ≥ 8% | 出现「先别/暂停」立刻停手，只回一句话确认 |
| 极短句 ≥ 20% | ≤15 字按「在上一轮产物上改一个点」理解 |
| 返工标记 ≥ 8% | 同一处被否第二次不微调参数，换实现层级 |
| 情绪 ≥ 15% | 第一行认账，第二行给证据，第三行才说下一步 |
| 最常待的项目 ≥ 20 条 | 该项目单独一条：先给结构再写代码 |
| 验收词 ≥ 8% | 按你的口径验收，不用 curl 200 代替截图 |
| 反复翻车 ≥ 3 次 | 点名那个领域，先给可验证证据再宣布完成 |

不够阈值就不写。宁可少一条，也不要一条没数据支撑的废话。

---

## 写在哪、怎么回滚

只写 `~/.agents/AGENTS.md` 里这一块：

```markdown
<!-- prompt-doctor:begin -->
### 我的说话风格（提纯插件自动适配 · 2026-10-30）
…
<!-- prompt-doctor:end -->
```

- **不碰** `~/.dsh/AGENTS.md`（你手写的人格）
- **不碰**任何项目的 `AGENTS.md`
- 每次写之前备份到 `~/.dsh/prompt-doctor/backup/AGENTS-<时间戳>.md`
- 内容没变就不写（`changed: false`），所以重启一百次也不会把文件写脏
- 历史写在 `~/.dsh/prompt-doctor/fits.jsonl`，一行一次

---

## token 口径

日志里每条 `assistant/message` 都带真实的 `usage`，所以不估算，直接读：

```
等效输入 token = input + 0.10×cacheRead + 0.25×cacheWrite + 4×output
```

权重表达的是「读缓存便宜、生成贵」这个相对关系，跨模型统一成一把尺子。
这不是价格，别拿它算钱——真正的钱看 `~/.dsh/.dshw-usage.json`。

---

## 工具调不到怎么办

先看 `~/.dsh/prompt-doctor/loaded.json`：

```json
{ "version": "1.0.0", "tools": ["prompt_audit", "..."], "failed": [] }
```

- `tools` 是空数组 → 宿主没给 `tools` 服务，插件在跑但工具没挂上
- `failed` 有内容 → 注册被拒，错误原文在里面（一般是宿主版本不认某个字段，会自动降级重试）
- 文件不存在 → `apply` 压根没被调用，查 profile 的 `cordis.patch.yml` 里有没有这行：

```yaml
- insert:
    - id: prompt-doctor
      name: dsh-prompt-doctor
```

同一个 `id` **只能出现一次**，重复会让整组跳过。

---

## 未验证

- 重启 DSH 之后 `prompt_audit` 是否出现在工具列表里（本机日志证明 `apply` 会被调用、托管块会被写，但工具注册链路没在真实会话里跑过）
- `output.schema` / `isConcurrencySafe` 两个可选字段在各个版本的宿主上是否都认（已做三档降级，最差降到裸定义）
- macOS / Linux 未测，仓库只在 Windows 11 + Node 24 上跑过

---

## 许可

MIT。日志不出本机：不联网、不调模型、不带遥测。
