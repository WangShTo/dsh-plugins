// 提纯 · 提问体检卡片（Client 半）。由 tools/gen-client.mjs 把快照烘进 SNAPSHOT。
window.__ModuleLoader__.load({
  id: 'dsh-prompt-doctor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const SNAPSHOT = {
  "generatedAt": "2026-10-30",
  "prompts": 204,
  "projects": 22,
  "files": 41,
  "median": 31,
  "p90": 105,
  "longest": 2470,
  "rates": {
    "reference": 31.4,
    "rework": 12.7,
    "gate": 14.7,
    "emotion": 30.4,
    "accept": 13.7,
    "tiny": 25.5,
    "long": 5.9
  },
  "bucket": {
    "tiny": 52,
    "short": 73,
    "mid": 67,
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
    }
  ],
  "samples": [
    "把初始内置的课程信息删掉吧，用户有需求自己导入课程",
    "不用打电话啥的，我想的是每天提醒提醒天气，注意休息，过生日过节庆祝一下啥的",
    "算了我觉得这个项目做完有点一般，没啥必要性"
  ]
};

    const C = {
      card: {
        margin: '0 auto 8px',
        maxWidth: 760,
        padding: '10px 14px 11px',
        border: '1px solid color-mix(in oklab, currentColor 12%, transparent)',
        borderRadius: 12,
        background: 'color-mix(in oklab, currentColor 3%, transparent)',
        fontSize: 12,
        lineHeight: 1.55,
        fontVariantNumeric: 'tabular-nums',
      },
      row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      badge: {
        fontSize: 11,
        padding: '1px 7px',
        borderRadius: 999,
        border: '1px solid color-mix(in oklab, currentColor 22%, transparent)',
        opacity: 0.85,
        letterSpacing: '.02em',
      },
      title: { fontWeight: 600, letterSpacing: '.01em' },
      dim: { opacity: 0.62 },
      right: { marginLeft: 'auto', fontSize: 11, opacity: 0.55 },
      stats: { display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 6 },
      stat: { display: 'flex', flexDirection: 'column', minWidth: 56 },
      num: { fontSize: 17, fontWeight: 650, lineHeight: 1.2 },
      unit: { fontSize: 11, opacity: 0.6, marginLeft: 2, fontWeight: 400 },
      label: { fontSize: 11, opacity: 0.62 },
      bar: { display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 8, width: '100%' },
      legend: { display: 'flex', gap: 10, marginTop: 5, fontSize: 11, opacity: 0.6, flexWrap: 'wrap' },
    };

    const SEGMENTS = [
      { key: 'tiny', label: '≤15字', color: '#e8744f' },
      { key: 'short', label: '16–40字', color: '#e8b34f' },
      { key: 'mid', label: '41–200字', color: '#4f9de8' },
      { key: 'long', label: '>200字', color: '#57b98a' },
    ];

    const total = SEGMENTS.reduce((a, s) => a + (SNAPSHOT.bucket[s.key] || 0), 0) || 1;

    function Stat(props) {
      return h('div', { style: C.stat },
        h('div', { style: C.num }, props.value, props.unit ? h('span', { style: C.unit }, props.unit) : null),
        h('div', { style: C.label }, props.label));
    }

    function Card() {
      const s = SNAPSHOT;
      return h('div', { style: C.card, 'data-prompt-doctor': 'card' },
        h('div', { style: C.row },
          h('span', { style: C.badge }, '提纯'),
          h('span', { style: C.title }, '我的提问体检'),
          h('span', { style: C.dim }, `${s.prompts} 条真人提示 · ${s.projects} 个项目 · ${s.files} 份会话日志`),
          h('span', { style: C.right }, `快照 ${s.generatedAt}`)),
        h('div', { style: C.stats },
          h(Stat, { value: s.median, unit: '字', label: '中位长度' }),
          h(Stat, { value: s.p90, unit: '字', label: 'p90 长度' }),
          h(Stat, { value: s.rates.reference, unit: '%', label: '带指代' }),
          h(Stat, { value: s.rates.rework, unit: '%', label: '返工标记' }),
          h(Stat, { value: s.rates.gate, unit: '%', label: '闸门句' }),
          h(Stat, { value: s.longest, unit: '字', label: '最长一条' })),
        h('div', { style: C.bar }, SEGMENTS.map((seg) =>
          h('div', {
            key: seg.key,
            title: `${seg.label}：${s.bucket[seg.key] || 0} 条`,
            style: { width: `${((s.bucket[seg.key] || 0) / total) * 100}%`, background: seg.color, opacity: 0.85 },
          }))),
        h('div', { style: C.legend }, SEGMENTS.map((seg) =>
          h('span', { key: seg.key }, `${seg.label} ${s.bucket[seg.key] || 0}`))));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'prompt-doctor-card', order: 5,
        }, Card));
      },
    };
  },
});
