/**
 * 贴图系统
 * --------
 * · 行星贴图来自 Solar System Scope（CC BY 4.0，见 NOTICE.md）
 * · 法线图 / 粗糙度图在运行时由颜色贴图推导（Sobel 高通），
 *   所以岩石行星有真实的凹凸感，海洋有镜面高光，且不额外下载资源
 * · 卫星表面 100% 程序化生成（环形山、虎纹、火山、双色半球…），
 *   按半径分档生成，生成过程分帧让出主线程，页面秒开
 */

import * as THREE from 'three';

/* ── 文件清单 ───────────────────────────────────────────── */
export const FILES = {
  sun: 'textures/2k_sun.jpg',
  mercury: 'textures/2k_mercury.jpg',
  venus: 'textures/2k_venus_surface.jpg',
  venusAtmosphere: 'textures/2k_venus_atmosphere.jpg',
  earth: 'textures/2k_earth_daymap.jpg',
  earthNight: 'textures/2k_earth_nightmap.jpg',
  earthClouds: 'textures/2k_earth_clouds.jpg',
  moon: 'textures/2k_moon.jpg',
  mars: 'textures/2k_mars.jpg',
  jupiter: 'textures/2k_jupiter.jpg',
  saturn: 'textures/2k_saturn.jpg',
  saturnRing: 'textures/2k_saturn_ring_alpha.png',
  uranus: 'textures/2k_uranus.jpg',
  neptune: 'textures/2k_neptune.jpg',
};

const SRGB_KEYS = new Set(Object.keys(FILES));

/**
 * 载入时的宽度上限
 * -----------------
 * 这 14 张源图都是 2048×1024，带 mipmap 后每张占 10.7 MB 显存，合计超过 150 MB。
 * 而取景时行星在屏幕上大约 350 px 直径，极端放大也就占满 900 px：
 * 2048 宽的等距圆柱图里有 1024 px 对应可见半球，早就过采样了。
 * 因此除地球昼面（最常被拉近看的那张）外，一律降到 1024×512，显存直接降到四分之一。
 */
const MAX_W = {
  earth: 2048, mercury: 2048, sun: 2048, venus: 2048, venusAtmosphere: 2048,
  earthNight: 2048, earthClouds: 2048,
};
const DEFAULT_MAX_W = 1024;   // 尚未恢复 2k 源图的几张，按 1k 载入

export const textures = {};
let maxAniso = 4;
export function setAnisotropy(v) { maxAniso = Math.max(1, Math.min(16, v | 0)); }

/* ── 加载 ───────────────────────────────────────────────── */
export function loadTextures(onProgress) {
  const keys = Object.keys(FILES);
  let done = 0;
  return Promise.all(keys.map(key => new Promise(resolve => {
    new THREE.TextureLoader().load(
      FILES[key],
      tex => {
        const maxW = MAX_W[key] || DEFAULT_MAX_W;
        if (tex.image && tex.image.width > maxW) {
          const cv = document.createElement('canvas');
          cv.width = maxW;
          cv.height = maxW / 2;
          cv.getContext('2d').drawImage(tex.image, 0, 0, cv.width, cv.height);
          tex.image = cv;          // 原图随之释放，JS 堆也跟着降
        }
        tex.colorSpace = SRGB_KEYS.has(key) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = maxAniso;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        textures[key] = tex;
        done++; onProgress && onProgress(done, keys.length, key);
        resolve(tex);
      },
      undefined,
      () => { done++; onProgress && onProgress(done, keys.length, key); resolve(null); },
    );
  })));
}

/** 有月球正面贴图时用它，否则退回程序化 */

