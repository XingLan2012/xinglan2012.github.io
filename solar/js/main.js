/**
 * 太阳系 · 主程序
 * ----------------
 * 启动顺序：渲染器 → 贴图 → 行星 → 卫星（分帧）→ HUD → 主循环
 * 时间模型：儒略日驱动的真实轨道解算，时间轴可任意拖动 / 变速 / 倒放
 */

import * as THREE from 'three';
import { createScene } from './scene.js';
import { World } from './world.js';
import { Hud } from './ui.js';
import { loadTextures, setAnisotropy } from './textures.js';
import { jdFromDate, formatJd } from './astronomy.js';
import * as S from './scale.js';
import { landmarksOf } from './landmarks.js';

const NOW_JD = jdFromDate(new Date());
const MIN_JD = jdFromDate(new Date(Date.UTC(1700, 0, 1)));
const MAX_JD = jdFromDate(new Date(Date.UTC(2200, 0, 1)));

const state = {
  jd: NOW_JD,
  playing: true,
  direction: 1,
  rate: 1 / 86400,     // 天 / 秒 —— 默认就是实时：1 秒 = 1 秒
  follow: true,
  rocketView: false,   // 火箭自由飞行视角
  immersive: false,    // 沉浸模式：隐藏全部界面
  flySpeedExp: -2.2,   // 10^x 场景单位/秒，滚轮调节
  adaptive: true,      // 帧率过低时自动降低渲染分辨率
  flags: {
    labels: true, orbits: true, moonOrbits: true, realSize: true, realDist: true,
    belt: true, kuiper: true, oort: true, sats: true, satOrbits: true,
  },
};

const canvas = document.getElementById('stage');
let scene3, world, hud, renderer, camera, controls;
let lastTime = 0, fpsAcc = 0, fpsFrames = 0, fpsAt = 0, elapsed = 0;
let tween = null;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const tmp3 = new THREE.Vector3();
/** 取景相位角：既保证目标大面积受光，又留出可见的晨昏线 */
const FRAME_PHASE = 42 * Math.PI / 180;
const YAXIS = new THREE.Vector3(0, 1, 0);

boot().catch(err => {
  console.error(err);
  if (hud) hud.fail(String(err && err.message ? err.message : err));
  else {
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = '初始化失败：' + err;
    document.body.appendChild(d);
  }
});

window.addEventListener('error', e => {
  console.error('[solar]', e.message);
  if (!window.__solar) showFatal(e.message);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[solar]', e.reason);
  if (!window.__solar) showFatal(String(e.reason));
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  showFatal('WebGL 上下文丢失，请刷新页面。');
});

function showFatal(message) {
  const d = document.createElement('div');
  d.className = 'err';
  d.textContent = '运行中断：' + message;
  document.body.appendChild(d);
}

async function boot() {
  let bootHud = {
    stage: document.getElementById('bootStage'),
    bar: document.getElementById('bootBar'),
    pct: document.getElementById('bootPct'),
    set(stage, p) {
      if (this.stage) this.stage.textContent = stage;
      if (this.bar) this.bar.style.width = `${Math.round(p * 100)}%`;
      if (this.pct) this.pct.textContent = `${Math.round(p * 100)}%`;
    },
  };

  bootHud.set('创建渲染上下文', 0.02);
  scene3 = createScene(canvas);
  renderer = scene3.renderer;
  camera = scene3.camera;
  controls = scene3.controls;
  setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  bootHud.set('载入行星贴图', 0.05);
  await loadTextures((done, total) => bootHud.set(`载入贴图 ${done}/${total}`, 0.05 + 0.32 * (done / total)));

  world = new World(scene3.scene, camera);
  world.currentJd = state.jd;
  world.build((stage, p) => bootHud.set(stage, p));

  bootHud.set('生成卫星表面', 0.4);
  await world.buildMoons((stage, p) => bootHud.set(stage, p));

  world.applyScale();
  world.update(state.jd, 0);
  hud = new Hud(world, actions);
  hud.setPlaying(state.playing);
  hud.setRate(rateToSlider(state.rate), rateText(state.rate));
  hud.setDirection(1);
  for (const k of Object.keys(state.flags)) hud.setFlagButton(k, state.flags[k]);
  for (const k of ['belt', 'kuiper', 'oort', 'sats']) {
    world.populations.setVisible(k, state.flags[k]);
  }
  world.populations.setRings(state.flags.satOrbits);
  updateOrbitVisibility();
  hud.boot('', 1);
  hud.bootDone();

  bindGlobalEvents();
  // 开场：俯瞰内太阳系（真实比例尺下太阳是一颗亮星，轨道线是主要线索）
  camera.position.set(0, 175, 350);
  controls.target.set(0, 0, 0);
  controls.update();
  hud.setView('inner');

  // 便于调试与控制台自检
  window.__solar = { state, world, hud, actions, scene: scene3, camera, renderer, controls, params: S.params, ready: true };
  requestAnimationFrame(loop);
}

