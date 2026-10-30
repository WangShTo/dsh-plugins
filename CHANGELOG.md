# Changelog

## v0.3.0 — 2026-10-30

从「体检」到**自动适配**：分析结果不再只是数字，而是写进指令文件、每轮生效的约定。

### 新增

- `lib/fit.mjs`：把六类统计翻译成规则（指代、闸门、短句、返工、情绪、验收、最费话项目），每条带 `why` 与真实 `evidence`。
- `lib/agents.mjs`：托管块读写。只动 `<!-- prompt-doctor:begin/end -->` 之间，块外一个字节不碰；写前备份到 `~/.dsh/prompt-doctor/backup/`，`last-fit.json` 留最近一次 diff；`removeBlock()` 可整段撤销。
- `lib/run.mjs`：一条龙 `体检 → 规则 → 写盘`。CLI、agent 工具、页面生成三个入口共用，保证「页面说的」和「实际写的」是同一份。
- Host 工具 `prompt_fit`：对话里说「适配一下」即写入，返回新增/移除的行。启动时按 `config.autoFit !== false` 自动跑一次，内容没变不写盘。
- `tools/fit.mjs`：`--dry` 看 diff、`--apply` 写入、`--undo` 撤销。
- 页面新增两节：「这个插件在干什么」（采集 / 分析 / 改写三格）与「它替你改了哪些约定」（规则 + 为什么 + 例子 + 上次写入时间与目标路径）。

### 变更

- 自动适配的目标文件定为 `~/.agents/AGENTS.md`（shared-agents 层），与手写人格 `~/.dsh/AGENTS.md` 分层，互不覆盖。

## v0.2.0 — 2026-10-30

- **移除** 对话页里的卡片（`conversation.composer.dock` 注册整段删除），对话页不再出现任何插件 UI。
- **新增** 顶部入口：标题栏「提问体检」按钮（`conversation.header`）+ 斜杠命令 `/tijian`。
- **新增** `shell.overlay` 整页报告：Esc / 点背景关闭；页面开头说明数据来源与剔除规则。
- **修复** 安装方式：`node_modules/dsh-prompt-doctor` 必须是 Windows 目录联接（junction）。此前 `ln -s` 静默退化成复制，导致改完代码界面一直是旧版。

## v0.1.0 — 2026-10-30

- 首个版本：多帧 zstd 解码（`28 b5 2f fd` 逐帧）、会话目录名解码（`~HEX4`）、真人提示过滤（剔除系统注入与 QQ 网关注入）。
- 六类统计：长度分布、指代、返工、闸门、情绪、验收词；按项目分组。
- Host 工具 `prompt_audit`；对话页卡片（后被 v0.2 移除）。

## v0.4.1 — 2026-10-30（事故修复版）

这一版不是加功能，是补两个把 DSH 搞挂的坑。

### 事故 1：入口挪进子目录 → web boot 失败

`exports["./client"]` 指到 `./client/client.js`、`main` 指到 `./lib/index.js` 之后，宿主启动报：

```
Error: web boot: 12 entries did not activate
@deepseek-ai/dsh-client-ui-conversation: failed
其余 11 个 pending (waiting for service: uiConversation)
```

界面白屏、打不开。**改回与 `templates/decoration` 一致的根级布局**：`index.js`、`client.js` 都在包根，`exports["."]`/`exports["./client"]` 指向它们；`lib/` 只放内部实现，由根 `index.js` 再导出。

### 事故 2：用 PowerShell 写 profile 清单 → 带 BOM → 宿主 fatal

```
DesktopHostFatalError: Unexpected token '\ufeff', "\ufeff{\n    \"n\"..." is not valid JSON
    at readProfileManifest (dsh-app-boot/lib/index.js:913)
```

Profile 的 `package.json` 不能有 BOM。**所有 profile 写盘改走 `tools/profile.mjs`（node，无 BOM）**，写完立刻按宿主的方式回读校验。

### 新增防线

- `tools/profile.mjs status|verify|install|uninstall`：备份 → 改写 → 回读校验；`verify` 检查 BOM、JSON 可解析、exports 目标存在、包名、patch 行。
- `scripts/smoke-profile.mjs` 加严：BOM、JSON、每个 exports 目标是否存在、`files` 项存在、根入口能否 `import` 出 `apply`。
- `fit-install.bat` / `fit-rollback.bat`：双击安装 / 双击回滚（不依赖我）。
