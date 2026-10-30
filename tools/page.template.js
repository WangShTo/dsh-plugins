// 提纯 · 提问体检（Client 半）。
//
// 形态：不占输入框位置。注册一条斜杠命令「体检」，输入 / 选中它 →
// 弹出一整页体检报告；Esc 或点背景关闭。
// 数据由 tools/gen-client.mjs 烘进 SNAPSHOT（Client 半读不了文件系统）。
window.__ModuleLoader__.load({
  id: 'dsh-prompt-doctor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const SNAPSHOT = /*__SNAPSHOT__*/;

    // —— 跨组件的小开关：命令 run() 里打开，页面里关闭 ——
    const listeners = new Set();
    let isOpen = false;
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
      backdrop: {
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(16, 42, 50, .38)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      },
      panel: {
        width: 'min(920px, 100%)', maxHeight: '82vh', overflow: 'auto',
        background: '#ffffff', color: '#17323a',
        borderRadius: 18, border: '1px solid #dbe9ec',
        boxShadow: '0 24px 70px rgba(12, 46, 56, .28)',
        font: '13px/1.6 "Microsoft YaHei UI", "Segoe UI", system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      },
      head: {
        position: 'sticky', top: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 22px 14px', borderBottom: '1px solid #eaf3f5',
        background: 'linear-gradient(#ffffff, rgba(255,255,255,.92))',
      },
      badge: {
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: '#e8f4f6', color: '#2f7f7f', letterSpacing: '.04em',
      },
      h1: { fontSize: 15.5, fontWeight: 650, letterSpacing: '.01em' },
      sub: { fontSize: 11.5, color: '#7b979e' },
      close: {
        marginLeft: 'auto', cursor: 'pointer', border: '1px solid #dbe9ec',
        background: '#f7fbfc', borderRadius: 9, padding: '4px 10px',
        fontSize: 12, color: '#4d6f78',
      },
      body: { padding: '18px 22px 22px', display: 'grid', gap: 18 },
      cards: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 },
      card: { padding: '11px 12px', borderRadius: 12, background: '#f7fbfc', border: '1px solid #eaf3f5' },
      big: { fontSize: 21, fontWeight: 660, lineHeight: 1.15 },
      unit: { fontSize: 11, fontWeight: 400, color: '#7b979e', marginLeft: 2 },
      cap: { fontSize: 11, color: '#7b979e', marginTop: 3 },
      section: { display: 'grid', gap: 8 },
      h2: { fontSize: 12.5, fontWeight: 620, color: '#3c5c65', letterSpacing: '.02em' },
      bar: { display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', border: '1px solid #e6f0f2' },
      legend: { display: 'flex', gap: 14, fontSize: 11.5, color: '#7b979e', flexWrap: 'wrap' },
      dot: { width: 8, height: 8, borderRadius: 3, display: 'inline-block', marginRight: 5 },
      rows: { display: 'grid', gap: 5 },
      row: { display: 'grid', gridTemplateColumns: '190px 1fr 56px', alignItems: 'center', gap: 10, fontSize: 12 },
      track: { height: 7, borderRadius: 999, background: '#eef5f7', overflow: 'hidden' },
      fill: { height: '100%', borderRadius: 999, background: '#4f9de8' },
      num: { textAlign: 'right', color: '#5c7c85' },
      tips: { display: 'grid', gap: 7, fontSize: 12.5, color: '#3c5c65' },
      tip: { display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, alignItems: 'start' },
      idx: { color: '#9db8be', fontWeight: 600 },
      foot: { fontSize: 11, color: '#9db8be', borderTop: '1px solid #eaf3f5', paddingTop: 10 },
    };

    const SEGMENTS = [
      { key: 'tiny', label: '≤15 字', color: '#e8744f' },
      { key: 'short', label: '16–40 字', color: '#e8b34f' },
      { key: 'mid', label: '41–200 字', color: '#4f9de8' },
      { key: 'long', label: '>200 字', color: '#57b98a' },
    ];

    const TIPS = [
      '短句没问题，问题是唯一指向：「这个/那个」后面补半句名词，我就不用回查三轮。',
      '形容词给判据：把「铺满」说成「表格右边缘贴住窗口右边缘，窗口 1721px 时也贴住」。',
      '一次只下一条闸门：「先别打包」比「先别动，我们讨论一下」更容易被我执行。',
      '验收物先说：跑起来／截图对得上／adb 有设备，任选其一作为完成条件。',
    ];

    function Stat(props) {
      return h('div', { style: C.card },
        h('div', { style: C.big }, props.value, h('span', { style: C.unit }, props.unit || '')),
        h('div', { style: C.cap }, props.label));
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
              h('div', { style: C.h1 }, '我的提问体检'),
              h('div', { style: C.sub }, `${s.prompts} 条真人提示 · ${s.projects} 个项目 · ${s.files} 份会话日志 · 快照 ${s.generatedAt}`)),
            h('button', { style: C.close, onClick: () => setOpen(false) }, 'Esc 关闭')),

          h('div', { style: C.body },
            h('div', { style: C.cards },
              h(Stat, { value: s.median, unit: '字', label: '中位长度' }),
              h(Stat, { value: s.p90, unit: '字', label: 'p90 长度' }),
              h(Stat, { value: s.longest, unit: '字', label: '最长一条' }),
              h(Stat, { value: s.rates.reference, unit: '%', label: '带指代' }),
              h(Stat, { value: s.rates.rework, unit: '%', label: '返工标记' }),
              h(Stat, { value: s.rates.gate, unit: '%', label: '闸门句' })),

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
              h('div', { style: C.h2 }, '提示词最多的项目'),
              h('div', { style: C.rows }, s.topProjects.map((p) =>
                h('div', { key: p.name, style: C.row },
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: p.name }, p.name),
                  h('div', { style: C.track }, h('div', { style: { ...C.fill, width: `${(p.n / maxProject) * 100}%` } })),
                  h('span', { style: C.num }, p.n + ' 条'))))),

            h('div', { style: C.section },
              h('div', { style: C.h2 }, '拿到我这里的四条建议'),
              h('div', { style: C.tips }, TIPS.map((t, i) =>
                h('div', { key: i, style: C.tip },
                  h('span', { style: C.idx }, String(i + 1)),
                  h('span', null, t))))),

            h('div', { style: C.foot },
              `情绪句 ${s.rates.emotion}% · 验收词 ${s.rates.accept}% · 极短(≤15字) ${s.rates.tiny}% · 长(>200字) ${s.rates.long}%`,
              h('br'),
              '口径见仓库 README；数字是快照，重跑 node tools/gen-client.mjs 更新。'))));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // 页面挂帧级 overlay：不进输入框布局，命令打开、Esc 关闭。
        try {
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay', id: 'prompt-doctor-page', order: 30,
          }, Page));
        } catch (error) {
          console.warn('[prompt-doctor] overlay slot unavailable:', error && error.message);
        }

        // 斜杠命令：输入 / 就能看到「提问体检」。
        try {
          ctx.inject(['commandUi'], (scope) => {
            const commands = scope.get('commandUi');
            scope.effect(() => commands.register({
              name: '体检',
              label: () => '提问体检',
              available: () => true,
              ui: { kind: 'action', run: () => setOpen(true) },
            }), 'prompt-doctor: command');
          });
        } catch (error) {
          console.warn('[prompt-doctor] command unavailable:', error && error.message);
        }
      },
    };
  },
});
