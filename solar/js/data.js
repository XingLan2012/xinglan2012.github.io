/**
 * 天体目录 —— 天体与卫星的物理、轨道、外观参数。
 *
 * 行星轨道根数采用 JPL/Standish《Approximate Positions of the Planets》
 * (1800–2050 AD) 的经典根数 + 世纪变率，因此页面显示的位置是
 * 真实历元的日心位置，而非随手画的圆。
 *
 *   a     半长轴 (AU)
 *   e     偏心率
 *   i     轨道倾角 (deg, 相对黄道)
 *   L     平黄经 (deg)
 *   peri  近日点黄经 ϖ (deg)
 *   node  升交点黄经 Ω (deg)
 *   变率  每一项 / 儒略世纪
 *
 * 卫星使用相对行星赤道面的轨道根数（真实规则卫星几乎都在赤道面）；
 * 唯一例外是月球：其根数相对黄道给出，见条目里的 frame: 'ecliptic'。
 */

import { buildMoonEntries } from './moons-catalog.js';

const K = 1; // 语义标记：本文件只描述数据，不做任何缩放

/* ── 太阳 ───────────────────────────────────────────────── */
export const SUN = {
  id: 'sun', spin0: 84.176,
  name: '太阳',
  en: 'Sun',
  type: 'star',
  radiusKm: 696340,
  massKg: 1.98892e30,
  gravity: 274,
  rotationHours: 609.12,
  pole: [286.13, 63.87],
  tempC: 5505,
  tempLabel: '表面 5,505 °C · 核心 1,500 万 °C',
  ui: '#ffd24a',
  glow: '#ffb020',
  desc: '占太阳系总质量 99.86% 的 G2V 主序星，以每秒约 6 亿吨的氢核聚变维持整个行星系的引力与光热。',
  facts: [
    ['光谱型', 'G2V'],
    ['绝对星等', '+4.83'],
    ['自转周期', '25.4 天（赤道）'],
    ['核心温度', '1.57×10⁷ K'],
    ['年龄', '约 46 亿年'],
  ],
};

