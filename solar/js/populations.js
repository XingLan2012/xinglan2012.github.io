/**
 * 天体群
 * ------
 * 太阳系不只是九颗行星加几颗卫星：真正让它成形的是几百万个小天体构成的
 * 群体结构。这里按真实的**分布**（而不是逐颗编目）生成五个层：
 *
 *   主带     2.1–3.3 AU，剔除了柯克伍德空隙的位置，e、i 按实际分布取样
 *   特洛伊   跟木星同半长轴，聚集在 L4 / L5 两个拉格朗日点前后 ±60°
 *   柯伊伯带 30–50 AU 的盘，含 e、i 都很小的「冷经典」成分
 *   奥尔特云 各向同性的球壳，2,000–100,000 AU
 *   人造卫星 地球周围的真实星座高度与倾角（400 km 到 GEO 35,786 km）
 *
 * 前四层是天体，第五层是人类的造物——它和参考图里地球周围那团密集轨迹是同一件事。
 *
 * ⚠ 奥尔特云是唯一做了「示意压缩」的层：真实外缘 100,000 AU 相当于 3×10⁶ 场景单位，
 *   远超相机可视范围（也远超整个星场），所以它按固定映射画在近处，界面上标注为示意。
 *   其余四层都在真实比例尺下按真实距离绘制。
 */

import * as THREE from 'three';
import { auToUnits, moonOrbitUnits, params } from './scale.js';

const J2000 = 2451545.0;
const DEG = Math.PI / 180;
const AU_KM = 1.495978707e8;

/**
 * 人造卫星的轨道壳层
 * ------------------
 * 高度与倾角都是真实星座的在用数值；数量是按真实规模抽样后的代表值
 * （低轨通信星座实际已有数千颗，这里按比例取了几十颗画得清楚）。
 *   alt  近地点高度 km · apo 远地点高度（大椭圆轨道用）· inc 倾角 °
 *   n    抽样数量 · use 用途
 */
