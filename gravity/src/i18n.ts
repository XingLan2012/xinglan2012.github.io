// ---------------------------------------------------------------------------
// Language state + shared UI strings.
//
// Upstream Gravity ships English + Polish. This deployment adds Simplified
// Chinese (zh) — a GPL-3.0 modification of https://github.com/qunabu/Gravity,
// disclosed in /gravity/NOTICE.md. English stays the base language: every
// string without a translation falls back to it.
// ---------------------------------------------------------------------------

export type Lang = 'en' | 'pl' | 'zh';

export const LANGS: Lang[] = ['en', 'pl', 'zh'];
export const LANG_BTN: Record<Lang, string> = { en: 'EN', pl: 'PL', zh: '中文' };

const KEY = 'gravity-lang';

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'pl' || v === 'zh';

/** Stored choice → ?lang= override → browser language → English. */
function detect(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) return q;
  } catch { /* ignore */ }
  try {
    const stored = localStorage.getItem(KEY);
    if (isLang(stored)) return stored;
  } catch { /* ignore */ }
  const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('pl')) return 'pl';
  return 'en';
}

let lang: Lang = detect();
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang { return lang; }

export function setLang(l: Lang): void {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  applyDocument();
  listeners.forEach((fn) => { try { fn(l); } catch (e) { console.error(e); } });
}

/** Register a re-render callback for language changes (world labels, panel). */
export function onLangChange(fn: (l: Lang) => void): void { listeners.add(fn); }

/** Pick one of the three strings for the current language. */
export function tr(en: string, pl: string, zh: string): string {
  return lang === 'zh' ? zh : lang === 'pl' ? pl : en;
}

// ---------------------------------------------------------------------------
// Solar-system body names (ids come from data/bodies.ts).
// ---------------------------------------------------------------------------

const ZH_BODIES: Record<string, string> = {
  sun: '太阳',
  mercury: '水星',
  venus: '金星',
  earth: '地球',
  moon: '月球',
  mars: '火星',
  phobos: '火卫一',
  deimos: '火卫二',
  jupiter: '木星',
  io: '木卫一',
  europa: '木卫二',
  ganymede: '木卫三',
  callisto: '木卫四',
  saturn: '土星',
  titan: '土卫六',
  rhea: '土卫五',
  uranus: '天王星',
  titania: '天卫三',
  oberon: '天卫四',
  neptune: '海王星',
  triton: '海卫一',
  pluto: '冥王星',
  charon: '冥卫一',
};

/** Display name of a body: Chinese in zh, the upstream English name otherwise. */
export function bodyName(id: string, en: string): string {
  return lang === 'zh' ? (ZH_BODIES[id] ?? en) : en;
}

/** Time-speed readout, with localized units. */
export function fmtSpeed(dps: number): string {
  if (dps < 1) return lang === 'zh' ? `${(dps * 24).toFixed(1)} 小时/秒` : `${(dps * 24).toFixed(1)} h/s`;
  if (dps < 400) return lang === 'zh' ? `${dps.toFixed(1)} 天/秒` : `${dps.toFixed(1)} days/s`;
  return lang === 'zh' ? `${(dps / 365.25).toFixed(2)} 年/秒` : `${(dps / 365.25).toFixed(2)} yr/s`;
}

// ---------------------------------------------------------------------------
// Panel + tour chrome.
// ---------------------------------------------------------------------------

export interface UIStrings {
  title: string;
  sub: string;
  scaleModel: string; visual: string; realScale: string;
  scaleHintVisual: string; scaleHintReal: string;
  physics: string; kepler: string; nbody: string; keplerHint: string; nbodyHint: string;
  dimension: string; dim3d: string; dim2d: string; dimHint: string;
  orbits: string; moons: string; heavier: string; projection: string; labels: string;
  time: string; pause: string; play: string; reset: string;
  focusCamera: string; replayTour: string;
  tour: string; explore: string; back: string; next: string; finish: string;
  speed: string; playCta: string; autoPlay: string; hideDesc: string; showDesc: string;
  madeBy: string; earthTexture: string;
}

