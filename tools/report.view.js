// 提纯 · 提问体检（Client 半）。
//
// 形态：对话页里不出现任何东西。顶部栏一个「提问体检」按钮（或 /tijian）打开整页报告，
// Esc / 点背景关闭。数据由 tools/gen-client.mjs 烘进 SNAPSHOT（Client 半读不了文件系统）。
window.__ModuleLoader__.load({
  id: 'dsh-prompt-doctor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const SNAPSHOT = /*__SNAPSHOT__*/;

    const listeners = new Set();
    // 静态预览用：preview.html?open=1 时默认展开，真实 DSH 地址里不带这个参数。
    let isOpen = /(^|[?&])open=1/.test(String(window.location && window.location.search || ''));
    function setOpen(v) {
      if (isOpen === v) return;
      isOpen = v;
      listeners.forEach((fn) => fn());
    }
    function useOpen() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const fn = () => bump((x) => x + 1);
        listeners.add(fn);
        return () => listeners.delete(fn);
      }, []);
      return isOpen;
    }

    const C = {
      badge: { fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#e8f4f6', color: '#2f7f7f', marginTop: 2 },
      trigger: {
        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
        padding: '3px 9px', borderRadius: 8, fontSize: 12,
        border: '1px solid color-mix(in oklab, currentColor 16%, transparent)',
        background: 'color-mix(in oklab, currentColor 4%, transparent)',
        color: 'inherit', opacity: 0.86, whiteSpace: 'nowrap',
      },
      backdrop: {
        position: 'fixed', inset: 0, zIndex: 70, padding: 24,
        background: 'rgba(14, 38, 46, .40)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
      panel: {
        width: 'min(940px, 100%)', maxHeight: '84vh', overflow: 'auto',
        background: '#fff', color: '#17323a', borderRadius: 18,
        border: '1px solid #dbe9ec', boxShadow: '0 26px 74px rgba(12, 46, 56, .3)',
        font: '13px/1.6 "Microsoft YaHei UI", "Segoe UI", system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      },
      head: {
        position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '18px 24px 15px', borderBottom: '1px solid #eaf3f5', background: '#fff',
      },
      h1: { fontSize: 16, fontWeight: 650 },
      lead: { fontSize: 12, color: '#6f8d95', marginTop: 3, maxWidth: 640 },
      close: {
        marginLeft: 'auto', cursor: 'pointer', border: '1px solid #dbe9ec', background: '#f7fbfc',
        borderRadius: 9, padding: '5px 11px', fontSize: 12, color: '#4d6f78',
      },
      body: { padding: '18px 24px 24px', display: 'grid', gap: 20 },
      cards: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 },
      card: { padding: '11px 12px', borderRadius: 12, background: '#f7fbfc', border: '1px solid #eaf3f5' },
      big: { fontSize: 21, fontWeight: 660, lineHeight: 1.15 },
      unit: { fontSize: 11, fontWeight: 400, color: '#7b979e', marginLeft: 2 },
      cap: { fontSize: 11, color: '#7b979e', marginTop: 3 },
      section: { display: 'grid', gap: 9 },
      h2: { fontSize: 12.5, fontWeight: 620, color: '#3c5c65', letterSpacing: '.02em' },
      note: { fontSize: 12, color: '#5c7c85', background: '#f7fbfc', border: '1px solid #eaf3f5', borderRadius: 11, padding: '10px 13px' },
      bar: { display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', border: '1px solid #e6f0f2' },
      legend: { display: 'flex', gap: 14, fontSize: 11.5, color: '#7b979e', flexWrap: 'wrap' },
      dot: { width: 8, height: 8, borderRadius: 3, display: 'inline-block', marginRight: 5 },
      pair: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
      before: { padding: '9px 12px', borderRadius: 10, background: '#fdf1ec', border: '1px solid #f6ded4', fontSize: 12.5 },
      after: { padding: '9px 12px', borderRadius: 10, background: '#eef8f1', border: '1px solid #d6ecdd', fontSize: 12.5 },
      tag: { fontSize: 10.5, letterSpacing: '.04em', opacity: 0.62, display: 'block', marginBottom: 3 },
      rows: { display: 'grid', gap: 5 },
      row: { display: 'grid', gridTemplateColumns: '190px 1fr 56px', alignItems: 'center', gap: 10, fontSize: 12 },
      track: { height: 7, borderRadius: 999, background: '#eef5f7', overflow: 'hidden' },
      fill: { height: '100%', borderRadius: 999, background: '#4f9de8' },
      num: { textAlign: 'right', color: '#5c7c85' },
      foot: { fontSize: 11, color: '#9db8be', borderTop: '1px solid #eaf3f5', paddingTop: 10 },
      steps: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
      step: { padding: '12px 13px', borderRadius: 12, background: '#f7fbfc', border: '1px solid #eaf3f5' },
      stepN: { fontSize: 10.5, fontWeight: 600, color: '#8fb3bb', letterSpacing: '.08em' },
      stepT: { fontSize: 13, fontWeight: 650, margin: '2px 0 4px' },
      stepD: { fontSize: 11.5, color: '#5c7c85', lineHeight: 1.65 },
      subline: { fontSize: 11.5, color: '#7b979e' },
      rule: { padding: '11px 13px', borderRadius: 12, border: '1px solid #eaf3f5', background: '#fff', display: 'grid', gap: 4 },
      ruleTitle: { fontSize: 12.5, fontWeight: 650, color: '#2f5b64' },
      ruleLine: { fontSize: 12.5, color: '#17323a', lineHeight: 1.65 },
      ruleWhy: { fontSize: 11, color: '#8aa6ad' },
    };

    const SEGMENTS = [
      { key: 'tiny', label: '≤15 字', color: '#e8744f' },
      { key: 'short', label: '16–40 字', color: '#e8b34f' },
      { key: 'mid', label: '41–200 字', color: '#4f9de8' },
      { key: 'long', label: '>200 字', color: '#57b98a' },
    ];

    const STEPS = [
      { n: '01', t: '采集', d: '读 ~/.dsh/sessions 里的会话日志，只留他亲手打的句子；系统注入、QQ 网关注入全部剔掉。' },
      { n: '02', t: '分析', d: '按长度、指代、返工、闸门、情绪、验收六类统计，再按项目分组看哪类项目最费话。' },
      { n: '03', t: '改写', d: '把结论翻成「我该怎么理解你」的约定，写进 ~/.agents/AGENTS.md 的托管块——我每次回话前都会先读它。' },
    ];


    function Stat(props) {
      return h('div', { style: C.card },
        h('div', { style: C.big }, props.value, h('span', { style: C.unit }, props.unit || '')),
        h('div', { style: C.cap }, props.label));
    }

    function Trigger() {
      return h('button', {
        style: C.trigger,
        title: '把你在 DSH 里打给我的话做一次体检',
        onClick: () => setOpen(true),
      }, '提问体检');
    }

    function Page() {
      const open = useOpen();
      React.useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [open]);
      if (!open) return null;

      const s = SNAPSHOT;
      const total = SEGMENTS.reduce((a, g) => a + (s.bucket[g.key] || 0), 0) || 1;
      const maxProject = Math.max(1, ...s.topProjects.map((p) => p.n));

      return h('div', { style: C.backdrop, onClick: () => setOpen(false) },
        h('div', { style: C.panel, onClick: (e) => e.stopPropagation() },
          h('div', { style: C.head },
            h('span', { style: C.badge }, '提纯'),
            h('div', null,
              h('div', { style: C.h1 }, '提问体检'),
              h('div', { style: C.lead },
                `把你在 DSH 里亲手打过的 ${s.prompts} 句话挖出来做体检——不是聊天记录，是「我到底有没有听懂你」的证据。`)),
            h('button', { style: C.close, onClick: () => setOpen(false) }, 'Esc 关闭')),

          h('div', { style: C.body },
            h('div', { style: C.note },
              `数据来源：${s.files} 份会话日志（~/.dsh/sessions）里的 ${s.prompts} 条真人提示，已剔除系统注入与 QQ 网关注入；覆盖 ${s.projects} 个项目，合计 ${s.chars} 字。数字是 ${s.generatedAt} 的快照，重跑 node tools/gen-client.mjs 更新。`),

            h('div', { style: C.cards },
              h(Stat, { value: s.median, unit: '字', label: '你说的中位长度' }),
              h(Stat, { value: s.p90, unit: '字', label: 'p90 长度' }),
              h(Stat, { value: s.longest, unit: '字', label: '最长一条' }),
              h(Stat, { value: s.rates.reference, unit: '%', label: '含指代' }),
              h(Stat, { value: s.rates.rework, unit: '%', label: '返工口气' }),
              h(Stat, { value: s.rates.gate, unit: '%', label: '含闸门句' })),

            h('div', { style: C.section },
              h('div', { style: C.h2 }, '长度分布'),
              h('div', { style: C.bar }, SEGMENTS.map((g) =>
                h('div', {
                  key: g.key,
                  title: `${g.label}：${s.bucket[g.key] || 0} 条`,
                  style: { width: `${((s.bucket[g.key] || 0) / total) * 100}%`, background: g.color },
                }))),
              h('div', { style: C.legend }, SEGMENTS.map((g) =>
                h('span', { key: g.key },
                  h('span', { style: { ...C.dot, background: g.color } }),
                  `${g.label} · ${s.bucket[g.key] || 0}`)))),

            h('div', { style: C.section },
              h('div', { style: C.h2 }, '这个插件在干什么'),
              h('div', { style: C.steps }, STEPS.map((st) => h('div', { key: st.n, style: C.step },
                h('div', { style: C.stepN }, st.n),
                h('div', { style: C.stepT }, st.t),
                h('div', { style: C.stepD }, st.d))))),

            h('div', { style: C.section },
              h('div', { style: C.h2 }, `它替你改了哪些约定（${s.fit.rules.length} 条）`),
              h('div', { style: C.subline },
                s.fit.lastAppliedAt
                  ? `上次写入 ${s.fit.lastAppliedAt} · 目标 ${s.fit.target} · 共 ${s.fit.rules.length} 条；重跑：跟我说「适配一下」或 node tools/fit.mjs --apply`
                  : `还没写入过。目标 ${s.fit.target}；跑 node tools/fit.mjs --apply 或让我调 prompt_fit。`),
              ...s.fit.rules.map((rule, i) => h('div', { key: rule.key, style: C.rule },
                h('div', { style: C.ruleTitle }, `${i + 1}. ${rule.title}`),
                h('div', { style: C.ruleLine }, rule.line),
                h('div', { style: C.ruleWhy }, `${rule.why}　例：${rule.evidence}`)))),

            h('div', { style: C.section },
              h('div', { style: C.h2 }, '你在哪些项目上话最多'),
              h('div', { style: C.rows }, s.topProjects.slice(0, 6).map((p) =>
                h('div', { key: p.name, style: C.row },
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: p.name }, p.name),
                  h('div', { style: C.track }, h('div', { style: { ...C.fill, width: `${(p.n / maxProject) * 100}%` } })),
                  h('span', { style: C.num }, p.n + ' 条'))))),

            h('div', { style: C.foot },
              `情绪句 ${s.rates.emotion}% · 验收词 ${s.rates.accept}% · 极短(≤15字) ${s.rates.tiny}% · 长(>200字) ${s.rates.long}%`,
              h('br'),
              '口径与自测脚本见仓库 README；这是快照，不是实时统计。'))));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        for (const slot of ['conversation.header', 'conversation.header.leading']) {
          try {
            ctx.slots.inject(slot, () => ctx.slots.register({
              name: slot, id: 'prompt-doctor-open', order: 40,
            }, Trigger));
          } catch (error) {
            console.warn('[prompt-doctor] header slot unavailable:', slot, error && error.message);
          }
        }

        try {
          ctx.inject(['commandUi'], (scope) => {
            const commands = scope.get('commandUi');
            scope.effect(() => commands.register({
              name: 'tijian',
              label: () => '提问体检',
              available: () => true,
              ui: { kind: 'action', run: () => setOpen(true) },
            }), 'prompt-doctor: command');
          });
        } catch (error) {
          console.warn('[prompt-doctor] command unavailable:', error && error.message);
        }

        try {
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay', id: 'prompt-doctor-page', order: 30,
          }, Page));
        } catch (error) {
          console.warn('[prompt-doctor] overlay slot unavailable:', error && error.message);
        }
      },
    };
  },
});