/* ── 主循环 ───────────────────────────────────────────── */
function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;
  let dt = lastTime ? Math.min(t - lastTime, 0.1) : 0.016;
  lastTime = t;
  // 标签页不可见时彻底停摆（浏览器本就会停 rAF，这里兜住后台标签被节流的情况）
  if (document.hidden) return;
  elapsed += dt;

  if (state.playing && dt > 0) {
    state.jd += dt * state.rate * state.direction;
    if (state.jd < MIN_JD) { state.jd = MIN_JD; state.direction = 1; hud.setDirection(1); }
    if (state.jd > MAX_JD) { state.jd = MAX_JD; state.direction = -1; hud.setDirection(-1); }
  }

  if (scaleAnim) advanceScaleAnim(dt);
  world.update(state.jd, elapsed);          // 位置 / 自转 / 轨道线
  updateCamera(dt);
  if (scaleAnim && hud.selected && !tween) refitCamera(hud.selected);
  if (!state.rocketView) controls.update(); // 相机最终就位（火箭视角下由跟拍接管）
  world.updateShading();                    // 用本帧相机矩阵更新光照相关 uniform
  updateSunScreen();                        // 太阳的屏幕位置：体积光沿它拉伸
  updateOrbitVisibility();
  hud.update({ jd: state.jd, camera, canvas }, t);
  // 沉浸读数限到 8 Hz：它只是给人看的数字，没必要逐帧拼字符串
  if (state.immersive && t - immerseAt > 0.125) { immerseAt = t; updateImmerseHud(); }
  scene3.render();

  fpsAcc += dt; fpsFrames++;
  if (t - fpsAt > 0.6 && fpsAcc > 0) {
    const fps = Math.round(fpsFrames / fpsAcc);
    hud.setFps(fps);
    fpsAcc = 0; fpsFrames = 0; fpsAt = t;
    adaptQuality(fps, t);
  }
}

/**
 * 轨道线可见性
 * 行星轨道线跟随总开关；卫星轨道线只在「近距离看得到母星」或「选中的就是该系统」时出现，
 * 否则每个行星周围都挂着一圈细线，缩放时既杂乱又看不出层级。
 * 参数面板里的「轨道」按钮对当前选中的天体做一次性覆盖。
 */
let orbitManual = null;
let lastSelOrbitShown = null;
function updateOrbitVisibility() {
  const onPlanet = state.flags.orbits;
  const onMoon = state.flags.moonOrbits;
  const sel = hud.selected;
  const cam = camera.position;
  for (const rt of world.list) {
    if (!rt.orbitLine) continue;
    let show;
    if (rt.isMoon) {
      // 卫星轨道：总开关 + （相机离母星够近 或 选中的就是这个系统）
      show = onMoon;
      if (show) {
        const p = rt.parent;
        const near = cam.distanceTo(p.position) < Math.max(p.sysOrbitR || 0, p.radiusUnits * 30) * 2.5;
        show = near || !!(sel && (sel === rt || sel === p));
      }
    } else {
      show = onPlanet;
    }
    if (orbitManual !== null && sel && rt.data.id === sel.data.id) show = orbitManual;
    rt.orbitLine.visible = show;
  }
  // 只在状态真的翻转时才碰 DOM
  const shown = sel && sel.orbitLine ? sel.orbitLine.visible : null;
  if (shown !== lastSelOrbitShown) {
    lastSelOrbitShown = shown;
    if (sel) hud.setOrbitButton(shown);
  }
}

/**
 * 自适应画质：连续低帧率就把渲染分辨率降下来（对移动端与集显很关键），
 * 帧率恢复后再慢慢升回去。只动分辨率，不动画面构成。
 */