export const SAT_SYSTEMS = [
  /* ── 载人航天 ─────────────────────────────────────── */
  { id: 'iss', name: '国际空间站', en: 'ISS', cat: '载人航天', alt: 420, inc: 51.64, e: 0.0004,
    real: 1, draw: 14, ring: 6, mass: 419725, year: 1998, owner: '多国合作', status: '在役',
    use: '长期载人驻留与微重力实验',
    note: '1998 年首批模块发射，2011 年建成，是史上最大的在轨人造结构，质量约 420 吨，'
      + '内部加压容积约 915 立方米。原定 2024 年退役，现已延长至 2030 年前后。' },
  { id: 'tiangong', name: '中国空间站', en: 'Tiangong', cat: '载人航天', alt: 390, inc: 41.47, e: 0.0006,
    real: 1, draw: 12, ring: 5, mass: 100000, year: 2021, owner: '中国', status: '在役',
    use: '长期载人驻留与空间科学实验',
    note: '2021 年天和核心舱入轨，2022 年完成问天、梦天两舱对接，形成 T 字构型，'
      + '总质量约 100 吨，设计寿命 10 年以上，可支持 3 名航天员长期驻留。' },
  { id: 'crew', name: '载人飞船与货运飞船', en: 'Crew / Cargo', cat: '载人航天', alt: 400, inc: 51.6, e: 0.0006,
    real: 6, draw: 10, ring: 3, mass: 12000, year: 1961, owner: '各国', status: '在役',
    use: '空间站人员轮换与物资补给',
    note: '神舟、联盟号、载人龙、天舟、进步号等往返空间站的飞船，'
      + '通常在轨停靠数月后返回或再入烧毁。' },

  /* ── 科学 ─────────────────────────────────────────── */
  { id: 'hst', name: '哈勃太空望远镜', en: 'Hubble', cat: '科学', alt: 540, inc: 28.47, e: 0.0003,
    real: 1, draw: 4, ring: 3, mass: 11110, year: 1990, owner: 'NASA / ESA', status: '在役',
    use: '紫外—可见光—近红外天文观测',
    note: '1990 年由发现号航天飞机送入轨道，主镜口径 2.4 米，'
      + '先后经历 5 次在轨维修，至今仍在产出观测成果。' },
  { id: 'science', name: '其他科学卫星', en: 'Science Satellites', cat: '科学', alt: 600, inc: 97.8, e: 0.0012,
    real: 45, draw: 40, ring: 4, mass: 1500, year: 1962, owner: '各国科研机构', status: '在役',
    use: '地球科学、天文、空间物理与微重力研究',
    note: '这一类包含大量专项科学任务，轨道从极轨到近赤道都有，'
      + '寿命通常只有几年，因此在轨数量始终处于更替状态。' },

  /* ── 低轨通信星座 ─────────────────────────────────── */
  { id: 'starlink', name: '星链', en: 'Starlink', cat: '通信星座', alt: 550, inc: 53.0, e: 0.0004,
    real: 7000, draw: 4200, ring: 30, mass: 306, year: 2019, owner: 'SpaceX', status: '部署中',
    use: '低轨卫星互联网接入', planes: 72,
    note: '2019 年起批量部署，是史上规模最大的卫星星座，'
      + '主力壳层在 550 km / 53°，单星约 300 公斤，设计寿命约 5 年，'
      + '失效后靠自身推进在数周内再入大气烧毁。' },
  { id: 'oneweb', name: '一网', en: 'OneWeb', cat: '通信星座', alt: 1200, inc: 87.9, e: 0.0005,
    real: 630, draw: 560, ring: 18, mass: 150, year: 2019, owner: 'Eutelsat OneWeb', status: '在役',
    use: '全球低轨宽带接入', planes: 12,
    note: '工作在 1200 km 极轨，初代组网计划 648 颗，'
      + '轨道比星链高、寿命更长，覆盖重点在高纬度与航空航海场景。' },
  { id: 'iridium', name: '铱星', en: 'Iridium NEXT', cat: '通信星座', alt: 780, inc: 86.4, e: 0.0003,
    real: 75, draw: 66, ring: 12, mass: 860, year: 2017, owner: 'Iridium', status: '在役',
    use: '全球语音与数据中继', planes: 6,
    note: '1998 年首代部署，2017–2019 年完成 NEXT 换代。'
      + '66 颗工作星分布 6 个轨道面，星间链路让它不依赖地面站即可全球组网。' },
  { id: 'globalstar', name: '全球星', en: 'Globalstar', cat: '通信星座', alt: 1414, inc: 52.0, e: 0.0004,
    real: 24, draw: 24, ring: 4, mass: 700, year: 1998, owner: 'Globalstar', status: '在役',
    use: '移动语音与物联网数据',
    note: '1998 年部署的低轨移动通信系统，采用 52° 倾角以覆盖主要陆地人口带，'
      + '不设星间链路，依赖地面关口站。' },
  { id: 'orbcomm', name: '轨道通信', en: 'Orbcomm', cat: '通信星座', alt: 750, inc: 47.0, e: 0.0004,
    real: 30, draw: 28, ring: 4, mass: 170, year: 1995, owner: 'Orbcomm', status: '在役',
    use: '物联网与低速数据采集',
    note: '面向物流、海事与工业设备的窄带数据服务，是较早投入商用的低轨星座之一。' },
  { id: 'o3b', name: 'O3b 中轨通信', en: 'O3b mPOWER', cat: '通信', alt: 8062, inc: 0.04, e: 0.0002,
    real: 20, draw: 20, ring: 4, mass: 1700, year: 2013, owner: 'SES', status: '在役',
    use: '赤道地区低时延宽带中继',
    note: '部署在 8000 km 的近赤道轨道，时延介于低轨与静止轨道之间，'
      + '主要服务岛屿、船舶与偏远地区回传。' },
  { id: 'geo', name: '静止轨道通信卫星', en: 'GEO Comsat', cat: '通信', alt: 35786, inc: 0.05, e: 0.0003,
    real: 560, draw: 520, ring: 16, mass: 4000, year: 1964, owner: '各国运营商', status: '在役',
    use: '电视广播、固定通信与数据中继',
    note: '1964 年辛康 3 号首次成功定点，此后赤道上空 35,786 km 的这条环带'
      + '成为最稀缺的轨道资源，位置由国际电信联盟统一分配。' },

  /* ── 导航 ─────────────────────────────────────────── */
  { id: 'gps', name: 'GPS', en: 'GPS', cat: '导航', alt: 20180, inc: 55.0, e: 0.002,
    real: 31, draw: 31, ring: 8, mass: 3880, year: 1978, owner: '美国太空军', status: '在役',
    use: '全球定位、导航与授时', planes: 6,
    note: '1978 年首颗发射，1995 年达到全面运行能力。'
      + '24 颗工作星分布在 6 个轨道面，轨道周期约半个恒星日，因此地面轨迹每天重复两次。' },
  { id: 'beidou', name: '北斗三号', en: 'BeiDou-3', cat: '导航', alt: 21528, inc: 55.0, e: 0.001,
    real: 30, draw: 30, ring: 8, mass: 1000, year: 2000, owner: '中国', status: '在役',
    use: '全球定位、导航、授时与短报文通信', planes: 3,
    note: '2020 年 7 月正式开通全球服务。与其他导航系统不同，'
      + '北斗由 MEO、IGSO、GEO 三种轨道混合组网，并独有区域短报文通信能力。' },
  { id: 'glonass', name: '格洛纳斯', en: 'GLONASS', cat: '导航', alt: 19130, inc: 64.8, e: 0.001,
    real: 24, draw: 24, ring: 6, mass: 1415, year: 1982, owner: '俄罗斯', status: '在役',
    use: '全球定位、导航与授时', planes: 3,
    note: '苏联 1982 年起部署，采用 64.8° 的高倾角，'
      + '对高纬度地区的覆盖明显优于倾角较低的 GPS。' },
  { id: 'galileo', name: '伽利略', en: 'Galileo', cat: '导航', alt: 23222, inc: 56.0, e: 0.0003,
    real: 28, draw: 28, ring: 6, mass: 715, year: 2011, owner: '欧盟 / ESA', status: '在役',
    use: '民用高精度全球导航', planes: 3,
    note: '欧盟主导的民用导航系统，2016 年提供初始服务，'
      + '轨道最高、周期最长，配合搜索救援与高精度服务。' },

  /* ── 遥感 ─────────────────────────────────────────── */
  { id: 'planet', name: '鸽群遥感星座', en: 'Planet Dove', cat: '遥感', alt: 475, inc: 97.4, e: 0.0008,
    real: 200, draw: 180, ring: 8, mass: 5, year: 2013, owner: 'Planet Labs', status: '在役',
    use: '每日全球中等分辨率成像',
    note: '单星只有几公斤，靠数量取胜：'
      + '数百颗 3U 立方星分布在多个太阳同步轨道面，实现全球每天一次成像。' },
  { id: 'sentinel', name: '哨兵', en: 'Sentinel', cat: '遥感', alt: 693, inc: 98.62, e: 0.0001,
    real: 8, draw: 8, ring: 4, mass: 1140, year: 2014, owner: 'ESA', status: '在役',
    use: '哥白尼计划对地观测',
    note: '哥白尼计划的核心任务系列，涵盖雷达、光学、大气与海洋多种载荷，'
      + '数据对全球免费开放。' },
  { id: 'landsat', name: '陆地卫星', en: 'Landsat 9', cat: '遥感', alt: 705, inc: 98.2, e: 0.0001,
    real: 2, draw: 6, ring: 4, mass: 2711, year: 1972, owner: 'NASA / USGS', status: '在役',
    use: '地表变化长期连续观测',
    note: '1972 年起持续观测地表，是运行时间最长的对地观测计划，'
      + '半个多世纪的影像被广泛用于土地利用与气候变化研究。' },
  { id: 'gaofen', name: '高分专项', en: 'Gaofen', cat: '遥感', alt: 780, inc: 98.5, e: 0.0005,
    real: 30, draw: 30, ring: 6, mass: 2000, year: 2013, owner: '中国', status: '在役',
    use: '高分辨率对地观测',
    note: '中国高分辨率对地观测重大专项，涵盖光学、雷达、高光谱等多型载荷，'
      + '多数运行在太阳同步轨道。' },
  { id: 'recon', name: '侦察与军民两用卫星', en: 'Reconnaissance', cat: '遥感', alt: 550, inc: 97.8, e: 0.0006,
    real: 260, draw: 220, ring: 6, mass: 2500, year: 1960, owner: '各国', status: '在役',
    use: '成像侦察与军事观测',
    note: '各国光学与雷达侦察卫星的总称，多数在 500–1000 km 的太阳同步轨道上，'
      + '轨道参数常不公开。' },

  /* ── 气象 ─────────────────────────────────────────── */
  { id: 'fy3', name: '风云三号', en: 'Fengyun-3', cat: '气象', alt: 836, inc: 98.75, e: 0.0012,
    real: 6, draw: 8, ring: 4, mass: 2300, year: 2008, owner: '中国气象局', status: '在役',
    use: '全球数值天气预报与气候监测',
    note: '中国第二代极轨气象卫星，搭载微波与光学遥感器，'
      + '数据进入全球数值天气预报同化系统。' },
  { id: 'jpss', name: '极轨气象卫星', en: 'JPSS / MetOp', cat: '气象', alt: 824, inc: 98.7, e: 0.0012,
    real: 20, draw: 20, ring: 4, mass: 2500, year: 1998, owner: 'NOAA / EUMETSAT', status: '在役',
    use: '全球极轨气象与气候观测',
    note: '美国 JPSS 与欧洲 MetOp 系列组成的晨昏轨道观测网，'
      + '与静止气象卫星互补，提供全球覆盖。' },
  { id: 'fy4', name: '风云四号', en: 'Fengyun-4', cat: '气象', alt: 35786, inc: 0.5, e: 0.0003,
    real: 3, draw: 4, ring: 3, mass: 5400, year: 2016, owner: '中国气象局', status: '在役',
    use: '静止轨道气象与空间天气监测',
    note: '中国第二代静止气象卫星，可对区域做分钟级高频次扫描，'
      + '并具备闪电成像与空间天气监测能力。' },
  { id: 'goes', name: 'GOES', en: 'GOES', cat: '气象', alt: 35786, inc: 0.1, e: 0.0002,
    real: 5, draw: 5, ring: 3, mass: 5192, year: 1975, owner: 'NOAA', status: '在役',
    use: '西半球静止轨道气象监测',
    note: '1975 年起运行的美国静止气象卫星系列，'
      + '现役 GOES-R 系列可每 30 秒更新一次风暴区域图像。' },
  { id: 'meteosat', name: '气象卫星（其他）', en: 'Meteosat / Himawari', cat: '气象', alt: 35786, inc: 0.1, e: 0.0002,
    real: 25, draw: 20, ring: 3, mass: 2000, year: 1977, owner: 'EUMETSAT / JMA 等', status: '在役',
    use: '静止轨道气象观测网',
    note: '欧洲 Meteosat、日本 Himawari、俄罗斯 Elektro 等系列共同组成'
      + '全球静止气象卫星观测网，覆盖各大洋。' },

  /* ── 中继与大椭圆 ─────────────────────────────────── */
  { id: 'tdrs', name: '跟踪与数据中继卫星', en: 'TDRS', cat: '中继', alt: 35786, inc: 13.0, e: 0.0004,
    real: 9, draw: 9, ring: 4, mass: 3454, year: 1983, owner: 'NASA', status: '在役',
    use: '航天器与地面站之间的中继通信',
    note: '1983 年起为航天飞机提供中继，现在支撑国际空间站'
      + '与各类低轨任务的全天候数据回传。' },
  { id: 'molniya', name: '闪电轨道', en: 'Molniya', cat: '大椭圆', alt: 500, apo: 39800, inc: 63.4, e: 0.72,
    real: 8, draw: 12, ring: 6, mass: 1600, year: 1965, owner: '俄罗斯', status: '在役',
    use: '高纬度地区长时间通信覆盖',
    note: '1965 年起苏联为高纬度地区设计：轨道倾角 63.4° 使近地点辐角不再漂移，'
      + '卫星在远地点附近驻留约 8 小时，恰好覆盖北半球高纬。' },

  /* ── 载人航天（飞船） ─────────────────────────────── */
  { id: 'shenzhou', name: '神舟载人飞船', en: 'Shenzhou', cat: '载人航天', alt: 390, inc: 41.5, e: 0.0006,
    real: 1, draw: 4, ring: 3, mass: 8000, year: 1999, owner: '中国', status: '在役',
    use: '航天员往返中国空间站',
    note: '1999 年首飞，采用三舱构型，停靠空间站期间作为乘组返回的救生船。' },
  { id: 'tianzhou', name: '天舟货运飞船', en: 'Tianzhou', cat: '载人航天', alt: 390, inc: 41.5, e: 0.0006,
    real: 1, draw: 3, ring: 3, mass: 13500, year: 2017, owner: '中国', status: '在役',
    use: '空间站推进剂与物资补给',
    note: '世界上载货比最高的货运飞船之一，可上行 6.9 吨物资并带走空间站废弃物再入烧毁。' },
  { id: 'crew-dragon', name: '载人龙飞船', en: 'Crew Dragon', cat: '载人航天', alt: 420, inc: 51.6, e: 0.0005,
    real: 2, draw: 3, ring: 3, mass: 12000, year: 2020, owner: 'SpaceX / NASA', status: '在役',
    use: '商业载人往返国际空间站',
    note: '2020 年首次载人飞行，是航天飞机退役后美国本土恢复载人能力的标志。' },
  { id: 'progress', name: '进步号货运飞船', en: 'Progress', cat: '载人航天', alt: 420, inc: 51.6, e: 0.0005,
    real: 2, draw: 3, ring: 3, mass: 7000, year: 1978, owner: '俄罗斯', status: '在役',
    use: '空间站物资补给与轨道抬升',
    note: '1978 年起服役，是运行时间最长的货运飞船系列，也可用于修正空间站轨道。' },
  { id: 'cygnus', name: '天鹅座货运飞船', en: 'Cygnus', cat: '载人航天', alt: 420, inc: 51.6, e: 0.0005,
    real: 1, draw: 3, ring: 3, mass: 6600, year: 2013, owner: 'Northrop Grumman', status: '在役',
    use: '国际空间站货运补给',
    note: '采用圆柱形加压货舱，可用安塔瑞斯或猎鹰九号发射。' },

  /* ── 科学（天文与物理） ───────────────────────────── */
  { id: 'chandra', name: '钱德拉 X 射线天文台', en: 'Chandra', cat: '科学', alt: 14000, apo: 134000, inc: 76.7, e: 0.74,
    real: 1, draw: 5, ring: 4, mass: 4800, year: 1999, owner: 'NASA', status: '在役',
    use: 'X 射线天文观测',
    note: '运行在 14000 × 134000 km 的高椭圆轨道上，' +
      '每个周期有连续 50 多小时位于辐射带之外，可长时间不间断观测。' },
  { id: 'xmm', name: 'XMM-牛顿望远镜', en: 'XMM-Newton', cat: '科学', alt: 7000, apo: 114000, inc: 40, e: 0.79,
    real: 1, draw: 5, ring: 4, mass: 3800, year: 1999, owner: 'ESA', status: '在役',
    use: 'X 射线光谱与成像',
    note: '与钱德拉互补：它主打大面积探测器带来的高灵敏度光谱，' +
      '同样利用高椭圆轨道避开地球辐射带。' },
  { id: 'fermi', name: '费米伽马射线空间望远镜', en: 'Fermi', cat: '科学', alt: 550, inc: 25.6, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 4300, year: 2008, owner: 'NASA', status: '在役',
    use: '伽马射线全天巡视',
    note: '每日扫描全天，已编目数千个伽马射线源，包括活动星系核与脉冲星。' },
  { id: 'swift', name: '雨燕天文台', en: 'Swift', cat: '科学', alt: 600, inc: 20.6, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 1470, year: 2004, owner: 'NASA', status: '在役',
    use: '伽马射线暴快速定位与跟踪',
    note: '可在探测到伽马暴后数十秒内自动转向目标，' +
      '是研究伽马射线暴余辉的关键平台。' },
  { id: 'tess', name: 'TESS 系外行星巡天', en: 'TESS', cat: '科学', alt: 108000, apo: 375000, inc: 37, e: 0.55,
    real: 1, draw: 4, ring: 3, mass: 350, year: 2018, owner: 'NASA', status: '在役',
    use: '全天搜索凌星系外行星',
    note: '采用与月球 2:1 共振的高椭圆轨道，可在稳定热环境下连续观测' +
      '同一片天区约一个月。' },
  { id: 'cheops', name: 'CHEOPS 系外行星表征卫星', en: 'CHEOPS', cat: '科学', alt: 700, inc: 98.2, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 300, year: 2019, owner: 'ESA', status: '在役',
    use: '已知系外行星的精确半径测量',
    note: '不做巡天，专门对已发现的系外行星做高精度凌星测光。' },
  { id: 'hxmt', name: '慧眼硬 X 射线望远镜', en: 'HXMT', cat: '科学', alt: 550, inc: 43.0, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 2500, year: 2017, owner: '中国', status: '在役',
    use: '硬 X 射线巡天与黑洞观测',
    note: '中国首颗 X 射线天文卫星，已发现多个新黑洞候选体与伽马暴。' },
  { id: 'dampe', name: '悟空暗物质粒子探测', en: 'DAMPE', cat: '科学', alt: 500, inc: 97.4, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 1400, year: 2015, owner: '中国', status: '在役',
    use: '高能宇宙线与伽马射线测量',
    note: '在 TeV 能段测得迄今最精确的电子宇宙线能谱，' +
      '为暗物质间接探测提供了关键数据。' },
  { id: 'micius', name: '墨子号量子科学实验卫星', en: 'Micius', cat: '科学', alt: 500, inc: 97.4, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 640, year: 2016, owner: '中国', status: '在役',
    use: '星地量子密钥分发与纠缠分发',
    note: '首次实现千公里级星地双向量子纠缠分发与量子密钥分发。' },
  { id: 'ep', name: '爱因斯坦探针', en: 'Einstein Probe', cat: '科学', alt: 600, inc: 29.0, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 1450, year: 2024, owner: '中国 / ESA', status: '在役',
    use: '软 X 射线时域巡天',
    note: '采用龙虾眼仿生光学，视场约 3600 平方度，专门捕捉瞬时 X 射线爆发。' },
  { id: 'sdo', name: '太阳动力学天文台', en: 'SDO', cat: '科学', alt: 35786, inc: 28.0, e: 0.0004,
    real: 1, draw: 4, ring: 3, mass: 3100, year: 2010, owner: 'NASA', status: '在役',
    use: '太阳活动连续监测',
    note: '位于倾斜的地球同步轨道，几乎不间断地以多波段拍摄太阳。' },
  { id: 'xihe', name: '羲和号太阳探测卫星', en: 'Xihe', cat: '科学', alt: 517, inc: 98.0, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 550, year: 2021, owner: '中国', status: '在役',
    use: '太阳 Hα 波段光谱成像',
    note: '中国首颗太阳探测科学技术试验卫星，首次实现太阳 Hα 波段光谱成像。' },
  { id: 'aso-s', name: '夸父一号', en: 'ASO-S', cat: '科学', alt: 720, inc: 98.2, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 860, year: 2022, owner: '中国', status: '在役',
    use: '太阳磁场、耀斑与日冕物质抛射联合观测',
    note: '在一颗卫星上同时观测太阳磁场、耀斑和日冕物质抛射，' +
      '被称为「一磁两暴」。' },
  { id: 'gracefo', name: 'GRACE-FO 重力测量', en: 'GRACE-FO', cat: '科学', alt: 490, inc: 89.0, e: 0.001,
    real: 2, draw: 4, ring: 3, mass: 600, year: 2018, owner: 'NASA / GFZ', status: '在役',
    use: '地球重力场与地下水储量变化',
    note: '两颗卫星相距约 220 km 编队飞行，用微波测距感知重力差异，' +
      '据此反演地下水、冰盖与海平面的质量迁移。' },
  { id: 'icesat2', name: 'ICESat-2 冰盖测量', en: 'ICESat-2', cat: '科学', alt: 496, inc: 92.0, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 1500, year: 2018, owner: 'NASA', status: '在役',
    use: '极地冰盖与海冰厚度测量',
    note: '搭载光子计数激光高度计，每秒发射一万个激光脉冲，' +
      '可精确到几厘米地测量冰面高程变化。' },
  { id: 'swarm', name: 'Swarm 地磁测量', en: 'Swarm', cat: '科学', alt: 460, inc: 87.4, e: 0.001,
    real: 3, draw: 4, ring: 3, mass: 470, year: 2013, owner: 'ESA', status: '在役',
    use: '地球磁场及其长期变化',
    note: '三颗卫星编队飞行，分离地球内部磁场、电离层与海洋潮汐的磁信号。' },
  { id: 'aqua', name: 'Aqua 水循环观测', en: 'Aqua', cat: '科学', alt: 705, inc: 98.2, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 2900, year: 2002, owner: 'NASA', status: '在役',
    use: '水循环与大气遥感',
    note: '地球观测系统的主力之一，与 Terra、Aura 同处太阳同步轨道组成编队。' },
  { id: 'terra', name: 'Terra 陆地观测', en: 'Terra', cat: '科学', alt: 705, inc: 98.1, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 4900, year: 1999, owner: 'NASA', status: '在役',
    use: '陆地与大气长期观测',
    note: '1999 年发射，是地球观测系统第一颗旗舰卫星，至今仍在提供数据。' },
  { id: 'oco2', name: 'OCO-2 碳观测', en: 'OCO-2', cat: '科学', alt: 705, inc: 98.2, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 450, year: 2014, owner: 'NASA', status: '在役',
    use: '大气二氧化碳浓度精确测量',
    note: '以 ppm 级精度绘制全球二氧化碳分布，用于区分自然与人为排放。' },
  { id: 'smap', name: 'SMAP 土壤湿度', en: 'SMAP', cat: '科学', alt: 685, inc: 98.1, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 940, year: 2015, owner: 'NASA', status: '在役',
    use: '全球土壤湿度与冻融状态',
    note: '搭载 6 米可展开网状天线，是当时最大的在轨旋转天线。' },
  { id: 'swot', name: 'SWOT 地表水与海洋地形', en: 'SWOT', cat: '科学', alt: 890, inc: 77.6, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 2200, year: 2022, owner: 'NASA / CNES', status: '在役',
    use: '全球地表水体与海洋中尺度涡',
    note: '首次以宽幅干涉雷达测量地表水位，可观测宽度 100 米以上的河流。' },

  /* ── 导航增强与其他导航 ───────────────────────────── */
  { id: 'qzss', name: '准天顶卫星系统', en: 'QZSS', cat: '导航', alt: 36000, apo: 39000, inc: 43.0, e: 0.075,
    real: 5, draw: 5, ring: 3, mass: 4000, year: 2010, owner: '日本', status: '在役',
    use: '日本区域导航增强',
    note: '采用倾斜同步轨道，使卫星长时间停留在日本上空高仰角处，' +
      '在城市峡谷与山区也能定位。' },
  { id: 'navic', name: '印度区域导航', en: 'NavIC / IRNSS', cat: '导航', alt: 35786, inc: 29.0, e: 0.002,
    real: 7, draw: 7, ring: 3, mass: 1400, year: 2013, owner: '印度', status: '在役',
    use: '印度及周边区域导航',
    note: '由 GEO 与 IGSO 混合组网，覆盖印度本土及周边约 1500 公里范围。' },
  { id: 'sbas', name: '星基增强系统', en: 'SBAS (WAAS/EGNOS)', cat: '导航', alt: 35786, inc: 0.1, e: 0.0003,
    real: 20, draw: 20, ring: 4, mass: 2000, year: 2003, owner: '各国', status: '在役',
    use: '导航信号完好性增强与精密进近',
    note: 'WAAS、EGNOS、GAGAN 等系统通过静止轨道卫星播发改正数，' +
      '把 GPS 定位精度提升到米级以内，支撑民航精密进近。' },
  { id: 'doris', name: 'DORIS 定轨信标', en: 'DORIS', cat: '导航', alt: 1330, inc: 66.0, e: 0.001,
    real: 6, draw: 6, ring: 3, mass: 700, year: 1990, owner: 'CNES', status: '在役',
    use: '精密定轨与地球动力学',
    note: '搭载在多个对地观测卫星上的多普勒定轨系统，' +
      '为大地测量与海平面监测提供厘米级轨道。' },

  /* ── 通信（区域与专用） ───────────────────────────── */
  { id: 'kuiper', name: '柯伊伯星座', en: 'Project Kuiper', cat: '通信星座', alt: 630, inc: 51.9, e: 0.0004,
    real: 200, draw: 160, ring: 10, mass: 570, year: 2023, owner: 'Amazon', status: '部署中',
    use: '低轨卫星互联网接入',
    note: '亚马逊的低轨宽带星座，规划 3236 颗，' +
      '分 630 km 与 590–610 km 等壳层部署。' },
  { id: 'gw', name: '星网 GW 星座', en: 'Guowang', cat: '通信星座', alt: 1145, inc: 86.5, e: 0.0005,
    real: 100, draw: 90, ring: 8, mass: 300, year: 2024, owner: '中国', status: '部署中',
    use: '低轨卫星互联网',
    note: '中国规划的低轨宽带星座，总规模上万颗，' +
      '主要壳层在 1145 km 附近。' },
  { id: 'qianfan', name: '千帆星座', en: 'Qianfan / G60', cat: '通信星座', alt: 1000, inc: 89.0, e: 0.0005,
    real: 90, draw: 80, ring: 8, mass: 300, year: 2024, owner: '中国', status: '部署中',
    use: '低轨宽带与物联网服务',
    note: '上海主导的商业低轨星座，规划约 1.4 万颗，' +
      '采用 1000 km 附近的极轨壳层。' },
  { id: 'tiantong', name: '天通一号移动通信', en: 'Tiantong-1', cat: '通信', alt: 35786, inc: 0.1, e: 0.0003,
    real: 3, draw: 3, ring: 3, mass: 5400, year: 2016, owner: '中国', status: '在役',
    use: '卫星移动电话与应急通信',
    note: '中国自主的移动通信卫星系统，覆盖中国及周边、中东、' +
      '非洲等区域，可直连手持终端。' },
  { id: 'inmarsat', name: '海事卫星', en: 'Inmarsat', cat: '通信', alt: 35786, inc: 3.0, e: 0.0003,
    real: 14, draw: 12, ring: 4, mass: 6000, year: 1979, owner: 'Inmarsat / Viasat', status: '在役',
    use: '海事、航空与应急通信',
    note: '1979 年成立，是最早的全球移动卫星通信系统，' +
      '至今仍是航空与航运的关键通信手段。' },
  { id: 'tianlian', name: '天链中继卫星', en: 'Tianlian', cat: '中继', alt: 35786, inc: 2.0, e: 0.0004,
    real: 5, draw: 5, ring: 3, mass: 5000, year: 2008, owner: '中国', status: '在役',
    use: '载人航天与低轨航天器中继通信',
    note: '使中国空间站与低轨卫星的数据回传覆盖率从约 12% 提升到接近 100%。' },
  { id: 'edrs', name: '欧洲数据中继系统', en: 'EDRS', cat: '中继', alt: 35786, inc: 0.1, e: 0.0003,
    real: 2, draw: 4, ring: 3, mass: 3000, year: 2016, owner: 'ESA / Airbus', status: '在役',
    use: '对地观测数据激光中继',
    note: '使用激光链路把哨兵卫星的观测数据实时传回地面，' +
      '单次过境即可回传数 TB。' },

  /* ── 遥感（各国与商业） ───────────────────────────── */
  { id: 'zy3', name: '资源三号', en: 'Ziyuan-3', cat: '遥感', alt: 505, inc: 97.4, e: 0.001,
    real: 2, draw: 6, ring: 4, mass: 2650, year: 2012, owner: '中国', status: '在役',
    use: '立体测绘与地理国情监测',
    note: '中国首颗民用高分辨率立体测绘卫星，可生成 1:50000 地形图。' },
  { id: 'huanjing', name: '环境减灾卫星', en: 'HJ-1', cat: '遥感', alt: 650, inc: 98.0, e: 0.001,
    real: 2, draw: 6, ring: 4, mass: 470, year: 2008, owner: '中国', status: '在役',
    use: '环境与灾害监测',
    note: '两颗光学星与一颗雷达星组成编队，实现对同一地区的快速重访。' },
  { id: 'jilin', name: '吉林一号', en: 'Jilin-1', cat: '遥感', alt: 500, inc: 97.5, e: 0.001,
    real: 100, draw: 70, ring: 6, mass: 200, year: 2015, owner: '长光卫星', status: '在役',
    use: '商业高分辨率视频与成像',
    note: '中国规模最大的商业遥感星座之一，可对目标进行视频成像，' +
      '曾实现对移动船舶的连续跟踪。' },
  { id: 'iceye', name: 'ICEYE 合成孔径雷达', en: 'ICEYE', cat: '遥感', alt: 570, inc: 97.7, e: 0.001,
    real: 40, draw: 30, ring: 5, mass: 100, year: 2018, owner: 'ICEYE', status: '在役',
    use: '全天候雷达成像与洪水监测',
    note: '小型化 SAR 卫星的开创者，单星质量不到 100 公斤，' +
      '可在夜间与云层下成像。' },
  { id: 'capella', name: 'Capella 合成孔径雷达', en: 'Capella', cat: '遥感', alt: 600, inc: 97.9, e: 0.001,
    real: 10, draw: 10, ring: 4, mass: 110, year: 2018, owner: 'Capella Space', status: '在役',
    use: '商业 SAR 成像',
    note: '提供亚米级分辨率的商业雷达影像，可穿透云层与烟雾。' },
  { id: 'worldview', name: 'WorldView 商业成像', en: 'WorldView', cat: '遥感', alt: 617, inc: 98.0, e: 0.001,
    real: 4, draw: 6, ring: 3, mass: 2800, year: 2007, owner: 'Maxar', status: '在役',
    use: '亚米级商业光学成像',
    note: '长期提供 30 厘米级分辨率的商业影像，广泛用于测绘与灾害评估。' },
  { id: 'pleiades', name: '昴宿星高分辨率成像', en: 'Pléiades', cat: '遥感', alt: 695, inc: 98.2, e: 0.001,
    real: 4, draw: 6, ring: 3, mass: 970, year: 2011, owner: 'CNES / Airbus', status: '在役',
    use: '军民两用高分辨率成像',
    note: '具备极高的姿态机动能力，可对同一目标做立体与多角度成像。' },
  { id: 'radarsat', name: 'RADARSAT 雷达卫星', en: 'RADARSAT', cat: '遥感', alt: 600, inc: 97.8, e: 0.001,
    real: 3, draw: 6, ring: 3, mass: 2200, year: 1995, owner: '加拿大航天局', status: '在役',
    use: '海冰监测与资源调查',
    note: '加拿大为北极海冰监测研制的雷达卫星系列，' +
      '在极夜与云层下仍能稳定成像。' },
  { id: 'terrasar', name: 'TerraSAR-X', en: 'TerraSAR-X', cat: '遥感', alt: 514, inc: 97.4, e: 0.001,
    real: 2, draw: 6, ring: 3, mass: 1230, year: 2007, owner: 'DLR / Airbus', status: '在役',
    use: '高分辨率雷达成像',
    note: '德国首颗高分辨率民用雷达卫星，与 TanDEM-X 编队生成全球数字高程模型。' },
  { id: 'alos', name: '先进陆地观测卫星', en: 'ALOS', cat: '遥感', alt: 691, inc: 98.2, e: 0.001,
    real: 2, draw: 6, ring: 3, mass: 4000, year: 2006, owner: 'JAXA', status: '在役',
    use: '陆地观测与灾害监测',
    note: '日本大型对地观测卫星，搭载 L 波段雷达，' +
      '在植被与地表形变监测上有独特优势。' },
  { id: 'kompsat', name: 'KOMPSAT 多用途卫星', en: 'KOMPSAT', cat: '遥感', alt: 685, inc: 98.1, e: 0.001,
    real: 5, draw: 8, ring: 4, mass: 1400, year: 1999, owner: '韩国', status: '在役',
    use: '地理信息与灾害监测',
    note: '韩国多用途卫星系列，涵盖光学与雷达载荷，' +
      '兼顾民用测绘与灾害响应。' },
  { id: 'haiyang', name: '海洋卫星', en: 'Haiyang', cat: '遥感', alt: 770, inc: 98.6, e: 0.001,
    real: 6, draw: 8, ring: 4, mass: 1500, year: 2002, owner: '中国', status: '在役',
    use: '海色、海温与海洋动力环境',
    note: '中国海洋系列卫星，为渔业、海洋环境与气候变化研究提供数据。' },
  { id: 'tanSat', name: '碳卫星', en: 'TanSat', cat: '遥感', alt: 700, inc: 98.2, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 620, year: 2016, owner: '中国', status: '在役',
    use: '大气二氧化碳监测',
    note: '中国首颗全球二氧化碳监测科学实验卫星，' +
      '与日本 GOSAT、美国 OCO-2 共同构成碳观测网。' },

  /* ── 气象与小卫星星座 ─────────────────────────────── */
  { id: 'dmsp', name: '国防气象卫星计划', en: 'DMSP', cat: '气象', alt: 840, inc: 98.8, e: 0.001,
    real: 4, draw: 8, ring: 4, mass: 1200, year: 1962, owner: '美国', status: '在役',
    use: '军事气象与海洋观测',
    note: '1962 年起连续运行，是寿命最长的气象卫星系列之一，' +
      '也为民用天气预报提供了大量数据。' },
  { id: 'elektro', name: '电子号气象卫星', en: 'Elektro', cat: '气象', alt: 35786, inc: 0.1, e: 0.0003,
    real: 3, draw: 4, ring: 3, mass: 1800, year: 1994, owner: '俄罗斯', status: '在役',
    use: '静止轨道气象观测',
    note: '俄罗斯的静止气象卫星系列，覆盖印度洋与欧洲上空。' },
  { id: 'insat', name: 'INSAT 气象与通信', en: 'INSAT', cat: '气象', alt: 35786, inc: 0.1, e: 0.0003,
    real: 5, draw: 5, ring: 3, mass: 2500, year: 1983, owner: '印度', status: '在役',
    use: '气象观测、通信与广播',
    note: '一星多用的典型：同时承担气象成像、电视广播与通信转发。' },
  { id: 'spire', name: 'Spire 气象与船舶监测', en: 'Spire', cat: '气象', alt: 500, inc: 97.0, e: 0.001,
    real: 100, draw: 70, ring: 6, mass: 6, year: 2013, owner: 'Spire Global', status: '在役',
    use: '无线电掩星大气探测与船舶追踪',
    note: '数十颗 3U 立方星通过接收导航卫星的掩星信号，' +
      '反演全球大气温湿廓线，数据进入多家气象机构。' },
  { id: 'hawkeye', name: 'HawkEye 360 无线电监测', en: 'HawkEye 360', cat: '遥感', alt: 550, inc: 97.8, e: 0.001,
    real: 30, draw: 24, ring: 5, mass: 30, year: 2018, owner: 'HawkEye 360', status: '在役',
    use: '射频信号地理定位',
    note: '三星编队通过时差定位地面无线电发射源，' +
      '用于海事监管、频谱管理与应急响应。' },
  { id: 'astrocast', name: 'Astrocast 物联网星座', en: 'Astrocast', cat: '通信星座', alt: 550, inc: 97.5, e: 0.001,
    real: 20, draw: 18, ring: 4, mass: 4, year: 2018, owner: 'Astrocast', status: '在役',
    use: '全球物联网窄带数据',
    note: '面向偏远地区的传感器数据回传，单星仅数公斤。' },
  { id: 'tianqi', name: '天启物联网星座', en: 'Tianqi', cat: '通信星座', alt: 500, inc: 97.4, e: 0.001,
    real: 40, draw: 30, ring: 5, mass: 30, year: 2018, owner: '国电高科', status: '在役',
    use: '全球物联网数据采集',
    note: '中国自主的低轨物联网星座，服务物流、水利、气象等行业的远程监测。' },
  { id: 'xingyun', name: '行云物联网星座', en: 'Xingyun', cat: '通信星座', alt: 550, inc: 97.6, e: 0.001,
    real: 20, draw: 16, ring: 4, mass: 80, year: 2017, owner: '航天行云', status: '在役',
    use: '物联网与天基网络试验',
    note: '中国航天科工的低轨物联网星座，同时验证天基互联网关键技术。' },
  { id: 'aurora', name: '极光与电离层探测', en: 'Aurora / Ionosphere', cat: '科学', alt: 700, inc: 98.7, e: 0.001,
    real: 15, draw: 14, ring: 4, mass: 200, year: 2010, owner: '各国', status: '在役',
    use: '极区电离层与空间天气监测',
    note: '这类卫星运行在极轨上，监测太阳活动对电离层与通信导航的扰动。' },
  { id: 'cubesat', name: '教育与业余无线电台', en: 'Cubesat / AMSAT', cat: '科学', alt: 550, inc: 51.6, e: 0.002,
    real: 120, draw: 100, ring: 6, mass: 2, year: 2003, owner: '各院校与业余组织', status: '在役',
    use: '工程教育、技术验证与业余通信',
    note: '立方星标准的普及让高校与业余组织也能发射卫星，' +
      '在轨数量众多、寿命通常只有一两年。' },

  /* ── 更多真实系统（各国 / 商业 / 专用） ───────────── */
  { id: 'cbers', name: '中巴地球资源卫星', en: 'CBERS', cat: '遥感', alt: 778, inc: 98.5, e: 0.001,
    real: 4, draw: 6, ring: 4, mass: 2000, year: 1999, owner: '中国 / 巴西', status: '在役',
    use: '资源调查与灾害监测',
    note: '中国与巴西联合研制，是发展中国家之间最成功的航天合作项目之一，' +
      '数据向全球免费开放。' },
  { id: 'gosat', name: '温室气体观测卫星', en: 'GOSAT', cat: '科学', alt: 613, inc: 98.0, e: 0.001,
    real: 2, draw: 4, ring: 3, mass: 1750, year: 2009, owner: 'JAXA', status: '在役',
    use: '二氧化碳与甲烷浓度观测',
    note: '世界首颗专用的温室气体观测卫星，' +
      '与 OCO-2、TanSat 共同构成全球碳观测体系。' },
  { id: 'saocom', name: 'SAOCOM 雷达卫星', en: 'SAOCOM', cat: '遥感', alt: 620, inc: 97.9, e: 0.001,
    real: 2, draw: 6, ring: 3, mass: 3000, year: 2018, owner: '阿根廷 CONAE', status: '在役',
    use: '土壤湿度与农业监测',
    note: 'L 波段雷达对土壤含水量敏感，' +
      '与意大利 COSMO-SkyMed 组成联合星座。' },
  { id: 'cosmo', name: 'COSMO-SkyMed 雷达星座', en: 'COSMO-SkyMed', cat: '遥感', alt: 619, inc: 97.9, e: 0.001,
    real: 4, draw: 6, ring: 4, mass: 1900, year: 2007, owner: '意大利 ASI', status: '在役',
    use: '军民两用雷达成像',
    note: '四星编队可对同一区域实现数小时级重访，' +
      '广泛用于地震形变与海面监测。' },
  { id: 'enmap', name: 'EnMAP 高光谱卫星', en: 'EnMAP', cat: '遥感', alt: 653, inc: 98.0, e: 0.001,
    real: 1, draw: 3, ring: 3, mass: 980, year: 2022, owner: '德国 DLR', status: '在役',
    use: '高光谱地表成分探测',
    note: '在 420–2450 nm 区间划分 200 多个波段，' +
      '可识别矿物、土壤与植被的精细成分。' },
  { id: 'skysat', name: '天空卫星', en: 'SkySat', cat: '遥感', alt: 450, inc: 53.0, e: 0.001,
    real: 21, draw: 20, ring: 5, mass: 110, year: 2013, owner: 'Planet Labs', status: '在役',
    use: '亚米级视频与成像',
    note: '可拍摄 30 秒左右的短高清视频，' +
      '是首批具备视频成像能力的商业卫星。' },
  { id: 'blacksky', name: '黑天商业成像', en: 'BlackSky', cat: '遥感', alt: 430, inc: 53.0, e: 0.001,
    real: 20, draw: 20, ring: 5, mass: 55, year: 2018, owner: 'BlackSky', status: '在役',
    use: '高频次商业成像与实时分析',
    note: '主打「每天多次」的重访能力，配合自动目标识别提供近实时情报。' },
  { id: 'satellogic', name: '卫星逻辑星座', en: 'Satellogic', cat: '遥感', alt: 500, inc: 97.5, e: 0.001,
    real: 40, draw: 30, ring: 5, mass: 45, year: 2016, owner: 'Satellogic', status: '在役',
    use: '低成本高重访成像',
    note: '阿根廷起家的商业星座，单星成本低，' +
      '主打高频次全球覆盖。' },
  { id: 'beidou2', name: '北斗二号', en: 'BeiDou-2', cat: '导航', alt: 21528, inc: 55.0, e: 0.002,
    real: 15, draw: 15, ring: 5, mass: 2200, year: 2007, owner: '中国', status: '在役',
    use: '区域导航与授时',
    note: '北斗的第二步：先以 GEO 与 IGSO 覆盖亚太，' +
      '为全球组网验证了星载原子钟与混合星座方案。' },
  { id: 'aehf', name: '先进极高频军事通信', en: 'AEHF', cat: '通信', alt: 35786, inc: 2.0, e: 0.0003,
    real: 6, draw: 6, ring: 3, mass: 6200, year: 2010, owner: '美国太空军', status: '在役',
    use: '抗干扰战略通信',
    note: '采用极高频与跳频技术，' +
      '为战略指挥提供抗核加固、抗干扰的通信链路。' },
  { id: 'sbirs', name: '导弹预警卫星', en: 'SBIRS', cat: '科学', alt: 35786, inc: 5.0, e: 0.0004,
    real: 6, draw: 6, ring: 4, mass: 4500, year: 2011, owner: '美国太空军', status: '在役',
    use: '红外导弹预警与导弹防御',
    note: '由静止轨道与高椭圆轨道卫星组成，' +
      '红外传感器可在导弹点火的数秒内发现尾焰。' },
  { id: 'nrol', name: '电子侦察卫星', en: 'ELINT / NROL', cat: '遥感', alt: 700, inc: 97.8, e: 0.002,
    real: 25, draw: 20, ring: 5, mass: 3000, year: 1971, owner: '各国', status: '在役',
    use: '电子信号侦收与定位',
    note: '通过截获雷达与通信信号确定辐射源位置，' +
      '轨道参数通常不公开。' },
  { id: 'ses', name: 'SES 商业通信卫星', en: 'SES', cat: '通信', alt: 35786, inc: 0.05, e: 0.0003,
    real: 60, draw: 45, ring: 6, mass: 4500, year: 1988, owner: 'SES', status: '在役',
    use: '广播、宽带与政府通信',
    note: '全球最大的静止轨道运营商之一，' +
      '同时运营 O3b 中轨星座与近地轨道服务。' },
  { id: 'intelsat', name: '国际通信卫星', en: 'Intelsat', cat: '通信', alt: 35786, inc: 0.05, e: 0.0003,
    real: 50, draw: 40, ring: 6, mass: 6000, year: 1965, owner: 'Intelsat', status: '在役',
    use: '国际电视与数据中继',
    note: '1965 年发射的「晨鸟」是第一颗商用静止通信卫星，' +
      '由此开创了跨洋卫星通信时代。' },
  { id: 'viasat', name: '卫讯高通量卫星', en: 'ViaSat', cat: '通信', alt: 35786, inc: 0.1, e: 0.0003,
    real: 5, draw: 5, ring: 3, mass: 6400, year: 2011, owner: 'Viasat', status: '在役',
    use: '高通量宽带接入',
    note: '单星容量达数百 Gbps，' +
      '主要为航空、海事与偏远地区提供宽带。' },
  { id: 'apac', name: '亚太与中星系列', en: 'APStar / ChinaSat', cat: '通信', alt: 35786, inc: 0.05, e: 0.0003,
    real: 30, draw: 25, ring: 5, mass: 5000, year: 1994, owner: '中国卫通等', status: '在役',
    use: '广播电视与区域通信',
    note: '覆盖亚太地区的广播通信卫星系列，' +
      '承担大量电视节目传输与应急通信任务。' },
  { id: 'laser', name: '激光通信试验卫星', en: 'Laser Comms', cat: '科学', alt: 550, inc: 97.0, e: 0.001,
    real: 20, draw: 16, ring: 4, mass: 500, year: 2019, owner: '各国', status: '在役',
    use: '星间与星地激光通信验证',
    note: '激光链路带宽远高于微波，' +
      '且无需频谱许可，是下一代星座的骨干技术。' },
  { id: 'mev', name: '在轨服务飞行器', en: 'MEV / OOS', cat: '科学', alt: 35786, inc: 0.1, e: 0.0004,
    real: 5, draw: 5, ring: 3, mass: 2300, year: 2019, owner: 'Northrop Grumman 等', status: '在役',
    use: '卫星延寿与在轨维修',
    note: '与燃料耗尽的通信卫星对接后接管其姿态与轨道控制，' +
      '可把寿命延长数年。' },
  { id: 'sarsat', name: '搜救与数据采集卫星', en: 'SARSAT / Argos', cat: '科学', alt: 850, inc: 98.7, e: 0.001,
    real: 16, draw: 14, ring: 4, mass: 500, year: 1982, owner: '国际搜救组织', status: '在役',
    use: '遇险信标定位与环境数据采集',
    note: '搭载在极轨气象卫星上的搜救载荷，' +
      '全球已累计协助救出数万人。' },
  { id: 'xingtu', name: '星图低轨导航增强', en: 'LEO Navigation Aug', cat: '导航', alt: 1000, inc: 50.0, e: 0.001,
    real: 30, draw: 24, ring: 5, mass: 200, year: 2022, owner: '中国', status: '部署中',
    use: '低轨导航信号增强',
    note: '利用低轨卫星信号强、几何变化快的特点，' +
      '把定位收敛时间从分钟级压缩到秒级。' },
  { id: 'lunar-relay', name: '地月空间试验卫星', en: 'Cislunar Relay', cat: '科学', alt: 500, apo: 400000, inc: 28.0, e: 0.9,
    real: 4, draw: 5, ring: 3, mass: 500, year: 2018, owner: '各国', status: '在役',
    use: '地月空间通信与导航试验',
    note: '运行在大偏心率的地月转移轨道上，' +
      '为后续月球探测验证通信与导航方案。' },
];

