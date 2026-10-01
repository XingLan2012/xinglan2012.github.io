/**
 * 控制台 UI
 * ---------
 * 顶：时刻读数与显示开关
 * 画面内浮层：选中天体的物理参数与实时遥测（不是停靠侧栏）
 * 底：可拖动时间轴（刻度随缩放自适应）
 * 覆盖层：天体标签 + 卫星引线 + 取景框
 */

import { formatJd, isoDate, jdFromIso, dateFromJd, poleToEcliptic } from './astronomy.js';
import { moonBlurb, moonFacts, classifyMoon, kmText, periodText } from './moon-info.js';
import { landmarksOf, LANDMARK_BODIES } from './landmarks.js';
import { AU_KM, C_KM_S, J2000 as J2, auToUnits, unitsToAu, KM_UNITS } from './scale.js';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUP_MINUS = '⁻';

/* ── 格式化 ───────────────────────────────────────────── */
export function fmt(v, d = 2) {
  if (!Number.isFinite(v)) return '—';
  const av = Math.abs(v);
  if (av !== 0 && (av < 1e-3 || av >= 1e7)) return sci(v);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function sci(v) {
  if (!Number.isFinite(v)) return '—';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / Math.pow(10, e);
  const es = (e < 0 ? SUP_MINUS : '') + String(Math.abs(e)).split('').map(c => SUP[+c]).join('');
  return `${m.toFixed(2)}×10${es}`;
}
function kms(v) { return v >= 1000 ? fmt(v, 0) : fmt(v, v < 10 ? 2 : 1); }
function lightTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`;
  return `${(seconds / 3600).toFixed(2)} 小时`;
}
function periodDays(d) {
  if (!Number.isFinite(d)) return '—';
  if (Math.abs(d) < 400) return `${fmt(Math.abs(d), 2)} 天`;
  return `${fmt(Math.abs(d) / 365.25, 2)} 年`;
}
function rotPeriod(h) {
  if (!h) return '—';
  const a = Math.abs(h);
  const retro = h < 0 ? '（逆向）' : '';
  if (a < 48) {
    const H = Math.floor(a), M = Math.round((a - H) * 60);
    return `${H} 时 ${String(M).padStart(2, '0')} 分${retro}`;
  }
  return `${fmt(a / 24, 2)} 天${retro}`;
}
function distKu(km) {
  if (km >= 1e8) return `${fmt(km / AU_KM, 3)} AU`;
  if (km >= 1e6) return `${fmt(km / 1e6, 2)} 百万 km`;
  return `${fmt(km, 0)} km`;
}
export function axialTilt(body) {
  const p = poleToEcliptic(body.pole || [0, 90]);
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return Math.acos(Math.max(-1, Math.min(1, p.z / l))) * 180 / Math.PI;
}

/* ── HUD ──────────────────────────────────────────────── */
export class Hud {
  constructor(world, actions) {
    this.world = world;
    this.actions = actions;
    this.el = {
      boot: document.getElementById('boot'),
      bootStage: document.getElementById('bootStage'),
      bootBar: document.getElementById('bootBar'),
      bootPct: document.getElementById('bootPct'),
      date: document.getElementById('clockDate'),
      time: document.getElementById('clockTime'),
      sub: document.getElementById('clockSub'),
      insp: document.getElementById('inspector'),
      inspBody: document.getElementById('inspectorBody'),
      inspHead: document.getElementById('inspectorHead'),
      labels: document.getElementById('labels'),
      leaders: document.getElementById('leaders'),
      reticle: document.getElementById('reticle'),
      track: document.getElementById('track'),
      tlCanvas: document.getElementById('tlCanvas'),
      handle: document.getElementById('handle'),
      fill: document.getElementById('trackFill'),
      nowMark: document.getElementById('nowMark'),
      dateInput: document.getElementById('dateInput'),
      rateRead: document.getElementById('rateRead'),
      fps: document.getElementById('fps'),
      hint: document.getElementById('hint'),
      toggleBar: document.getElementById('toggles'),
      yearRead: document.getElementById('yearRead'),
      statJd: document.getElementById('statJd'),
      statLine: document.getElementById('statLine'),
      statBodies: document.getElementById('statBodies'),
      statMoons: document.getElementById('statMoons'),
      mastMeta: document.getElementById('mastMeta'),
      search: document.getElementById('searchInput'),
      searchBox: document.querySelector('.search'),
      searchClear: document.getElementById('searchClear'),
      searchResults: document.getElementById('searchResults'),
      catalog: document.getElementById('catalog'),
      catalogBody: document.getElementById('catalogBody'),
      catalogMeta: document.getElementById('catalogMeta'),
      catalogToggle: document.getElementById('catalogToggle'),
      catalogClose: document.getElementById('catalogClose'),
      catExpand: document.getElementById('catExpand'),
      catCollapse: document.getElementById('catCollapse'),
    };
    this.labels = new Map();
    this.viewCenter = J2;
    this.viewSpan = 365.25 * 100;
    this.telemetryAt = 0;
    this.clockAt = -1;
    this.tm = null;
    this._labelList = [];
    this._barPct = '';
    this._ret = 'none';
    this._clockDate = '';
    this._clockTime = '';
    this._clockSub = '';
    this._dateIso = '';
    this._year = '';
    this._jdStat = '';
    this._tlKey = '';
    this._evCache = { key: '', list: null };
    this.selected = null;
    this.visibleLabels = [];
    // 卫星列表用事件委托：面板每次重建都不必重新绑定
    if (this.el.inspBody) {
      this.el.inspBody.addEventListener('click', e => {
        const lm = e.target.closest('[data-lm]');
        if (lm && this.selected) {
          this.actions.focusLandmark(this.selected.data.id, Number(lm.dataset.lm));
          return;
        }
        const row = e.target.closest('[data-goto]');
        if (row) this.actions.select(row.dataset.goto, true);
      });
    }
    this.#buildLabels();
    this.#bindTrack();
    this.#bindToggles();
    this.#buildSearch();
    this.#buildCatalog();
    this.#stampSummary();
  }

  /* ── 天体目录 ─────────────────────────────────────── */
  /**
   * 按母星分组的完整目录：恒星 → 行星 → 该行星的全部卫星。
   * 点任意一行直接跳过去，和点场景里的天体是同一个动作。
   * 卫星不再需要靠搜索才能到达——目录里就能一路展开点下去。
   */
  #buildCatalog() {
    const body = this.el.catalogBody;
    if (!body) return;
    const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const sun = this.world.list.find(x => x.isSun);
    const planets = this.world.list
      .filter(x => !x.isMoon && !x.isSun)
      .sort((a, b) => order.indexOf(a.data.id) - order.indexOf(b.data.id));
    const moonsOf = id => this.world.list
      .filter(x => x.isMoon && x.data.parent === id)
      .sort((a, b) => b.data.radiusKm - a.data.radiusKm);

    const row = (rt, cls = '') => `<div class="cat-row${cls}" data-goto="${rt.data.id}">
        <b>${rt.data.name}</b><i>${rt.data.en}</i></div>`;

    let html = '';
    if (sun) html += row(sun);
    html += '<div class="cat-sep"></div>';

    for (const p of planets) {
      const moons = moonsOf(p.data.id);
      if (!moons.length) { html += row(p); continue; }
      html += `<div class="cat-group" data-group="${p.data.id}">
        <div class="cat-row" data-goto="${p.data.id}">
          <span class="cat-caret">▸</span><b>${p.data.name}</b><i>${p.data.en}</i><em>${moons.length}</em>
        </div>
        <div class="cat-children">${moons.map(m => row(m, ' moon')).join('')}</div>
      </div>`;
    }
    // 人造卫星单独成组：位置挂在地球上，点一层就飞到那一层
    const satTargets = this.world.satTargets ? [...this.world.satTargets.values()] : [];
    if (satTargets.length) {
      const n = satTargets.reduce((s2, x) => s2 + x.data.draw, 0);
      const real = satTargets.reduce((s2, x) => s2 + x.data.real, 0);
      html += `<div class="cat-sep"></div>
        <div class="cat-group open" data-group="sats">
          <div class="cat-row" data-goto="earth">
            <span class="cat-caret">▸</span><b>人造卫星</b><i>ARTIFICIAL</i><em>${real.toLocaleString('zh-CN')}</em>
          </div>
          <div class="cat-children">
            ${satTargets.map(x => `<div class="cat-row moon" data-goto="sat:${x.data.id}">
                <b>${x.data.name}</b><i>${fmt(x.data.aKm - 6371, 0)}km</i>
                <em>${x.data.real >= 1000 ? (x.data.real / 1000).toFixed(1) + 'k' : x.data.real}</em></div>`).join('')}
          </div>
        </div>`;
    }
    // 已命名小行星：按编号列出，点进去看档案
    const minors = this.world.minorTargets ? [...this.world.minorTargets.values()] : [];
    if (minors.length) {
      html += `<div class="cat-sep"></div>
        <div class="cat-group" data-group="asteroids">
          <div class="cat-row" data-goto="ast-4">
            <span class="cat-caret">▸</span><b>已命名小行星</b><i>ASTEROIDS</i><em>${minors.length}</em>
          </div>
          <div class="cat-children">
            ${minors.map(x => `<div class="cat-row moon" data-goto="${x.data.id}">
                <b>(${x.data.num}) ${x.data.name}</b><i>${x.data.spectral}</i>
                <em>${x.data.diameterKm >= 10 ? fmt(x.data.diameterKm, 0) : fmt(x.data.diameterKm, 1)}km</em></div>`).join('')}
          </div>
        </div>`;
    }
    // 彗星
    const comets = this.world.comets || [];
    if (comets.length) {
      html += `<div class="cat-sep"></div>
        <div class="cat-group" data-group="comets">
          <div class="cat-row" data-goto="comet-1p">
            <span class="cat-caret">▸</span><b>彗星</b><i>COMETS</i><em>${comets.length}</em>
          </div>
          <div class="cat-children">
            ${comets.map(x => `<div class="cat-row moon" data-goto="${x.data.id}">
                <b>${x.data.name}</b><i>${x.data.inc > 90 ? '逆行' : '顺行'}</i>
                <em>${x.data.perihelionAu.toFixed(2)}AU</em></div>`).join('')}
          </div>
        </div>`;
    }
    body.innerHTML = html;

    const moonTotal = this.world.list.filter(x => x.isMoon).length;
    if (this.el.catalogMeta) {
      this.el.catalogMeta.textContent = `${planets.length} 行星 · ${moonTotal} 卫星 · `
        + `${satTargets.length} 人造系统 · ${(this.world.minorTargets ? this.world.minorTargets.size : 0)} 小行星`
        + ` · ${(this.world.comets ? this.world.comets.length : 0)} 彗星`;
    }

    // 委托：点箭头只展开，点整行直接跳过去
    body.addEventListener('click', e => {
      const group = e.target.closest('.cat-group');
      if (e.target.closest('.cat-caret') && group) {
        group.classList.toggle('open');
        return;
      }
      const hit = e.target.closest('[data-goto]');
      if (!hit) return;
      if (group) group.classList.add('open');   // 跳到卫星时顺手把该族展开
      this.actions.select(hit.dataset.goto, true);
    });

    if (this.el.catExpand) {
      this.el.catExpand.addEventListener('click', () => {
        body.querySelectorAll('.cat-group').forEach(g => g.classList.add('open'));
      });
    }
    if (this.el.catCollapse) {
      this.el.catCollapse.addEventListener('click', () => {
        body.querySelectorAll('.cat-group').forEach(g => g.classList.remove('open'));
      });
    }
    if (this.el.catalogToggle) this.el.catalogToggle.addEventListener('click', () => this.toggleCatalog());
    if (this.el.catalogClose) this.el.catalogClose.addEventListener('click', () => this.toggleCatalog(false));
  }

  toggleCatalog(force) {
    const el = this.el.catalog;
    if (!el) return;
    const on = force === undefined ? !el.classList.contains('open') : !!force;
    el.classList.toggle('open', on);
    document.body.classList.toggle('has-catalog', on);
    if (this.el.catalogToggle) this.el.catalogToggle.classList.toggle('on', on);
    if (on) this.#syncCatalog();
  }

  /** 目录里高亮当前目标，并把它的分组展开、滚到可见处 */
  #syncCatalog() {
    const body = this.el.catalogBody;
    if (!body) return;
    const sel = this.selected ? this.selected.data.id : null;
    for (const r of body.querySelectorAll('.cat-row')) r.classList.toggle('on', r.dataset.goto === sel);
    if (!sel) return;
    const cur = body.querySelector(`.cat-row[data-goto="${sel}"]`);
    if (!cur) return;
    const group = cur.closest('.cat-group');
    if (group) group.classList.add('open');
    cur.scrollIntoView({ block: 'nearest' });
  }

  /* ── 搜索 ─────────────────────────────────────────── */
  /**
   * 左上角搜索：中文名、英文名、编号都能匹配。
   * 结果按「行星 → 卫星」并优先前缀命中排序，回车或点击直接飞过去。
   * 快捷键 / 或 Ctrl+K 聚焦，上下键选择，Esc 关闭。
   */
  #buildSearch() {
    const input = this.el.search;
    const box = this.el.searchResults;
    if (!input || !box) return;

    // 预建索引：只在启动时遍历一次，之后每次输入只是过滤
    this.searchIndex = this.world.list.map(rt => ({
      rt,
      zh: rt.data.name,
      en: (rt.data.en || '').toLowerCase(),
      id: rt.data.id,
      parent: rt.parent ? rt.parent.data.name : '',
      tag: rt.isSun ? '恒星' : (rt.data.type === 'moon' ? `卫星 · ${rt.parent ? rt.parent.data.name : ''}` : '行星'),
      order: rt.isMoon ? 1 : 0,
    }));

    const run = () => {
      const q = input.value.trim().toLowerCase();
      this.el.searchBox.classList.toggle('has-text', !!q);
      if (!q) { box.hidden = true; box.replaceChildren(); this.searchHits = []; return; }
      const hits = [];
      for (const it of this.searchIndex) {
        let score = -1;
        if (it.zh.startsWith(q)) score = 0;
        else if (it.en.startsWith(q)) score = 1;
        else if (it.id.startsWith(q)) score = 2;
        else if (it.zh.includes(q)) score = 3;
        else if (it.en.includes(q)) score = 4;
        if (score >= 0) hits.push({ ...it, score });
      }
      hits.sort((a, b) => a.order - b.order || a.score - b.score || b.rt.radiusKm - a.rt.radiusKm || (a.zh < b.zh ? -1 : 1));
      this.searchHits = hits.slice(0, 40);
      if (!this.searchHits.length) {
        box.innerHTML = '<div class="sr-empty">没有匹配的天体</div>';
        box.hidden = false;
        return;
      }
      this.searchCursor = 0;
      box.innerHTML = this.searchHits.map((h, i) =>
        `<div class="sr-item${i === 0 ? ' on' : ''}" data-i="${i}"><b>${h.zh}</b><i>${h.en}</i><em>${h.tag}</em></div>`).join('');
      box.hidden = false;
    };

    const pick = i => {
      const hit = this.searchHits && this.searchHits[i];
      if (!hit) return;
      input.value = '';
      this.el.searchBox.classList.remove('has-text');
      box.hidden = true;
      box.replaceChildren();
      input.blur();
      this.actions.select(hit.rt.data.id, true);
    };

    const move = d => {
      if (!this.searchHits || !this.searchHits.length) return;
      this.searchCursor = (this.searchCursor + d + this.searchHits.length) % this.searchHits.length;
      for (const el of box.querySelectorAll('.sr-item')) {
        el.classList.toggle('on', Number(el.dataset.i) === this.searchCursor);
      }
      const cur = box.querySelector('.sr-item.on');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(this.searchCursor || 0); }
      else if (e.key === 'Escape') { input.value = ''; box.hidden = true; input.blur(); }
      e.stopPropagation();
    });
    box.addEventListener('mousedown', e => {
      const item = e.target.closest('.sr-item');
      if (item) { e.preventDefault(); pick(Number(item.dataset.i)); }
    });
    if (this.el.searchClear) {
      this.el.searchClear.addEventListener('click', () => {
        input.value = ''; box.hidden = true; this.el.searchBox.classList.remove('has-text'); input.focus();
      });
    }
    this._focusSearch = () => { input.focus(); input.select(); };
  }

  /** 标题块与右上角的静态统计：天体数、卫星数、轨道数 */
  #stampSummary() {
    const total = this.world.list.filter(b => !b.isMoon).length;
    const moons = this.world.list.filter(b => b.isMoon).length;
    const known = this.world.list.filter(b => !b.isMoon && b.data.satellites).reduce((s2, b) => s2 + b.data.satellites, 0);
    const orbits = this.world.list.filter(b => b.orbitLine).length;
    const planets = this.world.list.filter(b => !b.isMoon && !b.isSun).length;
    const pop = this.world.populations ? this.world.populations.stats() : [];
    const popCount = pop.reduce((s0, x) => s0 + x.count, 0);
    this.popTotal = popCount;
    if (this.el.statBodies) this.el.statBodies.textContent = String(total);
    if (this.el.statMoons) this.el.statMoons.textContent = String(moons);
    if (this.el.mastMeta) {
      this.el.mastMeta.textContent = `—— 真实历元 · ${planets} 行星 · ${moons} 卫星（已命名）· ${popCount.toLocaleString('zh-CN')} 个群内天体`;
    }
    // 直接取两端的年份，别拿「距今多少年」当范围写
    const y0 = dateFromJd(jdFromIso('1700-01-01')).getUTCFullYear();
    const y1 = dateFromJd(jdFromIso('2200-01-01')).getUTCFullYear();
    const years = `${y0}–${y1} 年`;
    if (this.el.statLine) this.el.statLine.textContent = `${planets} 行星 · ${moons} 卫星 · 时间轴 ${years}`;
  }

  /* ── 启动进度 ─────────────────────────────────────── */
  boot(stage, pct) {
    if (this.el.bootStage) this.el.bootStage.textContent = stage;
    if (this.el.bootBar) this.el.bootBar.style.width = `${Math.round(pct * 100)}%`;
    if (this.el.bootPct) this.el.bootPct.textContent = `${Math.round(pct * 100)}%`;
  }
  bootDone() {
    if (!this.el.boot) return;
    this.el.boot.classList.add('done');
    setTimeout(() => { if (this.el.boot) this.el.boot.style.display = 'none'; }, 800);
    if (this.el.hint) setTimeout(() => this.el.hint.classList.add('hide'), 9000);
  }
  fail(message) {
    const div = document.createElement('div');
    div.className = 'err';
    div.innerHTML = `<b>渲染失败</b><br>${message}`;
    document.body.appendChild(div);
    if (this.el.boot) this.el.boot.classList.add('done');
  }

  /* ── 标签层 ───────────────────────────────────────── */
  #buildLabels() {
    const ns = 'http://www.w3.org/2000/svg';
    for (const rt of this.world.list) {
      const div = document.createElement('div');
      div.className = 'label' + (rt.isMoon ? ' moon' : '');
      div.style.display = 'none';   // 未标注前必须显式隐藏，否则会堆在左上角
      div.innerHTML = `<i>${rt.data.en}</i><b>${rt.data.name}</b>`;
      // 点击标签即切换目标：选中 + 飞过去，这就是主导航方式
      div.addEventListener('click', e => { e.stopPropagation(); this.actions.select(rt.data.id, true); });
      this.el.labels.appendChild(div);
      const line = document.createElementNS(ns, 'line');
      line.style.display = 'none';
      this.el.leaders.appendChild(line);
      this.labels.set(rt.data.id, { div, line, shown: false, leader: null, lx: NaN, ly: NaN, sx: NaN, sy: NaN, lyv: NaN });
    }
  }

  #bindToggles() {
    // 视角预设
    const views = document.getElementById('views');
    if (views) {
      views.addEventListener('click', e => {
        const b = e.target.closest('[data-view]');
        if (b) this.actions.view(b.dataset.view);
      });
      this.el.views = views;
    }
    // 两个容器（显示开关 / 天体群开关）用同一套委托
    this.el.toggleBars = [this.el.toggleBar, document.getElementById('populations')].filter(Boolean);
    for (const bar of this.el.toggleBars) {
      bar.addEventListener('click', e => {
        const btn = e.target.closest('.tgl[data-flag]');
        if (!btn) return;
        const flag = btn.dataset.flag;
        const on = !btn.classList.contains('on');
        btn.classList.toggle('on', on);
        this.actions.toggle(flag, on);
      });
    }
  }

  setView(name) {
    if (!this.el.views) return;
    for (const b of this.el.views.querySelectorAll('[data-view]')) {
      b.classList.toggle('on', b.dataset.view === name);
    }
  }

  setFlagButton(flag, on) {
    for (const bar of (this.el.toggleBars || [])) {
      const btn = bar.querySelector(`.tgl[data-flag="${flag}"]`);
      if (btn) btn.classList.toggle('on', !!on);
    }
  }

  /* ── 时间轴 ───────────────────────────────────────── */
  #bindTrack() {
    const track = this.el.track;
    let dragging = false;
    const spanAu = () => this.viewSpan;

    const timeFromEvent = ev => {
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      return this.viewCenter - spanAu() / 2 + t * spanAu();
    };

    const move = ev => {
      if (!dragging) return;
      this.actions.setJd(timeFromEvent(ev), true);
    };
    const up = ev => {
      if (!dragging) return;
      dragging = false;
      track.releasePointerCapture && track.releasePointerCapture(ev.pointerId);
    };
    track.addEventListener('pointerdown', ev => {
      dragging = true;
      track.setPointerCapture && track.setPointerCapture(ev.pointerId);
      this.actions.setJd(timeFromEvent(ev), true);
    });
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
    track.addEventListener('wheel', ev => {
      ev.preventDefault();
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const anchor = this.viewCenter - this.viewSpan / 2 + t * this.viewSpan;
      const k = ev.deltaY > 0 ? 1.28 : 1 / 1.28;
      this.viewSpan = Math.max(2, Math.min(365.25 * 400, this.viewSpan * k));
      // 以光标处为锚点缩放
      this.viewCenter = anchor - (t - 0.5) * this.viewSpan;
    }, { passive: false });

    /* 时间控制按钮 */
    document.getElementById('timeControls').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'play') this.actions.play(!this.playing);
      else if (act === 'back') this.actions.direction(-1);
      else if (act === 'fwd') this.actions.direction(1);
      else if (act === 'now') this.actions.now();
      else if (act === 'span') { this.viewSpan = parseFloat(b.dataset.span); this.viewCenter = this.jd || J2; }
      else if (act === 'step') this.actions.step(parseFloat(b.dataset.delta));
    });

    const speed = document.getElementById('speed');
    speed.addEventListener('input', () => this.actions.rate(parseFloat(speed.value)));
    this.el.speed = speed;

    const dateInput = this.el.dateInput;
    dateInput.addEventListener('change', () => {
      const jd = jdFromIso(dateInput.value);
      if (jd != null) this.actions.setJd(jd, true);
      else dateInput.value = isoDate(this.jd || J2);
    });
    dateInput.addEventListener('keydown', e => { if (e.key === 'Enter') dateInput.blur(); });
  }

  setPlaying(p) {
    this.playing = p;
    const b = document.querySelector('button[data-act="play"]');
    if (b) {
      b.textContent = p ? '❚❚' : '▶';
      b.classList.toggle('on', p);
    }
  }
  setRate(value, text) {
    if (this.el.speed && parseFloat(this.el.speed.value) !== value) this.el.speed.value = String(value);
    this.el.rateRead.textContent = text;
  }
  setDirection(d) {
    const a = document.querySelector('button[data-act="back"]');
    const b = document.querySelector('button[data-act="fwd"]');
    if (a) a.classList.toggle('on', d < 0);
    if (b) b.classList.toggle('on', d > 0);
  }
  /* ── 选中 ─────────────────────────────────────────── */
  setSelected(rt) {
    this.tm = null;
    // 选中的卫星必须始终可见：否则飞到它跟前的那一两秒里它还是被 LOD 剔掉的
    if (this.world) for (const b of this.world.list) if (b.isMoon) b.isSelected = false;
    if (rt && rt.isMoon) rt.isSelected = true;
    this.selected = rt;
    this.telemetryAt = -1;   // 立即刷新一次遥测，避免出现空档
    for (const [id, l] of this.labels) l.div.classList.toggle('sel', !!rt && rt.data.id === id);
    if (this.el.insp) this.el.insp.classList.toggle('open', !!rt);
    document.body.classList.toggle('has-card', !!rt);   // 档案展开时收起右上开关，避免叠在一起
    if (this.el.reticle) this.el.reticle.style.display = rt ? 'block' : 'none';
    if (rt) this.#renderInspector(rt);
    if (this.el.catalog && this.el.catalog.classList.contains('open')) this.#syncCatalog();
  }

  #renderInspector(rt) {
    if (rt.isSat) return this.#renderSatInspector(rt);
    if (rt.isComet) return this.#renderCometInspector(rt);
    if (rt.isMinor) return this.#renderMinorInspector(rt);
    const b = rt.data;
    const typeName = { star: '恒星', planet: '行星', dwarf: '矮行星', moon: '卫星' }[b.type] || '天体';
    const parent = rt.parent ? this.world.bodies.get(rt.parent.data ? rt.parent.data.id : rt.parent) : null;
    this.el.inspHead.innerHTML = `
      <div class="inspector-swatch" style="color:${b.ui || '#cfc6b0'}"><i></i></div>
      <div class="inspector-id"><b>${b.name}</b><span>${b.en} · ${typeName}</span></div>
      <button class="inspector-close" title="关闭">✕</button>`;
    this.el.inspHead.querySelector('.inspector-close').addEventListener('click', () => this.actions.select(null));

    const rel = earthRatio(b);
    const bars = rel ? `
      <div class="bars">
        ${barRow('半径', rel.radius)}${barRow('质量', rel.mass)}${barRow('重力', rel.gravity)}
      </div>` : '';

    const isMoon = b.type === 'moon';
    const cls = isMoon ? classifyMoon(b, parent ? parent.data : null) : null;
    const staticRows = isMoon ? [
      ['半径', `${fmt(b.radiusKm, 1)}<span class="u">km</span>`],
      ['质量', `${sci(b.massKg)}<span class="u">kg</span>`],
      ['表面重力', `${fmt(b.gravity, 3)}<span class="u">m/s²</span>`],
      ['自转', '潮汐锁定（同步）'],
      ['自转周期', `与公转相同`],
      ['轨道方向', cls.retrograde ? '逆行' : '顺行'],
      ['参考面', cls.frameLabel],
      ['所属群', cls.group || '—'],
      ['母星', parent ? `${parent.data.name}<span class="u">${kmText(b.orbit.a)}</span>` : '—'],
    ] : [
      ['半径', `${fmt(b.radiusKm, b.type === 'star' ? 0 : 1)}<span class="u">km</span>`],
      ['质量', `${sci(b.massKg)}<span class="u">kg</span>`],
      ['表面重力', `${fmt(b.gravity, 2)}<span class="u">m/s²</span>`],
      ['自转周期', rotPeriod(b.rotationHours)],
      ['轴倾角', `${fmt(axialTilt(b), 2)}<span class="u">°</span>`],
      ['平均温度', b.tempLabel || `${fmt(b.tempC, 0)} °C`],
      ['天然卫星', b.id === 'sun' ? '8 大行星' : (b.satellites != null ? `${b.satellites} 颗${renderCount(this.world, b.id) ? `<span class="u"> / 页内 ${renderCount(this.world, b.id)}</span>` : ''}` : (b.id === 'mercury' || b.id === 'venus' ? '无' : '—'))],
      ...(b.id === 'earth' && this.world.satTargets
        ? [['人造卫星', `<span class="u">${this.world.satTargets.size} 个系统 / 页内绘制 ${[...this.world.satTargets.values()].reduce((s2, x) => s2 + x.data.draw, 0)} 颗</span>`]]
        : []),
    ];

    const orbitalRows = (b.type === 'planet' || b.type === 'dwarf') ? [
      ['半长轴', `${fmt(b.elements.a, 4)}<span class="u">AU</span>`],
      ['偏心率', fmt(b.elements.e, 5)],
      ['轨道倾角', `${fmt(b.elements.i, 3)}<span class="u">°</span>`],
    ] : (isMoon ? [
      ['半长轴', kmText(b.orbit.a)],
      ['偏心率', fmt(b.orbit.e, 5)],
      ['轨道倾角', `${fmt(b.orbit.inc, 3)}<span class="u">°</span>`],
      ['公转周期', periodText(b.orbit.period)],
      ['半长轴 / 母星半径', parent ? `${(b.orbit.a / parent.data.radiusKm).toFixed(1)}<span class="u">倍</span>` : '—'],
    ] : []);

    // 行星的卫星列表：每一行都可以点开，和行星本身一样有档案
    const childMoons = (!isMoon && b.type !== 'star')
      ? this.world.list.filter(x => x.isMoon && x.parent === rt).sort((a, c) => c.data.radiusKm - a.data.radiusKm)
      : [];
    // 人造卫星：地球才有，按轨道壳层列出来，点进去看该层的工程参数
    const satShells = (b.id === 'earth' && this.world.satTargets) ? [...this.world.satTargets.values()] : [];
    const satList = satShells.length ? `
      <div class="sec">人造卫星 · ${satShells.length} 个系统 / 绘制 ${satShells.reduce((s2, x) => s2 + x.data.draw, 0)} 颗</div>
      <div class="moon-list">
        ${satShells.map(x => `<div class="moon-row" data-goto="sat:${x.data.id}">
            <b>${x.data.name}</b><i>${x.data.cat}</i>
            <em>${fmt(x.data.aKm - 6371, 0)} km · ${x.data.inc.toFixed(1)}°</em>
          </div>`).join('')}
      </div>` : '';
    // 著名地点：真实经纬度，点一下飞到该点正上方
    const lms = LANDMARK_BODIES.has(b.id) ? landmarksOf(b.id) : [];
    const lmList = lms.length ? `
      <div class="sec">著名地点 · ${lms.length}</div>
      <div class="moon-list">
        ${lms.map((l, i) => `<div class="moon-row" data-lm="${i}">
            <b>${l[1]}</b><i>${l[6]}</i>
            <em>${Math.abs(l[3]).toFixed(1)}°${l[3] >= 0 ? 'N' : 'S'} ${Math.abs(l[4]).toFixed(1)}°${l[4] >= 0 ? 'E' : 'W'}</em>
          </div>`).join('')}
      </div>` : '';
    const moonList = childMoons.length ? `
      <div class="sec">卫星 · ${childMoons.length}</div>
      <div class="moon-list">
        ${childMoons.map(x => `<div class="moon-row" data-goto="${x.data.id}">
            <b>${x.data.name}</b><i>${x.data.en}</i>
            <em>${x.data.radiusKm >= 100 ? Math.round(x.data.radiusKm) : x.data.radiusKm.toFixed(1)} km</em>
          </div>`).join('')}
      </div>` : '';

    this.el.inspBody.innerHTML = `
      <div class="dossier-stat">
        <b>${fmt(b.radiusKm * 2, 0)}</b><span>${isMoon && b.radiusKm < 200 ? '平均直径 · km' : '赤道直径 · km'}</span>
      </div>
      <div class="live">
        <div class="live-title"><span class="pulse"></span>实时遥测</div>
        <dl class="kv"><dt>距太阳</dt><dd id="tmSun">—</dd></dl>
        <dl class="kv"><dt>轨道速度</dt><dd id="tmVel">—</dd></dl>
        <dl class="kv"><dt>距地球</dt><dd id="tmEarth">—</dd></dl>
        <dl class="kv"><dt>光行时</dt><dd id="tmLight">—</dd></dl>
        ${isMoon ? '<dl class="kv"><dt>距母星</dt><dd id="tmParent">—</dd></dl>' : ''}
        ${(b.type === 'planet' || b.type === 'dwarf') ? `
          <dl class="kv"><dt>真近点角</dt><dd id="tmNu">—</dd></dl>
          <dl class="kv"><dt>平近点角</dt><dd id="tmM">—</dd></dl>
          <dl class="kv"><dt>日心黄经</dt><dd id="tmLon">—</dd></dl>` : ''}
        <dl class="kv"><dt>视直径</dt><dd id="tmAng">—</dd></dl>
      </div>
      <div class="sec">物理参数</div>
      ${bars}
      ${staticRows.map(kvRow).join('')}
      ${orbitalRows.length ? `<div class="sec">轨道根数 · J2000</div>${orbitalRows.map(kvRow).join('')}` : ''}
      ${moonList}
      ${satList}
      ${lmList}
      <div class="sec">简介</div>
      <div class="desc">${b.desc || (isMoon && parent ? moonBlurb(b, parent.data) : '')}</div>
      ${(() => {
        const fs = b.facts || (isMoon && parent ? moonFacts(b, parent.data) : null);
        return fs ? `<div class="sec">要点</div><div class="facts">${fs.map(f => `<div><span>${f[0]}</span><span>${f[1]}</span></div>`).join('')}</div>` : '';
      })()}
      <div class="actions">
        <button class="btn" id="btnFollow">追踪</button>
        <button class="btn" id="btnFrame">取景</button>
        <button class="btn" id="btnOrbit">轨道</button>
      </div>
      <div id="lmDesc" style="display:none"></div>`;
    const ff = this.el.inspBody.querySelector('#btnFollow');
    const fr = this.el.inspBody.querySelector('#btnFrame');
    const ob = this.el.inspBody.querySelector('#btnOrbit');
    ff.classList.toggle('on', !!this.following);
    ff.addEventListener('click', () => this.actions.follow(!this.following));
    fr.addEventListener('click', () => this.actions.frame());
    if (ob) ob.addEventListener('click', () => this.actions.toggleOrbitFor(rt));
  }

  /**
   * 人造卫星壳层的档案
   * 这类目标没有「一颗」的概念，有价值的是这一层本身的工程参数：
   * 高度、倾角、周期、速度、类型与用途，以及它在真实世界里对应什么。
   */
  #renderSatInspector(rt) {
    const d = rt.data;
    const km = v => fmt(v, 0);
    this.el.inspHead.innerHTML = `
      <div class="inspector-swatch" style="color:#${(d.color || 0xe2e6ee).toString(16).padStart(6, '0')}"><i></i></div>
      <div class="inspector-id"><b>${d.name}</b><span>${d.en} · 人造卫星</span></div>
      <button class="inspector-close" title="关闭">✕</button>`;
    this.el.inspHead.querySelector('.inspector-close').addEventListener('click', () => this.actions.select(null));

    const aKm = d.aKm;
    const alt = aKm - 6371;
    const orbitClass = alt < 2000 ? '低地球轨道 LEO'
      : (Math.abs(alt - 35786) < 400 ? '地球静止轨道 GEO'
        : (d.apo ? '大椭圆轨道 HEO' : '中地球轨道 MEO'));
    const orbitRows = [
      ['轨道类型', orbitClass],
      ['轨道高度', d.apo ? `${km(d.alt)} × ${km(d.apo)}<span class="u">km</span>` : `${km(alt)}<span class="u">km</span>`],
      ['轨道倾角', `${d.inc.toFixed(2)}<span class="u">°</span>`],
      ['轨道周期', `${d.periodMin.toFixed(1)}<span class="u">分钟</span>`],
      ['轨道速度', `${d.speedKmS.toFixed(2)}<span class="u">km/s</span>`],
      ['偏心率', d.e.toFixed(4)],
    ];
    if (d.planes) orbitRows.push(['轨道面数', `${d.planes}<span class="u">个</span>`]);
    const sysRows = [
      ['类别', d.cat || '—'],
      ['运营方', d.owner || '—'],
      ['首次发射', `${d.year} 年`],
      ['在轨规模', `${d.real.toLocaleString('zh-CN')}<span class="u">颗</span>`],
      ['页内绘制', `${d.draw.toLocaleString('zh-CN')}<span class="u">颗</span>`],
      ['状态', d.status || '—'],
    ];
    if (d.mass) {
      sysRows.push(['典型单星质量', d.mass >= 1000
        ? `${(d.mass / 1000).toFixed(d.mass >= 10000 ? 0 : 1)}<span class="u">吨</span>`
        : `${d.mass}<span class="u">kg</span>`]);
    }
    sysRows.push(['主要用途', d.use]);
    this.el.inspBody.innerHTML = `
      <div class="dossier-stat"><b>${d.real.toLocaleString('zh-CN')}</b><span>在轨规模 · 页内绘制 ${d.draw.toLocaleString('zh-CN')} 颗</span></div>
      <div class="live">
        <div class="live-title"><span class="pulse"></span>实时遥测</div>
        <dl class="kv"><dt>距地心</dt><dd id="tmSun">—</dd></dl>
        <dl class="kv"><dt>距地表</dt><dd id="tmVel">—</dd></dl>
        <dl class="kv"><dt>日下点纬度</dt><dd id="tmNu">—</dd></dl>
      </div>
      <div class="sec">系统概况</div>
      ${sysRows.map(kvRow).join('')}
      <div class="sec">轨道参数</div>
      ${orbitRows.map(kvRow).join('')}
      <div class="sec">背景</div>
      <div class="desc">${d.note || ''}</div>
      <div class="desc" style="padding-top:8px;color:var(--text-faint);font-size:10.5px">
        表格里的高度、倾角、偏心率取实际在轨数值，周期与速度由半长轴现算
        （T = 2π√(a³/μ)，v = √(μ/a)）；「在轨规模」是真实数量，
        「页内绘制」是本页按比例抽样的数量，两者分开写。
      </div>
      <div class="actions">
        <button class="btn" id="btnFollow">追踪</button>
        <button class="btn" id="btnFrame">取景</button>
      </div>`;
    const ff = this.el.inspBody.querySelector('#btnFollow');
    const fr = this.el.inspBody.querySelector('#btnFrame');
    ff.classList.toggle('on', !!this.following);
    ff.addEventListener('click', () => this.actions.follow(!this.following));
    fr.addEventListener('click', () => this.actions.frame());
    this.tm = null;
  }

  /** 记录当前选中的地点，并把它的一段介绍显示在档案里 */
  setLandmark(bodyId, index) {
    this.landmark = bodyId == null ? null : { bodyId, index };
    const box = this.el.inspBody && this.el.inspBody.querySelector('#lmDesc');
    if (!box) return;
    const lms = bodyId ? landmarksOf(bodyId) : [];
    const lm = lms[index];
    if (!lm) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = `<div class="sec">${lm[1]} · ${lm[2]}</div>
      <div class="facts">
        <div><span>类型</span><span>${lm[6]}</span></div>
        <div><span>坐标</span><span>${Math.abs(lm[3]).toFixed(2)}°${lm[3] >= 0 ? 'N' : 'S'} ·
          ${Math.abs(lm[4]).toFixed(2)}°${lm[4] >= 0 ? 'E' : 'W'}</span></div>
        <div><span>尺度</span><span>${lm[5] >= 100 ? fmt(lm[5], 0) + ' km' : fmt(lm[5], 2) + ' km'}</span></div>
      </div>
      <div class="desc">${lm[7]}</div>`;
    for (const r of this.el.inspBody.querySelectorAll('[data-lm]')) {
      r.classList.toggle('on', Number(r.dataset.lm) === index);
    }
  }

  /** 彗星档案：类别、核直径、近日点、周期、活动强度 */
  #renderCometInspector(rt) {
    const b = rt.data;
    const o = b.orbit;
    this.el.inspHead.innerHTML = `
      <div class="inspector-swatch" style="color:${b.ui}"><i></i></div>
      <div class="inspector-id"><b>${b.name}</b><span>${b.en} · ${b.cls}</span></div>
      <button class="inspector-close" title="关闭">✕</button>`;
    this.el.inspHead.querySelector('.inspector-close').addEventListener('click', () => this.actions.select(null));
    const rows = [
      ['类别', b.cls],
      ['彗核直径', `${fmt(b.nucleusKm, b.nucleusKm < 5 ? 1 : 0)}<span class="u">km</span>`],
      ['发现年份', b.year < 0 ? `公元前 ${-b.year} 年` : `${b.year} 年`],
      ['轨道倾角', `${fmt(b.inc, 2)}<span class="u">°</span>`],
      ['轨道方向', b.inc > 90 ? '逆行（i > 90°）' : '顺行'],
      ['近日点距离', `${fmt(b.perihelionAu, 3)}<span class="u">AU</span>`],
      ['公转周期', b.hyperbolic ? '双曲轨道 · 不再回归'
        : (b.periodYr >= 1000 ? `${fmt(b.periodYr, 0)} 年` : `${fmt(b.periodYr, 2)} 年`)],
    ];
    this.el.inspBody.innerHTML = `
      <div class="dossier-stat"><b>${fmt(b.nucleusKm, b.nucleusKm < 5 ? 1 : 0)}</b><span>彗核直径 · km</span></div>
      <div class="live">
        <div class="live-title"><span class="pulse"></span>实时遥测</div>
        <dl class="kv"><dt>距太阳</dt><dd id="tmSun">—</dd></dl>
        <dl class="kv"><dt>轨道速度</dt><dd id="tmVel">—</dd></dl>
        <dl class="kv"><dt>活动强度</dt><dd id="tmEarth">—</dd></dl>
      </div>
      <div class="sec">彗星参数</div>
      ${rows.map(kvRow).join('')}
      <div class="sec">${b.hyperbolic ? '轨道参数 · 双曲' : '轨道根数 · J2000'}</div>
      ${(b.hyperbolic
        ? [['轨道类型', '双曲轨道 · 星际天体'],
           ['真实偏心率', b.realE.toFixed(4)],
           ['真实半长轴', `${b.realA.toFixed(4)}<span class="u">AU（负值表示双曲）</span>`],
           ['轨道倾角', `${b.inc.toFixed(2)}<span class="u">°</span>`]]
        : [['半长轴', `${b.orbit.a.toFixed(3)}<span class="u">AU</span>`],
           ['偏心率', b.e.toFixed(4)],
           ['轨道倾角', `${b.inc.toFixed(2)}<span class="u">°</span>`]])
        .map(kvRow).join('')}
      <div class="sec">简介</div>
      <div class="desc">${b.desc}</div>
      <div class="desc" style="padding-top:8px;color:var(--text-faint);font-size:10.5px">
        彗发与彗尾的亮度按日心距的 −2.5 次方换算，因此同一颗彗星在近日点附近会
        明显亮起来、尾巴拉长，在远日点则几乎只剩下彗核。彗尾始终背向太阳。
      </div>
      <div class="actions">
        <button class="btn" id="btnFollow">追踪</button>
        <button class="btn" id="btnFrame">取景</button>
      </div>
      <div id="lmDesc" style="display:none"></div>`;
    const ff = this.el.inspBody.querySelector('#btnFollow');
    const fr = this.el.inspBody.querySelector('#btnFrame');
    ff.classList.toggle('on', !!this.following);
    ff.addEventListener('click', () => this.actions.follow(!this.following));
    fr.addEventListener('click', () => this.actions.frame());
    this.tm = null;
  }

  /** 已命名小行星的档案：编号、族、光谱型、真实根数 */
  #renderMinorInspector(rt) {
    const b = rt.data;
    const o = b.orbit;
    this.el.inspHead.innerHTML = `
      <div class="inspector-swatch" style="color:${b.ui}"><i></i></div>
      <div class="inspector-id"><b>(${b.num}) ${b.name}</b><span>${b.en} · ${b.spectral} 型小行星</span></div>
      <button class="inspector-close" title="关闭">✕</button>`;
    this.el.inspHead.querySelector('.inspector-close').addEventListener('click', () => this.actions.select(null));
    const rows = [
      ['编号', `(${b.num})`],
      ['所属族', b.family],
      ['光谱型', `${b.spectral} 型`],
      ['发现年份', `${b.discovered} 年`],
      ['直径', `${fmt(b.diameterKm, b.diameterKm < 10 ? 2 : 1)}<span class="u">km</span>`],
      ['平均半径', `${fmt(b.radiusKm, b.radiusKm < 10 ? 2 : 1)}<span class="u">km</span>`],
      ['估算质量', `${sci(b.massKg)}<span class="u">kg</span>`],
      ['表面重力', `${sci(b.gravity)}<span class="u">m/s²</span>`],
    ];
    const orb = [
      ['半长轴', `${fmt(o.a, 4)}<span class="u">AU</span>`],
      ['偏心率', fmt(o.e, 5)],
      ['轨道倾角', `${fmt(o.inc, 2)}<span class="u">°</span>`],
      ['公转周期', periodText(o.period)],
    ];
    this.el.inspBody.innerHTML = `
      <div class="dossier-stat"><b>${fmt(b.diameterKm, 0)}</b><span>直径 · km</span></div>
      <div class="live">
        <div class="live-title"><span class="pulse"></span>实时遥测</div>
        <dl class="kv"><dt>距太阳</dt><dd id="tmSun">—</dd></dl>
        <dl class="kv"><dt>轨道速度</dt><dd id="tmVel">—</dd></dl>
        <dl class="kv"><dt>距地球</dt><dd id="tmEarth">—</dd></dl>
      </div>
      <div class="sec">天体参数</div>
      ${rows.map(kvRow).join('')}
      <div class="sec">轨道根数 · J2000</div>
      ${orb.map(kvRow).join('')}
      <div class="sec">简介</div>
      <div class="desc">${b.desc || `第 ${b.num} 号小行星，属${b.family}，光谱型 ${b.spectral}，` +
        `轨道半长轴 ${b.orbit.a.toFixed(3)} AU、偏心率 ${b.orbit.e.toFixed(4)}、` +
        `相对黄道倾角 ${b.orbit.inc.toFixed(2)}°。`}</div>
      <div class="actions">
        <button class="btn" id="btnFollow">追踪</button>
        <button class="btn" id="btnFrame">取景</button>
      </div>
      <div id="lmDesc" style="display:none"></div>`;
    const ff = this.el.inspBody.querySelector('#btnFollow');
    const fr = this.el.inspBody.querySelector('#btnFrame');
    ff.classList.toggle('on', !!this.following);
    ff.addEventListener('click', () => this.actions.follow(!this.following));
    fr.addEventListener('click', () => this.actions.frame());
    this.tm = null;
  }

  setOrbitButton(on) {
    const b = this.el.inspBody && this.el.inspBody.querySelector('#btnOrbit');
    if (b) b.classList.toggle('on', !!on);
  }

  setFollowing(on) {
    this.following = on;
    const b = this.el.inspBody && this.el.inspBody.querySelector('#btnFollow');
    if (b) b.classList.toggle('on', !!on);
  }

  /* ── 逐帧 ─────────────────────────────────────────── */
  update(state, t) {
    const { jd, camera, canvas } = state;
    this.jd = jd;

    /* 时钟：读数只到秒，5 Hz 刷新即可；写 DOM 前先比对，避免无谓的重排 */
    if (t - this.clockAt > 0.2) {
      this.clockAt = t;
      const f = formatJd(jd);
      if (f.date !== this._clockDate) { this._clockDate = f.date; this.el.date.textContent = f.date; }
      if (f.time !== this._clockTime) { this._clockTime = f.time; this.el.time.textContent = f.time; }
      const years = (jd - J2) / 365.25;
      const sub = `JD ${jd.toFixed(3)} · J2000 ${years >= 0 ? '+' : '−'}${Math.abs(years).toFixed(2)} 年`;
      if (sub !== this._clockSub) { this._clockSub = sub; this.el.sub.textContent = sub; }
      const iso = isoDate(jd);
      if (iso !== this._dateIso && this.el.dateInput && document.activeElement !== this.el.dateInput) {
        this._dateIso = iso;
        this.el.dateInput.value = iso;
      }
      // 主读数：十进制年份，参考图里那个「巨大的小数年」就是它
      const y = decimalYear(jd);
      const ys = y.toFixed(10);
      if (ys !== this._year) { this._year = ys; this.el.yearRead.textContent = ys; }
      if (this._jdStat !== f.date) { this._jdStat = f.date; if (this.el.statJd) this.el.statJd.textContent = f.date; }
    }

    /* 时间轴：窗口跟随日期自动滚动，句柄始终留在可视区内 */
    let start = this.viewCenter - this.viewSpan / 2;
    let t01 = (jd - start) / this.viewSpan;
    if (t01 > 0.88) { this.viewCenter += (t01 - 0.88) * this.viewSpan; start = this.viewCenter - this.viewSpan / 2; t01 = 0.88; }
    else if (t01 < 0.12) { this.viewCenter -= (0.12 - t01) * this.viewSpan; start = this.viewCenter - this.viewSpan / 2; t01 = 0.12; }
    this.#layoutTicks(start);
    const barPct = `${(t01 * 100).toFixed(3)}%`;
    if (barPct !== this._barPct) {
      this._barPct = barPct;
      if (this.el.handle) this.el.handle.style.left = barPct;
      if (this.el.fill) this.el.fill.style.width = barPct;
    }

    /* 标签与拾取信息 */
    this.#updateLabels(camera);

    /* 遥测（限频 6 Hz） */
    if (t - this.telemetryAt > 1 / 6) {
      this.telemetryAt = t;
      this.#updateTelemetry(state);
    }
  }

  /**
   * 刻度带
   * ------
   * 参考图底部那排密密麻麻的小竖条不是装饰：这里用真实的轨道事件填充它。
   * 每颗行星每个周期各有一次近日点与远日点（平近点角 M ≡ 0° / 180°），
   * 这些时刻可以直接从根数解出来，于是内行星密而短、外行星疏而高，
   * 整条带子自然形成疏密对比——和参考图的观感一致，但每一条都是真数据。
   */
  #layoutTicks(start) {
    const span = this.viewSpan;
    const candidates = [1, 2, 5, 7, 14, 30, 61, 91, 182.6, 365.25, 730.5, 1826.25, 3652.5, 7305, 18262.5, 36525, 73050];
    let step = candidates[candidates.length - 1];
    for (const c of candidates) { if (span / c <= 13) { step = c; break; } }

    const cv = this.el.tlCanvas;
    if (cv) {
      const rect = this.el.track.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // 只在窗口位移超过一个像素或尺寸变化时重绘，播放时不会每帧都画
      const key = `${w}x${h}|${Math.round((start - this._tlStart0 || 0) / span * w)}|${Math.round(span)}`;
      if (key !== this._tlKey || this._tlW !== w || this._tlH !== h) {
        this._tlKey = key; this._tlW = w; this._tlH = h;
        this.#drawTrack(cv, w, h, dpr, start, span, step);
      }
    }

    const nowJd = Date.now() / 86400000 + 2440587.5;
    const nowT = (nowJd - start) / span;
    if (nowT >= 0 && nowT <= 1) {
      this.el.nowMark.style.display = 'block';
      this.el.nowMark.style.left = `${nowT * 100}%`;
    } else {
      this.el.nowMark.style.display = 'none';
    }
  }

  #drawTrack(cv, w, h, dpr, start, span, step) {
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const labelY = h - 4;
    const baseY = h - 14;
    const x = jd => ((jd - start) / span) * w;

    /* 年份网格与标签 */
    const first = Math.ceil(start / step) * step;
    g.font = '8.5px ui-monospace, monospace';
    g.textBaseline = 'alphabetic';
    for (let v = first; v <= start + span; v += step) {
      const px = Math.round(x(v)) + 0.5;
      g.strokeStyle = 'rgba(232,230,224,0.07)';
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke();
      const date = dateFromJd(v);
      const y = date.getUTCFullYear();
      const label = step >= 365.25
        ? `${y}`
        : (step >= 30 ? `${y}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
          : `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
      g.fillStyle = 'rgba(150,148,140,0.85)';
      g.fillText(label, px + 3, labelY);
    }

    /* 真实轨道事件 */
    const events = this.#eventsIn(start, start + span);
    for (const e of events) {
      const px = x(e.jd);
      if (px < -2 || px > w + 2) continue;
      const tall = e.kind === 0;
      g.fillStyle = tall ? 'rgba(216,180,92,0.78)' : 'rgba(232,230,224,0.26)';
      g.fillRect(Math.round(px), baseY - e.h, 1, e.h);
    }

    /* 基线 */
    g.strokeStyle = 'rgba(232,230,224,0.1)';
    g.beginPath(); g.moveTo(0, baseY + 0.5); g.lineTo(w, baseY + 0.5); g.stroke();
    this._tlStart0 = start;
  }

  /** 取一段窗口内的近日点 / 远日点事件（带缓存与数量上限） */
  #eventsIn(start, end) {
    const key = `${Math.round(start)}|${Math.round(end)}`;
    if (this._evCache.key === key) return this._evCache.list;
    const list = [];
    const CAP = 420;
    for (const rt of this.world.list) {
      const el = rt.data.elements;
      if (!el) continue;
      const M0 = el.L - el.peri;
      const n = el.dL - el.dperi;             // 度 / 儒略世纪
      if (!n) continue;
      const period = Math.abs(360 / n) * 36525;   // 天
      const hgt = Math.max(5, Math.min(26, Math.log10(Math.max(period, 10)) * 6.0 - 6));
      const t0 = (start - J2) / 36525, t1 = (end - J2) / 36525;
      for (const [phase, kind] of [[0, 0], [180, 1]]) {
        const k0 = Math.ceil((M0 + n * t0 - phase) / 360);
        const k1 = Math.floor((M0 + n * t1 - phase) / 360);
        const count = k1 - k0 + 1;
        if (count <= 0) continue;
        const stride = Math.max(1, Math.ceil(count / CAP));
        for (let k = k0; k <= k1; k += stride) {
          list.push({ jd: J2 + ((360 * k + phase - M0) / n) * 36525, kind, h: kind === 0 ? hgt : hgt * 0.5 });
        }
      }
    }
    list.sort((a, b) => a.jd - b.jd);
    this._evCache = { key, list };
    return list;
  }

  #updateLabels(camera) {
    const w = this.world.width || window.innerWidth;
    const h = this.world.height || window.innerHeight;
    const list = this._labelList || (this._labelList = []);
    let count = 0;
    const camPos = camera.position;
    const showLabels = this.actions.getFlag('labels');
    const selectedId = this.selected ? this.selected.data.id : null;

    for (const rt of this.world.list) {
      const rec = this.labels.get(rt.data.id);
      if (!rec) continue;
      // 卫星先用世界层算好的 LOD 结果挡掉，远景下省掉一百多次投影
      if (rt.isMoon && rt.lodVisible === false) {
        if (rec.shown) {
          rec.div.style.display = 'none';
          rec.line.style.display = 'none';
          rec.shown = false; rec.leader = null;
        }
        continue;
      }
      const dist = camPos.distanceTo(rt.position);
      const s = this.world.project(rt.position, camera, rt.radiusUnits);
      let show = showLabels && s.visible;
      if (show && rt.isMoon) {
        const par = rt.parent;
        // 母星在屏幕上足够大 / 相机离得够近 / 选中的就是该系统时才标注卫星
        const parScreen = this.world.project(par.position, camera, par.radiusUnits);
        const near = camPos.distanceTo(par.position) < Math.max(par.sysOrbitR || 0, par.radiusUnits * 30) * 2.5;
        show = (near && parScreen.radius > 2.5) || selectedId === rt.data.id || selectedId === par.data.id;
      }
      if (!show) {
        if (rec.shown) {
          rec.div.style.display = 'none';
          rec.line.style.display = 'none';
          rec.shown = false; rec.leader = null;
        }
        continue;
      }
      const offset = rt.isMoon ? s.radius + 46 : s.radius + 12;
      const item = list[count] || (list[count] = {});
      item.rt = rt; item.rec = rec;
      item.x = s.x + offset; item.y = s.y;
      item.sx = s.x; item.sy = s.y;
      item.moon = rt.isMoon; item.dist = dist;
      count++;
    }
    list.length = count;

    // 纵向去重叠：按 y 排序后推开
    list.sort((a, b) => a.y - b.y);
    const placed = [];
    for (const item of list) {
      let y = item.y;
      for (const p of placed) {
        if (Math.abs(p.x - item.x) < 150 && Math.abs(p.y - y) < 15) y = p.y + 15;
      }
      item.y = y;
      placed.push(item);
    }

    // 只在数值真的变了才写样式：静止画面下几乎零 DOM 写入
    for (const item of list) {
      const { rec } = item;
      const x = Math.round(item.x * 2) / 2;
      const y = Math.round(item.y * 2) / 2;
      const sx = Math.round(item.sx * 2) / 2;
      const sy = Math.round(item.sy * 2) / 2;
      if (!rec.shown) { rec.div.style.display = 'block'; rec.shown = true; }
      if (rec.lx !== x || rec.ly !== y) {
        rec.lx = x; rec.ly = y;
        rec.div.style.transform = `translate3d(${x}px, ${y}px, 0) translateY(-50%)`;
      }
      if (item.moon) {
        if (rec.leader !== true) { rec.line.style.display = 'block'; rec.leader = true; }
        if (rec.sx !== sx || rec.sy !== sy) {
          rec.sx = sx; rec.sy = sy;
          rec.line.setAttribute('x1', sx);
          rec.line.setAttribute('y1', sy);
          rec.line.setAttribute('x2', x - 2);
        }
        if (rec.lyv !== y) { rec.lyv = y; rec.line.setAttribute('y2', y); }
      } else if (rec.leader !== false) {
        rec.line.style.display = 'none';
        rec.leader = false;
      }
    }
    this.visibleLabels = list;

    // 取景框
    if (this.selected && this.el.reticle) {
      const s = this.world.project(this.selected.position, camera);
      if (s.visible) {
        const r = Math.round(Math.max(s.radius + 8, 14));
        const rx = Math.round(s.x - r), ry = Math.round(s.y - r);
        if (this._ret !== `${rx}|${ry}|${r}`) {
          this._ret = `${rx}|${ry}|${r}`;
          const st = this.el.reticle.style;
          st.display = 'block';
          st.left = `${rx}px`;
          st.top = `${ry}px`;
          st.width = `${r * 2}px`;
          st.height = `${r * 2}px`;
        }
      } else if (this._ret !== 'none') {
        this._ret = 'none';
        this.el.reticle.style.display = 'none';
      }
    }
  }

  #updateTelemetry(state) {
    const rt = this.selected;
    if (!rt || !this.el.inspBody) return;
    if (rt.isSat) return this.#updateSatTelemetry(rt);
    if (rt.isComet) return this.#updateCometTelemetry(rt);
    if (rt.isMinor) return this.#updateMinorTelemetry(rt);
    const cache = this.tm || (this.tm = {});
    const set = (id, text) => {
      const e = cache[id] || (cache[id] = this.el.inspBody.querySelector(`#${id}`));
      if (e && e.__v !== text) { e.__v = text; e.innerHTML = text; }
    };
    const p = rt.position;
    const sunAu = rt.sunDistanceAu != null ? rt.sunDistanceAu : Math.hypot(p.x, p.y, p.z) / auToUnits(1);
    set('tmSun', `${fmt(sunAu, 4)}<span class="u">AU</span>`);
    set('tmVel', rt.speedKmS != null ? `${kms(rt.speedKmS)}<span class="u">km/s</span>` : '—');

    const earth = this.world.bodies.get('earth');
    const isEarthMoon = rt.isMoon && rt.data.parent === 'earth';
    if (rt === earth) {
      set('tmEarth', '<span class="u">本星</span>');
    } else if (isEarthMoon) {
      set('tmEarth', `${fmt(rt.parentDistanceKm || 0, 0)}<span class="u">km</span>`);
    } else {
      set('tmEarth', `${fmt(helioDistanceAu(rt, earth), 4)}<span class="u">AU</span>`);
    }
    if (rt === earth) set('tmLight', '<span class="u">—</span>');
    else {
      const dAu = isEarthMoon ? (rt.parentDistanceKm || 0) / AU_KM : helioDistanceAu(rt, earth);
      set('tmLight', lightTime(dAu * AU_KM / C_KM_S));
    }
    if (rt.isMoon) set('tmParent', `${fmt(rt.parentDistanceKm || 0, 0)}<span class="u">km</span>`);
    if (rt.state) {
      set('tmNu', `${fmt(((rt.state.nu * 180 / Math.PI) % 360 + 360) % 360, 2)}<span class="u">°</span>`);
      set('tmM', `${fmt(((rt.state.M * 180 / Math.PI) % 360 + 360) % 360, 2)}<span class="u">°</span>`);
      set('tmLon', `${fmt((rt.state.lon % 360 + 360) % 360, 2)}<span class="u">°</span>`);
    }
    // 视直径：把相机位置也换算回真实日心坐标，避免非线性尺度带来的误差
    const camAu = sceneToAu(state.camera.position);
    const bodyAu = rt.helioAu;
    if (camAu && bodyAu) {
      const realKm = Math.hypot(
        (camAu.x - bodyAu.x), (camAu.y - bodyAu.y), (camAu.z - bodyAu.z),
      ) * AU_KM;
      const deg = 2 * Math.atan(rt.radiusKm / Math.max(realKm, 1)) * 180 / Math.PI;
      set('tmAng', `${fmt(deg, 3)}<span class="u">°</span>`);
    }
  }

  /** 人造卫星壳层的实时遥测：先算卫星此刻的地心位置，再换算成高度与纬度 */
  #updateSatTelemetry(rt) {
    const cache = this.tm || (this.tm = {});
    const set = (id, text) => {
      const e = cache[id] || (cache[id] = this.el.inspBody.querySelector(`#${id}`));
      if (e && e.__v !== text) { e.__v = text; e.innerHTML = text; }
    };
    const L = this.world.populations.layers.get('sats');
    const d = rt.data;
    if (!L) {
      set('tmSun', '—'); set('tmVel', '—'); set('tmNu', '—');
      return;
    }
    // 找出这一层的第一颗卫星，读到它此刻在母星坐标系里的位置
    const k = L.shellOf ? L.shellOf.findIndex(sh => sh && sh.id === d.id) : -1;
    if (k >= 0) {
      const arr = L.geom.attributes.position.array;
      const x = arr[k * 3], y = arr[k * 3 + 1], z = arr[k * 3 + 2];
      const rUnits = Math.hypot(x, y, z);
      const rKm = rUnits / KM_UNITS;
      set('tmSun', `${fmt(rKm, 0)}<span class="u">km</span>`);
      set('tmVel', `${fmt(Math.max(0, rKm - 6371), 0)}<span class="u">km</span>`);
      // 几何挂在姿态节点下，y 就是该层相对赤道面的纬度方向
      const lat = Math.asin(Math.max(-1, Math.min(1, y / Math.max(rUnits, 1e-12)))) * 180 / Math.PI;
      set('tmNu', `${fmt(lat, 2)}<span class="u">°</span>`);
    } else {
      set('tmSun', '—'); set('tmVel', '—'); set('tmNu', '—');
    }
  }

  /** 已命名小行星的实时遥测：日心距、轨道速度、与地球的距离 */
  #updateMinorTelemetry(rt) {
    const cache = this.tm || (this.tm = {});
    const set = (id, text) => {
      const e = cache[id] || (cache[id] = this.el.inspBody.querySelector(`#${id}`));
      if (e && e.__v !== text) { e.__v = text; e.innerHTML = text; }
    };
    const p = rt.position;
    const rAu = unitsToAu(Math.hypot(p.x, p.y, p.z));
    set('tmSun', `${fmt(rAu, 4)}<span class="u">AU</span>`);
    // 活力公式 v = √(μ(2/r − 1/a))
    const v = Math.sqrt(1.32712440018e20 * (2 / (rAu * 1.495978707e11) - 1 / (rt.data.orbit.a * 1.495978707e11))) / 1000;
    set('tmVel', `${fmt(v, 2)}<span class="u">km/s</span>`);
    const earth = this.world.bodies.get('earth');
    if (earth) {
      set('tmEarth', `${fmt(Math.hypot(p.x - earth.position.x, p.y - earth.position.y, p.z - earth.position.z) / auToUnits(1), 4)}<span class="u">AU</span>`);
    }
    const box = this.el.inspBody && this.el.inspBody.querySelector('#lmDesc');
    if (box) { box.style.display = 'none'; }
  }

  /** 彗星的实时遥测：日心距、轨道速度、当前活动强度 */
  #updateCometTelemetry(rt) {
    const cache = this.tm || (this.tm = {});
    const set = (id, text) => {
      const e = cache[id] || (cache[id] = this.el.inspBody.querySelector(`#${id}`));
      if (e && e.__v !== text) { e.__v = text; e.innerHTML = text; }
    };
    const p = rt.position;
    const rAu = unitsToAu(Math.hypot(p.x, p.y, p.z));
    set('tmSun', `${fmt(rAu, 4)}<span class="u">AU</span>`);
    const aAu = rt.data.orbit.a;
    const v = Math.sqrt(1.32712440018e20 * (2 / (rAu * 1.495978707e11) - 1 / (aAu * 1.495978707e11))) / 1000;
    set('tmVel', `${fmt(v, 2)}<span class="u">km/s</span>`);
    const act = Math.min(1.4, Math.pow(1.2 / Math.max(rAu, 0.08), 2.5));
    const pct = Math.round(Math.min(1, act / 1.4) * 100);
    set('tmEarth', `${pct}<span class="u">% ${pct > 60 ? '（活跃）' : pct > 15 ? '（微弱）' : '（近乎静止）'}</span>`);
  }

  /** 火箭视角的速度读数：滚轮每动一下都会刷新 */
  setFlySpeed(exp, cur) {
    if (!this.el.hint) return;
    const v = Math.pow(10, exp);
    const txt = `${v >= 1000 ? v.toExponential(1) : v.toFixed(v < 1 ? 4 : 2)} 单位/秒`;
    this.el.hint.textContent = `WASD 飞行 · 空格升 / Shift 降 · 拖拽自由观察 · 滚轮调速（当前 ${txt}）`;
    this.el.hint.classList.remove('hide');
  }

  setFps(v) { if (this.el.fps) this.el.fps.textContent = `${v} FPS`; }
}