/* ── 行星 ───────────────────────────────────────────────── */
export const PLANETS = [
  {
    id: 'mercury', spin0: 329.5988, name: '水星', en: 'Mercury', type: 'planet',
    radiusKm: 2439.7, massKg: 3.3011e23, gravity: 3.70, gm: 2.2032e13,
    rotationHours: 1407.6, pole: [281.0103, 61.4155],
    tempC: 167, tempLabel: '−173 °C ~ 427 °C',
    ui: '#a89b8c', glow: '#8c8175',
    elements: {
      a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, peri: 77.45779628, node: 48.33076593,
      da: 0.00000037, de: 0.00001906, di: -0.00594749, dL: 149472.67411175, dperi: 0.16047689, dnode: -0.12534081,
    },
    texture: 'mercury', bump: 0.9,
    desc: '离太阳最近、体积最小的行星。没有真正的大气，昼夜温差超过 600 °C，表面布满与月球相似的撞击坑。',
    facts: [['公转周期', '87.97 天'], ['自转周期', '58.65 天'], ['卫星', '无'], ['大气', '极稀薄外逸层']],
  },
  {
    id: 'venus', spin0: 160.2, name: '金星', en: 'Venus', type: 'planet',
    radiusKm: 6051.8, massKg: 4.8675e24, gravity: 8.87, gm: 3.24859e14,
    rotationHours: -5832.5, pole: [272.76, 67.16],
    tempC: 464, tempLabel: '表面 464 °C（温室效应）',
    ui: '#e8c88a', glow: '#d8a860',
    elements: {
      a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, peri: 131.60246718, node: 76.67984255,
      da: 0.00000390, de: -0.00004107, di: -0.00078890, dL: 58517.81538729, dperi: 0.00268329, dnode: -0.27769418,
    },
    texture: 'venus', bump: 0.25,
    clouds: { texture: 'venusAtmosphere', altitude: 1.004, opacity: 0.9, spinScale: 0.55, color: 0xf3e2b8, useMap: true },
    atmosphere: { color: 0xf5d79a, power: 3.0, intensity: 1.5, altitude: 1.035 },
    desc: '地球的“姊妹星”，却因浓密的二氧化碳大气与硫酸云成为太阳系最炽热的行星。自转方向与公转相反。',
    facts: [['公转周期', '224.70 天'], ['自转周期', '243.02 天（逆向）'], ['气压', '92 个地球大气压'], ['卫星', '无']],
  },
  {
    id: 'earth', spin0: 190.147, name: '地球', en: 'Earth', type: 'planet',
    satellites: 1,
    radiusKm: 6371.0, massKg: 5.97237e24, gravity: 9.807, gm: 3.986004418e14,
    rotationHours: 23.9345, pole: [0.0, 90.0],
    tempC: 15, tempLabel: '平均 15 °C',
    ui: '#4f9de0', glow: '#5fb0ff',
    elements: {
      a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0.0,
      da: 0.00000562, de: -0.00004392, di: -0.01294668, dL: 35999.37244981, dperi: 0.32327364, dnode: 0.0,
    },
    texture: 'earth', bump: 0.55, nightLights: true, oceanSpecular: true,
    clouds: { texture: 'earthClouds', altitude: 1.012, opacity: 0.85, spinScale: 0.92, color: 0xffffff },
    atmosphere: { color: 0x5aa9ff, power: 3.4, intensity: 1.35, altitude: 1.045 },
    desc: '目前已知唯一孕育生命的行星。71% 的表面被液态水覆盖，磁场与臭氧层共同抵挡太阳风与紫外辐射。',
    facts: [['公转周期', '365.256 天'], ['自转周期', '23 时 56 分 4 秒'], ['轴倾角', '23.44°'], ['卫星', '1 颗']],
  },
  {
    id: 'mars', spin0: 176.63, name: '火星', en: 'Mars', type: 'planet',
    satellites: 2,
    radiusKm: 3389.5, massKg: 6.4171e23, gravity: 3.721, gm: 4.282837e13,
    rotationHours: 24.6229, pole: [317.68, 52.89],
    tempC: -63, tempLabel: '平均 −63 °C',
    ui: '#d1593a', glow: '#e07a4a',
    elements: {
      a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891,
      da: 0.00001847, de: 0.00007882, di: -0.00813131, dL: 19140.30268499, dperi: 0.44441088, dnode: -0.29257343,
    },
    texture: 'mars', bump: 1.0,
    atmosphere: { color: 0xd98b5a, power: 3.6, intensity: 0.75, altitude: 1.03 },
    desc: '红色的氧化铁荒漠。拥有太阳系最高的火山奥林匹斯山（21.9 km）与最长的峡谷水手谷（4000 km）。',
    facts: [['公转周期', '686.98 天'], ['自转周期', '24 时 37 分'], ['轴倾角', '25.19°'], ['卫星', '2 颗']],
  },
  {
    id: 'jupiter', spin0: 284.95, name: '木星', en: 'Jupiter', type: 'planet',
    radiusKm: 69911, massKg: 1.8982e27, gravity: 24.79, gm: 1.26686534e17,
    rotationHours: 9.925, pole: [268.056595, 64.495303],
    tempC: -108, tempLabel: '云顶 −108 °C',
    ui: '#d8a878', glow: '#e0b98a',
    elements: {
      a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909,
      da: -0.00011607, de: -0.00013253, di: -0.00183714, dL: 3034.74612775, dperi: 0.21252668, dnode: 0.20469106,
    },
    texture: 'jupiter',
    rings: { innerKm: 122500, outerKm: 129000, opacity: 0.10, texture: 'jupiterRing', tilt: 0 },
    atmosphere: { color: 0xe8c9a0, power: 3.0, intensity: 0.85, altitude: 1.025 },
    desc: '质量是其余七颗行星总和的 2.5 倍。大红斑是一场持续了至少 190 年的反气旋风暴，直径可容纳一个地球。',
    facts: [['公转周期', '11.86 年'], ['自转周期', '9 时 55 分'], ['已确认卫星', '95 颗'], ['磁场强度', '地球的 2 万倍']],
    satellites: 95,
  },
  {
    id: 'saturn', spin0: 38.9, name: '土星', en: 'Saturn', type: 'planet',
    radiusKm: 58232, massKg: 5.6834e26, gravity: 10.44, gm: 3.7931187e16,
    rotationHours: 10.656, pole: [40.589, 83.537],
    tempC: -139, tempLabel: '云顶 −139 °C',
    ui: '#e3cea0', glow: '#f0dca8',
    elements: {
      a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448,
      da: -0.00125060, de: -0.00050991, di: 0.00193609, dL: 1222.49362201, dperi: -0.41897216, dnode: -0.28867794,
    },
    texture: 'saturn',
    rings: {
      innerKm: 74500, outerKm: 140220, opacity: 0.96, texture: 'saturnRing',
      // 冰环：主环 + 卡西尼缝的径向 alpha 由贴图给出
      shadow: true,
    },
    atmosphere: { color: 0xf0dfae, power: 3.0, intensity: 0.7, altitude: 1.03 },
    desc: '平均密度仅 0.687 g/cm³，比水还轻。环系由数万亿块冰屑组成，厚度却往往不足 20 米。',
    facts: [['公转周期', '29.46 年'], ['自转周期', '10 时 33 分'], ['轴倾角', '26.73°'], ['已确认卫星', '146 颗']],
    satellites: 146,
  },
  {
    id: 'uranus', spin0: 203.81, name: '天王星', en: 'Uranus', type: 'planet',
    radiusKm: 25362, massKg: 8.6810e25, gravity: 8.87, gm: 5.793939e15,
    rotationHours: -17.24, pole: [257.311, -15.175],
    tempC: -197, tempLabel: '云顶 −197 °C',
    ui: '#9fd8dc', glow: '#a8e8ea',
    elements: {
      a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, peri: 170.95427630, node: 74.01692503,
      da: -0.00196176, de: -0.00004397, di: -0.00242939, dL: 428.48202785, dperi: 0.40805281, dnode: 0.04240589,
    },
    texture: 'uranus',
    rings: { innerKm: 41800, outerKm: 51150, opacity: 0.34, texture: 'uranusRing', thin: true },
    atmosphere: { color: 0x9ce4ea, power: 3.0, intensity: 0.95, altitude: 1.04 },
    desc: '自转轴倾斜 97.8°，几乎“躺着”绕日运行，两极各有 42 年的极昼与极夜。大气中的甲烷吸收红光，使其呈青蓝色。',
    facts: [['公转周期', '84.01 年'], ['自转周期', '17 时 14 分（逆向）'], ['轴倾角', '97.77°'], ['已确认卫星', '28 颗']],
    satellites: 28,
  },
  {
    id: 'neptune', spin0: 253.18, name: '海王星', en: 'Neptune', type: 'planet',
    radiusKm: 24622, massKg: 1.02413e26, gravity: 11.15, gm: 6.836529e15,
    rotationHours: 16.11, pole: [299.36, 43.46],
    tempC: -201, tempLabel: '云顶 −201 °C',
    ui: '#4f6dd8', glow: '#5f80ff',
    elements: {
      a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574,
      da: 0.00026291, de: 0.00005105, di: 0.00035372, dL: 218.45945325, dperi: -0.32241464, dnode: -0.00508664,
    },
    texture: 'neptune',
    atmosphere: { color: 0x5a7cff, power: 3.2, intensity: 1.0, altitude: 1.035 },
    desc: '第一颗由数学预测而非观测发现的行星。风速可达 2100 km/h，是太阳系最猛烈的风暴带。',
    facts: [['公转周期', '164.8 年'], ['自转周期', '16 时 6 分'], ['发现', '1846 年 · 勒维耶预测'], ['已确认卫星', '16 颗']],
    satellites: 16,
  },
  {
    id: 'pluto', spin0: 236.77, name: '冥王星', en: 'Pluto', type: 'dwarf',
    radiusKm: 1188.3, massKg: 1.303e22, gravity: 0.62, gm: 8.71e11,
    rotationHours: -153.2928, pole: [132.993, -6.163],
    tempC: -229, tempLabel: '平均 −229 °C',
    ui: '#c9b6a0', glow: '#d8c8b0',
    elements: {
      a: 39.48211675, e: 0.24882730, i: 17.14001206, L: 238.92903833, peri: 224.06891629, node: 110.30393684,
      da: -0.00031596, de: 0.00005170, di: 0.00004818, dL: 145.20780515, dperi: -0.04062942, dnode: -0.01183482,
    },
    texture: 'pluto', bump: 1.0, procedural: { kind: 'pluto' },
    atmosphere: { color: 0xbcd0e8, power: 4.0, intensity: 0.5, altitude: 1.05 },
    desc: '2006 年被重新归类为矮行星。2015 年新视野号掠过，揭示了氮冰平原“斯普特尼克高原”与 3500 米高的水冰山脉。',
    facts: [['公转周期', '247.9 年'], ['自转周期', '6.39 天（逆向）'], ['轨道共振', '与海王星 2:3'], ['卫星', '5 颗']],
    satellites: 5,
  },
];