/** 分类配色：同一类的卫星同色，便于在密集轨迹网里分辨 */
export const SAT_CAT_COLOR = {
  载人航天: 0xfff0d8, 科学: 0xffe0b0, 通信星座: 0xe2e6ee, 通信: 0xffe6b8,
  导航: 0xf0ead6, 遥感: 0xd8e6d4, 气象: 0xd4e2f2, 中继: 0xe8d8f0, 大椭圆: 0xf6e2c0,
};

/* 奥尔特云示意半径（场景单位）：真实值不可能画出来，见文件头说明 */
const OORT_IN_U = 42000;
const OORT_OUT_U = 78000;
const OORT_IN_AU = 2000;
const OORT_OUT_AU = 100000;

/* ── 随机数：固定种子，保证每次打开看到的是同一片天空 ── */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** 细颗粒点精灵：小行星是砂砾，不该用大光斑 */
function grainSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(4, 4, 0, 4, 4, 4);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 轨道平面内的点 → 黄道直角坐标（与行星轨道线同一套 3-1-3 旋转） */
function planeToEcliptic(xp, yp, m) {
  return [
    m[0] * xp + m[1] * yp,
    m[2] * xp + m[3] * yp,
    m[4] * xp + m[5] * yp,
  ];
}

/** 由 (i, Ω, ω) 生成 3×2 的平面→黄道旋转矩阵 */
function planeMatrix(incDeg, nodeDeg, periDeg) {
  const i = incDeg * DEG, O = nodeDeg * DEG, w = (periDeg - nodeDeg) * DEG;
  const cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  const cO = Math.cos(O), sO = Math.sin(O);
  return [
    cw * cO - sw * ci * sO, -sw * cO - cw * ci * sO,
    cw * sO + sw * ci * cO, -sw * sO + cw * ci * cO,
    sw * si, cw * si,
  ];
}

