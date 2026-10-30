// 翻车事件重建：把「他说没做好」和「我上一句说做好了」对上，按领域聚类。
// 输出的不是比例，是**失败模式**——这是能写成人格约定的原料。

const REWORK = /不是|不对|不啊|重新|又|为什么|怎么还|还没|我说过|还是|怎么不|怎么这么|算了|服了|离谱|一眼|这不/;
const CLAIM = /(已|已经)(改|做|加|写|修|完成)|做好了|搞定|完成了|现在(正好|应该|可以)|✅|OK|finished|done/i;
const DOMAINS = [
  ['表格/列宽', [[/列宽|铺满|表头|el-table|滚动条|对齐/, 3], [/表格/, 1], [/宽度/, 1]]],
  ['打包/APK', [[/apk|安装包|签名|gradle/i, 3], [/打包/, 2], [/安卓包/, 2]]],
  ['组件/小部件', [[/小组件|widget|remoteview|桌面卡片/i, 4], [/空白/, 1], [/创建出来/, 1]]],
  ['图片还原', [[/还原|贴图|素材|png|svg/i, 2], [/像不像|一模一样|走样/, 3]]],
  ['界面/样式', [[/不好看|美观|丑|配色|圆角|间距|字体/, 3], [/布局|样式/, 1]]],
  ['启动/环境', [[/启动|起不来|端口|依赖|maven|idea|报错/, 2], [/error|failed/i, 1], [/环境/, 1]]],
  ['数据/抓取', [[/抓取|爬|解析|坐标|视口|接口/i, 2], [/数据/, 1]]],
  ['文档/内容', [[/ppt|word|excel|文档|报告|文案/i, 2], [/内容/, 1]]],
  ['功能缺失', [[/没实现|根本不|缺了|少了|没有这个功能|不支持/, 3], [/没有|不能/, 1]]],
];

const NOISE = /^【当前时间】|^【你的身份】|^# 角色卡：|^【最近刷到的东西】|^【会话令牌】|Current runtime context|Time sampled|<system-reminder|\[Compressed conversation section\]|^<hindsight_knowledge/;

export function redact(text, max = 90) {
  if (!text) return '';
  let t = String(text)
    .replace(new RegExp(String.fromCharCode(92) + 'u001b' + String.fromCharCode(92) + '[\\[0-9;]*m', 'g'), '')
    .replace(/[A-Za-z]:[\\/][^\s，。；、）)]+/g, '<路径>')
    .replace(/~\/[^\s，。；、）)]+/g, '<路径>')
    .replace(/sk-[A-Za-z0-9-]{8,}/g, '<密钥>')
    .replace(/ghp_[A-Za-z0-9]{8,}/g, '<密钥>')
    .replace(/密码\S*/g, '<密码>')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > max) t = t.slice(0, max - 1) + '…';
  return t;
}

export function domainOf(text) {
  const scored = [];
  for (const [name, rules] of DOMAINS) {
    let score = 0;
    for (const [re, w] of rules) if (re.test(text)) score += w;
    if (score > 0) scored.push([name, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.filter(([, s]) => s >= 2).slice(0, 2).map(([n]) => n);
}

// events: [{kind:'user'|'assistant'|'tool', text, at}]
export function buildIncidents(events) {
  const out = [];
  let lastClaim = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === 'assistant') {
      if (CLAIM.test(e.text || '')) lastClaim = { text: e.text, at: e.at };
      continue;
    }
    if (e.kind !== 'user') continue;
    if (NOISE.test(e.text || '')) continue;
    if (!REWORK.test(e.text || '')) continue;
    const claim = lastClaim;
    lastClaim = null;
    const basis = `${e.text} ${claim ? claim.text : ''}`;
    const domains = domainOf(basis);
    out.push({
      at: e.at,
      user: redact(e.text, 110),
      claim: claim ? redact(claim.text, 110) : '',
      domains: domains.length ? domains : ['其他'],
    });
  }
  return out;
}

export function cluster(incidents, { min = 2, perDomain = 2 } = {}) {
  const groups = new Map();
  for (const it of incidents) {
    for (const d of it.domains) {
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(it);
    }
  }
  return [...groups.entries()]
    .map(([domain, items]) => {
      items.sort((a, b) => a.at - b.at);
      return {
        domain,
        count: items.length,
        firstAt: items[0].at,
        lastAt: items[items.length - 1].at,
        samples: items.slice(-perDomain).map(({ at, user, claim }) => ({ at, user, claim })),
      };
    })
    .filter((g) => g.count >= min)
    .sort((a, b) => b.count - a.count);
}
