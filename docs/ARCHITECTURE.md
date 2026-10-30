# 架构

DSH 插件是两个半身：**Host**（Node 进程，能读文件、注册工具）和 **Client**（浏览器里的 React，能画界面）。
这个插件把逻辑全放在 `lib/`，两个半身只做转接，所以同一份结论不会出现「页面说的」和「实际写的」不一致。

```
~/.dsh/sessions/**/session.v4.jsonl.zstd
        │  lib/audit.mjs      多帧 zstd 逐帧解码 + 只留真人提示
        ▼
   统计报告（长度/指代/返工/闸门/情绪/验收 + 项目分布）
        │  lib/incidents.mjs  把「他说没做好」和「我上一句说做好了」配对，按领域聚类
        ▼
   翻车地图（领域 + 次数 + 脱敏样本）
        │  lib/fit.mjs        统计 + 翻车 → 规则（title / line / why / evidence）
        ▼
   规则数组
        ├── lib/agents.mjs  → 写进 ~/.agents/AGENTS.md 的托管块（备份 / 幂等 / --undo）
        └── client/client.js → 页面渲染（顶栏按钮 + /tijian 整页）
```

## 层的职责

| 文件 | 层 | 职责 | 依赖 |
| --- | --- | --- | --- |
| `lib/index.js` | Host | 注册 `prompt_audit` / `prompt_fit`，启动时自动适配 | 只依赖 `lib/` |
| `lib/audit.mjs` | 纯逻辑 | 解码日志、过滤注入、算比例 | 只有 node 内置 |
| `lib/incidents.mjs` | 纯逻辑 | 翻车配对、领域打分、脱敏 | 只有 node 内置 |
| `lib/fit.mjs` | 纯逻辑 | 数字 → 规则文本 | `incidents` |
| `lib/agents.mjs` | 纯逻辑 | 托管块读写、备份、撤销 | 只有 node 内置 |
| `lib/run.mjs` | 编排 | 一条龙，CLI / 工具 / 页面共用 | 上面四个 |
| `client/client.js` | Client | 顶栏入口、整页渲染、斜杠命令 | 由 `tools/report.view.js` 生成 |

**为什么 client 是生成的**：页面的数字必须来自同一份 `runFit()` 结果，手写就会漂。
`tools/gen-client.mjs` 把快照烘进 `client/client.js`，页面因此零请求、零异步——打开即有内容。

## 不变量（改代码时守住这几条）

1. `lib/` 里不许出现 `import` 第三方包，也不许 `fetch`——插件必须离线可用。
2. 写盘只有一个入口：`agents.applyBlock()`。它负责备份、幂等、只动块内。
3. 规则里不许出现原文：所有样本过 `incidents.redact()`（路径、密钥、密码变占位符）。
4. 页面不许注册 `conversation.composer.dock`（v0.2 的教训：用户明确否掉了输入框上方的常驻卡片）。
5. 任何统计口径的改动，同步改 `README.md` 的口径表，并在 `CHANGELOG.md` 记一行。

## 测试

`scripts/smoke-*.mjs` 是分层的冒烟测试，不依赖测试框架：

| 脚本 | 覆盖 |
| --- | --- |
| `smoke-sessions.mjs` | 多帧 zstd、目录名 `~HEX4` 还原 |
| `smoke-incidents.mjs` | 翻车配对、领域分类、脱敏 |
| `smoke-fit.mjs` | 规则生成、托管块只动块内、幂等、撤销 |
| `smoke-client.mjs` | 不占输入框、注册了顶栏与整页、无外链、语法 |
| `smoke-profile.mjs` | `package.json` 与 `cordis.patch.yml` 的安装契约 |

`npm run smoke` 一次跑完。CI 只需要 `node --version >= 22.15`。

## 与同类项目的分工

生态里已经有两个往「提示词质量」做的插件：

- [`dsh-prompt-lint`](https://github.com/LIN-F1SH/dsh-prompt-lint)：在**输入时**帮你改写这句话，输入框旁一键出更短的带约束版本。
- [`dsh-prompt-enhancer`](https://github.com/Fishsb/dsh-prompt-enhancer)：也是输入侧的增强。

它们解决「这一句怎么说」，本插件解决「**我已经说过 200 句，能不能让 agent 记住我这个人**」——
产物是一段持久约定（写进 AGENTS.md），不是一个更好的输入框。两者可以同时装，不抢同一个 slot。