/** 平近点角 → 位置（偏心率都很小，用二项级数解中心差，精度远优于点的大小） */
function eccentricPosition(a, e, M, out) {
  const nu = M + (2 * e - 0.25 * e * e * e) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
  const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
  out[0] = r * Math.cos(nu);
  out[1] = r * Math.sin(nu);
  return r;
}

export class Populations {
  constructor(scene) {
    this.scene = scene;
    this.layers = new Map();
    this.lastJd = NaN;
    this.sprite = grainSprite();
  }

  /* ── 构建 ─────────────────────────────────────────── */
  build(earthRT) {
    this.earth = earthRT;
    this.#buildBelt();
    this.#buildTrojans();
    this.#buildKuiper();
    this.#buildOort();
    this.#buildSatellites();
    return this;
  }

  /** 主带小行星：真实的位置分布按柯克伍德空隙挖空 */
  #buildBelt() {
    const N = 6000, LINES = 240, SEG = 56;
    const rng = makeRng(0x5eed01);
    const GAPS = [[2.06, 0.035], [2.50, 0.030], [2.82, 0.024], [2.95, 0.020], [3.27, 0.030]];
    const el = new Float32Array(N * 5);      // a, e, M0, n(deg/day), 是否画线
    const rot = new Float32Array(N * 6);
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tmp = [0, 0];
    const c = new THREE.Color();