let lowStreak = 0, highStreak = 0, qualityCooldown = 0;
function adaptQuality(fps, t) {
  if (!state.adaptive || t < qualityCooldown) return;
  if (fps < 28) { lowStreak++; highStreak = 0; }
  else if (fps > 55) { highStreak++; lowStreak = 0; }
  else { lowStreak = 0; highStreak = 0; return; }
  const cur = scene3.pixelRatio;
  if (lowStreak >= 3 && cur > 0.65) {
    scene3.setPixelRatio(cur * 0.75);
    lowStreak = 0;
    qualityCooldown = t + 4;
  } else if (highStreak >= 10 && cur < scene3.maxPixelRatio - 0.01) {
    scene3.setPixelRatio(Math.min(scene3.maxPixelRatio, cur * 1.34));
    highStreak = 0;
    qualityCooldown = t + 8;
  }
}

/* ── 火箭自由飞行 ─────────────────────────────────────
   WASD 前后左右 · 空格上升 / Shift 下降 · 拖拽鼠标自由观察 · 滚轮调飞行速度 */
const keys = new Set();
const flyCam = { yaw: 0, pitch: -0.22, dist: 1, dragging: false };
let flySpeedShown = null;

function flyDir() {
  // 由环绕角得到「视线方向」
  return new THREE.Vector3(
    Math.sin(flyCam.yaw) * Math.cos(flyCam.pitch),
    Math.sin(flyCam.pitch),
    Math.cos(flyCam.yaw) * Math.cos(flyCam.pitch),
  ).normalize();
}

function updateFly(dt) {
  const rs = world.rocketState();
  if (!rs) return;
  const dir = flyDir();
  const speed = Math.pow(10, state.flySpeedExp);
  const move = { f: 0, s: 0, u: 0 };
  if (keys.has('KeyW')) move.f += 1;
  if (keys.has('KeyS')) move.f -= 1;
  if (keys.has('KeyA')) move.s -= 1;
  if (keys.has('KeyD')) move.s += 1;
  if (keys.has('Space')) move.u += 1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) move.u -= 1;
  world.flyRocket(dt, move, dir, YAXIS, speed);
  const st = world.rocketState();
  // 相机吊在火箭后方：距离由滚轮控制，方向由鼠标拖拽控制
  camera.position.copy(st.pos).addScaledVector(dir, -flyCam.dist).addScaledVector(YAXIS, flyCam.dist * 0.16);
  tmp.copy(st.pos);
  camera.lookAt(tmp);
  controls.target.copy(tmp);
  if (flySpeedShown !== state.flySpeedExp) {
    flySpeedShown = state.flySpeedExp;
    hud.setFlySpeed(state.flySpeedExp, st.speed);
  }
}

let immerseAt = -1;
let followPrev = new THREE.Vector3();
let followId = null;
/** 视角预设之间的过渡（内景 ↔ 全览），与天体取景互斥 */
let viewTween = null;
function updateCamera(dt) {
  /* 火箭视角：相机吊在火箭后上方，视线顺着飞行方向。
     由它接管相机，因此这一帧不再跑常规的跟随与取景逻辑。 */
  if (state.rocketView) { updateFly(dt); return; }
  const sel = hud.selected;
  if (viewTween) {
    viewTween.t = Math.min(1, viewTween.t + dt / viewTween.dur);
    const k = easeInOut(viewTween.t);
    camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, k);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, k);
    if (viewTween.t >= 1) viewTween = null;
  } else if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const k = easeInOut(tween.t);
    const body = tween.rt;
    tmp.copy(body.position).add(tween.offset);
    camera.position.lerpVectors(tween.fromPos, tmp, k);
    controls.target.lerpVectors(tween.fromTarget, body.position, k);
    if (tween.t >= 1) {
      if (tween.follow) setFollow(true, body);
      tween = null;
    }
  } else if (state.follow && sel) {
    if (followId === followKey(sel)) {
      tmp.subVectors(sel.position, followPrev);
      camera.position.add(tmp);
      controls.target.copy(sel.position);
    } else {
      setFollow(true, sel);
    }
  }
  followPrev.copy(sel ? sel.position : controls.target);
  followId = sel ? followKey(sel) : null;

  // 近裁面在 1e-8，所以最小距离可以贴着天体表面，不必留 1.2e-6 的余量
  controls.minDistance = (sel && !sel.isSat) ? Math.max(sel.radiusUnits * 1.06, 1e-8) : 1e-8;
  controls.maxDistance = 300000;
}