/* ── 卫星 ─────────────────────────────────────────────────
 * a      半长轴 (km)
 * period 恒星周期 (天)
 * inc    相对母星赤道面的倾角 (deg)
 * M0     J2000 历元平近点角 (deg)
 * 其余   radiusKm / massKg / 外观
 * ------------------------------------------------------- */
const MOON_DETAILS = [
  /* 火星 */
  {
    id: 'phobos', parent: 'mars', name: '火卫一', en: 'Phobos',
    radiusKm: 11.27, massKg: 1.0659e16, gravity: 0.0057,
    orbit: { a: 9376, period: 0.318910, e: 0.0151, inc: 1.08, M0: 92.4 },
    spin: 'tidally-locked', ui: '#9a8d80', rock: { seed: 1101, base: [0.42, 0.39, 0.36], craters: 260, roughness: 1.0 },
    desc: '太阳系中离母星最近的卫星，正以每百年 1.8 米的速度坠向火星，约 3000 万年后将被撕碎成环。',
  },
  {
    id: 'deimos', parent: 'mars', name: '火卫二', en: 'Deimos',
    radiusKm: 6.2, massKg: 1.4762e15, gravity: 0.003,
    orbit: { a: 23463, period: 1.263, e: 0.00033, inc: 1.79, M0: 279.6 },
    spin: 'tidally-locked', ui: '#8d8175', rock: { seed: 1102, base: [0.46, 0.43, 0.39], craters: 200, roughness: 1.0 },
    desc: '外形不规则的小卫星，表面覆盖着厚厚的风化层，最大陨石坑直径约 2.3 km。',
  },
  /* 木星 */
  {
    id: 'io', parent: 'jupiter', name: '木卫一', en: 'Io',
    radiusKm: 1821.6, massKg: 8.9319e22, gravity: 1.796,
    orbit: { a: 421800, period: 1.769138, e: 0.0041, inc: 0.036, M0: 342.0 },
    spin: 'tidally-locked', ui: '#e8d55a', rock: { seed: 2101, base: [0.86, 0.74, 0.32], craters: 40, volcanoes: 46, roughness: 0.7 },
    desc: '太阳系火山活动最剧烈的天体，400 多座活火山由木星潮汐加热驱动，硫化物喷发高达 500 km。',
  },
  {
    id: 'europa', parent: 'jupiter', name: '木卫二', en: 'Europa',
    radiusKm: 1560.8, massKg: 4.7998e22, gravity: 1.315,
    orbit: { a: 671100, period: 3.551181, e: 0.009, inc: 0.466, M0: 171.0 },
    spin: 'tidally-locked', ui: '#e6e0cc', rock: { seed: 2102, base: [0.88, 0.86, 0.79], craters: 30, lineae: 60, ice: 0.55, roughness: 0.35 },
    desc: '冰壳之下藏着一片深达 100 km 的液态海洋，含水量约为地球海洋的两倍，是寻找地外生命的重要目标。',
  },
  {
    id: 'ganymede', parent: 'jupiter', name: '木卫三', en: 'Ganymede',
    radiusKm: 2634.1, massKg: 1.4819e23, gravity: 1.428,
    orbit: { a: 1070400, period: 7.154553, e: 0.0013, inc: 0.177, M0: 65.0 },
    spin: 'tidally-locked', ui: '#b8ac9c', rock: { seed: 2103, base: [0.63, 0.60, 0.55], craters: 220, lineae: 26, ice: 0.3, roughness: 0.75 },
    desc: '太阳系最大的卫星，比水星还大。它是唯一拥有自身磁场的卫星，表面是古老暗区与年轻沟槽地形的拼贴。',
  },
  {
    id: 'callisto', parent: 'jupiter', name: '木卫四', en: 'Callisto',
    radiusKm: 2410.3, massKg: 1.0759e23, gravity: 1.235,
    orbit: { a: 1882700, period: 16.689018, e: 0.0074, inc: 0.192, M0: 224.0 },
    spin: 'tidally-locked', ui: '#7d7468', rock: { seed: 2104, base: [0.44, 0.41, 0.38], craters: 420, roughness: 0.95 },
    desc: '太阳系表面撞击坑最密集的天体之一，地质活动早已停止，是一枚保存了 40 亿年的“化石”。',
  },
  {
    id: 'amalthea', parent: 'jupiter', name: '木卫五', en: 'Amalthea',
    radiusKm: 83.5, massKg: 2.08e18, gravity: 0.02,
    orbit: { a: 181400, period: 0.498179, e: 0.0032, inc: 0.374, M0: 20.0 },
    spin: 'tidally-locked', ui: '#b06a50', rock: { seed: 2105, base: [0.62, 0.34, 0.26], craters: 120, roughness: 1.0 },
    desc: '木星内侧的小卫星，呈暗红色，可能是被木星引力捕获的天体，轨道位于木卫一之内。',
  },
  /* 土星 */
  {
    id: 'mimas', parent: 'saturn', name: '土卫一', en: 'Mimas',
    radiusKm: 198.2, massKg: 3.749e19, gravity: 0.064,
    orbit: { a: 185540, period: 0.942422, e: 0.0196, inc: 1.574, M0: 14.0 },
    spin: 'tidally-locked', ui: '#cfcabd', rock: { seed: 3101, base: [0.80, 0.79, 0.76], craters: 180, ice: 0.35, roughness: 0.8 },
    desc: '因赤道上巨大的赫歇尔坑而形似“死星”，坑深 10 km、直径 130 km，几乎达到卫星半径的三分之一。',
  },
  {
    id: 'enceladus', parent: 'saturn', name: '土卫二', en: 'Enceladus',
    radiusKm: 252.1, massKg: 1.0802e20, gravity: 0.113,
    orbit: { a: 238040, period: 1.370218, e: 0.0047, inc: 0.009, M0: 198.0 },
    spin: 'tidally-locked', ui: '#f2f4f0', rock: { seed: 3102, base: [0.94, 0.95, 0.95], craters: 60, ice: 0.9, tigerStripes: true, roughness: 0.25 },
    desc: '反射率高达 0.99 的冰卫星。南极“虎纹”裂缝持续喷出水汽羽流，证实冰下存在全球性液态海洋。',
  },
  {
    id: 'tethys', parent: 'saturn', name: '土卫三', en: 'Tethys',
    radiusKm: 531.1, massKg: 6.174e20, gravity: 0.145,
    orbit: { a: 294670, period: 1.887802, e: 0.0001, inc: 1.091, M0: 121.0 },
    spin: 'tidally-locked', ui: '#e4e6e2', rock: { seed: 3103, base: [0.90, 0.90, 0.88], craters: 150, ice: 0.7, roughness: 0.5 },
    desc: '几乎全由水冰构成，密度仅 0.98 g/cm³。伊萨卡峡谷绵延 2000 km，宽达 100 km。',
  },
  {
    id: 'dione', parent: 'saturn', name: '土卫四', en: 'Dione',
    radiusKm: 561.4, massKg: 1.0954e21, gravity: 0.232,
    orbit: { a: 377420, period: 2.736915, e: 0.0022, inc: 0.014, M0: 233.0 },
    spin: 'tidally-locked', ui: '#dcdcd4', rock: { seed: 3104, base: [0.86, 0.86, 0.83], craters: 170, ice: 0.6, lineae: 22, roughness: 0.55 },
    desc: '背阳面的明亮冰崖网络暗示其过去曾有地质活动，可能也存在过内部海洋。',
  },
  {
    id: 'rhea', parent: 'saturn', name: '土卫五', en: 'Rhea',
    radiusKm: 763.8, massKg: 2.306e21, gravity: 0.264,
    orbit: { a: 527040, period: 4.518212, e: 0.001, inc: 0.345, M0: 45.0 },
    spin: 'tidally-locked', ui: '#d6d5cc', rock: { seed: 3105, base: [0.81, 0.80, 0.77], craters: 260, ice: 0.55, roughness: 0.7 },
    desc: '土星第二大卫星，四分之三为水冰。表面古老而布满撞击坑，几乎看不到地质改造的痕迹。',
  },
  {
    id: 'titan', parent: 'saturn', name: '土卫六', en: 'Titan',
    radiusKm: 2574.7, massKg: 1.3452e23, gravity: 1.352,
    orbit: { a: 1221870, period: 15.945421, e: 0.0288, inc: 0.34854, M0: 163.0 },
    spin: 'tidally-locked', ui: '#e0a956', rock: { seed: 3106, base: [0.86, 0.62, 0.28], craters: 20, haze: true, roughness: 0.6 },
    atmosphere: { color: 0xd9903a, power: 2.4, intensity: 1.6, altitude: 1.08 },
    desc: '太阳系唯一拥有浓密大气的卫星，表面气压 1.45 bar。甲烷雨汇成湖泊与河流，构成完整的液态循环。',
  },
  {
    id: 'iapetus', parent: 'saturn', name: '土卫八', en: 'Iapetus',
    radiusKm: 734.5, massKg: 1.8056e21, gravity: 0.223,
    orbit: { a: 3560820, period: 79.3215, e: 0.0286, inc: 15.47, M0: 275.0 },
    spin: 'tidally-locked', ui: '#a09284', rock: { seed: 3107, base: [0.55, 0.50, 0.45], craters: 240, twoTone: true, roughness: 0.85 },
    desc: '阴阳脸的卫星：前导半球被暗如煤炭的物质覆盖（反射率 0.05），后随半球却是明亮冰面。赤道山脊高达 13 km。',
  },
  /* 天王星 */
  {
    id: 'miranda', parent: 'uranus', name: '天卫五', en: 'Miranda',
    radiusKm: 235.8, massKg: 6.59e19, gravity: 0.079,
    orbit: { a: 129390, period: 1.413479, e: 0.0013, inc: 4.232, M0: 311.0 },
    spin: 'tidally-locked', ui: '#c8cfd2', rock: { seed: 4101, base: [0.72, 0.75, 0.77], craters: 130, ice: 0.5, roughness: 0.6 },
    desc: '地貌混乱的小卫星，拥有高达 20 km 的悬崖“维罗纳断崖”——太阳系最高的悬崖。',
  },
  {
    id: 'ariel', parent: 'uranus', name: '天卫一', en: 'Ariel',
    radiusKm: 578.9, massKg: 1.353e21, gravity: 0.27,
    orbit: { a: 190900, period: 2.520379, e: 0.0012, inc: 0.26, M0: 39.0 },
    spin: 'tidally-locked', ui: '#dfe4e6', rock: { seed: 4102, base: [0.85, 0.87, 0.88], craters: 120, ice: 0.6, lineae: 30, roughness: 0.5 },
    desc: '天王星卫星中最明亮的一颗，纵横的峡谷与流冰痕迹说明它曾有活跃的内部热源。',
  },
  {
    id: 'umbriel', parent: 'uranus', name: '天卫二', en: 'Umbriel',
    radiusKm: 584.7, massKg: 1.172e21, gravity: 0.2,
    orbit: { a: 266000, period: 4.144177, e: 0.0039, inc: 0.128, M0: 174.0 },
    spin: 'tidally-locked', ui: '#8b8f92', rock: { seed: 4103, base: [0.42, 0.44, 0.46], craters: 260, roughness: 0.9 },
    desc: '天王星卫星中最暗的一颗，表面覆盖着神秘的亮环“翁贝尔环”。',
  },
  {
    id: 'titania', parent: 'uranus', name: '天卫三', en: 'Titania',
    radiusKm: 788.9, massKg: 3.527e21, gravity: 0.379,
    orbit: { a: 435910, period: 8.705872, e: 0.0011, inc: 0.34, M0: 24.0 },
    spin: 'tidally-locked', ui: '#cdd3d6', rock: { seed: 4104, base: [0.74, 0.76, 0.78], craters: 200, ice: 0.45, roughness: 0.65 },
    desc: '天王星最大的卫星，表面遍布巨大峡谷与撞击坑，梅西纳峡谷长达 1500 km。',
  },
  {
    id: 'oberon', parent: 'uranus', name: '天卫四', en: 'Oberon',
    radiusKm: 761.4, massKg: 3.014e21, gravity: 0.347,
    orbit: { a: 583520, period: 13.463239, e: 0.0014, inc: 0.058, M0: 283.0 },
    spin: 'tidally-locked', ui: '#b9aca0', rock: { seed: 4105, base: [0.60, 0.56, 0.51], craters: 300, roughness: 0.85 },
    desc: '天王星最外侧的大卫星，坑底常覆盖着神秘的暗色物质，可能是冰火山喷发留下的有机尘埃。',
  },
  /* 海王星 */
  {
    id: 'triton', parent: 'neptune', name: '海卫一', en: 'Triton',
    radiusKm: 1353.4, massKg: 2.139e22, gravity: 0.779,
    orbit: { a: 354759, period: 5.876854, e: 0.000016, inc: 156.885, M0: 66.0 },
    spin: 'tidally-locked', ui: '#f0dcd8', rock: { seed: 5101, base: [0.88, 0.82, 0.80], craters: 80, cantaloupe: true, ice: 0.75, roughness: 0.4 },
    desc: '唯一逆行的大卫星，几乎可以肯定是被捕获的柯伊伯带天体。表面温度 −235 °C，却仍有氮气间歇泉喷发。',
  },
  {
    id: 'proteus', parent: 'neptune', name: '海卫八', en: 'Proteus',
    radiusKm: 210, massKg: 4.4e19, gravity: 0.07,
    orbit: { a: 117646, period: 1.122315, e: 0.00053, inc: 0.524, M0: 145.0 },
    spin: 'tidally-locked', ui: '#7a7570', rock: { seed: 5102, base: [0.38, 0.37, 0.36], craters: 300, roughness: 1.0 },
    desc: '形状不规则的暗色卫星，已接近自引力能维持球形的极限尺寸。',
  },
  {
    id: 'nereid', parent: 'neptune', name: '海卫二', en: 'Nereid',
    radiusKm: 170, massKg: 3.1e19, gravity: 0.07,
    orbit: { a: 5513400, period: 360.13, e: 0.7507, inc: 7.23, M0: 250.0 },
    spin: 'tidally-locked', ui: '#9a948c', rock: { seed: 5103, base: [0.48, 0.47, 0.45], craters: 220, roughness: 1.0 },
    desc: '轨道偏心率高达 0.75，是太阳系中轨道最扁的卫星之一，距海王星最近时 140 万 km，最远时 970 万 km。',
  },
  /* 冥王星 */
  {
    id: 'charon', parent: 'pluto', name: '冥卫一', en: 'Charon',
    radiusKm: 606, massKg: 1.586e21, gravity: 0.288,
    orbit: { a: 19591, period: 6.3872, e: 0.0002, inc: 0.08, M0: 220.0 },
    spin: 'tidally-locked', ui: '#b6b2ac', rock: { seed: 6101, base: [0.66, 0.65, 0.63], craters: 180, ice: 0.5, roughness: 0.6 },
    desc: '直径超过冥王星的一半，两者互相潮汐锁定，绕共同质心旋转，常被视为双矮行星系统。',
  },
];

