/**
 * 轨道力学
 * --------
 * · 行星：JPL 近似根数 + 世纪变率 → 开普勒方程 Newton 迭代 → 日心黄道坐标
 * · 卫星：相对母星赤道面的开普勒轨道（月球含交点退行与近地点进动）
 * · 速度：活力公式（vis-viva）给出瞬时轨道速度，与位置解算自洽
 */

import { AU_KM, AU_M, GM_SUN, J2000, DEG, OBLIQUITY } from './scale.js';

export const DAY_MS = 86400000;
const UNIX_EPOCH_JD = 2440587.5;

export function jdFromDate(date) { return date.getTime() / DAY_MS + UNIX_EPOCH_JD; }
export function dateFromJd(jd) { return new Date((jd - UNIX_EPOCH_JD) * DAY_MS); }

const PAD = n => String(n).padStart(2, '0');

/** JD → "2026-09-30 00:12 UTC" */
export function formatJd(jd) {
  const d = dateFromJd(jd);
  const y = d.getUTCFullYear();
  const s = `${y < 0 ? '−' + String(-y).padStart(4, '0') : String(y).padStart(4, '0')}-${PAD(d.getUTCMonth() + 1)}-${PAD(d.getUTCDate())}`;
  return { date: s, time: `${PAD(d.getUTCHours())}:${PAD(d.getUTCMinutes())} UTC`, weekday: '日一二三四五六'[d.getUTCDay()] };
}