/* ── 噪声 ───────────────────────────────────────────────── */
function ihash(x, y, seed) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1013904223)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wx = i => ((i % period) + period) % period;
  const a = ihash(wx(xi), yi, seed), b = ihash(wx(xi + 1), yi, seed);
  const c = ihash(wx(xi), yi + 1, seed), d = ihash(wx(xi + 1), yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, period, seed, octaves = 4, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, p = period, s = seed;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * (p / period), y * (p / period), p, s);
    norm += amp;
    amp *= gain; p *= 2; s = (s * 7919 + 13) | 0;
  }
  return sum / norm;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const css = (rgb, a) => `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;

/* ── 程序化卫星表面 ─────────────────────────────────────── */

function drawCraters(ctx, W, H, rand, count, opt) {
  const { bright = 1, dark = 1, minR = 0.004, maxR = 0.075 } = opt;
  for (let i = 0; i < count; i++) {
    // 幂律尺寸分布：小坑远多于大坑
    const t = Math.pow(rand(), 2.6);
    const rad = (minR + t * (maxR - minR)) * W;
    const cx = rand() * W;
    const lat = rand() * 2 - 1;
    const cy = H * (0.5 + lat * 0.46);
    const sy = Math.max(0.25, Math.cos(lat * Math.PI * 0.5));
    const sx = 1 / sy;
    if (Math.abs(lat) > 0.94) continue;
    for (const off of [-W, 0, W]) {
      if (cx + off < -rad * 2 || cx + off > W + rad * 2) continue;
      ctx.save();
      ctx.translate(cx + off, cy);
      ctx.scale(sx, 1);
      // 溅射物晕
      let g = ctx.createRadialGradient(0, 0, rad * 0.7, 0, 0, rad * 1.7);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.25, `rgba(255,255,255,${0.10 * bright})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rad * 1.7, 0, 6.2832); ctx.fill();
      // 明亮坑缘
      g = ctx.createRadialGradient(0, 0, rad * 0.55, 0, 0, rad * 1.05);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.55, `rgba(255,255,255,${0.22 * bright})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rad * 1.05, 0, 6.2832); ctx.fill();
      // 坑底阴影
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 0.92);
      g.addColorStop(0, `rgba(0,0,0,${0.34 * dark})`);
      g.addColorStop(0.7, `rgba(0,0,0,${0.18 * dark})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.92, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
  }
}