/* ── 小工具 ───────────────────────────────────────────── */
/** 十进制年份：2026.7479… 这种写法在档案图里一眼能读出「年内进度」 */
function decimalYear(jd) {
  const d = dateFromJd(jd);
  const y = d.getUTCFullYear();
  const a = Date.UTC(y, 0, 1) / 86400000 + 2440587.5;
  const b = Date.UTC(y + 1, 0, 1) / 86400000 + 2440587.5;
  return y + (jd - a) / (b - a);
}
function renderCount(world, id) {
  return world.list.filter(x => x.isMoon && x.data.parent === id).length;
}
function kvRow([k, v]) { return `<dl class="kv"><dt>${k}</dt><dd>${v}</dd></dl>`; }
function barRow(name, ratio) {
  const pct = Math.max(1.5, Math.min(100, Math.log10(Math.max(ratio, 1e-4)) * 25 + 50));
  return `<div class="bar-row"><span>${name}</span><i style="width:${pct}%"></i><b>${ratio >= 1 ? ratio.toFixed(2) : ratio.toFixed(3)}×</b></div>`;
}
function earthRatio(b) {
  if (b.id === 'earth') return null;
  return { radius: b.radiusKm / 6371, mass: b.massKg / 5.97237e24, gravity: b.gravity / 9.807 };
}
/** 与地球的真实距离（AU）：用日心坐标计算，避免尺度映射误差 */
function helioDistanceAu(rt, earth) {
  const a = rt.helioAu;
  if (!a || !earth || !earth.helioAu) return 0;
  return Math.hypot(a.x - earth.helioAu.x, a.y - earth.helioAu.y, a.z - earth.helioAu.z);
}
/** 场景坐标 → 日心黄道坐标（AU）：保持方向，只反解径向映射 */
function sceneToAu(v) {
  const u = Math.hypot(v.x, v.y, v.z);
  if (u < 1e-6) return { x: 0, y: 0, z: 0 };
  const rAu = unitsToAu(u);
  const k = rAu / u;
  return { x: v.x * k, y: -v.z * k, z: v.y * k };
}
