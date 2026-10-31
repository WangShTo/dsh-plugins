# dsh-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai) 写的插件，一个包只做一件事，装哪个用哪个。

---

## 包里有什么

### prompt-doctor · 提问体检

**有什么用**：读你本机的会话日志，统计提示条数、长度、五类句式（指代 / 返工 / 闸门 / 情绪 / 验收）的占比，把你的习惯写成几条可执行的约定，追加到 `~/.agents/AGENTS.md`。省的是返工，不是字数。

**怎么用**：

```bash
node tools/cli.mjs audit        # 只读体检，先看报告
node tools/cli.mjs fit --apply  # 确认后再写入 AGENTS.md 的托管块
```

托管块有 `<!-- prompt-doctor:begin/end -->` 标记，重跑只覆盖块内内容，手改的部分留在块外。

**状态**：v1.0.0，可用。

---

### route-gate · 路线闸门

**有什么用**：每次会话第一次要动文件、跑命令、起子 agent 之前，先把「做什么 / 几条路线 / 每路怎么做 / 代价 / 验收」摆成一张琥珀色卡片，你点「开工 · A」之后工具才放行。没点之前 `write`、`edit`、`bash`、`pwsh`、`subagent` 全部被工具层挡住。省的是跑偏十几轮才发现方向不对。

**怎么用**：装上就有，模型要动东西时自己弹卡。

- **开工 · A** — 按推荐路线执行；改动超出卡里声明的范围会重新上闸；
- **换一条** — 不执行；回一句「B」或「C」就换那条路线重出卡。

`/route` 看当前状态，`/route off` 关掉本会话的闸门，`/route on` 打开。卡面长什么样：[`docs/card-mock.png`](packages/route-gate/docs/card-mock.png)。

**状态**：v0.4.0，可用。

---

## 装

```bash
git clone https://github.com/WangShTo/dsh-plugins.git
cd dsh-plugins
node scripts/install.mjs --package route-gate          # 路线闸门
node scripts/install.mjs --package prompt-doctor       # 提问体检
```

然后重启 DSH。`--revert` 退回原样，`--dry-run` 只打印不写。

脚本只动三处，每处先备份到 `<文件>.bak-<时间戳>`：

1. `~/.dsh/profiles/<profile>/package.json` 的 `dependencies` 加一条 `file:` 指向本仓库；
2. 同一文件的 `dsh.profile.bundles` 加包名；
3. `cordis.patch.yml` 末尾插一块 `insert`（同 id 已存在就跳过——重复 id 会让整组失效）。

---

## 约定

- **零运行时依赖**：只吃宿主提供的服务（`tools`、`systemPrompt`、`userQuestions`），不把 `@deepseek-ai/*` 打进 dependencies；
- **一个包一个 `cordis.patch.yml`**，各自能单独装、单独卸，装错一个不影响别的；
- **改宿主前先读源码**：钩子的签名以 `node_modules/@deepseek-ai/dsh-*/lib/` 为准，不按文档猜；
- **每个包自带测试**，`node --test` 能跑，不需要装 DSH。

---

## 开发

```bash
node scripts/smoke-tools.mjs      # 不装进 profile 也能验的闭环

cd packages/prompt-doctor
node tools/cli.mjs audit

cd packages/route-gate
npm test                          # 20 个用例，不需要装 DSH
```

冒烟验的是：`apply` 被调用 → 工具真的进注册表 → 每个都返回中文人话 → 旧宿主能降级 → 没有 `tools` 服务时不抛。

---

## 许可

MIT。