/** JD → "2026-09-30" */
export function isoDate(jd) {
  const d = dateFromJd(jd);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${PAD(d.getUTCMonth() + 1)}-${PAD(d.getUTCDate())}`;
}

/** "2026-09-30" → JD（UTC 00:00） */
export function jdFromIso(text) {
  const m = /^\s*(-?\d{1,6})-(\d{1,2})-(\d{1,2})/.exec(text || '');
  if (!m) return null;
  const jd = Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS + UNIX_EPOCH_JD;
  return Number.isFinite(jd) ? jd : null;
}

/* ── 行星 ─────────────────────────────────────────────── */

export function elementsAt(el, jd) {
  const T = (jd - J2000) / 36525;
  return {
    T,
    a: el.a + el.da * T,
    e: el.e + el.de * T,
    i: el.i + el.di * T,
    L: el.L + el.dL * T,
    peri: el.peri + el.dperi * T,
    node: el.node + el.dnode * T,
  };
}

/** 开普勒方程 M = E − e·sinE，Newton 迭代 */
export function solveKepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 12; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

/**
 * 轨道面 3-1-3 旋转：轨道内坐标 → 参考面坐标
 *
 *   R = Rz(Ω) · Rx(i) · Rz(ω−Ω)
 *
 * i 是相对参考面（黄道 / 行星赤道）的倾角：i = 0 时轨道必须落在参考面内，
 * 即 z 分量为 0；最大离面量 = r·sin i。曾经这里把 sin i 与 cos i 写反，
 * 等价于用「相对极轴的倾角 90°−i」建轨道，会让整片太阳系竖起来。
 */
export function orient(xp, yp, nodeRad, incRad, periRad) {
  const w = periRad - nodeRad;
  const cw = Math.cos(w), sw = Math.sin(w);
  const ci = Math.cos(incRad), si = Math.sin(incRad);
  const cO = Math.cos(nodeRad), sO = Math.sin(nodeRad);
  return {
    x: (cw * cO - sw * ci * sO) * xp + (-sw * cO - cw * ci * sO) * yp,
    y: (cw * sO + sw * ci * cO) * xp + (-sw * sO + cw * ci * cO) * yp,
    z: (sw * si) * xp + (cw * si) * yp,
  };
}

/**
 * 行星日心状态（黄道 J2000 直角坐标，单位 AU）
 * @returns {{p:{x,y,z}, r:number, a:number, e:number, i:number, nu:number, E:number, M:number,
 *            speedKmS:number, periodDays:number, lon:number, lat:number}}
 */
export function planetState(planet, jd) {
  const el = elementsAt(planet.elements, jd);
  let M = el.L - el.peri;
  M = ((M + 180) % 360 + 360) % 360 - 180;
  const Mr = M * DEG;
  const E = solveKepler(Mr, el.e);
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e)) * Math.sin(E);
  const p = orient(xp, yp, el.node * DEG, el.i * DEG, el.peri * DEG);
  const r = Math.hypot(p.x, p.y, p.z);
  const nu = Math.atan2(Math.sqrt(Math.max(0, 1 - el.e * el.e)) * Math.sin(E), Math.cos(E) - el.e);
  const aM = el.a * AU_M;
  const rM = Math.max(r * AU_M, 1);
  const speedKmS = Math.sqrt(Math.max(0, GM_SUN * (2 / rM - 1 / aM))) / 1000;
  const periodDays = 2 * Math.PI * Math.sqrt((aM * aM * aM) / GM_SUN) / 86400;
  return {
    p, r, a: el.a, e: el.e, i: el.i, nu, E, M: Mr,
    speedKmS, periodDays,
    lon: Math.atan2(p.y, p.x) / DEG,
    lat: Math.asin(p.z / Math.max(r, 1e-9)) / DEG,
  };
}

/* ── 卫星 ─────────────────────────────────────────────── */

/**
 * 卫星在母星赤道坐标系中的位置（km，Y 轴为母星北极）
 * 采用 3-1-3 欧拉角；月球带交点退行 / 近地点进动。
 */
export function moonLocalPosition(moon, jd) {
  const o = moon.orbit;
  const epoch = o.epoch || J2000;
  const a = o.a;
  const e = o.e || 0;
  const M = (o.M0 || 0) + 360 * ((jd - epoch) / o.period);
  const node = o.node != null ? o.node + (o.dnode || 0) * (jd - J2000) : 0;
  const peri = o.peri != null ? o.peri + (o.dperi || 0) * (jd - J2000) : 0;
  const E = solveKepler(((M % 360) + 360) % 360 * DEG, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
  const p = orient(xp, yp, node * DEG, (o.inc || 0) * DEG, peri * DEG);
  return { x: p.x, y: p.y, z: p.z };
}

/** 卫星瞬时轨道速度 km/s（活力公式，GM 取母星） */
export function moonSpeedKmS(moon, parent, rKm) {
  const gm = (parent && parent.gm) ? parent.gm : 3.986004418e14;
  const aM = moon.orbit.a * 1000;
  const rM = Math.max(rKm * 1000, 1);
  return Math.sqrt(Math.max(0, gm * (2 / rM - 1 / aM))) / 1000;
}

/* ── 姿态 ─────────────────────────────────────────────── */

/** 赤道 J2000 极轴 → 黄道坐标 */
export function poleToEcliptic(pole) {
  const ra = pole[0] * DEG, dec = pole[1] * DEG;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  const ce = Math.cos(OBLIQUITY), se = Math.sin(OBLIQUITY);
  return { x, y: y * ce + z * se, z: -y * se + z * ce };
}

/** 黄道坐标 → three.js 场景坐标（Y 轴为黄道北极） */
export function eclipticToScene(v) { return { x: v.x, y: v.z, z: -v.y }; }

/** 天体极轴（场景坐标，单位向量） */
export function axisVector(body) {
  const e = eclipticToScene(poleToEcliptic(body.pole || [0, 90]));
  const l = Math.hypot(e.x, e.y, e.z) || 1;
  return [e.x / l, e.y / l, e.z / l];
}

/**
 * 自转相位（弧度）。使用 IAU 的 W0 与自转速率，
 * 因此地球的昼夜分界线与真实时刻一致。
 * d 为自 J2000 起的天数。
 */
export function spinAngle(body, jd) {
  const d = jd - J2000;
  const hours = body.rotationHours;
  if (!hours) return 0;
  const rate = (2 * Math.PI) / (hours / 24);   // 弧度 / 天
  return (body.spin0 || 0) * DEG + rate * d;   // W0 以度给出
}
