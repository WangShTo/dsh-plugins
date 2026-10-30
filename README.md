# dsh-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai) 用的插件，一个仓库一个插件，**互不依赖**——想用哪个装哪个。

| 包 | 状态 | 一句话 |
|---|---|---|
| [`packages/prompt-doctor`](packages/prompt-doctor) | **v1.0.0,可用** | 提纯：读会话日志学你的习惯，把规则写进 `~/.agents/AGENTS.md`，省的是返工不是字数 |
| `dsh-route-gate` | 设计完成，未实现 | 先定路线再开工：工具层硬闸 + 预算熔断（设计稿在 `G:\all workspace\插件\调用顺序\docs\`） |
| `dsh-auto-session` | 规划中 | 上下文满了自动交接换会话 |

只发已实现的包。后两个等做出来再进 `packages/`——占位目录会比没有更容易让人装错东西。

三个包都**零运行时依赖**，只吃宿主提供的服务（`tools`、`systemPrompt` 等），所以不会因为某个 `@deepseek-ai/*` 包改名而一起挂掉。

---

## 装一个

```bash
git clone https://github.com/WangShTo/dsh-plugins.git
cd dsh-plugins
node scripts/install.mjs --package prompt-doctor     # 或 route-gate / auto-session
```

然后重启 DSH。`node scripts/install.mjs --package prompt-doctor --revert` 退回原样。

脚本只动三处，每处都先备份到 `<文件>.bak-<时间戳>`：

1. `~/.dsh/profiles/<profile>/package.json` 的 `dependencies` 加一条 `file:` 指向本仓库
2. 同一个文件的 `dsh.profile.bundles` 加包名
3. `cordis.patch.yml` 末尾插一块 `insert`（**同 id 已存在就跳过**——重复的 id 会让整组失效，这是上一版工具一直挂不上的坑之一）

`--dry-run` 只打印不写。

---

## 为什么不合成一个包

三个插件共享的是**做法**不是**代码**：

- 都要解 `zstd` 多帧日志、都要脱敏、都要原子写——但这部分各写各的只有几十行
- 合成一个大包，用户为了一个功能被迫装另外两个，`prompt-doctor` 的 `AGENTS.md` 写入会和 `route-gate` 的预算熔断搅在一起

所以：一个仓库（统一 issue / 版本 / CI），三个独立包（各自 `package.json`、各自 `cordis.patch.yml`、各自能单独卸载）。

---

## 开发

```bash
node scripts/smoke-tools.mjs          # 不装进 profile 也能验的闭环
cd packages/prompt-doctor
node tools/cli.mjs audit              # 只读体检
```

冒烟验的是「apply 被调用 → 四个工具真的进注册表 → 每个都返回中文人话 → 旧宿主降级也上 → 没有 tools 服务时不抛」。

---

## 许可

MIT。