    for (let k = 0; k < N; k++) {
      let a = 0;
      for (let tries = 0; tries < 24; tries++) {
        // 内密外疏：靠近 2.7 AU 处取样更多
        a = 2.10 + Math.pow(rng(), 0.85) * 1.18;
        if (!GAPS.some(([g, w]) => Math.abs(a - g) < w)) break;
      }
      const e = Math.min(0.34, Math.pow(rng(), 2.1) * 0.42);
      const inc = Math.pow(rng(), 1.6) * 20;
      const node = rng() * 360;
      const peri = rng() * 360;
      const M0 = rng() * 360;
      const period = Math.pow(a, 1.5) * 365.25;
      el[k * 5] = a; el[k * 5 + 1] = e; el[k * 5 + 2] = M0;
      el[k * 5 + 3] = 360 / period; el[k * 5 + 4] = k % Math.floor(N / LINES) === 0 ? 1 : 0;
      rot.set(planeMatrix(inc, node, peri), k * 6);
      // 亮度随大小分布：少数大、多数暗
      const b = 0.34 + Math.pow(rng(), 3) * 0.66;
      c.setRGB(b, b * 0.97, b * 0.9);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }

    const layer = this.#makeLayer('belt', N, LINES, SEG, {
      color: 0xffffff, opacity: 1, size: 1.5, vertexColors: true,
      lineColor: 0xc9c4b8, lineOpacity: 0.07,
    });
    layer.el = el; layer.rot = rot; layer.verts = pos; layer.moving = true;
    layer.geom.attributes.position.array.set(pos);
    layer.geom.attributes.color.array.set(col);
    layer.geom.attributes.color.needsUpdate = true;
    this.#pushLayer(layer, 'belt');
    this.#refreshLines(layer);
  }

  /** 木星特洛伊：与木星同半长轴，聚集在 L4 / L5 */
  #buildTrojans() {
    const N = 700;
    const rng = makeRng(0x5eed02);
    const el = new Float32Array(N * 5);
    const rot = new Float32Array(N * 6);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let k = 0; k < N; k++) {
      const a = 5.204 + (rng() - 0.5) * 0.16;
      const e = Math.pow(rng(), 2.4) * 0.13;
      const inc = Math.pow(rng(), 1.3) * 28;
      const l4 = k % 2 === 0;
      /* 拉格朗日点按定义取木星**平黄经** ±60°（34.396° 是 J2000 的木星平黄经，
         14.728° 是近日点黄经，两者不能混用）。±22° 是云团的展宽。 */
      const lead = 34.39644051 + (l4 ? 60 : -60) + (rng() - 0.5) * 44;
      const node = rng() * 360;
      const peri = rng() * 360;
      const M0 = ((lead - peri) % 360 + 360) % 360;
      el[k * 5] = a; el[k * 5 + 1] = e; el[k * 5 + 2] = M0;
      el[k * 5 + 3] = 360 / (Math.pow(a, 1.5) * 365.25); el[k * 5 + 4] = 0;
      rot.set(planeMatrix(inc, node, peri), k * 6);
      const b = 0.3 + rng() * 0.5;
      c.setRGB(b * 0.88, b * 0.94, b);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const layer = this.#makeLayer('trojan', N, 0, 0, {
      color: 0xffffff, opacity: 1, size: 1.6, vertexColors: true,
      lineColor: 0x9fa8b4, lineOpacity: 0,
    });
    layer.el = el; layer.rot = rot; layer.moving = true;
    layer.geom.attributes.color.array.set(col);
    layer.geom.attributes.color.needsUpdate = true;
    this.#pushLayer(layer, 'trojan');
  }

  /** 柯伊伯带：30–50 AU 的盘，含少量冷经典成分 */
  #buildKuiper() {
    const N = 3000, LINES = 110, SEG = 56;
    const rng = makeRng(0x5eed03);
    const el = new Float32Array(N * 5);
    const rot = new Float32Array(N * 6);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let k = 0; k < N; k++) {
      const cold = rng() < 0.45;
      const a = 30 + Math.pow(rng(), 0.8) * 20;
      const e = cold ? rng() * 0.05 : Math.pow(rng(), 1.8) * 0.28;
      const inc = cold ? rng() * 4 : Math.pow(rng(), 1.4) * 26;
      const node = rng() * 360, peri = rng() * 360, M0 = rng() * 360;
      el[k * 5] = a; el[k * 5 + 1] = e; el[k * 5 + 2] = M0;
      el[k * 5 + 3] = 360 / (Math.pow(a, 1.5) * 365.25);
      el[k * 5 + 4] = k % Math.floor(N / LINES) === 0 ? 1 : 0;
      rot.set(planeMatrix(inc, node, peri), k * 6);
      const b = 0.3 + Math.pow(rng(), 2.4) * 0.6;
      c.setRGB(b * 0.9, b * 0.95, b);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const layer = this.#makeLayer('kuiper', N, LINES, SEG, {
      color: 0xffffff, opacity: 1, size: 1.5, vertexColors: true,
      lineColor: 0xa8b2bd, lineOpacity: 0.05,
    });
    layer.el = el; layer.rot = rot; layer.moving = true;
    layer.geom.attributes.color.array.set(col);
    layer.geom.attributes.color.needsUpdate = true;
    this.#pushLayer(layer, 'kuiper');
    this.#refreshLines(layer);
  }

  /**
   * 奥尔特星云：各向同性球壳。
   * 静态——真实奥尔特云的公转周期以百万年计，逐帧动它是没有意义的。
   */
  #buildOort() {
    const N = 26000;
    const rng = makeRng(0x5eed04);
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    this._oortDir = new Float32Array(N * 3);
    this._oortRad = new Float32Array(N);
    const c = new THREE.Color();
    for (let k = 0; k < N; k++) {
      // 球面均匀方向
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      // 半径按 r^-1.6 取样：内密外疏，符合观测到的分布趋势
      const t = Math.pow(rng(), 0.62);
      /* 内奥尔特云（希尔斯云）是扁的：越靠内越贴黄道面。
         这不只是为了好看——它让全览视图里自然出现「球壳 + 黄道盘带」的结构，
         和参考图那张全览是同一个形状，而形状本身来自真实结构。 */
      const flat = 0.09 + 0.91 * Math.pow(t, 0.55);
      let dx = Math.cos(th) * s, dy = u * flat, dz = Math.sin(th) * s;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      this._oortDir[k * 3] = dx; this._oortDir[k * 3 + 1] = dy; this._oortDir[k * 3 + 2] = dz;
      this._oortRad[k] = t;
      const b = 0.26 + Math.pow(rng(), 2.2) * 0.5;
      c.setRGB(b * 0.86, b * 0.92, b);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      pos[k * 3] = dx * 60000; pos[k * 3 + 1] = dy * 60000; pos[k * 3 + 2] = dz * 60000;
    }
    const layer = this.#makeLayer('oort', N, 0, 0, {
      color: 0xffffff, opacity: 1, size: 1.6, vertexColors: true,
      lineColor: 0x8f96a3, lineOpacity: 0,
    });
    layer.geom.attributes.position.array.set(pos);
    layer.geom.attributes.color.array.set(col);
    layer.geom.attributes.color.needsUpdate = true;
    this.#pushLayer(layer, 'oort');
    this.applyScale();
  }

  /**
   * 地球人造卫星
   * -------------
   * 真实星座的高度与倾角：国际空间站 400 km / 51.6°，太阳同步 700 km / 98.2°，
   * 低轨星座 550 km / 53°，中轨导航 20,200 km / 55°，地球静止 35,786 km / 0.1°，
   * 再加少量大椭圆轨道（闪电型，i = 63.4°）。
   * 星下位置是本页自己按开普勒方程算的，不代表任何真实编目——
   * 参考图里地球周围那团密集轨迹，就是这一层。
   */
  #buildSatellites() {
    const SYSTEMS = SAT_SYSTEMS;
    const Re = 6371;
    const total = SYSTEMS.reduce((s2, x) => s2 + x.draw, 0);
    const rng = makeRng(0x5eed05);
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const aKm = new Float32Array(total);
    const eArr = new Float32Array(total);
    const rotArr = new Float32Array(total * 6);
    const M0Arr = new Float32Array(total);
    const nArr = new Float32Array(total);
    const c = new THREE.Color();

    const shellOf = new Array(total);
    let k = 0;
    for (const sys of SYSTEMS) {
      const color = new THREE.Color(SAT_CAT_COLOR[sys.cat] || 0xe2e6ee);
      for (let j = 0; j < sys.draw; j++, k++) {
        let a;
        if (sys.apo) {
          // 大椭圆：以远地点反推半长轴
          const ra = Re + sys.apo;
          a = (ra + (Re + sys.alt)) / 2;
        } else {
          a = Re + sys.alt;
        }
        const e = sys.e;
        // 同一壳层内均匀铺开升交点，形成参考图里那种交叉的轨迹网
        const node = (j / sys.draw) * 360 + rng() * 12;
        const peri = rng() * 360;
        const M0 = rng() * 360 * DEG;
        aKm[k] = a; eArr[k] = e; M0Arr[k] = M0;
        if (!shellOf[k]) shellOf[k] = sys;
        // 预存弧度/天，逐帧只需一次乘加，省掉两次取模
        nArr[k] = (2 * Math.PI) / (2 * Math.PI * Math.sqrt(Math.pow(a * 1000, 3) / 3.986004418e14) / 86400);
        rotArr.set(planeMatrix(sys.inc, node, peri), k * 6);
        const b = 0.62 + rng() * 0.38;
        c.setRGB(color.r * b, color.g * b, color.b * b);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: this.sprite, size: 2.3, sizeAttenuation: false,
      vertexColors: true, transparent: true, depthWrite: false,
      toneMapped: false,          // 不走 ACES：2px 的点被压暗后就彻底看不见了
      /* 这里必须用普通混合。加性混合下七千个点密集重叠会线性累加，
         近地空间直接爆成一片纯白（实测该区域 26% 像素饱和到 240 以上）。
         普通混合不累加，亮点密度靠数量本身表达。 */
      blending: THREE.NormalBlending, opacity: 0.92,
    });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    // 挂到地球的姿态节点下：地轴倾角与公转自动跟随，不必逐帧算世界坐标
    const parent = this.earth && this.earth.axisNode ? this.earth.axisNode : this.scene;
    parent.add(points);

    /* 轨道环只给代表卫星画
       六千多颗全部画环会糊成一整片；但即便只取「代表」，
       四百条半透明线叠在近地空间里，alpha 也会累加到完全不透明，
       表现就是地球边缘糊上一圈过曝的白光。所以总量压到 100 条左右，
       并按 √draw 分摊——否则星链一家就占掉大半。 */
    const RING_TOTAL = 100;
    const ringIdx = [];
    {
      const w = SYSTEMS.map(x => Math.sqrt(x.draw));
      const wsum = w.reduce((a, b) => a + b, 0);
      let k2 = 0;
      SYSTEMS.forEach((sys, si) => {
        const want = Math.max(1, Math.round((w[si] / wsum) * RING_TOTAL));
        const step = Math.max(1, Math.floor(sys.draw / want));
        for (let j = 0; j < sys.draw; j++, k2++) if (j % step === 0 && ringIdx.length < RING_TOTAL) ringIdx.push(k2);
      });
    }
    const SEG = 64;
    const ringPos = new Float32Array(ringIdx.length * SEG * 2 * 3);
    const ringGeom = new THREE.BufferGeometry();
    ringGeom.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    const rings = new THREE.LineSegments(ringGeom, new THREE.LineBasicMaterial({
      color: 0xcfcac0, transparent: true, opacity: 0.17, depthWrite: false, toneMapped: false,
    }));
    rings.frustumCulled = false;
    parent.add(rings);

    const layer = {
      id: 'sats', points, geom, rings, ringGeom, ringPos, parent, ringIdx,
      aKm, eArr, rotArr, M0Arr, nArr, total, SEG, moving: true, shellOf,
    };
    this.layers.set('sats', layer);
    this.applyScale();
  }

  #makeLayer(id, n, lines, seg, opt) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({
      map: this.sprite, size: opt.size, sizeAttenuation: false,
      vertexColors: !!opt.vertexColors, color: opt.color,
      transparent: true, opacity: opt.opacity, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    const layer = { id, points, geom, el: null, rot: null, lines: null, lineGeom: null, lineCount: 0, seg: 0 };
    if (lines > 0 && seg > 0) {
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines * seg * 2 * 3), 3));
      layer.lineCount = lines;
      layer.seg = seg;
      const lineMesh = new THREE.LineSegments(lineGeom, new THREE.LineBasicMaterial({
        color: opt.lineColor, transparent: true, opacity: opt.lineOpacity,
        depthWrite: false, toneMapped: false,
      }));
      lineMesh.frustumCulled = false;
      layer.lines = lineMesh; layer.lineGeom = lineGeom;
    }
    return layer;
  }

  #pushLayer(layer, id) {
    this.scene.add(layer.points);
    if (layer.lines) this.scene.add(layer.lines);
    this.layers.set(id, layer);
  }

  /* ── 尺度 ─────────────────────────────────────────── */
  applyScale() {
    const oort = this.layers.get('oort');
    if (oort && this._oortDir) {
      // 示意压缩：真实 2000–100000 AU 映射到 42000–78000 单位，随距离模式略微收紧
      const g = 1 - 0.3 * params.distT;
      const arr = oort.geom.attributes.position.array;
      for (let i = 0; i < this._oortRad.length; i++) {
        const r = (OORT_IN_U + this._oortRad[i] * (OORT_OUT_U - OORT_IN_U)) * g;
        arr[i * 3] = this._oortDir[i * 3] * r;
        arr[i * 3 + 1] = this._oortDir[i * 3 + 1] * r;
        arr[i * 3 + 2] = this._oortDir[i * 3 + 2] * r;
      }
      oort.geom.attributes.position.needsUpdate = true;
    }
    this.#layoutSatellites();
  }

  /** 人造卫星：半径用与月球相同的压缩模型，因此和月球轨道保持同一套比例 */
  #layoutSatellites() {
    const L = this.layers.get('sats');
    if (!L || !this.earth) return;
    const Re = this.earth.radiusKm, Ru = this.earth.radiusUnits;
    const { aKm, eArr, rotArr, total, SEG, ringPos, ringIdx } = L;
    L.radKm = new Float32Array(total);
    for (let k = 0; k < total; k++) L.radKm[k] = moonOrbitUnits(aKm[k], Re, Ru);
    // 轨道环：椭圆按真实形状画在卫星自己的轨道面内
    let p = 0;
    for (const k of ringIdx) {
      const a = L.radKm[k], e = L.eArr[k];
      const o = k * 6;
      const m0 = L.rotArr[o], m1 = L.rotArr[o + 1], m2 = L.rotArr[o + 2], m3 = L.rotArr[o + 3], m4 = L.rotArr[o + 4], m5 = L.rotArr[o + 5];
      for (let s = 0; s < SEG; s++) {
        for (const idx of [s, s + 1]) {
          const nu = (idx / SEG) * Math.PI * 2;
          const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
          const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
          ringPos[p++] = m0 * xp + m1 * yp;
          ringPos[p++] = m4 * xp + m5 * yp;
          ringPos[p++] = -(m2 * xp + m3 * yp);
        }
      }
    }
    L.ringGeom.attributes.position.needsUpdate = true;
    // 尺度映射变了，代表轨道线要跟着重画（它们只依赖尺度，不依赖时间）
    for (const layer of this.layers.values()) {
      if (layer.lines) this.#refreshLines(layer);
    }
  }

  /* ── 逐帧 ─────────────────────────────────────────── */
  /**
   * 逐帧推进
   * ---------
   * 只有点位置需要逐帧算，而且按模拟时间差 >= 0.02 天节流：
   * 默认速度下小行星每帧只走 0.00004 像素，逐帧重算是纯浪费；
   * 快进时每帧都会越过这个阈值，自然恢复逐帧更新。
   *
   * 代表轨道线**不在这里重建**：小行星的根数是常量（不含进动项），
   * 轨道形状只随尺度映射变化，所以只在 applyScale 时重建一次。
   */
  update(jd) {
    if (jd === this.lastJd) return;                 // 暂停
    const prev = this.lastJd;
    this.lastJd = jd;
    const d = jd - J2000;
    // 小行星一圈要几年，位移还看不见就不必重算；
    // 卫星 90 分钟就绕地球一圈，必须逐帧——沿用同一个阈值会让它跳着走。
    const slowDue = !(Math.abs(jd - prev) < 0.02);
    for (const L of this.layers.values()) {
      if (!L.moving) continue;
      if (L.id === 'sats') this.#stepSatellites(L, d);
      else if (slowDue) this.#stepBelt(L, d);
    }
  }

  /** 小行星 / 柯伊伯天体：直接解椭圆，再按当前尺度映射到场景 */
  #stepBelt(L, d) {
    const { el, rot, geom } = L;
    const arr = geom.attributes.position.array;
    const n = el.length / 5;
    const out = [0, 0];
    for (let k = 0; k < n; k++) {
      const a = el[k * 5], e = el[k * 5 + 1];
      const M = ((el[k * 5 + 2] + el[k * 5 + 3] * d) % 360 + 360) % 360 * DEG;
      const r = eccentricPosition(a, e, M, out);
      const o = k * 6, xp = out[0], yp = out[1];
      const x = rot[o] * xp + rot[o + 1] * yp;
      const y = rot[o + 2] * xp + rot[o + 3] * yp;
      const z = rot[o + 4] * xp + rot[o + 5] * yp;
      const s = auToUnits(r) / Math.max(r, 1e-9);
      arr[k * 3] = x * s;
      arr[k * 3 + 1] = z * s;
      arr[k * 3 + 2] = -y * s;
    }
    geom.attributes.position.needsUpdate = true;
  }

  /**
   * 人造卫星：地心坐标，几何直接挂在姿态节点下
   * 页内要算六千多颗，所以这里对近圆轨道走快路径：
   * 绝大多数卫星的 e < 0.01，中心差不到 1°，直接用真近点角 ≈ 平近点角，
   * 省掉两次 sin 和一次除法；只有闪电轨道这类大偏心率才认真解椭圆。
   */
  #stepSatellites(L, d) {
    const arr = L.geom.attributes.position.array;
    const rot = L.rotArr;
    const a = L.radKm, ecc = L.eArr, m0 = L.M0Arr, nn = L.nArr;
    const out = [0, 0];
    for (let k = 0; k < L.total; k++) {
      const e = ecc[k];
      const M = m0[k] + nn[k] * d;      // 弧度制，无需取模
      let xp, yp;
      if (e < 0.01) {
        xp = a[k] * Math.cos(M);
        yp = a[k] * Math.sin(M);
      } else {
        eccentricPosition(a[k], e, M, out);
        xp = out[0]; yp = out[1];
      }
      const o = k * 6;
      arr[k * 3] = rot[o] * xp + rot[o + 1] * yp;
      arr[k * 3 + 1] = rot[o + 4] * xp + rot[o + 5] * yp;
      arr[k * 3 + 2] = -(rot[o + 2] * xp + rot[o + 3] * yp);
    }
    L.geom.attributes.position.needsUpdate = true;
  }

  /** 代表性轨道线：只给抽出来的那几颗画整圈，换取成片的细线观感 */
  #refreshLines(L) {
    if (!L.lines) return;
    const { el, rot, lineGeom } = L;
    const arr = lineGeom.attributes.position.array;
    const n = el.length / 5;
    const SEG = L.seg;                       // 每条的段数，不能拿整条数组的顶点数当段数
    let p = 0, drawn = 0;
    for (let k = 0; k < n && drawn < L.lineCount; k++) {
      if (el[k * 5 + 4] !== 1) continue;
      drawn++;
      const a = el[k * 5], e = el[k * 5 + 1];
      const o = k * 6;
      const m0 = rot[o], m1 = rot[o + 1], m2 = rot[o + 2], m3 = rot[o + 3], m4 = rot[o + 4], m5 = rot[o + 5];
      for (let s = 0; s < SEG; s++) {
        for (const idx of [s, s + 1]) {
          const nu = (idx / SEG) * Math.PI * 2;
          const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
          const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
          const x = m0 * xp + m1 * yp;
          const y = m2 * xp + m3 * yp;
          const z = m4 * xp + m5 * yp;
          const sc = auToUnits(r) / Math.max(r, 1e-9);
          arr[p++] = x * sc;
          arr[p++] = z * sc;
          arr[p++] = -y * sc;
        }
      }
    }
    lineGeom.attributes.position.needsUpdate = true;
  }

  /* ── 显隐 ─────────────────────────────────────────── */
  setVisible(id, on) {
    const L = this.layers.get(id);
    if (!L) return;
    L.points.visible = on;
    if (L.lines) L.lines.visible = on;
    // 人造卫星的轨迹网有自己的开关，不跟着点一起被强制打开
    if (L.rings) L.rings.visible = on && this.satRings !== false;
    L.moving = on && (id === 'sats' || id === 'belt' || id === 'trojan' || id === 'kuiper');
  }

  /** 人造卫星的轨道环单独开关（卫星本体与轨迹网是两个层级） */
  setRings(on) {
    this.satRings = on;
    const L = this.layers.get('sats');
    if (L && L.rings) L.rings.visible = on && L.points.visible;
  }

  /** 分层统计，给界面用 */
  stats() {
    return [
      { id: 'belt', count: this.layers.get('belt') ? this.layers.get('belt').el.length / 5 : 0 },
      { id: 'trojan', count: this.layers.get('trojan') ? this.layers.get('trojan').el.length / 5 : 0 },
      { id: 'kuiper', count: this.layers.get('kuiper') ? this.layers.get('kuiper').el.length / 5 : 0 },
      { id: 'oort', count: this._oortRad ? this._oortRad.length : 0 },
      { id: 'sats', count: this.layers.get('sats') ? this.layers.get('sats').total : 0 },
    ];
  }
}