function setFollow(on, body) {
  state.follow = on;
  hud.setFollowing(on);
  if (on && body) {
    followPrev.copy(body.position);
    followId = followKey(body);
  }
}

/** 太阳的屏幕位置（0..1），供体积光沿视线方向采样 */
function updateSunScreen() {
  const g = scene3.godRay;
  if (!g) return;
  const p = world.bodies.get('sun');
  if (!p) return;
  tmp.copy(p.position).project(camera);
  const u = g.uniforms.uSun.value;
  u.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
  // 太阳在画面外时削弱体积光，避免出现从边缘硬拉进来的光轴
  const edge = Math.max(Math.abs(tmp.x), Math.abs(tmp.y));
  g.uniforms.uStrength.value = edge > 1.25 ? 0.22 : 0.62;
  /* 太阳不在画面内、或在画面上只有几个像素时直接停掉这一级后处理。
     实测默认视距下它的贡献恰好为 0——日面够不到阈值、一个像素都不参与累加，
     那就没必要每帧白跑一次全屏 28 次采样。 */
  const proj = world.project(p.position, camera, p.radiusUnits);
  g.enabled = proj.visible && proj.radius >= 3;
}

/** 沉浸模式下的极简读数：追踪目标 + 与相机的实时距离 */
function updateImmerseHud() {
  const el = hud.el.ihName;
  if (!el) return;
  const rt = hud.selected;
  if (!rt) {
    hud.setImmerseHud('未锁定目标', '在目录里选一个天体后按 F1');
    return;
  }
  const d = camera.position.distanceTo(rt.position);
  const km = d / S.KM_UNITS;
  const fmtKm = km >= 1e8 ? `${(km / S.AU_KM).toFixed(3)} AU`
    : (km >= 1e6 ? `${(km / 1e6).toFixed(2)} 百万 km` : `${Math.round(km).toLocaleString('zh-CN')} km`);
  hud.setImmerseHud(`${rt.data.name} ${rt.data.en || ''}`.trim(),
    `${state.follow ? '追踪中' : '未追踪'} · 距离 ${fmtKm} · 视半径 ${fmt(rt.radiusKm * 2, 0)} km`);
}

function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/** 跟随目标的唯一标识：人造卫星壳层用 sat: 前缀，避免和天体 id 撞车 */
function followKey(rt) { return (rt.isSat || rt.isMinor) ? `x:${rt.data.id}` : rt.data.id; }

function flyTo(pos, target, dur = 1.2) {
  viewTween = {
    t: 0, dur,
    fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
    toPos: pos.clone(), toTarget: target.clone(),
  };
}

/**
 * 取景距离
 * 视角半高 = dist·tan(fov/2)，所以「刚好装下 x 单位」对应 dist = x / tan(fov/2)。
 * 行星除本体特写外，还要把主要卫星系纳入画面，
 * 但上限 14 倍行星半径，保证行星本身不会缩成小点。
 */
function framingDistance(rt, cap) {
  const tan = Math.tan(camera.fov * Math.PI / 360);
  if (rt.isSat) return rt.radiusUnits / tan * 2.4;      // 整层轨道刚好进画面
  if (rt.isMinor) return rt.radiusUnits / tan * 3.0;    // 小行星 / 彗核：本体进画面
  let dist = rt.radiusUnits / tan * (rt.isMoon ? 3.2 : 2.6);
  if (rt.data.rings) {
    const outer = (rt.data.rings.outerKm / rt.radiusKm) * rt.radiusUnits;
    dist = Math.max(dist, outer / tan * 1.5);
  }
  if (rt.isSun) return rt.radiusUnits * 4.5;
  let maxOrbit = 0;
  for (const m of world.list) {
    if (m.parent !== rt) continue;
    maxOrbit = Math.max(maxOrbit, Math.abs(m.orbitScale) * m.data.orbit.a);
  }
  if (maxOrbit > 0) dist = Math.max(dist, Math.min(maxOrbit * 1.25, rt.radiusUnits * 14) / tan);
  if (cap) dist = Math.min(dist, cap);
  return dist;
}

