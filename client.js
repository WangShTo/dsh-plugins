// 提纯 · 提问体检（Client 半）。
//
// 形态：对话页里不出现任何东西。顶部栏一个「提问体检」按钮（或 /tijian）打开整页报告，
// Esc / 点背景关闭。数据由 tools/gen-client.mjs 烘进 SNAPSHOT（Client 半读不了文件系统）。
window.__ModuleLoader__.load({
  id: 'dsh-prompt-doctor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const SNAPSHOT = {
  "generatedAt": "2026-10-30",
  "prompts": 206,
  "projects": 22,
  "files": 41,
  "median": 32,
  "p90": 106,
  "longest": 2470,
  "chars": 19126,
  "rates": {
    "reference": 32,
    "rework": 13.1,
    "gate": 15.5,
    "emotion": 30.1,
    "accept": 13.6,
    "tiny": 25.2,
    "long": 5.8
  },
  "bucket": {
    "tiny": 52,
    "short": 73,
    "mid": 69,
    "long": 12
  },
  "topProjects": [
    {
      "name": "G:\\dsh\\workspace",
      "n": 64
    },
    {
      "name": "G:\\微信小游戏",
      "n": 25
    },
    {
      "name": "G:\\RuoYi",
      "n": 14
    },
    {
      "name": "C:\\Users\\wst21\\Desktop\\漫画",
      "n": 11
    },
    {
      "name": "C:\\Users\\wst21\\Desktop\\网络原理上机",
      "n": 11
    },
    {
      "name": "G:\\课表",
      "n": 10
    },
    {
      "name": "G:\\all workspace\\操纵手机",
      "n": 9
    },
    {
      "name": "G:\\all workspace\\接入QQ",
      "n": 8
    }
  ]
};

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
    };

    const SEGMENTS = [
      { key: 'tiny', label: '≤15 字', color: '#e8744f' },
      { key: 'short', label: '16–40 字', color: '#e8b34f' },
      { key: 'mid', label: '41–200 字', color: '#4f9de8' },
      { key: 'long', label: '>200 字', color: '#57b98a' },
    ];

    const buildPairs = (s) => [
      {
        title: '你说的「这个」我常常找不到',
        before: '这个表格怎么还没铺满',
        after: 'el-table 右侧要贴住窗口右边缘；窗口 1721px 时也贴住',
        why: `指代句占 ${s.rates.reference}%，我常要回查两三轮才锁定对象。`,
      },
      {
        title: '形容词没有判据，我只能猜',
        before: '不好看，优化一下',
        after: '圆对不齐；第五列后面再加一列空的圆；配色沿用现在的',
        why: '「美观/铺满/明显」这类词出现十几次，只有少数自带可数判据。',
      },
      {
        title: '闸门句最容易被越权',
        before: '先别打包，我们先看看',
        after: '别打包 APK，只给我网页预览',
        why: '你喊停过几次；单起一句「先别 X」比夹在长句里更容易被执行。',
      },
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
              h('div', { style: C.h2 }, '三件反复发生的事，和更省事的说法'),
              ...buildPairs(s).map((p, i) => h('div', { key: i, style: C.section },
                h('div', { style: { fontSize: 12.5, fontWeight: 600, color: '#3c5c65' } }, p.title),
                h('div', { style: C.pair },
                  h('div', { style: C.before }, h('span', { style: C.tag }, '你原话'), p.before),
                  h('div', { style: C.after }, h('span', { style: C.tag }, '我更好执行'), p.after)),
                h('div', { style: { fontSize: 11.5, color: '#7b979e' } }, p.why)))),

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