function strokeFlow(ctx, W, H, rand, count, color, width, lenScale) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x0 = rand() * W, y0 = rand() * H;
    const len = W * lenScale * (0.3 + rand());
    const ang = (rand() - 0.5) * 0.8;
    ctx.strokeStyle = color(0.10 + rand() * 0.35);
    ctx.lineWidth = width * (0.5 + rand());
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let x = x0, y = y0, a = ang;
    const seg = 8;
    for (let s = 0; s < seg; s++) {
      a += (rand() - 0.5) * 0.7;
      x += Math.cos(a) * (len / seg);
      y += Math.sin(a) * (len / seg) * 0.6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/**
 * 生成卫星表面贴图
 * @param {object} rock  外观描述（seed / base / craters / lineae / ice / volcanoes …）
 * @param {number} radiusKm
 */
export function makeMoonTexture(rock, radiusKm) {
  // 卫星取景时直径约 280 px，512 宽已经过采样；小卫星更是只有几十像素。
  // 之前一律 512（大的 1024），24 颗下来光颜色图就占了上百 MB 是不必要的。
  const W = radiusKm >= 1000 ? 512 : 256;
  const H = W / 2;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const rand = mulberry32(rock.seed || 7);
  const base = rock.base || [0.6, 0.58, 0.55];

  // 1. 基色
  const br = Math.round(base[0] * 255), bg = Math.round(base[1] * 255), bb = Math.round(base[2] * 255);
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, W, H);

  // 2. 大尺度色斑（低分辨率 fBm 放大，成本极低）
  const tint = (nw, nh, cells, seed, alpha, mode) => {
    const small = makeCanvas(nw, nh);
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(nw, nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const n = fbm(x * cells / nw, y * cells / nh * 0.5 + 0.5, cells, seed, 4);
        const k = (n - 0.5) * 2;
        const i = (y * nw + x) * 4;
        const v = k > 0 ? 255 : 0;
        img.data[i] = base[0] * 255 + v * base[0] * 0.5;
        img.data[i + 1] = base[1] * 255 + v * base[1] * 0.5;
        img.data[i + 2] = base[2] * 255 + v * base[2] * 0.5;
        img.data[i + 3] = Math.min(255, Math.abs(k) * 255);
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = mode;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, W, H);
    ctx.restore();
  };
  tint(160, 80, 14, rock.seed + 11, 0.75, 'soft-light');
  tint(200, 100, 34, rock.seed + 29, 0.5, 'overlay');

  // 3. 特征
  if (rock.ice) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255,255,255,${0.34 * rock.ice})`);
    g.addColorStop(0.22, 'rgba(255,255,255,0)');
    g.addColorStop(0.78, 'rgba(255,255,255,0)');
    g.addColorStop(1, `rgba(255,255,255,${0.30 * rock.ice})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (rock.volcanoes) {
    for (let i = 0; i < rock.volcanoes; i++) {
      const x = rand() * W, y = H * (0.08 + rand() * 0.84);
      const r = W * (0.006 + rand() * 0.022);
      let g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      g.addColorStop(0, 'rgba(90,40,10,0.95)');
      g.addColorStop(0.35, 'rgba(150,80,20,0.55)');
      g.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.fill();
      g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,245,190,0.85)');
      g.addColorStop(0.6, 'rgba(220,150,40,0.5)');
      g.addColorStop(1, 'rgba(120,50,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    strokeFlow(ctx, W, H, rand, 26, a => `rgba(120,60,20,${a * 0.5})`, W * 0.006, 0.22);
  }

  if (rock.lineae) {
    strokeFlow(ctx, W, H, rand, rock.lineae, a => `rgba(255,250,240,${a})`, W * 0.0035, 0.3);
    strokeFlow(ctx, W, H, rand, Math.round(rock.lineae * 0.6), a => `rgba(120,80,50,${a * 0.7})`, W * 0.0025, 0.26);
  }

  if (rock.tigerStripes) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,190,210,0.5)';
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = W * (0.004 + rand() * 0.008);
      ctx.beginPath();
      const y0 = H * (0.62 + i * 0.055);
      ctx.moveTo(W * (0.05 + rand() * 0.1), y0);
      for (let s = 1; s <= 6; s++) {
        ctx.lineTo(W * (0.05 + s * 0.15), y0 + (rand() - 0.5) * H * 0.06);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (rock.cantaloupe) {
    for (let i = 0; i < 90; i++) {
      const x = rand() * W, y = H * (0.1 + rand() * 0.8);
      const r = W * (0.012 + rand() * 0.03);
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.20)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  }

  if (rock.twoTone) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(30,22,16,0.88)');
    g.addColorStop(0.38, 'rgba(60,46,34,0.35)');
    g.addColorStop(0.62, 'rgba(60,46,34,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (rock.haze) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,190,90,0.30)');
    g.addColorStop(0.5, 'rgba(255,170,70,0.14)');
    g.addColorStop(1, 'rgba(255,190,90,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 4. 环形山
  if (rock.craters) {
    // 纹理改小后环形山的相对半径要跟着放大，否则细到看不见
    const big = radiusKm >= 1000;
    drawCraters(ctx, W, H, rand, rock.craters, {
      bright: rock.ice ? 0.7 : 1.15,
      dark: rock.ice ? 0.6 : 1,
      minR: 0.0035, maxR: big ? 0.06 : 0.085,
    });
  }

  // 5. 细腻颗粒
  const grain = makeCanvas(256, 128);
  const gctx = grain.getContext('2d');
  const gimg = gctx.createImageData(256, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 256; x++) {
      const n = fbm(x * 64 / 256, y * 32 / 128 + 1.7, 64, rock.seed + 91, 3);
      const k = (n - 0.5) * 2;
      const i = (y * 256 + x) * 4;
      const v = k > 0 ? 255 : 0;
      gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = 128 + v * 0.35;
      gimg.data[i + 3] = Math.min(255, Math.abs(k) * 190);
    }
  }
  gctx.putImageData(gimg, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(grain, 0, 0, W, H);
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  tex.userData.canvas = cv;
  return tex;
}

/* ── 小卫星的共享贴图 ───────────────────────────────────── */
/**
 * 一百多颗小卫星如果每颗都生成一张程序化贴图，光贴图就是上百 MB 显存、
 * 启动也要多花十几秒——而它们在屏幕上通常只有几像素。
 * 这里按外观族只生成 4 张基础图（灰岩 / 冰质 / 暗色 / 铁锈），
 * 各卫星用材质颜色做色偏，几像素的尺度下看不出共用。
 */
const sharedCache = new Map();

export function sharedMoonTexture(fam = 'rock') {
  if (sharedCache.has(fam)) return sharedCache.get(fam);
  const SPEC = {
    rock: { base: [0.62, 0.60, 0.57], craters: 210, ice: 0 },
    ice: { base: [0.84, 0.87, 0.90], craters: 160, ice: 0.6 },
    dark: { base: [0.42, 0.40, 0.39], craters: 240, ice: 0 },
    rust: { base: [0.70, 0.58, 0.46], craters: 180, ice: 0 },
  };
  const spec = SPEC[fam] || SPEC.rock;
  const W = 256, H = 128;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const rand = mulberry32(9000 + fam.length * 137);
  const br = Math.round(spec.base[0] * 255), bg = Math.round(spec.base[1] * 255), bb = Math.round(spec.base[2] * 255);
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, W, H);
  // 低分辨率 fBm 放大成大尺度色斑
  for (const [cells, seed, alpha] of [[3, 11, 0.30], [7, 23, 0.20], [15, 37, 0.12]]) {
    const nw = 48, nh = 24;
    const small = makeCanvas(nw, nh);
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(nw, nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const n = fbm(x * cells / nw, y * cells / nh * 0.5 + 0.5, cells, seed, 4);
        const k = (n - 0.5) * 2 * alpha * 255;
        const i = (y * nw + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, br + k));
        img.data[i + 1] = Math.max(0, Math.min(255, bg + k));
        img.data[i + 2] = Math.max(0, Math.min(255, bb + k));
        img.data[i + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, W, H);
  }
  drawCraters(ctx, W, H, rand, spec.craters, {
    bright: spec.ice ? 0.6 : 1.0, dark: spec.ice ? 0.5 : 0.9,
    minR: 0.006, maxR: 0.075,
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  sharedCache.set(fam, tex);
  return tex;
}

/* ── 由颜色图推导法线 / 粗糙度 ─────────────────────────── */

/** 颜色贴图 → 法线贴图（Sobel，X 方向环绕） */
export function normalMapFrom(canvas, strength = 2.2, outSize = 1024) {
  const W = outSize, H = outSize / 2;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
  }
  const out = new Uint8Array(W * H * 4);
  const at = (x, y) => lum[((y < 0 ? 0 : y >= H ? H - 1 : y) * W) + ((x + W) % W)];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br2 = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br2) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br2) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * W + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/** 地球：海洋光滑、陆地粗糙 */
