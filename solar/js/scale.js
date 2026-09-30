/**
 * 尺度模型
 * ---------
 * 默认即真实比例尺：1 AU = 30 单位、1 km = 30/1.496×10⁸ 单位，
 * 天体半径与轨道距离共用同一比例尺，所以这是「真的」太阳系。
 *
 * 观赏模式（可选）把距离按 r^0.52 压缩、把小天体放大。
 * 两个参数各自在 0（真实）↔ 1（观赏）之间连续插值，
 * 位置与轨道线共用同一映射，因此行星永远精确落在画出的轨道上。
 *
 *   distT   0 = 真实距离, 1 = 压缩距离
 *   sizeT   0 = 真实大小（与距离同一比例尺）, 1 = 夸张大小（地球固定 0.5 单位）
 */

export const AU_KM = 1.495978707e8;
export const AU_M = AU_KM * 1000;
export const GM_SUN = 1.32712440018e20;   // m³/s²
export const J2000 = 2451545.0;
export const DEG = Math.PI / 180;
export const OBLIQUITY = 23.4392911 * DEG;
export const C_KM_S = 299792.458;

/** 1 AU 的场景单位数 */
const AU_UNITS = 30;
/** 压缩映射的幂次：r_scene ∝ r_AU^0.52 */
const COMP_POW = 0.52;
/** 观赏模式下的地球场景半径 */
const EARTH_UNITS = 0.5;
/** 观赏模式下卫星轨道相对母星半径的压缩指数 */
const MOON_POW = 0.6;

/** 每 km 对应的场景单位数（真实比例尺）≈ 2.003×10⁻⁷ */
export const KM_UNITS = AU_UNITS / AU_KM;

export const params = {
  /** 0 = 真实距离，1 = 压缩距离 */
  distT: 0,
  /** 0 = 真实大小，1 = 夸张大小 */
  sizeT: 0,
};

/**
 * 日心距离 AU → 场景单位（真实 ↔ 压缩 的连续插值）
 * 两个端点是绝大多数时候的状态（默认就是真实比例尺），单独走快路径：
 * 这一步每帧会被调用几万次（小行星带、柯伊伯带的每个顶点），
 * 省掉 Math.pow 能直接把逐帧开销压下来。
 */
export function auToUnits(rAU) {
  if (params.distT === 0) return rAU * AU_UNITS;
  if (params.distT === 1) return AU_UNITS * Math.pow(rAU, COMP_POW);
  const lin = rAU * AU_UNITS;
  const cmp = AU_UNITS * Math.pow(rAU, COMP_POW);
  return lin * (1 - params.distT) + cmp * params.distT;
}

/** 场景单位 → 日心距离 AU（用于 HUD 换算） */
export function unitsToAu(u) {
  if (params.distT <= 0.0001) return u / AU_UNITS;
  const rCmp = Math.pow(u / AU_UNITS, 1 / COMP_POW);
  if (params.distT >= 0.9999) return rCmp;
  return (u / AU_UNITS) * (1 - params.distT) + rCmp * params.distT;
}

/** 天体半径（km） → 场景半径 */
export function bodyRadiusUnits(km) {
  const real = km * KM_UNITS;
  const exag = EARTH_UNITS * Math.pow(km / 6371, 0.65);
  return real * (1 - params.sizeT) + exag * params.sizeT;
}

/** 卫星轨道半长轴（km） → 场景单位 */
export function moonOrbitUnits(aKm, parentRadiusKm, parentRadiusUnits) {
  const real = aKm * KM_UNITS;
  const exag = parentRadiusUnits * Math.pow(aKm / parentRadiusKm, MOON_POW);
  const v = real * (1 - params.sizeT) + exag * params.sizeT;
  return Math.max(v, parentRadiusUnits * (1.05 + 0.4 * params.sizeT));
}

/** 卫星显示半径下限：真实模式下不生效（轨道即真实距离，不必迁就可见性） */
export function moonDisplayFloor(parentRadiusUnits) {
  return parentRadiusUnits * 0.028 * params.sizeT + 1.2e-6;
}

/** 太阳半径：观赏模式下必须钳制，否则会吞掉水星轨道 */
export function sunRadiusUnits() {
  const raw = bodyRadiusUnits(696340);
  const mercury = auToUnits(0.387);
  return Math.min(raw, mercury * 0.22);
}