/* 地球的卫星单独给出更精确的根数（含交点退行与近地点进动） */
const MOON_EARTH = {
  id: 'moon', parent: 'earth', name: '月球', en: 'Moon', type: 'moon',
  radiusKm: 1737.4, massKg: 7.342e22, gravity: 1.62,
  orbit: {
    a: 384400, period: 27.321661, e: 0.0549, inc: 5.145, M0: 135.27,
    node: 125.08, dnode: -0.0529539, peri: 83.353, dperi: 0.11140, epoch: 2451545.0,
    // 月球是唯一的例外：根数相对黄道给出（交点沿黄道 18.6 年退行一周），
    // 不再叠加地球赤道面，否则会被地球 23.44° 的轴倾角带偏。
    frame: 'ecliptic',
  },
  spin: 'tidally-locked', ui: '#c9c6c0', texture: 'moon', bump: 1.0,
  desc: '太阳系第五大卫星，与地球互相潮汐锁定，因此永远只以同一面朝向我们。它正以每年 3.8 cm 的速度远离地球。',
};

/**
 * 卫星总表
 * --------
 * 条目来自 moons-catalog.js 的已命名卫星总表（约 150 颗），
 * 其中 24 颗重要的卫星用手工细节覆盖：更准的质量/重力、真实相位、专属外观与简介。
 * 母星从中文名前缀判定（火卫→火星、木卫→木星 …），这是 IAU 中文命名的一贯规则。
 */
const DETAIL_BY_ID = Object.fromEntries(MOON_DETAILS.map(m => [m.id, m]));
const PREFIX_PARENT = [
  ['火卫', 'mars'], ['木卫', 'jupiter'], ['土卫', 'saturn'],
  ['天卫', 'uranus'], ['海卫', 'neptune'], ['冥卫', 'pluto'],
];
export const MOONS = [
  MOON_EARTH,
  ...buildMoonEntries().map(entry => {
    const hit = PREFIX_PARENT.find(([p]) => entry.name.startsWith(p));
    const parent = hit ? hit[1] : null;
    const base = { ...entry, parent };
    const d = DETAIL_BY_ID[entry.id];
    if (!d) return base;
    return {
      ...base, ...d,
      orbit: { ...base.orbit, ...d.orbit },
      rock: { ...base.rock, ...d.rock },
    };
  }).filter(m => m.parent),
];

export const BODIES = [SUN, ...PLANETS, ...MOONS];

export const BY_ID = Object.fromEntries(BODIES.map(b => [b.id, b]));

export { K };
