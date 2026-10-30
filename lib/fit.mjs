// 把体检数字翻译成「我该怎么改」的规则。
//
// 输出是确定性的：同一个快照永远得到同一组规则，方便 diff 与回滚。
// 每条规则都带 evidence，页面上要能把「哪句话支撑了这条规则」show 出来。

const pct = (v) => Number(v) || 0;

import { decodeDirName } from './audit.mjs';

/** @param {ReturnType<import('./audit.mjs').audit>} report */
export function deriveRules(report) {
  const r = report.rates || {};
  const rules = [];

  if (pct(r.reference) >= 15) {
    rules.push({
      key: 'reference',
      title: '指代句：先定位，不猜着开工',
      line: '他说「这个 / 那个 / 它 / 还是 / 又」时，先在上文产物里定位对象；定位不到就列 2 个候选问一句，不要边猜边改文件。',
      why: `指代句占 ${r.reference}%（全库最高的一类），猜错一次就是一轮返工。`,
      evidence: '「这个表格怎么还没铺满」← 我没查是哪张表就开始调列宽',
    });
  }

  if (pct(r.gate) >= 8) {
    rules.push({
      key: 'gate',
      title: '闸门句：手停，嘴不停',
      line: '出现「先别 / 暂停 / 不要 / 等等」时立刻停止动手，只回一句话确认，不改文件、不打包、不重启。',
      why: `闸门句占 ${r.gate}%，我历史上多次把它当语气词忽略。`,
      evidence: '「先别打包apk，禁止打包apk！！！」← 我上一轮已经在跑构建',
    });
  }

  if (pct(r.tiny) >= 20) {
    rules.push({
      key: 'short',
      title: '短句 = 改一个点，不是新需求',
      line: '≤15 字的指令默认按「在上一轮产物上改一个点」理解；要开新项目他会把项目名说出来。',
      why: `≤15 字的提示占 ${r.tiny}%，中位长度只有 ${report.median} 字。`,
      evidence: '「铺满」「再大一点」都是在改刚交付的那个文件',
    });
  }

  if (pct(r.rework) >= 8) {
    rules.push({
      key: 'rework',
      title: '第二次返工：换方法，不微调',
      line: '同一处被否第二次时，不再微调参数，换实现层级（改结构/换控件/换数据源），并在回复里说清换了什么。',
      why: `返工口气占 ${r.rework}%；同一问题我平均要改 3 轮才换方法。`,
      evidence: '若依列宽 15 轮：写死 885→900→1005 都是同一层级',
    });
  }

  if (pct(r.emotion) >= 15) {
    rules.push({
      key: 'emotion',
      title: '带情绪时：先认账再给证据',
      line: '句子带「怎么还 / 服了 / 又」时，第一行认账一句（不解释），第二行给可验证的证据，第三行才说下一步。',
      why: `带情绪的提示占 ${r.emotion}%，多出现在我宣布「已完成」之后。`,
      evidence: '「组件可以创建出来但是为什么是空白的」← 我说过「做好了」',
    });
  }

  const top = (report.topProjects || [])[0];
  const topName = top && shortPath(decodeDirName(top.dir || top.name || ''));
  if (top && top.n >= 20 && topName) {
    rules.push({
      key: 'project',
      title: `最费话的项目：${topName}`,
      line: `${topName} 相关需求先给结构再写代码；涉及界面时先截一张当前效果图，改完再截一张。`,
      why: `这个项目你打了 ${top.n} 条提示，是全库最多的。`,
      evidence: '同一项目里「完全按照我给你的图」被 9 版 SVG 重绘消耗掉',
    });
  }

  if (pct(r.accept) >= 8) {
    rules.push({
      key: 'accept',
      title: '验收词：按他的口径，不按我的',
      line: '说「跑起来 / 能用 / 对得上 / 有设备」时，给同口径的证据（截图、日志、adb devices 输出），不用 curl 200 代替。',
      why: `验收词占 ${r.accept}%，其中「能打开」被我当成「能用」的情况最多。`,
      evidence: '「能正常打开但是都是英文」← 我用 HTTP 200 验收了内容',
    });
  }

  return rules;
}

function shortPath(p) {
  const parts = String(p || '').split(/[\\/]/).filter(Boolean);
  if (!parts.length) return '';
  return parts.slice(-2).join('\\');
}

/** 规则 → 要写进 AGENTS.md 的正文（不含标记行）。 */
export function renderBlock(rules, meta) {
  const head = [
    `### 我的说话风格（提纯插件自动适配 · ${meta.date}）`,
    '',
    '> 这段由 `dsh-prompt-doctor` 依据会话日志自动生成，重跑会覆盖；想手改请写在标记外面。',
    '',
  ];
  const body = rules.map((r, i) => `${i + 1}. **${r.title}** — ${r.line}`);
  return [...head, ...body].join('\n');
}