/** 尺度过渡中让相机跟随目标同步推拉，避免切到真实比例尺后目标变成亚像素点 */
function refitCamera(rt) {
  const want = framingDistance(rt);
  tmp.subVectors(camera.position, rt.position);
  const cur = tmp.length();
  if (!(cur > 1e-12)) return;
  tmp.multiplyScalar(want / cur);
  camera.position.copy(rt.position).add(tmp);
  controls.target.copy(rt.position);
}

/**
 * 取景方向
 * 不再「朝太阳方向插值」——插值强度不够时相机会停在晨昏线附近甚至夜面，
 * 目标就成了一个黑球。这里直接构造：以「天体→太阳」为轴，绕到固定相位角
 * 的侧上方，侧向由当前相机方位决定，因此视角自然、且永远受光。
 */
function frameDirection(rt) {
  const prev = tmp2.subVectors(camera.position, controls.target);
  if (prev.lengthSq() < 1e-12) prev.set(0.35, 0.4, 1);
  if (rt.isSun) return prev.normalize();
  const toSun = tmp.subVectors(world.bodies.get('sun').position, rt.position).normalize();
  const side = tmp3.copy(prev).addScaledVector(toSun, -prev.dot(toSun));   // 垂直于日向的分量
  if (side.lengthSq() < 1e-12) side.crossVectors(YAXIS, toSun);
  if (side.lengthSq() < 1e-12) side.set(0, 1, 0);
  side.normalize();
  return prev.copy(toSun).multiplyScalar(Math.cos(FRAME_PHASE))
    .addScaledVector(side, Math.sin(FRAME_PHASE))
    .addScaledVector(YAXIS, 0.28)
    .normalize();
}

function frameBody(rt, instant = false, cap = 0) {
  if (!rt) return;
  const dist = framingDistance(rt, cap);
  tmp2.copy(frameDirection(rt));
  tmp2.y = Math.max(tmp2.y, 0.22);
  tmp2.normalize().multiplyScalar(dist);
  if (instant) {
    camera.position.copy(rt.position).add(tmp2);
    controls.target.copy(rt.position);
    setFollow(state.follow, rt);
    return;
  }
  tween = {
    t: 0, dur: 1.05, rt, offset: tmp2.clone(),
    fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
    follow: true,
  };
}

/* ── 交互 ─────────────────────────────────────────────── */
function pickAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left, py = clientY - rect.top;
  let best = null, bestScore = Infinity;
  for (const rt of world.list) {
    const s = world.project(rt.position, camera);
    if (!s.visible) continue;
    const d = Math.hypot(s.x - px, s.y - py);
    const tol = Math.max(s.radius + 14, rt.isMoon ? 18 : 24);
    if (d > tol) continue;
    let score = d - Math.min(s.radius, 18) * 0.6;
    if (rt.isMoon) score *= 1.3;
    if (score < bestScore) { bestScore = score; best = rt; }
  }
  return best;
}

