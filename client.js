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
  "prompts": 218,
  "projects": 22,
  "files": 41,
  "median": 32,
  "p90": 105,
  "longest": 2470,
  "chars": 19538,
  "rates": {
    "reference": 33,
    "rework": 12.8,
    "gate": 14.7,
    "emotion": 31.2,
    "accept": 13.3,
    "tiny": 25.2,
    "long": 5.5
  },
  "bucket": {
    "tiny": 55,
    "short": 78,
    "mid": 73,
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
      "name": "G:\\提纯",
      "n": 20
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
    }
  ],
  "fit": {
    "target": "C:\\Users\\wst21\\.agents\\AGENTS.md",
    "changed": true,
    "rules": [
      {
        "key": "reference",
        "title": "指代句：先定位，不猜着开工",
        "line": "他说「这个 / 那个 / 它 / 还是 / 又」时，先在上文产物里定位对象；定位不到就列 2 个候选问一句，不要边猜边改文件。",
        "why": "指代句占 33%（全库最高的一类），猜错一次就是一轮返工。",
        "evidence": "「不是，你咋给dsh整挂了！！！？自己去找问题出在哪儿了，立马给我修好，自己测试一下会不会出bug啊」← 「找到原因了：我改的结构把 DSH 的客户端启动链打断了，并不是它自己坏了。 日志（%APPDATA%\\@deepse…」"
      },
      {
        "key": "gate",
        "title": "闸门句：手停，嘴不停",
        "line": "出现「先别 / 暂停 / 不要 / 等等」时立刻停止动手，只回一句话确认，不改文件、不打包、不重启。",
        "why": "闸门句占 14.7%，我历史上多次把它当语气词忽略。",
        "evidence": "「这个小卡片不美观，我不要这样吗，如果不是必须的就把这个去掉，如果是必须的，就单独做一个页面来显示提纯的这些东西放在顶…」← 「已经按这个改了，只是界面还停在旧版本上（插件包在启动时缓存，我按了两次 Ctrl+R 都没换过来）。 - 旧卡片已经…」"
      },
      {
        "key": "short",
        "title": "短句 = 改一个点，不是新需求",
        "line": "≤15 字的指令默认按「在上一轮产物上改一个点」理解；要开新项目他会把项目名说出来。",
        "why": "≤15 字的提示占 25.2%，中位长度只有 32 字。",
        "evidence": "「为什么会这样，把你的启动程序改一下，你自己验证一下能不能通过」← 「MySQL 已经启动并显示在前台了 ✅ 当前状态 - 服务端：MySQL 9.3.0 正在监听 3306（另有 X …」"
      },
      {
        "key": "rework",
        "title": "第二次返工：换方法，不微调",
        "line": "同一处被否第二次时，不再微调参数，换实现层级（改结构/换控件/换数据源），并在回复里说清换了什么。",
        "why": "返工口气占 12.8%；同一问题我平均要改 3 轮才换方法。",
        "evidence": "「为什么又自启动了，不是让你改吗」← 「我在你机器上把该看的都看了，先说结论，再说下一步。 ## 已确认的现场（不是猜的） - 你装的是 Codex 桌面版…」"
      },
      {
        "key": "emotion",
        "title": "带情绪时：先认账再给证据",
        "line": "句子带「怎么还 / 服了 / 又」时，第一行认账一句（不解释），第二行给可验证的证据，第三行才说下一步。",
        "why": "带情绪的提示占 31.2%，多出现在我宣布「已完成」之后。",
        "evidence": "「我说不要这个小框框显示字，怎么又出来了」← 「LICENSE 加好了，GitHub 已经识别。 ## ✅ 完成 LOCAL 1065 字节 · 无 BOM · 首…」"
      },
      {
        "key": "project",
        "title": "最费话的项目：dsh\\workspace",
        "line": "dsh\\workspace 相关需求先给结构再写代码；涉及界面时先截一张当前效果图，改完再截一张。",
        "why": "这个项目你打了 64 条提示，是全库最多的。",
        "evidence": "「你把你给我的截图里面的坐标轴数据去掉，然后重新把图发给我」"
      },
      {
        "key": "accept",
        "title": "验收词：按他的口径，不按我的",
        "line": "说「跑起来 / 能用 / 对得上 / 有设备」时，给同口径的证据（截图、日志、adb devices 输出），不用 curl 200 代替。",
        "why": "验收词占 13.3%，其中「能打开」被我当成「能用」的情况最多。",
        "evidence": "「我给你重新打开了，你继续做点吧」← 「我先停一下，跟你说明当前状况，刚才出了问题： 我做错了一步 —— 我想关掉 Packet Tracer 里的 PDU…」"
      },
      {
        "key": "incident",
        "title": "最常翻车的地方：启动/环境",
        "line": "涉及「启动/环境」时，先给一条可验证的证据再宣布完成；拿不出证据就写「未验证：…」，不要用「做好了」结句。",
        "why": "翻车事件里 13 次属于这一类（共 29 次）。",
        "evidence": "「不是，你咋给dsh整挂了！！！？自己去找问题出在哪儿了，立马给我修好，自己测试一下会不会出bug啊」← 「找到原因了：我改的结构把 DSH 的客户端启动链打断了，并不是它自己坏了。 日志（%APPDATA%\\@deepse…」"
      }
    ],
    "lastAppliedAt": "2026-10-30 10:35",
    "lastAdded": 11
  }
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
