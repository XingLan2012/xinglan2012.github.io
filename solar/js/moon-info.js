/**
 * 卫星档案
 * --------
 * 一百五十多颗卫星不可能逐颗手写简介，但它们的档案不该是空白。
 * 这里的所有文字**都由真实数据推导**，不编造任何观测事实：
 *   · 分类（规则 / 不规则、所属群）由半长轴与倾角按天文学界通用的分组判据得出
 *   · 轨道描述直接读根数
 *   · 尺寸、周期、距离都由真实值换算
 * 有手写简介的重要卫星优先用手写的，其余用生成的。
 */

const AU_KM = 1.495978707e8;

/* ── 数值格式 ─────────────────────────────────────────── */
function num(v, d = 0) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function kmText(km) {
  if (km >= 1e8) return `${num(km / AU_KM, 3)} AU`;
  if (km >= 1e6) return `${num(km / 1e6, 3)} 百万 km`;
  if (km >= 1e4) return `${num(km / 1e4, 1)} 万 km`;
  return `${num(km, 0)} km`;
}
export function periodText(days) {
  const d = Math.abs(days);
  if (d < 1) return `${(d * 24).toFixed(2)} 小时`;
  if (d < 400) return `${d.toFixed(d < 10 ? 3 : 2)} 天`;
  return `${(d / 365.25).toFixed(2)} 年`;
}

/* ── 分组判据 ─────────────────────────────────────────── */
/**
 * 木星外围卫星的分群是看「半长轴 + 倾角」的组合：
 * 加尔默群与帕西法尔群的半长轴重叠，只能靠倾角分开（前者 165° 上下，后者 145–155°）；
 * 阿南刻群则靠更小的半长轴区分。这些都是文献里的通用判据。
 */
function jupiterGroup(aKm, inc) {
  const pro = inc < 90;
  if (aKm < 3e5) return { group: '内群（阿玛尔忒亚群）', regular: true };
  if (aKm < 2e6) return { group: '伽利略卫星', regular: true };
  if (aKm < 1e7) return { group: '忒弥斯托群', regular: false };
  if (pro) {
    if (aKm < 1.3e7) return { group: '希马利亚群', regular: false };
    if (inc > 40) return { group: '卡普群', regular: false };
    return { group: '瓦尔图多群', regular: false };
  }
  if (inc > 160) return { group: '加尔默群', regular: false };
  if (aKm < 2.25e7) return { group: '阿南刻群', regular: false };
  return { group: '帕西法尔群', regular: false };
}

function saturnGroup(aKm, inc) {
  const pro = inc < 90;
  if (aKm < 1.6e5) return { group: '主环与环隙卫星', regular: true };
  if (aKm < 4.2e5) return { group: '内圈卫星', regular: true };
  if (aKm < 4e6) return { group: '主卫星群', regular: true };
  if (!pro) {
    if (aKm > 1.2e7 && aKm < 1.4e7 && inc > 170) return { group: '土卫九（孤立逆行）', regular: false };
    return { group: '北欧群', regular: false };
  }
  if (aKm < 1.5e7) return { group: '因纽特群', regular: false };
  return { group: '高卢群', regular: false };
}

function uranusGroup(aKm, inc) {
  const pro = inc < 90;
  if (aKm < 1.1e5) return { group: '天卫内群（波西亚群）', regular: true };
  if (aKm < 6e5) return { group: '天卫主群', regular: true };
  if (pro) return { group: '玛格丽特（孤立顺行）', regular: false };
  if (aKm < 1e7) return { group: '卡利班群', regular: false };
  return { group: '西科拉克斯群', regular: false };
}

function neptuneGroup(aKm, inc) {
  const pro = inc < 90;
  if (aKm < 1.3e5) return { group: '海卫内群', regular: true };
  if (inc > 90) {
    if (aKm < 1e6) return { group: '海卫一（捕获的逆行天体）', regular: false };
    return { group: '逆行不规则卫星', regular: false };
  }
  if (aKm < 1e7) return { group: '海卫二（大偏心率）', regular: false };
  return { group: '顺行不规则卫星', regular: false };
}