function bindGlobalEvents() {
  const resize = () => {
    scene3.resize();
    world.width = canvas.clientWidth;
    world.height = canvas.clientHeight;
  };
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  let down = null;
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dur = performance.now() - down.t;
    down = null;
    if (moved > 6 || dur > 500) return;
    const rt = pickAt(e.clientX, e.clientY);
    actions.select(rt ? rt.data.id : null, !!rt);
  });
  canvas.addEventListener('dblclick', e => {
    const rt = pickAt(e.clientX, e.clientY);
    if (rt) actions.select(rt.data.id, true);
  });

  window.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); actions.play(!state.playing); break;
      case 'ArrowRight': actions.step(state.direction * 1); break;
      case 'ArrowLeft': actions.step(-state.direction * 1); break;
      case 'Equal': case 'NumpadAdd': actions.rate(state.rate * 1.6); break;
      case 'Minus': case 'NumpadSubtract': actions.rate(state.rate / 1.6); break;
      case 'KeyN': actions.now(); break;
      case 'KeyW': case 'KeyA': case 'KeyS': case 'KeyD': case 'Space': case 'ShiftLeft': case 'ShiftRight':
        if (state.rocketView) { keys.add(e.code); e.preventDefault(); }
        break;
      case 'Slash': if (hud._focusSearch) { e.preventDefault(); hud._focusSearch(); } break;
      case 'KeyK': if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (hud._focusSearch) hud._focusSearch(); } break;
      case 'KeyC': hud.toggleCatalog(); break;
      case 'KeyL': actions.toggle('labels', !state.flags.labels); break;
      case 'KeyO': actions.toggle('orbits', !state.flags.orbits); break;
      case 'KeyR': actions.toggle('realDist', !state.flags.realDist); break;
      case 'KeyF': actions.follow(!state.follow); break;
      case 'F1':
        e.preventDefault();
        actions.toggleImmersive();
        break;
      case 'Escape':
        if (state.immersive) actions.toggleImmersive(false);
        else if (hud.el.catalog && hud.el.catalog.classList.contains('open')) hud.toggleCatalog(false);
        else actions.select(null);
        break;
      default: break;
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  /* 火箭视角下的鼠标与滚轮：拖拽自由观察、滚轮调飞行速度 */
  canvas.addEventListener('pointerdown', e => {
    if (!state.rocketView) return;
    flyCam.dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', e => {
    flyCam.dragging = false;
    if (state.rocketView) { try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
  });
  canvas.addEventListener('pointermove', e => {
    if (!state.rocketView || !flyCam.dragging) return;
    flyCam.yaw -= e.movementX * 0.0042;
    flyCam.pitch = Math.max(-1.45, Math.min(1.45, flyCam.pitch - e.movementY * 0.0042));
  }, { passive: true });
  canvas.addEventListener('wheel', e => {
    if (!state.rocketView) return;
    e.preventDefault();
    e.stopPropagation();
    state.flySpeedExp = Math.max(-6, Math.min(3.4, state.flySpeedExp - e.deltaY * 0.0016));
    flySpeedShown = null;
  }, { passive: false, capture: true });

  document.addEventListener('visibilitychange', () => { lastTime = 0; });
}

