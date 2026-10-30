// Host 半：注册一个 agent 工具 `prompt_audit`，让助手随时重跑体检拿实时数字。
//
// 防呆：@deepseek-ai/dsh-tools 从 dsh 安装目录解析，不同版本可能改名/缺包。
// 所以用动态 import + try/catch——工具注册失败只会少一个工具，不会把卡片一起带崩。
import { audit, formatReport } from './lib/audit.mjs';

export const name = 'dsh-prompt-doctor';

export async function apply(ctx) {
  try {
    const { defineTool } = await import('@deepseek-ai/dsh-tools');
    const dispose = ctx.tools.register(defineTool({
      name: 'prompt_audit',
      description: [
        'Run the prompt health check over this machine\'s DSH session logs:',
        'it decodes every session.v4.jsonl.zstd (multi-frame zstd), keeps only prompts the human actually typed',
        '(system injections and QQ-bridge role cards are filtered out), then reports length spread,',
        'pronoun-reference rate, rework-marker rate and gate-phrase rate per project.',
        'Use it when the user asks how they write prompts, or when a plugin card looks stale.',
      ].join(' '),
      parameters: {
        limitProjects: { type: 'integer', description: 'How many projects to list (default 6).' },
      },
      async execute(args) {
        const report = formatReport(audit({ limitProjects: Number(args?.limitProjects) || 6 }));
        return report;
      },
    }));
    ctx.effect?.(() => () => dispose?.());
  } catch (error) {
    ctx.logger?.warn?.(`prompt-doctor: agent tool not registered (${error?.message ?? error})`);
  }
}