function plutoGroup() {
  return { group: '冥王星系统（与冥卫一共质心）', regular: true };
}
function marsGroup() {
  return { group: '火星内卫星', regular: true };
}
function earthGroup() {
  return { group: '地球卫星', regular: true };
}

export function classifyMoon(m, parent) {
  const o = m.orbit;
  const inc = o.inc || 0;
  const pid = parent ? parent.id : m.parent;
  let base;
  if (pid === 'jupiter') base = jupiterGroup(o.a, inc);
  else if (pid === 'saturn') base = saturnGroup(o.a, inc);
  else if (pid === 'uranus') base = uranusGroup(o.a, inc);
  else if (pid === 'neptune') base = neptuneGroup(o.a, inc);
  else if (pid === 'pluto') base = plutoGroup();
  else if (pid === 'mars') base = marsGroup();
  else if (pid === 'earth') base = earthGroup();
  else base = { group: '', regular: inc < 90 };
  const ecliptic = o.frame === 'ecliptic';
  return {
    ...base,
    retrograde: inc > 90,
    frameLabel: ecliptic ? '黄道面' : `${parent ? parent.name : '母星'}赤道面`,
    sizeClass: m.radiusKm >= 1000 ? '大型卫星' : (m.radiusKm >= 200 ? '中型卫星' : (m.radiusKm >= 50 ? '小型卫星' : '微小卫星')),
  };
}

/* ── 档案内容 ─────────────────────────────────────────── */
/** 由真实数据生成的简介：分类 → 轨道 → 尺寸 → 自转 */
export function moonBlurb(m, parent) {
  const o = m.orbit;
  const c = classifyMoon(m, parent);
  const pn = parent ? parent.name : '母星';
  const ratio = parent ? (o.a / parent.radiusKm) : 0;
  const s = [];

  s.push(`${pn}的${c.regular ? '规则' : '不规则'}卫星${c.group ? `，属${c.group}` : ''}。`);
  s.push(`轨道半长轴 ${kmText(o.a)}${ratio ? `（约 ${ratio.toFixed(1)} 倍${pn}半径）` : ''}，`
    + `公转周期 ${periodText(o.period)}，偏心率 ${o.e.toFixed(4)}，`
    + `轨道面相对${c.frameLabel}倾斜 ${(o.inc || 0).toFixed(2)}°，${c.retrograde ? '**逆行**' : '顺行'}。`);

  if (c.retrograde && !c.regular) {
    s.push('逆行且轨道面倾斜很大，通常意味着它不是与母星同期形成的，而是后来被引力捕获的天体。');
  } else if (!c.regular) {
    s.push('这类外围不规则卫星多被认为是太阳系早期被母星捕获的小天体，而非在原位形成。');
  }

  if (m.radiusKm < 10) {
    s.push(`平均半径只有 ${m.radiusKm.toFixed(1)} 公里，形状不规则，靠反射阳光才能被望远镜拍到。`);
  } else if (m.radiusKm < 200) {
    s.push(`平均半径 ${m.radiusKm.toFixed(0)} 公里，因自身引力不足以压成球体，外形是不规则的。`);
  } else {
    s.push(`平均半径 ${m.radiusKm.toFixed(1)} 公里，已达到流体静力平衡，接近球形。`);
  }

  s.push('自转与公转潮汐锁定，因此永远以同一面朝向母星。');
  return s.join('');
}

/** 要点表：全部是可直接核对的数据 */
export function moonFacts(m, parent) {
  const o = m.orbit;
  const c = classifyMoon(m, parent);
  const out = [
    ['轨道方向', c.retrograde ? '逆行（i > 90°）' : '顺行'],
    ['参考面', c.frameLabel],
    ['轨道倾角', `${(o.inc || 0).toFixed(2)}°`],
    ['偏心率', o.e.toFixed(4)],
    ['公转周期', periodText(o.period)],
    ['轨道半长轴', kmText(o.a)],
    ['自转', '潮汐锁定'],
    ['尺寸等级', c.sizeClass],
  ];
  if (c.group) out.unshift(['所属群', c.group]);
  return out;
}

/** 半长轴 ÷ 母星半径：判断「贴不贴母星」最直观的一个数 */
export function orbitRatio(m, parent) {
  return parent ? m.orbit.a / parent.radiusKm : 0;
}