/* ── 动作 ─────────────────────────────────────────────── */
const actions = {
  select(id, frame) {
    const rt = id ? (world.bodies.get(id) || world.satTargets.get(id)
      || world.minorTargets.get(id) || world.cometTargets.get(id)) : null;
    orbitManual = null;                     // 换目标即恢复默认规则
    lastSelOrbitShown = null;               // 面板被重建，按钮状态必须重写一次
    hud.setSelected(rt);
    updateOrbitVisibility();
    if (rt) {
      if (frame) frameBody(rt);
      else if (state.follow) setFollow(true, rt);
    } else {
      setFollow(false, null);
    }
  },
  frame() { if (hud.selected) frameBody(hud.selected); },
  /** 追踪当前选中的天体（行星或恒星都行）：时间推进时相机始终咬住它 */
  track(id) {
    const rt = id ? (world.bodies.get(id) || world.satTargets.get(id)
      || world.minorTargets.get(id) || world.cometTargets.get(id)) : hud.selected;
    if (!rt) return false;
    if (hud.selected !== rt) hud.setSelected(rt);
    setFollow(true, rt);
    frameBody(rt);
    return true;
  },
  untrack() { setFollow(false, null); },
  toggleImmersive(force) {
    state.immersive = force === undefined ? !state.immersive : !!force;
    document.body.classList.toggle('immersive', state.immersive);
    if (hud.setImmersive) hud.setImmersive(state.immersive);
    return state.immersive;
  },
  /**
   * 飞到某个著名地点
   * 标记挂在天体的 mesh 上随自转走，所以这里先把标记摆好、再取它此刻的世界坐标，
   * 然后把镜头推到该点正上方。
   */
  focusLandmark(bodyId, index) {
    const rt = world.bodies.get(bodyId);
    const list = landmarksOf(bodyId);
    const lm = list[index];
    if (!rt || !lm) return;
    tween = null;
    world.showLandmark(rt, lm);
    if (hud.selected !== rt) hud.setSelected(rt);
    hud.setLandmark(bodyId, index);
    const wp = world.landmarkWorldPosition();
    if (!wp) return;
    const n = tmp.subVectors(wp, rt.position).normalize().clone();
    const dist = rt.radiusUnits * 2.1;
    flyTo(wp.clone().addScaledVector(n, dist), wp.clone(), 1.2);
    setFollow(false, null);
  },
  /**
   * 放置一颗自定义行星
   * 直接把条目推进数据表，因此它和内置行星共享全部管线；
   * 不回写任何存储，刷新页面即消失。
   */
  placePlanet(spec) {
    const n = (world.list.filter(b => b.isCustom).length + 1);
    const TYPE = {
      rocky: { color: '#5aa9ff', glow: '#7cc0ff', density: 5500 },
      gas: { color: '#e0b98a', glow: '#f0cfa0', density: 1300 },
      ice: { color: '#8fd8e8', glow: '#a8e4f0', density: 1700 },
      dwarf: { color: '#9a948c', glow: '#b0a99f', density: 2000 },
    };
    const T = TYPE[spec.type] || TYPE.rocky;
    const radiusKm = Math.max(1, spec.radiusKm);
    const mass = (4 / 3) * Math.PI * Math.pow(radiusKm * 1000, 3) * T.density;
    const id = `custom-${Date.now().toString(36)}-${n}`;
    const a = spec.aAu;
    const e = Math.min(0.93, Math.max(0, spec.e));
    // 初始真近点角放在近日点，于是「初始速度」就是活力公式算出的近日点速度
    const data = {
      id, name: `自定义行星 ${n}`, en: `CUSTOM ${n}`, type: 'planet',
      radiusKm, massKg: mass,
      gravity: 6.674e-11 * mass / Math.pow(radiusKm * 1000, 2),
      rotationHours: 24, pole: [0, 90],
      tempC: 0, tempLabel: '自定义',
      ui: T.color, glow: T.glow,
      spin0: 0,
      elements: {
        a, e, i: spec.inc, L: 0, peri: 0, node: 0,
        da: 0, de: 0, di: 0, dL: 360 / (Math.pow(a, 1.5) * 365.25) * 36525, dperi: 0, dnode: 0,
      },
      texture: spec.texture || null,
      desc: `通过「放置行星」生成的${({ rocky: '岩石行星', gas: '气态巨行星', ice: '冰巨星', dwarf: '矮行星' })[spec.type] || '天体'}，`
        + `半径 ${radiusKm.toLocaleString('zh-CN')} km，轨道半长轴 ${a.toFixed(3)} AU、`
        + `偏心率 ${e.toFixed(3)}、倾角 ${spec.inc.toFixed(1)}°。只存在于当前页面，刷新后消失。`,
      facts: [['来源', '放置行星'], ['半径', `${radiusKm.toLocaleString('zh-CN')} km`]],
      isCustom: true,
    };
    const rt = world.addPlanet(data);
    hud.addBody(rt);
    setTimeout(() => { actions.select(id, true); }, 30);
    return id;
  },
  clearCustom() {
    const ids = world.clearCustom();
    if (ids.length) {
      hud.removeBodies(ids);
      hud.setSelected(null);
    }
    return ids.length;
  },
  clearLandmark() {
    world.hideLandmark();
    if (hud) hud.setLandmark(null, -1);
  },
  /**
   * 视角预设
   * 内景：内太阳系，行星是主角。
   * 全览：拉到奥尔特星云之外，整片星云与黄道尘埃带一起进画面。
   */
  view(name) {
    tween = null;
    setFollow(false, null);
    // 火箭视角接管相机，其余预设都要先退出它
    state.rocketView = (name === 'rocket');
    controls.enabled = !state.rocketView;
    if (state.rocketView) {
      world.resetRocket(state.jd);
      const rs = world.rocketState();
      flyCam.yaw = 0;
      flyCam.pitch = -0.22;
      flyCam.dist = (rs ? rs.length : 1) * 7;
      if (rs) camera.position.copy(rs.pos).addScaledVector(rs.forward, -flyCam.dist);
      keys.clear();
      hud.setView('rocket');
      hud.setFlySpeed(state.flySpeedExp);
      return;
    }
    if (name === 'full') {
      flyTo(new THREE.Vector3(0, 56000, 168000), new THREE.Vector3(0, 0, 0), 1.4);
      hud.setView('full');
    } else if (name === 'earth') {
      // 地球预设要收紧到约 11 个地球半径，人造卫星的轨迹网才会铺满画面
      const e = world.bodies.get('earth');
      if (e) {
        orbitManual = null; lastSelOrbitShown = null;
        hud.setSelected(e); updateOrbitVisibility();
        frameBody(e, false, e.radiusUnits * 11);
        hud.setView('earth');
      }
    } else {
      flyTo(new THREE.Vector3(0, 175, 350), new THREE.Vector3(0, 0, 0), 1.2);
      hud.setView('inner');
    }
  },
  follow(on) { setFollow(on, hud.selected); },
  play(on) {
    state.playing = on;
    hud.setPlaying(on);
  },
  direction(dir) {
    state.direction = dir;
    hud.setDirection(dir);
    if (!state.playing) actions.play(true);
  },
  rate(v) {
    state.rate = Math.max(1e-6, Math.min(1e4, v));
    hud.setRate(rateToSlider(state.rate), rateText(state.rate));
  },
  setJd(jd, fromUser) {
    state.jd = Math.max(MIN_JD, Math.min(MAX_JD, jd));
    if (fromUser) world.update(state.jd, elapsed);
  },
  step(days) { actions.setJd(state.jd + days, true); },
  now() { state.jd = jdFromDate(new Date()); },
  toggle(flag, on) {
    state.flags[flag] = on;
    hud.setFlagButton(flag, on);
    if (flag === 'labels') {
      for (const rec of hud.labels.values()) {
        if (!on) { rec.div.style.display = 'none'; rec.line.style.display = 'none'; rec.shown = false; }
      }
      if (hud.el.reticle) hud.el.reticle.style.display = on && hud.selected ? 'block' : 'none';
    }
    if (flag === 'orbits') updateOrbitVisibility();
    if (flag === 'belt' || flag === 'kuiper' || flag === 'oort' || flag === 'sats') {
      world.populations.setVisible(flag, on);
    }
    if (flag === 'satOrbits') world.populations.setRings(on);
    if (flag === 'realDist' || flag === 'realSize') startScaleAnim();
  },
  toggleOrbitFor(rt) {
    if (!rt.orbitLine) return;
    orbitManual = !rt.orbitLine.visible;
    updateOrbitVisibility();
  },
  getFlag(flag) { return state.flags[flag]; },
};

