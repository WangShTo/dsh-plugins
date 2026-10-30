// Host 半：两个 agent 工具 + 启动时自动适配。
//
// prompt_audit —— 只体检，不写文件。
// prompt_fit   —— 体检 + 把规则写进 ~/.agents/AGENTS.md 的托管块，返回改了哪些行。
//
// 防呆：@deepseek-ai/dsh-tools 从 dsh 安装目录解析，不同版本可能改名/缺包。
// 所以用动态 import + try/catch——工具注册失败只会少一个工具，不影响页面。
import { audit, formatReport } from './lib/audit.mjs';
import { runFit, summarize } from './lib/run.mjs';

export const name = 'dsh-prompt-doctor';

export async function apply(ctx, config = {}) {
  // 启动时自动适配一次：内容没变化就不写文件（applyBlock 里做了幂等判断）。
  if (config.autoFit !== false) {
    try {
      const res = runFit({ dryRun: false });
      ctx.logger?.info?.(`prompt-doctor: auto-fit ${res.changed ? '已更新' : '无变化'} → ${res.target}`);
    } catch (error) {
      ctx.logger?.warn?.(`prompt-doctor: auto-fit skipped (${error?.message ?? error})`);
    }
  }

  try {
    const { defineTool } = await import('@deepseek-ai/dsh-tools');

    const auditTool = defineTool({
      name: 'prompt_audit',
      description: [
        'Run the prompt health check over this machine\'s DSH session logs:',
        'it decodes every session.v4.jsonl.zstd (multi-frame zstd), keeps only prompts the human actually typed',
        '(system injections and QQ-bridge role cards are filtered out), then reports length spread,',
        'pronoun-reference rate, rework-marker rate and gate-phrase rate per project.',
        'Use it when the user asks how they write prompts, or when the plugin page looks stale.',
      ].join(' '),
      parameters: {
        limitProjects: { type: 'integer', description: 'How many projects to list (default 6).' },
      },
      async execute(args) {
        return formatReport(audit({ limitProjects: Number(args?.limitProjects) || 6 }));
      },
    });

    const fitTool = defineTool({
      name: 'prompt_fit',
      description: [
        'Re-run the prompt health check and APPLY the derived writing rules to the managed block in',
        '~/.agents/AGENTS.md (block markers: prompt-doctor:begin/end). Everything outside the block is untouched,',
        'the previous file is backed up under ~/.dsh/prompt-doctor/backup/. Returns the rules that are now in effect',
        'and the exact lines added/removed, so you can tell the user what changed.',
        'Use it when the user says "适配一下" / "改一下你的理解方式" or after a long stretch of rework.',
      ].join(' '),
      parameters: {
        dryRun: { type: 'boolean', description: 'Preview the diff without writing (default false).' },
      },
      async execute(args) {
        const res = runFit({ dryRun: Boolean(args?.dryRun) });
        if (!res.ok) return `体检失败：${res.reason}`;
        const diff = res.changed
          ? res.added.filter((l) => l.trim()).map((l) => '+ ' + l).join('\n')
          : '（与现有托管块一致，未改动）';
        return `${summarize(res)}\n\n${diff}\n\n目标：${res.target}`;
      },
    });

    const disposers = [ctx.tools.register(auditTool), ctx.tools.register(fitTool)];
    ctx.effect?.(() => () => disposers.forEach((d) => d?.()));
  } catch (error) {
    ctx.logger?.warn?.(`prompt-doctor: agent tools not registered (${error?.message ?? error})`);
  }
}