export function earthRoughnessFrom(canvas, outSize = 1024) {
  const W = outSize, H = outSize / 2;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H).data;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = src[p], g = src[p + 1], b = src[p + 2];
    const water = b > r + 8 && b > 40;
    const v = water ? 42 : 225;
    out[p] = out[p + 1] = out[p + 2] = v;
    out[p + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ── 环 ─────────────────────────────────────────────────── */

/**
 * 土星环：使用实测的环带透明度剖面贴图。
 * u 轴 = 径向（内 → 外）。
 */
export function saturnRingTexture() {
  const tex = textures.saturnRing;
  if (!tex) return null;
  const img = tex.image;
  const W = Math.min(2048, img.width);
  const cv = makeCanvas(W, 4);
  const ctx = cv.getContext('2d');
  // 兼容“剖面条”与“整幅图”两种素材：取垂直中线一行
  ctx.drawImage(img, 0, Math.floor(img.height / 2), img.width, 1, 0, 0, W, 4);
  const out = new THREE.CanvasTexture(cv);
  out.colorSpace = THREE.SRGBColorSpace;
  out.wrapS = THREE.ClampToEdgeWrapping;
  out.wrapT = THREE.ClampToEdgeWrapping;
  out.anisotropy = maxAniso;
  out.needsUpdate = true;
  return out;
}

/** 程序化细环（木星 / 天王星）：多条窄环 + 缝 */
export function proceduralRingTexture(bands, seed = 3) {
  const W = 1024;
  const cv = makeCanvas(W, 4);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, 4);
  const rand = mulberry32(seed);
  for (const [from, to, alpha, tint] of bands) {
    const x0 = from * W, x1 = to * W;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(${tint},0)`);
    g.addColorStop(0.5, `rgba(${tint},${alpha})`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, x1 - x0, 4);
  }
  for (let i = 0; i < 120; i++) {
    const x = rand() * W;
    const w = 1 + rand() * 4;
    ctx.fillStyle = `rgba(220,215,205,${0.02 + rand() * 0.09})`;
    ctx.fillRect(x, 0, w, 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ── 光斑 ───────────────────────────────────────────────── */
export function radialSprite(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,210,120,0.35)', size = 128) {
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, mid);
  g.addColorStop(0.62, 'rgba(255,170,60,0.08)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function starSprite(size = 64) {
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ── 银河背景（程序化，不依赖外部星图） ─────────────────── */
/**
 * 生成等距圆柱投影的银河天球：
 * 低频 fBm 塑造银道带与尘埃裂谷，再撒上数千颗恒星点。
 */
export function milkywayTexture() {
  const W = 1024, H = 512;      // 柔和背景，1024 足够，2048 白占 8 MB 显存
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');

  /* 1. 银道带：低分辨率逐像素，随后放大 */
  const nw = 320, nh = 160;
  const nc = makeCanvas(nw, nh);
  const nctx = nc.getContext('2d');
  const img = nctx.createImageData(nw, nh);
  for (let y = 0; y < nh; y++) {
    const lat = (0.5 - y / nh) * Math.PI;
    for (let x = 0; x < nw; x++) {
      const lon = (x / nw) * Math.PI * 2;
      // 银道面相对黄道约倾角 60°，用一条倾斜的正弦带近似
      const bandLat = 0.62 * Math.sin(lon + 0.5) + 0.18 * Math.sin(lon * 2 + 1.4);
      const d = (lat - bandLat) / 0.30;
      const band = Math.exp(-d * d);
      const cloud = fbm(x * 14 / nw, y * 7 / nh + 3.1, 14, 4242, 5);
      const dust = fbm(x * 34 / nw, y * 17 / nh + 8.7, 34, 977, 4);
      // 银心方向更亮更暖
      const core = Math.exp(-Math.pow(((lon + 1.05 + Math.PI * 2) % (Math.PI * 2) - Math.PI * 0.15) * 1.1, 2));
      let v = band * (0.22 + 1.05 * cloud) * (0.45 + 0.9 * dust);
      v *= 0.55 + 0.9 * core;
      v = Math.min(1, v * 1.25);
      const i = (y * nw + x) * 4;
      const warm = 0.35 + 0.65 * core;
      img.data[i] = v * 255 * (0.62 + 0.5 * warm);
      img.data[i + 1] = v * 255 * (0.66 + 0.26 * warm);
      img.data[i + 2] = v * 255 * (0.86 - 0.06 * warm);
      img.data[i + 3] = 255;
    }
  }
  nctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(nc, 0, 0, W, H);

  /* 2. 尘埃裂谷：叠一层更暗的窄带 */
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(nc, 0, 8, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  /* 3. 恒星点：带内更密 */
  const rand = mulberry32(20260930);
  for (let i = 0; i < 5200; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const lat = (0.5 - y / H) * Math.PI;
    const lon = (x / W) * Math.PI * 2;
    const bandLat = 0.62 * Math.sin(lon + 0.5) + 0.18 * Math.sin(lon * 2 + 1.4);
    const inBand = Math.exp(-Math.pow((lat - bandLat) / 0.32, 2));
    if (rand() > 0.32 + 0.68 * inBand) continue;
    const r = 0.35 + Math.pow(rand(), 3.4) * 1.5;
    const b = 0.35 + Math.pow(rand(), 2.2) * 0.65;
    const t = rand();
    const col = t < 0.6 ? [200, 214, 255] : (t < 0.85 ? [255, 244, 226] : [255, 206, 168]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${b})`);
    g.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},${b * 0.35})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 6.2832); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