/* ── 尺度过渡 ─────────────────────────────────────────── */
/**
 * 真实 ↔ 观赏 不是瞬切，而是把 distT / sizeT 在 1.2 秒内连续插值，
 * 每帧重算尺寸与轨道线，所以行星在整个过渡中都精确落在轨道上。
 */
let scaleAnim = null;
function startScaleAnim() {
  tween = null;
  scaleAnim = {
    t: 0, dur: 1.2,
    fromDistT: S.params.distT, fromSizeT: S.params.sizeT,
    toDistT: state.flags.realDist ? 0 : 1,
    toSizeT: state.flags.realSize ? 0 : 1,
  };
}
function advanceScaleAnim(dt) {
  scaleAnim.t = Math.min(1, scaleAnim.t + dt / scaleAnim.dur);
  const k = easeInOut(scaleAnim.t);
  S.params.distT = scaleAnim.fromDistT + (scaleAnim.toDistT - scaleAnim.fromDistT) * k;
  S.params.sizeT = scaleAnim.fromSizeT + (scaleAnim.toSizeT - scaleAnim.fromSizeT) * k;
  world.applyScale();
  if (scaleAnim.t >= 1) scaleAnim = null;
}

/* ── 速度换算 ─────────────────────────────────────────── */
function rateToSlider(v) {
  return Math.max(0, Math.min(1, (Math.log10(v) + 5) / 9));
}
function rateText(daysPerSec) {
  const sec = Math.abs(daysPerSec) * 86400;
  if (Math.abs(sec - 1) < 0.02) return '实时 · 1 秒 = 1 秒';   // 默认就是真实流速
  let s;
  if (sec < 60) s = `${sec.toFixed(1)} 秒`;
  else if (sec < 3600) s = `${(sec / 60).toFixed(1)} 分`;
  else if (sec < 86400) s = `${(sec / 3600).toFixed(1)} 小时`;
  else if (sec < 86400 * 40) s = `${(sec / 86400).toFixed(2)} 天`;
  else if (sec < 86400 * 400) s = `${(sec / 86400 / 30.44).toFixed(2)} 月`;
  else s = `${(sec / 86400 / 365.25).toFixed(2)} 年`;
  return `1 秒 = ${s}`;
}

export { state, actions };