export const UI: Record<Lang, UIStrings> = {
  en: {
    title: 'Gravity',
    sub: 'Solar System · Newtonian Model',
    scaleModel: 'Scale model', visual: 'Visual', realScale: 'True scale',
    scaleHintVisual: 'Visual scale — sizes & distances compressed so everything is visible.',
    scaleHintReal: 'True scale — accurate sizes & distances. Planets are specks; zoom in.',
    physics: 'Physics', kepler: 'Keplerian', nbody: 'N-body',
    keplerHint: 'Analytic two-body orbits from J2000 elements — exact, stable positions.',
    nbodyHint: 'Direct F = G·m₁·m₂/r² integration of every pair — gravity, simulated.',
    dimension: 'Dimension', dim3d: '3D', dim2d: '2D ecliptic',
    dimHint: '3D shows real orbital inclinations; 2D flattens onto the ecliptic plane.',
    orbits: 'Orbit paths', moons: 'Moons', heavier: 'heavier',
    projection: 'Projection lines onto ecliptic', labels: 'Labels',
    time: 'Time', pause: '⏸ Pause', play: '▶ Play', reset: '⟲ J2000',
    focusCamera: 'Focus camera', replayTour: '▶ Replay guided tour',
    tour: 'Guided Tour', explore: 'Explore ✕', back: '‹ Back', next: 'Next ›', finish: 'Finish ✓',
    speed: 'Time speed', playCta: 'Play with narration & music',
    autoPlay: 'Auto-play narration', hideDesc: 'Hide description', showDesc: 'Show description',
    madeBy: 'Made by', earthTexture: 'Earth texture',
  },
  pl: {
    title: 'Grawitacja',
    sub: 'Układ Słoneczny · model newtonowski',
    scaleModel: 'Skala modelu', visual: 'Wizualna', realScale: 'Rzeczywista',
    scaleHintVisual: 'Skala wizualna — rozmiary i odległości ściśnięte, by wszystko było widoczne.',
    scaleHintReal: 'Skala rzeczywista — dokładne rozmiary i odległości. Planety to drobiny; przybliż.',
    physics: 'Fizyka', kepler: 'Kepler', nbody: 'N-ciał',
    keplerHint: 'Analityczne orbity dwuciałowe z elementów J2000 — dokładne, stabilne pozycje.',
    nbodyHint: 'Bezpośrednie całkowanie F = G·m₁·m₂/r² dla każdej pary — symulowana grawitacja.',
    dimension: 'Wymiar', dim3d: '3D', dim2d: '2D ekliptyka',
    dimHint: '3D pokazuje prawdziwe nachylenia orbit; 2D spłaszcza je do płaszczyzny ekliptyki.',
    orbits: 'Linie orbit', moons: 'Księżyce', heavier: 'cięższe',
    projection: 'Linie rzutu na ekliptykę', labels: 'Etykiety',
    time: 'Czas', pause: '⏸ Pauza', play: '▶ Odtwórz', reset: '⟲ J2000',
    focusCamera: 'Kamera na', replayTour: '▶ Powtórz przewodnik',
    tour: 'Przewodnik', explore: 'Eksploruj ✕', back: '‹ Wstecz', next: 'Dalej ›', finish: 'Zakończ ✓',
    speed: 'Prędkość czasu', playCta: 'Odtwórz z narracją i muzyką',
    autoPlay: 'Auto-odtwarzanie narracji', hideDesc: 'Ukryj opis', showDesc: 'Pokaż opis',
    madeBy: 'Autor', earthTexture: 'Tekstura Ziemi',
  },
  zh: {
    title: '引力',
    sub: '太阳系 · 牛顿力学模型',
    scaleModel: '比例模型', visual: '视觉比例', realScale: '真实比例',
    scaleHintVisual: '视觉比例 —— 压缩了天体大小与距离，让所有天体都能同框可见。',
    scaleHintReal: '真实比例 —— 大小与距离都按真实数值。行星只是一粒微尘，请放大查看。',
    physics: '物理引擎', kepler: '开普勒轨道', nbody: 'N 体模拟',
    keplerHint: '由 J2000 轨道根数解析求解二体问题 —— 位置精确且长期稳定。',
    nbodyHint: '对每一对天体直接积分 F = G·m₁·m₂/r² —— 把引力真正算出来。',
    dimension: '维度', dim3d: '三维', dim2d: '二维黄道面',
    dimHint: '三维显示真实的轨道倾角；二维则把所有轨道压平到黄道面上。',
    orbits: '轨道线', moons: '卫星', heavier: '更吃性能',
    projection: '投影到黄道面的连线', labels: '天体名称',
    time: '时间', pause: '⏸ 暂停', play: '▶ 播放', reset: '⟲ 回到 J2000',
    focusCamera: '镜头对准', replayTour: '▶ 重看引导讲解',
    tour: '引导讲解', explore: '自由探索 ✕', back: '‹ 上一步', next: '下一步 ›', finish: '完成 ✓',
    speed: '时间速度', playCta: '播放旁白与配乐',
    autoPlay: '自动播放讲解', hideDesc: '收起讲解', showDesc: '展开讲解',
    madeBy: '作者', earthTexture: '地球贴图',
  },
};

/** "Step 3" / "Krok 3" / "第 3 步" — the number is appended by the caller. */
export function stepWord(n: number): string {
  return lang === 'zh' ? `第 ${n} 步` : lang === 'pl' ? `Krok ${n}` : `Step ${n}`;
}

/** "12 · Title" uses the same localized word (dropdown shows the bare number). */
export function T(): UIStrings { return UI[lang]; }

// ---------------------------------------------------------------------------
// Static page chrome that lives in index.html (credits/attribution — the links
// and names stay exactly as upstream, only the labels are translated).
// ---------------------------------------------------------------------------

function applyDocument(): void {
  const ui = UI[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  document.title = lang === 'zh'
    ? 'GRAVITY · 太阳系引力模型'
    : lang === 'pl' ? 'GRAVITY · Model Układu Słonecznego' : 'GRAVITY · Solar System Model';

  const left = document.querySelector('.credit.credit-left');
  if (left) {
    left.innerHTML = `${ui.madeBy} <a href="https://github.com/qunabu/Gravity" target="_blank" rel="noopener noreferrer">qunabu</a>`;
  }
  const right = document.querySelector('.credit:not(.credit-left)');
  if (right) {
    right.innerHTML = `${ui.earthTexture} <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope</a> · CC BY 4.0`;
  }
  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    const label = lang === 'zh' ? '背景音乐' : lang === 'pl' ? 'Muzyka w tle' : 'Background music';
    musicBtn.setAttribute('title', label);
    musicBtn.setAttribute('aria-label', lang === 'zh' ? '开关背景音乐' : `Toggle ${label.toLowerCase()}`);
  }
}

applyDocument();

// Keep ?lang= in the URL honest if the visitor switches language by hand.
export function syncUrlLang(): void {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('lang') === lang) return;
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url.toString());
  } catch { /* ignore */ }
}
