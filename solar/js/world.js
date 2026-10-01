/**
 * 世界构建与逐帧演化
 * ------------------
 * 每个天体 = 组节点 → 姿态节点（黄道极轴）→ 自转球体 (+云层/大气/环)
 * 位置每帧由轨道根数解算，姿态由 IAU 极轴 + 自转周期给出，
 * 因此昼夜分界、土星环的朝向、行星的倾斜都是真实历元下的结果。
 */

import * as THREE from 'three';
import { SUN, PLANETS, MOONS, BY_ID } from './data.js';
import {
  planetState, moonLocalPosition, moonSpeedKmS, axisVector, spinAngle,
} from './astronomy.js';
import {
  textures, makeMoonTexture, normalMapFrom, earthRoughnessFrom, saturnRingTexture,
  proceduralRingTexture, radialSprite, sharedMoonTexture,
} from './textures.js';
import {
  sunSurfaceMaterial, coronaMaterial, atmosphereMaterial, cloudMaterial,
  planetMaterial, enableNightLights, enableRingShadow, makeRingGeometry, ringMaterial,
} from './materials.js';
import {
  auToUnits, bodyRadiusUnits, moonOrbitUnits, moonDisplayFloor, sunRadiusUnits, J2000,
} from './scale.js';
import { Populations, SAT_SYSTEMS, planeMatrix } from './populations.js';
import { buildAsteroidEntries } from './asteroids-catalog.js';
import { buildCometEntries } from './comets.js';

/* 共享球体几何
   34 个天体如果各自 new 一份，顶点缓冲要多占好几 MB，而它们只靠 scale 区分大小。
   分段数按屏幕上可能达到的尺寸定：取景时行星约 350 px，极端放大也就 900 px，
   64 分段的轮廓多边形误差不到 0.5 px，再高没有视觉收益。 */
const GEO_BODY = new THREE.SphereGeometry(1, 64, 32);    // 行星 / 大卫星
const GEO_SMALL = new THREE.SphereGeometry(1, 32, 16);   // 小卫星
const GEO_SHELL = new THREE.SphereGeometry(1, 48, 24);   // 云层 / 大气
const GEO_GLOW = new THREE.SphereGeometry(1, 24, 12);    // 日冕 / 光晕

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _proj = { x: 0, y: 0, radius: 0, visible: false };
const YAXIS = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const DEG2RAD = Math.PI / 180;
const DEG = DEG2RAD;
// 轨道线统一为制图学灰白：参考图里所有轨道是同一种近乎无色的细线，
// 靠透明度而不是色相区分层级；金色只留给界面读数与选中态。
const ORBIT_COLOR = 0xc9c4b8;
/* 黄道坐标 → 场景坐标 的映射 (x,y,z)→(x,z,−y) 本身是绕 X 轴 −90° 的旋转，
   所以卫星轨道的朝向可以整体用四元数表达，不必逐点重算几何。 */
const ECL_TO_SCENE = new THREE.Quaternion().setFromAxisAngle(AXIS_X, -Math.PI / 2);
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _m3 = new THREE.Matrix4();
const WHITE = new THREE.Color(0xffffff);

export class World {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.bodies = new Map();
    this.list = [];
    this.lastPlanetOrbitJd = -1e9;
    this.lastMoonOrbitJd = -1e9;
    this.sunDirView = new THREE.Vector3(0, 0, 1);
    this.needsRebuild = false;
    /** 天体群：小行星带 / 特洛伊 / 柯伊伯带 / 奥尔特云 / 人造卫星 */
    this.populations = new Populations(scene);
    /** 等待补专属贴图的卫星（进入视野后每帧补一颗） */
    this.pendingOwnTextures = [];
  }

  /* ── 构建 ─────────────────────────────────────────── */
  build(onStage = () => {}) {
    onStage('恒星与行星', 0.05);
    this.#buildSun();
    for (const p of PLANETS) this.#buildPlanet(p);
    onStage('轨道线', 0.35);
    this.refreshOrbits();
    onStage('小行星带与奥尔特云', 0.39);
    this.populations.build(this.bodies.get('earth'));
    this.pendingMoons = [...MOONS];
    this.#buildRocket();

    /* 人造卫星没有「一颗一颗」的档案，但每个轨道壳层都该能被选中查看。
       这里给每个壳层造一个轻量运行体：位置直接引用地球的 position（同一个
       Vector3 对象，地球怎么动它就跟到哪），半径取该壳层的轨道半径，
       于是取景会自动把整层轨道框进画面。 */
    const earth = this.bodies.get('earth');
    this.satTargets = new Map();
    if (earth) {
      for (const sh of SAT_SYSTEMS) {
        const aKm = sh.apo ? (6371 + sh.apo + 6371 + sh.alt) / 2 : 6371 + sh.alt;
        const rUnits = moonOrbitUnits(aKm, earth.radiusKm, earth.radiusUnits);
        const periodS = 2 * Math.PI * Math.sqrt(Math.pow(aKm * 1000, 3) / 3.986004418e14);
        const rt = {
          data: {
            ...sh, type: 'satellite', radiusKm: 0, aKm, periodMin: periodS / 60,
            // √(μ/a) 得到的是 m/s，换算成 km/s 再交给界面
            speedKmS: Math.sqrt(3.986004418e14 / (aKm * 1000)) / 1000,
          },
          position: earth.position,       // 同一个 Vector3：地球一动它就动
          radiusUnits: rUnits,
          parent: earth,
          isSat: true,
          helioAu: null,
        };
        this.satTargets.set(`sat:${sh.id}`, rt);
      }
    }

    /* 已命名小行星
       有正式名称与编号的那一批，按真实根数逐颗解算位置，
       因此它们落在主带里正确的位置上，而不是统计样本里的随机点。
       同时单独画一层点，颜色与统计样本区分开，便于在带里认出来。 */
    this.minorTargets = new Map();
    {
      const list = buildAsteroidEntries();
      const pos = new Float32Array(list.length * 3);
      const col = new Float32Array(list.length * 3);
      const c = new THREE.Color();
      list.forEach((b, i) => {
        const rt = {
          data: b, isMinor: true, isMoon: false, isSun: false,
          position: new THREE.Vector3(), radiusUnits: bodyRadiusUnits(b.radiusKm),
          orbitLine: null, helioAu: null,
        };
        rt.data.orbit = { ...b.orbit };
        this.minorTargets.set(b.id, rt);
        c.set(b.ui);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        map: this.populations.sprite, size: 3.0, sizeAttenuation: false,
        vertexColors: true, transparent: true, depthWrite: false,
        toneMapped: false, blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geom, mat);
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.minorLayer = { points: pts, geom, list: [...this.minorTargets.values()], moving: true };

      /* 每颗已命名小行星都给一个实体球
         之前它们只是一个点：能选中、能飞过去，到了跟前却什么都没有。
         小行星表面按光谱型取外观族，飞近后再按需换成专属贴图。 */
      const FAM_OF_TYPE = { S: 'rock', M: 'dark', V: 'rust', C: 'dark', B: 'dark',
        G: 'dark', F: 'dark', P: 'dark', D: 'dark', X: 'dark', E: 'rock', Q: 'rock' };
      const ROCK_OF_TYPE = {
        S: { base: [0.58, 0.51, 0.42], craters: 240, roughness: 0.9 },
        M: { base: [0.48, 0.48, 0.5], craters: 180, roughness: 0.72 },
        V: { base: [0.62, 0.54, 0.38], craters: 200, roughness: 0.86 },
        C: { base: [0.26, 0.25, 0.25], craters: 260, roughness: 0.98 },
      };
      for (const rt of this.minorTargets.values()) {
        const t = rt.data.spectral;
        const fam = FAM_OF_TYPE[t] || 'dark';
        const rock = ROCK_OF_TYPE[t] || { base: [0.4, 0.38, 0.36], craters: 230, roughness: 0.95 };
        this.#makeSmallBody(rt, { fam, rock, ui: rt.data.ui, bump: 1.3 });
      }
    }

    /* 彗星
       核之外还要画彗发与彗尾：两者都随日心距按 r^-2.5 变化，
       所以同一颗彗星在近日点附近会明显亮起来、尾巴拉长，在远日点几乎消失。 */
    this.cometTargets = new Map();
    this.comets = [];
    {
      const list = buildCometEntries();
      const pos = new Float32Array(list.length * 3);
      const col = new Float32Array(list.length * 3);
      const c = new THREE.Color();
      list.forEach((b, i) => {
        const rt = {
          data: b, isComet: true, isMinor: true, isMoon: false, isSun: false,
          position: new THREE.Vector3(), radiusUnits: bodyRadiusUnits(b.radiusKm),
          orbitLine: null, helioAu: null, act: 0,
        };
        this.cometTargets.set(b.id, rt);
        this.comets.push(rt);
        c.set(b.ui);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geom, new THREE.PointsMaterial({
        map: this.populations.sprite, size: 3.2, sizeAttenuation: false,
        vertexColors: true, transparent: true, depthWrite: false,
        toneMapped: false, blending: THREE.NormalBlending,
      }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.cometLayer = { points: pts, geom, list: this.comets };

      const comaTex = radialSprite('rgba(220,245,255,0.95)', 'rgba(140,210,255,0.35)', 256);
      const tailTex = this.#tailTexture();
      for (const rt of this.comets) {
        // 彗核：暗而脏的冰岩混合体
        this.#makeSmallBody(rt, {
          fam: 'dark',
          rock: { base: [0.3, 0.31, 0.33], craters: 90, ice: 0.5, roughness: 0.85 },
          ui: rt.data.ui, bump: 1.2,
        });
        const coma = new THREE.Sprite(new THREE.SpriteMaterial({
          map: comaTex, transparent: true, depthWrite: false, toneMapped: false,
          blending: THREE.AdditiveBlending, opacity: 0.85,
        }));
        coma.visible = false;
        this.scene.add(coma);
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
          map: tailTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
          toneMapped: false, blending: THREE.AdditiveBlending,
        }));
        tail.visible = false;
        this.scene.add(tail);
        const tail2 = tail.clone();
        tail2.material = tail.material.clone();
        tail2.material.opacity = 0.5;
        this.scene.add(tail2);
        rt.coma = coma; rt.tail = tail; rt.tail2 = tail2;
      }
    }
    return this;
  }

  /**
   * 卫星贴图分帧生成，避免阻塞首屏。
   * 每 3 颗让出一次主线程：让出次数从 24 次降到 8 次，
   * 启动明显更快，同时单帧工作量仍在几毫秒量级（期间有启动遮罩，不会看到卡顿）。
   */
  async buildMoons(onStage = () => {}) {
    const total = this.pendingMoons.length;
    // 让出次数固定在 12 次左右：卫星从 24 颗涨到 153 颗后，
    // 还按「每 3 颗让出一次」会变成 51 次等待，启动白白多花两三秒。
    // 200 km 以下的小卫星现在走共享贴图，单颗成本很低，攒一批再让出更划算。
    const stride = Math.max(3, Math.ceil(total / 12));
    for (let i = 0; i < total; i++) {
      const m = this.pendingMoons[i];
      this.#buildMoon(m);
      onStage(`卫星表面 ${i + 1}/${total}`, 0.4 + 0.55 * ((i + 1) / total));
      if (i % stride === stride - 1) await nextFrame();
    }
    this.pendingMoons = [];
    this.refreshOrbits();
  }

  /**
   * 火箭
   * ----
   * 一枚在 420 km 低轨上飞行的运载器，尾部有喷焰，供「火箭视角」跟拍。
   * 真实火箭只有几十米长，在这个比例尺下连一个像素都不到，
   * 因此按示意尺寸放大（约 0.12 倍地球半径），界面上标注为示意。
   */
  #buildRocket() {
    const earth = this.bodies.get('earth');
    if (!earth) return;
    const group = new THREE.Object3D();
    group.name = 'rocket';
    const L = 0.12;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.62, 20, 1, false),
      new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.42, metalness: 0.55 }),
    );
    body.position.y = 0.05;
    group.add(body);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.26, 20),
      new THREE.MeshStandardMaterial({ color: 0xd8503c, roughness: 0.5, metalness: 0.3 }),
    );
    nose.position.y = 0.49;
    group.add(nose);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.8 }),
    );
    ring.position.y = -0.24;
    group.add(ring);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.2, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.5, metalness: 0.6 }),
      );
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.19, -0.28, Math.sin(a) * 0.19);
      fin.rotation.y = -a;
      group.add(fin);
    }
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('rgba(255,240,200,0.95)', 'rgba(255,150,60,0.35)', 128),
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    flame.position.y = -0.42;
    group.add(flame);
    this.rocket = {
      group, flame, L,
      aKm: 6371 + 420, inc: 51.64, e: 0.0006, node: 40, peri: 0, M0: 200,
      forward: new THREE.Vector3(0, 0, 1),
      scale: earth.radiusUnits * L,
    };
    this.scene.add(group);          // 挂在场景上，才能飞出地球轨道
    this.rocket = Object.assign(this.rocket, {
      free: false,
      vel: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
    });
    this.applyScale();
  }

  /** 把火箭摆回 420 km 低轨（进入 / 退出自由飞行时调用） */
  resetRocket(jd) {
    const R = this.rocket;
    if (!R) return;
    R.free = false;
    R.vel.set(0, 0, 0);
    this.#stepRocket(jd == null ? this.currentJd : jd);
  }

  /**
   * 自由飞行积分
   * dt 秒 · move 为相机坐标系下的输入 (前后, 左右, 上下)，均已归一化到 [-1,1]
   * dir 与 up 为相机基向量，speed 为当前速度（场景单位 / 秒）
   */
  flyRocket(dt, move, dir, up, speed) {
    const R = this.rocket;
    if (!R) return;
    R.free = true;
    const right = _v1.copy(dir).cross(up).normalize();
    const wish = _v2.set(0, 0, 0)
      .addScaledVector(dir, move.f)
      .addScaledVector(right, move.s)
      .addScaledVector(YAXIS, move.u);
    if (wish.lengthSq() > 1e-9) wish.normalize();
    R.vel.lerp(wish.multiplyScalar(speed), Math.min(1, dt * 2.6));
    R.group.position.addScaledVector(R.vel, dt);
    if (R.vel.lengthSq() > 1e-12) {
      const q = _qc.setFromUnitVectors(YAXIS, _v3.copy(R.vel).normalize());
      R.group.quaternion.slerp(q, Math.min(1, dt * 3.2));
    }
    R.forward.set(0, 1, 0).applyQuaternion(R.group.quaternion);
    const t = (this.currentJd - J2000) * 1440;
    const flick = 0.82 + 0.18 * Math.sin(t * 6.3) + 0.1 * Math.sin(t * 17.7);
    R.flame.scale.setScalar(R.vel.lengthSq() > 1e-10 ? 0.62 * flick : 0.3 * flick);
  }

  /** 火箭的世界位置与朝向（供跟拍相机使用） */
  rocketState() {
    const R = this.rocket;
    if (!R) return null;
    return {
      pos: R.group.position.clone(),
      forward: R.forward.clone().normalize(),
      length: R.scale,
      free: R.free,
      speed: R.vel.length(),
    };
  }

  /**
   * 放置一颗自定义行星
   * -------------------
   * 直接把条目推进 PLANETS 数据表，于是它和内置行星走完全相同的管线：
   * 位置解算、轨道线、标签、目录、档案、取景全部自动生效。
   * 只存在于内存中，刷新页面即消失。
   */
  addPlanet(data) {
    PLANETS.push(data);
    this.#buildPlanet(data);
    const rt = this.bodies.get(data.id);
    if (rt) rt.isCustom = true;
    this.refreshOrbits();
    this.applyScale();
    this.update(this.currentJd, 0);
    return rt;
  }

  /** 移除所有自定义行星 */
  clearCustom() {
    const ids = this.list.filter(b => b.isCustom).map(b => b.data.id);
    for (const id of ids) {
      const rt = this.bodies.get(id);
      if (!rt) continue;
      if (rt.orbitLine) {
        rt.orbitLine.geometry.dispose();
        rt.orbitLine.material.dispose();
        rt.orbitLine.parent && rt.orbitLine.parent.remove(rt.orbitLine);
      }
      if (rt.group) rt.group.parent && rt.group.parent.remove(rt.group);
      this.bodies.delete(id);
      const i = this.list.indexOf(rt);
      if (i >= 0) this.list.splice(i, 1);
      const j = PLANETS.findIndex(p => p.id === id);
      if (j >= 0) PLANETS.splice(j, 1);
    }
    this.refreshOrbits();
    return ids;          // 返回 id 数组：调用方要靠它清理标签
  }

  #register(runtime) {
    this.bodies.set(runtime.data.id, runtime);
    this.list.push(runtime);
  }

  #buildSun() {
    const r = sunRadiusUnits();
    const group = new THREE.Object3D();
    group.name = 'sun';
    const mesh = new THREE.Mesh(GEO_BODY, sunSurfaceMaterial(textures.sun || null));
    mesh.scale.setScalar(r);
    group.add(mesh);

    const corona1 = new THREE.Mesh(GEO_GLOW, coronaMaterial(0xffc061));
    corona1.scale.setScalar(r * 1.06);
    corona1.material.uniforms.uPower.value = 3.4;
    corona1.material.uniforms.uIntensity.value = 1.25;
    group.add(corona1);
    const corona2 = new THREE.Mesh(GEO_GLOW, coronaMaterial(0xff9a3c));
    corona2.scale.setScalar(r * 1.32);
    corona2.material.uniforms.uPower.value = 2.0;
    corona2.material.uniforms.uIntensity.value = 0.22;
    group.add(corona2);

    const flare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('rgba(255,246,222,0.95)', 'rgba(255,190,90,0.42)', 256),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    }));
    flare.scale.setScalar(r * 1.9);
    group.add(flare);
    const flare2 = flare.clone();
    flare2.material = flare.material.clone();
    flare2.material.opacity = 0.12;
    flare2.scale.setScalar(r * 4.5);
    group.add(flare2);

    this.scene.add(group);
    this.#register({
      data: SUN, group, mesh, radiusUnits: r, radiusKm: SUN.radiusKm,
      position: group.position, orbitLine: null, isSun: true,
      helioAu: { x: 0, y: 0, z: 0 },
    });
  }

  #buildPlanet(p) {
    const r = bodyRadiusUnits(p.radiusKm);
    const group = new THREE.Object3D();
    group.name = p.id;

    const axisNode = new THREE.Object3D();
    const axis = axisVector(p);
    axisNode.quaternion.setFromUnitVectors(YAXIS, _v1.set(axis[0], axis[1], axis[2]).normalize());
    group.add(axisNode);

    const maps = this.#mapsFor(p);
    const mat = planetMaterial({ ...maps, bumpScale: p.bump || 1 });
    let nightUniforms = null;
    if (p.nightLights && textures.earthNight) {
      mat.emissiveMap = textures.earthNight;
      mat.emissive = new THREE.Color(0xffc07a);
      mat.emissiveIntensity = 1.6;
      nightUniforms = enableNightLights(mat);
    }
    let ringShadowUniforms = null;
    if (p.rings && p.rings.shadow) {
      const ri = p.radiusKm, inner = (p.rings.innerKm / ri) * r, outer = (p.rings.outerKm / ri) * r;
      ringShadowUniforms = enableRingShadow(mat, { inner, outer, strength: 0.8 });
    }

    const mesh = new THREE.Mesh(GEO_BODY, mat);
    mesh.scale.setScalar(r);
    axisNode.add(mesh);

    const runtime = {
      data: p, group, axisNode, mesh, radiusUnits: r, radiusKm: p.radiusKm,
      position: group.position, clouds: null, atmosphere: null, rings: null,
      ringShadowUniforms, nightUniforms, axis, orbitLine: null,
    };

    if (p.clouds) {
      const ctex = textures[p.clouds.texture] || null;
      const cm = new THREE.Mesh(GEO_SHELL, cloudMaterial(ctex, {
        color: p.clouds.color, opacity: p.clouds.opacity, useMap: p.clouds.useMap,
      }));
      cm.scale.setScalar(r * p.clouds.altitude);
      axisNode.add(cm);
      runtime.clouds = cm;
    }
    if (p.atmosphere) {
      const am = new THREE.Mesh(GEO_SHELL, atmosphereMaterial(p.atmosphere));
      am.scale.setScalar(r * p.atmosphere.altitude);
      axisNode.add(am);
      runtime.atmosphere = am;
    }
    if (p.rings) {
      const inner = p.rings.innerKm / p.radiusKm;
      const outer = p.rings.outerKm / p.radiusKm;
      const geo = makeRingGeometry(inner, outer, 384);
      let tex = null;
      if (p.rings.texture === 'saturnRing') tex = saturnRingTexture();
      if (!tex) {
        tex = p.id === 'uranus'
          ? proceduralRingTexture([[0.02, 0.06, 0.55, '190,205,215'], [0.2, 0.24, 0.35, '180,200,210'], [0.45, 0.5, 0.4, '175,195,205'], [0.8, 0.84, 0.5, '185,205,215'], [0.95, 0.99, 0.3, '190,210,220']], 11)
          : proceduralRingTexture([[0.05, 0.35, 0.16, '200,190,175'], [0.6, 0.72, 0.2, '205,195,180']], 5);
      }
      const rm = ringMaterial({
        map: tex, opacity: p.rings.opacity, planetRadius: r,
        color: p.id === 'saturn' ? 0xf0e2c0 : 0xc8d4dc,
      });
      const ring = new THREE.Mesh(geo, rm);
      ring.scale.setScalar(r);
      ring.renderOrder = 2;
      ring.frustumCulled = false;
      axisNode.add(ring);
      runtime.rings = ring;
    }

    this.scene.add(group);
    this.#register(runtime);
    this.#makeOrbitLine(runtime);
  }

  /**
   * 按需生成专属贴图
   * 只有在卫星真的进入视野时才会被调用，因此启动时不必为 153 颗全都买单。
   */
  #buildOwnTexture(rt) {
    if (!rt || !rt.pendingOwn) return;
    rt.pendingOwn = false;
    const m = rt.data;
    try {
      const rock = rt.ownRock || m.rock || { base: [0.5, 0.48, 0.45], craters: 120, seed: 3 };
      const map = makeMoonTexture(rock, m.radiusKm || 1);
      const canvas = map.userData && map.userData.canvas
        ? map.userData.canvas
        : (map.image instanceof HTMLCanvasElement ? map.image : null);
      let normalMap = null;
      if (canvas && m.radiusKm >= 300) {
        try { normalMap = normalMapFrom(canvas, 1.6, m.radiusKm >= 1000 ? 512 : 256); } catch (e) { normalMap = null; }
      }
      if (map.userData) map.userData.canvas = null;
      const mat = rt.mesh.material;
      mat.map = map;
      if (normalMap) { mat.normalMap = normalMap; mat.normalScale = new THREE.Vector2(m.bump || 1.1, m.bump || 1.1); }
      rt.baseTint = new THREE.Color(0xffffff);   // 专属贴图自带颜色，撤掉共享贴图的色偏
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    } catch (e) { /* 生成失败就继续用共享贴图 */ }
  }

  #buildMoon(m) {
    const parent = this.bodies.get(m.parent);
    if (!parent) return;
    const base = bodyRadiusUnits(m.radiusKm);
    const display = Math.max(base, moonDisplayFloor(parent.radiusUnits));
    const group = new THREE.Object3D();
    group.name = m.id;

    const axisNode = new THREE.Object3D();
    axisNode.quaternion.copy(parent.axisNode.quaternion);
    group.add(axisNode);

    /* 贴图策略
       153 颗卫星如果都在启动时现场生成程序化贴图，光这一步就要一秒半
       （19 颗大卫星各要画上百个环形山 + 推一张法线图）。
       但它们在远景里连一个像素都不到——所以先统一用外观族的共享贴图顶上，
       等哪颗真的进入视野（LOD 通过）再在空闲帧里把专属贴图换上去。
       既不影响观感，启动也不必为看不见的东西买单。 */
    let map = null;
    const shared = true;
    let pendingOwn = false;
    if (m.texture && textures[m.texture]) {
      map = textures[m.texture];
    } else {
      // 全部卫星先挂族贴图占位，真正飞近看时再换成专属贴图。
      // 之前只给 200 km 以上的换，结果小卫星放大后是一团糊的共享贴图。
      map = sharedMoonTexture(m.fam || 'rock');
      pendingOwn = true;
    }
    let normalMap = null;
    if (!pendingOwn) {
      const canvas = map.userData && map.userData.canvas
        ? map.userData.canvas
        : (map.image instanceof HTMLCanvasElement ? map.image
          : (map.image && map.image.width ? imageToCanvas(map.image) : null));
      if (canvas && m.radiusKm >= 300) {
        // 300 km 以下的卫星在屏幕上不超过几十像素，法线图的凹凸完全看不见
        try { normalMap = normalMapFrom(canvas, 1.6, m.radiusKm >= 1000 ? 512 : 256); } catch (e) { normalMap = null; }
      }
      if (map.userData) map.userData.canvas = null;   // 已上传显存，释放 CPU 端画布
    }
    const mat = planetMaterial({
      map, normalMap, bumpScale: m.bump || 1.1,
      roughness: (m.rock && m.rock.roughness != null) ? m.rock.roughness : 0.9,
    });
    if (shared && m.ui) mat.color = new THREE.Color(m.ui);   // 共享贴图靠色偏拉开差别
    const mesh = new THREE.Mesh(m.radiusKm >= 1000 ? GEO_BODY : GEO_SMALL, mat);
    mesh.scale.setScalar(display);
    axisNode.add(mesh);

    if (m.atmosphere) {
      const am = new THREE.Mesh(GEO_SHELL, atmosphereMaterial(m.atmosphere));
      am.scale.setScalar(display * m.atmosphere.altitude);
      axisNode.add(am);
    }

    const runtime = {
      data: m, parent, group, axisNode, mesh,
      radiusUnits: display, radiusKm: m.radiusKm,
      position: group.position, orbitLine: null, isMoon: true,
      orbitScale: 1,
      pendingOwn,          // 专属贴图还没生成，进入视野后再补
    };
    this.scene.add(group);
    this.#register(runtime);
    this.#makeOrbitLine(runtime);
  }

  #mapsFor(p) {
    const map = textures[p.texture] || null;
    const out = { map };
    const img = map && map.image;
    const canvasOf = t => (t && t.image instanceof HTMLCanvasElement) ? t.image : null;
    if (img && p.bump && ['mercury', 'mars', 'pluto'].includes(p.id)) {
      try {
        const canvas = canvasOf(map) || imageToCanvas(img);
        out.normalMap = normalMapFrom(canvas, p.id === 'mercury' ? 2.4 : 1.9, 1024);
      } catch (e) { /* 忽略：退回纯色 */ }
    }
    if (p.id === 'earth' && map) {
      try {
        const canvas = canvasOf(map) || imageToCanvas(map.image);
        out.normalMap = normalMapFrom(canvas, 1.2, 1024);
        out.roughnessMap = earthRoughnessFrom(canvas, 1024);
      } catch (e) { /* 忽略 */ }
    }
    if (p.id === 'venus' && textures.venus) out.map = textures.venus;
    return out;
  }

  /* ── 轨道线 ───────────────────────────────────────── */
  #makeOrbitLine(runtime) {
    const isMoon = !!runtime.isMoon;
    const n = isMoon ? 128 : (runtime.data.type === 'planet' ? 512 : 128);
    const arr = new Float32Array((n + 1) * 3);   // 多一个顶点用于闭合
    if (isMoon) {
      // 卫星轨道线挂到母星组下：母星每帧移动会自动带动它，
      // 几何只描述「轨道面内的椭圆」（单位 km），节点与近点进动用四元数表达。
      const a = runtime.data.orbit.a;
      const e = runtime.data.orbit.e || 0;
      for (let i = 0; i < n; i++) {
        const nu = (i / n) * Math.PI * 2;
        const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
        arr[i * 3] = r * Math.cos(nu);
        arr[i * 3 + 1] = r * Math.sin(nu);
      }
    }
    /* 闭合环：多留一个顶点，让最后一点与首点重合。
       用 THREE.Line 时如果只给 n 个点，第 n−1 点回到第 0 点的那一段不会画出来——
       地球轨道 512 点，缺口占 0.2%，在 30 单位半径的轨道上是约 0.37 单位，
       看起来就像行星没接上自己的轨道。 */
    for (let k = 0; k < 3; k++) arr[n * 3 + k] = arr[k];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({
      color: ORBIT_COLOR,
      transparent: true,
      opacity: isMoon ? 0.16 : 0.26,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;   // 关闭视锥剔除，因而无需包围球
    line.renderOrder = 1;
    (isMoon && runtime.parent ? runtime.parent.group : this.scene).add(line);
    runtime.orbitLine = line;
    runtime.orbitSegments = n;
    if (isMoon) line.scale.setScalar(runtime.orbitScale || 1);
  }

  /** 重新解算全部轨道线（尺度变化、初始化时调用） */
  refreshOrbits() {
    for (const rt of this.list) {
      if (rt.isSun || !rt.orbitLine) continue;
      if (rt.isMoon) this.#updateMoonOrbit(rt);
      else this.#updatePlanetOrbit(rt);
    }
    this.lastPlanetOrbitJd = this.currentJd;
    this.lastMoonOrbitJd = this.currentJd;
  }

  /**
   * 逐帧节流：行星轨道线的形状变化是百年量级（水星节点每年 0.003°），
   * 按年更新足够；卫星的进动由四元数表达，更新是 O(1)，按 20 天更新。
   */
  #refreshOrbitsThrottled(jd) {
    if (Math.abs(jd - this.lastMoonOrbitJd) > 20) {
      this.lastMoonOrbitJd = jd;
      for (const rt of this.list) {
        if (rt.isMoon && rt.orbitLine) this.#updateMoonOrbit(rt);
      }
    }
    if (Math.abs(jd - this.lastPlanetOrbitJd) > 365.25) {
      this.lastPlanetOrbitJd = jd;
      for (const rt of this.list) {
        if (!rt.isMoon && !rt.isSun && rt.orbitLine) this.#updatePlanetOrbit(rt);
      }
    }
  }

  #updatePlanetOrbit(rt) {
    const p = rt.data;
    const el = p.elements;
    const T = (this.currentJd - 2451545.0) / 36525 || 0;
    const a = el.a + el.da * T, e = Math.max(0, el.e + el.de * T);
    const inc = (el.i + el.di * T) * Math.PI / 180;
    const node = (el.node + el.dnode * T) * Math.PI / 180;
    const peri = (el.peri + el.dperi * T) * Math.PI / 180;
    const w = peri - node;
    const cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(inc), si = Math.sin(inc);
    const cO = Math.cos(node), sO = Math.sin(node);
    const arr = rt.orbitLine.geometry.attributes.position.array;
    const n = rt.orbitSegments;
    for (let i = 0; i <= n; i++) {
      const nu = (i / n) * Math.PI * 2;
      const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
      const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
      const x = (cw * cO - sw * ci * sO) * xp + (-sw * cO - cw * ci * sO) * yp;
      const y = (cw * sO + sw * ci * cO) * xp + (-sw * sO + cw * ci * cO) * yp;
      const z = (sw * si) * xp + (cw * si) * yp;
      const s = auToUnits(r) / Math.max(r, 1e-9);
      arr[i * 3] = x * s;
      arr[i * 3 + 1] = z * s;
      arr[i * 3 + 2] = -y * s;
    }
    rt.orbitLine.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 卫星轨道线朝向
   * 与 moonLocalPosition 完全同构：先取轨道面内的椭圆点 v，
   * 再 scene = Q_母星极轴 · C · Rz(Ω)·Rx(i)·Rz(ω−Ω) · v
   * 因此轨道线永远与卫星所在的解析轨道严格重合，且母星移动时自动跟随。
   */
  #updateMoonOrbit(rt) {
    const o = rt.data.orbit;
    const d = this.currentJd - J2000;
    const inc = (o.inc || 0) * DEG2RAD;
    const node = ((o.node || 0) + (o.dnode || 0) * d) * DEG2RAD;
    const peri = ((o.peri || 0) + (o.dperi || 0) * d) * DEG2RAD;
    _qa.setFromAxisAngle(AXIS_Z, node);
    _qb.setFromAxisAngle(AXIS_X, inc);
    _qc.setFromAxisAngle(AXIS_Z, peri - node);
    _qa.multiply(_qb).multiply(_qc);
    _qa.premultiply(ECL_TO_SCENE);
    if (o.frame !== 'ecliptic') _qa.premultiply(rt.parent.axisNode.quaternion);
    rt.orbitLine.quaternion.copy(_qa);
    rt.orbitLine.scale.setScalar(rt.orbitScale || 1);
  }

  /**
   * 尺度参数变化后重建尺寸
   */
  applyScale() {
    const sun = this.bodies.get('sun');
    if (sun) {
      const r = sunRadiusUnits();
      sun.radiusUnits = r;
      sun.group.children.forEach((c, i) => {
        const k = [1, 1.06, 1.32, 1.9, 4.5][i];
        if (k != null) c.scale.setScalar(r * k);
      });
      // 上面按子节点顺序缩放，太阳本体也是 1×
      sun.mesh.scale.setScalar(r);
    }
    for (const rt of this.list) {
      if (rt.isSun) continue;
      const r = bodyRadiusUnits(rt.radiusKm);
      if (rt.isMoon) {
        const parent = rt.parent;
        rt.radiusUnits = Math.max(r, moonDisplayFloor(parent.radiusUnits));
      } else {
        rt.radiusUnits = r;
      }
      rt.mesh.scale.setScalar(rt.radiusUnits);
      if (rt.clouds) rt.clouds.scale.setScalar(rt.radiusUnits * rt.data.clouds.altitude);
      if (rt.atmosphere) rt.atmosphere.scale.setScalar(rt.radiusUnits * rt.data.atmosphere.altitude);
      if (rt.rings) {
        rt.rings.scale.setScalar(rt.radiusUnits);
        if (rt.ringShadowUniforms) {
          const ri = rt.radiusKm;
          rt.ringShadowUniforms.uRingInner.value = (rt.data.rings.innerKm / ri) * rt.radiusUnits;
          rt.ringShadowUniforms.uRingOuter.value = (rt.data.rings.outerKm / ri) * rt.radiusUnits;
        }
        if (rt.rings.material.uniforms.uPlanetR) rt.rings.material.uniforms.uPlanetR.value = rt.radiusUnits;
      }
      if (rt.isMoon) {
        const p = rt.parent;
        rt.orbitScale = moonOrbitUnits(rt.data.orbit.a, p.radiusKm, p.radiusUnits) / rt.data.orbit.a;
      }
    }
    /* 每个行星的「卫星系统半径」= 最外层卫星的轨道半径。
       判断「相机是否在看这个卫星系统」必须用它，而不是每颗卫星自己的轨道半径：
       否则在木星的取景距离上，内圈的木卫一会被判成「母星太远」而整颗消失。 */
    for (const rt of this.list) {
      if (rt.isMoon || rt.isSun) continue;
      rt.sysOrbitR = 0;
    }
    for (const rt of this.list) {
      if (!rt.isMoon || !rt.parent) continue;
      const p = rt.parent;
      p.sysOrbitR = Math.max(p.sysOrbitR || 0, (rt.orbitScale || 1) * rt.data.orbit.a);
    }
    if (this.minorTargets) {
      for (const rt of this.minorTargets.values()) {
        rt.radiusUnits = bodyRadiusUnits(rt.data.radiusKm);
        if (rt.mesh) rt.mesh.scale.setScalar(rt.radiusUnits);
      }
    }
    if (this.cometTargets) {
      for (const rt of this.cometTargets.values()) {
        rt.radiusUnits = bodyRadiusUnits(rt.data.radiusKm);
        if (rt.mesh) rt.mesh.scale.setScalar(rt.radiusUnits);
      }
    }
    if (this.satTargets) {
      const earth = this.bodies.get('earth');
      for (const rt of this.satTargets.values()) {
        rt.radiusUnits = moonOrbitUnits(rt.data.aKm, earth.radiusKm, earth.radiusUnits);
      }
    }
    this.refreshOrbits();
    this.populations.applyScale();
  }

  /**
   * 小实体（小行星 / 彗核）
   * 用共享外观族贴图先顶上，飞近后再按需换成专属贴图——
   * 与卫星同一套策略，因此不会为看不见的东西付出启动成本。
   */
  #makeSmallBody(rt, { fam, rock, ui, bump = 1.2 }) {
    const mat = planetMaterial({
      map: sharedMoonTexture(fam), bumpScale: bump, roughness: rock.roughness || 0.9,
    });
    mat.color = new THREE.Color(ui || 0xffffff);
    const mesh = new THREE.Mesh(GEO_SMALL, mat);
    mesh.scale.setScalar(rt.radiusUnits);
    mesh.visible = false;
    this.scene.add(mesh);
    rt.mesh = mesh;
    rt.pendingOwn = true;
    rt.ownRock = { seed: 3000 + (rt.data.num || 0) + rt.data.id.length * 17, ...rock };
    rt.baseTint = new THREE.Color(ui || 0xffffff);
    rt.lit = 1;
  }

  /** 彗尾贴图：靠核一端亮，向外渐隐 */
  #tailTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d');
    const img = g.createImageData(64, 256);
    for (let y = 0; y < 256; y++) {
      const t = y / 255;                      // 0 = 靠近彗核
      const along = Math.pow(1 - t, 1.7);      // 沿轴渐隐
      const halfW = 0.10 + t * 0.75;           // 向外张开
      for (let x = 0; x < 64; x++) {
        const u = (x / 63) * 2 - 1;
        const radial = Math.max(0, 1 - Math.abs(u) / halfW);
        const a = Math.pow(radial, 1.6) * along;
        const i = (y * 64 + x) * 4;
        img.data[i] = 200 + 55 * a;
        img.data[i + 1] = 225 + 30 * a;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 235);
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 以太阳为中心的光影
   * --------------------
   * 母星挡住阳光时，卫星会落进它的本影或半影——这就是真实的日月食。
   * 本影内几乎全暗（保留一点行星反照），半影按位置线性过渡。
   * 光来自太阳这一点本来就成立（唯一主光源就在原点），
   * 这里补的是「谁被谁挡住」这一层。
   */
  #updateEclipses() {
    const sun = this.bodies.get('sun');
    if (!sun) return;
    for (const rt of this.list) {
      if (!rt.isMoon || !rt.parent || !rt.mesh) continue;
      const p = rt.parent;
      _v1.copy(sun.position).sub(p.position).normalize();     // 母星 → 太阳
      _v2.copy(rt.position).sub(p.position);                  // 母星 → 卫星
      const along = _v2.dot(_v1);
      let f = 1;
      if (along < 0) {
        const perp = Math.sqrt(Math.max(0, _v2.lengthSq() - along * along));
        const Rp = p.radiusUnits;
        f = perp < Rp ? 0.07
          : (perp < Rp * 1.35 ? 0.07 + 0.93 * ((perp - Rp) / (Rp * 0.35)) : 1);
      }
      if (Math.abs(f - (rt.lit == null ? 1 : rt.lit)) > 0.02) {
        rt.lit = f;
        rt.mesh.material.color.copy(rt.baseTint || WHITE).multiplyScalar(f);
      }
    }
  }

  /* ── 著名地点标记 ─────────────────────────────────── */
  /**
   * 把标记挂到天体的 mesh 上，让标记与地表一起自转——
   * 这样经纬度只需换算成单位球上的局部坐标，不必再跟自转相位较劲。
   * 局部坐标与 three.js SphereGeometry 的等距圆柱投影一致：
   *   θ = 90° − 纬度,  u = (经度 + 180) / 360
   *   x = −cos(2πu)·sinθ,  y = cosθ,  z = sin(2πu)·sinθ
   */
  showLandmark(rt, lm) {
    if (!rt || !rt.mesh || !lm) return null;
    if (!this._lmMarker) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      g.strokeStyle = 'rgba(255,217,122,0.95)';
      g.lineWidth = 5;
      g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,217,122,0.5)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,240,200,1)';
      g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this._lmMarker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      }));
      this._lmMarker.renderOrder = 5;
    }
    const lat = lm[3] * DEG, lon = lm[4] * DEG;
    const theta = Math.PI / 2 - lat;
    const phi = ((lon + 180) / 360) * Math.PI * 2;
    const p = _v1.set(
      -Math.cos(phi) * Math.sin(theta),
      Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
    );
    this._lmRT = rt;
    if (this._lmMarker.parent !== rt.mesh) rt.mesh.add(this._lmMarker);
    this._lmMarker.position.copy(p).multiplyScalar(1.04);
    this._lmMarker.scale.setScalar(0.22);
    this._lmMarker.visible = true;
    return p;
  }

  hideLandmark() {
    if (this._lmMarker) this._lmMarker.visible = false;
    this._lmRT = null;
  }

  /** 标记的世界坐标（自行更新矩阵，保证本帧就能用） */
  landmarkWorldPosition() {
    if (!this._lmRT || !this._lmMarker || !this._lmMarker.visible) return null;
    this._lmRT.mesh.updateWorldMatrix(true, false);
    return this._lmMarker.getWorldPosition(new THREE.Vector3());
  }

  /* ── 逐帧 ─────────────────────────────────────────── */
  update(jd, elapsed) {
    this.currentJd = jd;
    this.populations.update(jd);
    const sunRT = this.bodies.get('sun');
    if (sunRT) {
      sunRT.mesh.material.uniforms.uTime.value = elapsed;
      // 太阳缓慢自转
      sunRT.mesh.rotation.y = (jd - 2451545.0) / 25.38 * Math.PI * 2 % (Math.PI * 2);
    }

    for (const p of PLANETS) {
      const rt = this.bodies.get(p.id);
      if (!rt) continue;
      const st = planetState(p, jd);
      rt.state = st;
      const s = auToUnits(st.r) / Math.max(st.r, 1e-9);
      rt.position.set(st.p.x * s, st.p.z * s, -st.p.y * s);
      rt.sunDistanceAu = st.r;
      rt.speedKmS = st.speedKmS;
      rt.helioAu = st.p;
      this.#applySpin(rt, jd);
    }

    // 卫星：需要母星位置先就位
    // 屏幕半径的换算系数：pixels = radiusUnits / distance * screenScale
    const ss = ((this.height || 900) * 0.5) / Math.tan(this.camera.fov * Math.PI / 360);
    for (const m of MOONS) {
      const rt = this.bodies.get(m.id);
      if (!rt) continue;
      const parent = rt.parent;
      const local = moonLocalPosition(m, jd);
      const scale = rt.orbitScale || 1;
      _v1.set(local.x, local.z, -local.y).multiplyScalar(scale);
      // 规则卫星的根数相对母星赤道面（默认），月球相对黄道面
      if (m.orbit.frame !== 'ecliptic') _v1.applyQuaternion(parent.axisNode.quaternion);
      rt.position.copy(parent.position).add(_v1);
      const rKm = Math.hypot(local.x, local.y, local.z);
      rt.sunDistanceAu = (parent.state && parent.state.r) || 0;
      rt.speedKmS = moonSpeedKmS(m, BY_ID[m.parent], rKm);
      rt.parentDistanceKm = rKm;
      rt.helioAu = parent.helioAu || null;      // 潮汐锁定：同一面朝向母星
      const lx = local.x, lz = -local.y;
      rt.mesh.rotation.y = Math.atan2(lz, -lx);
      rt.axisNode.quaternion.copy(parent.axisNode.quaternion);

      /* 卫星 LOD
         一百五十多颗卫星如果全部提交绘制，光绘制调用就上百，而它们在远景里
         连一个像素都不到。这里按「母星够近 + 自身屏幕半径够大」两个条件剔除：
         离母星远时整族一起收掉，靠近时再逐颗按像素判定。 */
      const dist = _v2.copy(this.camera.position).sub(parent.position).length();
      const near = dist < Math.max(parent.sysOrbitR || 0, parent.radiusUnits * 30) * 2.5;
      /* 屏幕半径必须用「相机到这颗卫星自己」的距离。
         飞到卫星跟前时，它离母星可能还有几个百分点，但离相机只有千分之一——
         拿母星距离去算，会把一颗已经占满半个屏幕的卫星判成 0.8 像素然后整个隐藏，
         表现就是「放大之后什么都看不见」，贴图也永远不会升级。 */
      const dm = _v3.copy(this.camera.position).sub(rt.position).length();
      const px = (rt.radiusUnits / Math.max(dm, 1e-9)) * ss;
      const show = (near && px >= 0.32) || !!rt.isSelected;
      rt.lodVisible = show;
      if (rt.mesh.visible !== show) rt.mesh.visible = show;
      // 0.32px 只是「该画了」，还远不到「该生成贴图」：
      // 等到屏幕半径超过 6px（真成一个圆面）再生成，避免飞行途中无谓的卡顿
      if (show && rt.pendingOwn && px >= 6) this.pendingOwnTextures.push(rt);
    }

    // 每帧最多补一颗：即便一次飞进木星系，也只在几帧内补齐，感觉不到
    if (this.pendingOwnTextures.length) {
      // 同一颗可能连续几帧都被推进队列，出队时去重
      const rt = this.pendingOwnTextures.shift();
      if (rt.pendingOwn) this.#buildOwnTexture(rt);
    }

    // 已命名小行星：真实根数逐颗解算，落在主带里正确的位置上
    if (this.minorLayer) {
      const { list, geom } = this.minorLayer;
      const arr = geom.attributes.position.array;
      for (let i = 0; i < list.length; i++) {
        const rt = list[i];
        const el = rt.data.orbit;
        const M = (el.M0 + (360 / el.period) * (jd - J2000)) * DEG;
        const nu = M + (2 * el.e - 0.25 * el.e ** 3) * Math.sin(M) + 1.25 * el.e * el.e * Math.sin(2 * M);
        const r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
        const w = (el.peri - el.node) * DEG;
        const cw = Math.cos(w), sw = Math.sin(w);
        const ci = Math.cos(el.inc * DEG), si = Math.sin(el.inc * DEG);
        const cO = Math.cos(el.node * DEG), sO = Math.sin(el.node * DEG);
        const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
        const x = (cw * cO - sw * ci * sO) * xp + (-sw * cO - cw * ci * sO) * yp;
        const y = (cw * sO + sw * ci * cO) * xp + (-sw * sO + cw * ci * cO) * yp;
        const z = (sw * si) * xp + (cw * si) * yp;
        const sc = auToUnits(r) / Math.max(r, 1e-9);
        arr[i * 3] = x * sc; arr[i * 3 + 1] = z * sc; arr[i * 3 + 2] = -y * sc;
        rt.position.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      }
      geom.attributes.position.needsUpdate = true;
    }

    this.#stepRocket(jd);
    // 小行星与彗星：位置、可见性、按需贴图，以及彗发与彗尾
    this.#stepSmallBodies(jd, ss);

    // 轨道线按类型节流更新（详见 #refreshOrbitsThrottled）
    this.#refreshOrbitsThrottled(jd);
  }

  /** 小行星与彗星的逐帧处理 */
  #stepSmallBodies(jd, ss) {
    const sun = this.bodies.get('sun');
    const step = (layer, list) => {
      if (!layer) return;
      const arr = layer.geom.attributes.position.array;
      for (let i = 0; i < list.length; i++) {
        const rt = list[i];
        const el = rt.data.orbit;
        const M = (el.M0 + (360 / el.period) * (jd - J2000)) * DEG;
        const e = el.e;
        const nu = M + (2 * e - 0.25 * e ** 3) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
        const r = el.a * (1 - e * e) / (1 + e * Math.cos(nu));
        const w = (el.peri - el.node) * DEG;
        const cw = Math.cos(w), sw = Math.sin(w);
        const ci = Math.cos(el.inc * DEG), si = Math.sin(el.inc * DEG);
        const cO = Math.cos(el.node * DEG), sO = Math.sin(el.node * DEG);
        const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
        const x = (cw * cO - sw * ci * sO) * xp + (-sw * cO - cw * ci * sO) * yp;
        const y = (cw * sO + sw * ci * cO) * xp + (-sw * sO + cw * ci * cO) * yp;
        const z = (sw * si) * xp + (cw * si) * yp;
        const sc = auToUnits(r) / Math.max(r, 1e-9);
        arr[i * 3] = x * sc; arr[i * 3 + 1] = z * sc; arr[i * 3 + 2] = -y * sc;
        rt.position.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
        rt.helioAu = { x, y, z };
        this.#placeSmallBody(rt, sun, ss, r);
      }
      layer.geom.attributes.position.needsUpdate = true;
    };
    step(this.minorLayer, this.minorLayer ? this.minorLayer.list : []);
    step(this.cometLayer, this.cometLayer ? this.cometLayer.list : []);
  }

  /** 摆好小实体本体，并处理 LOD 与彗发彗尾 */
  #placeSmallBody(rt, sun, ss, rAu) {
    const mesh = rt.mesh;
    if (!mesh) return;
    const dm = _v3.copy(this.camera.position).sub(rt.position).length();
    const px = (rt.radiusUnits / Math.max(dm, 1e-9)) * ss;
    const show = px >= 0.32 || !!rt.isSelected;
    if (mesh.visible !== show) mesh.visible = show;
    rt.lodVisible = show;
    if (show) {
      mesh.position.copy(rt.position);
      if (rt.pendingOwn && px >= 6) this.pendingOwnTextures.push(rt);
    }
    // 彗星：活动强度按 r^-2.5，彗发与彗尾都跟着变
    if (rt.isComet && rt.coma) {
      const act = Math.min(1.4, Math.pow(1.2 / Math.max(rAu, 0.08), 2.5));
      rt.act = act;
      const on = act > 0.06;
      if (rt.coma.visible !== on) { rt.coma.visible = on; rt.tail.visible = on; rt.tail2.visible = on; }
      if (on) {
        const comaR = Math.max(auToUnits(0.0009 * act), rt.radiusUnits * 4);
        rt.coma.position.copy(rt.position);
        rt.coma.scale.setScalar(comaR);
        // 反向太阳方向：这是彗尾永远背向太阳的原因
        _v1.copy(rt.position).sub(sun.position);
        if (_v1.lengthSq() < 1e-12) _v1.set(0, 1, 0);
        _v1.normalize();
        const len = Math.max(auToUnits(0.09 * act), rt.radiusUnits * 20);
        for (const [tail, k, side] of [[rt.tail, 1, 0], [rt.tail2, 0.62, 0.5]]) {
          // 让平面朝相机、长轴沿反日向
          _v2.copy(this.camera.position).sub(rt.position).normalize();
          _qc.setFromUnitVectors(AXIS_Z, _v1).premultiply(_qb.setFromUnitVectors(AXIS_Z, _v2));
          const cy = new THREE.Vector3(0, 1, 0).applyQuaternion(_qc);
          const cx = new THREE.Vector3().crossVectors(cy, _v2).normalize();
          const cz = new THREE.Vector3().crossVectors(cx, cy).normalize();
          _m3.makeBasis(cx, cy, cz);
          tail.quaternion.setFromRotationMatrix(_m3);
          const L = len * k;
          tail.scale.set(L * 0.30, L, 1);
          tail.position.copy(rt.position).addScaledVector(_v1, L * 0.5)
            .addScaledVector(cx, side * L * 0.12);
        }
      }
    }
  }

  /** 火箭：420 km 低轨圆轨道，机头始终指向速度方向 */
  #stepRocket(jd) {
    const R = this.rocket;
    if (!R || R.free) return;      // 自由飞行时由 flyRocket 接管
    const earth = this.bodies.get('earth');
    const period = 2 * Math.PI * Math.sqrt(Math.pow(R.aKm * 1000, 3) / 3.986004418e14) / 86400;
    const rUnits = moonOrbitUnits(R.aKm, earth.radiusKm, earth.radiusUnits);
    const M = (R.M0 + (360 / period) * (jd - J2000)) * DEG;
    const nu = M + (2 * R.e - 0.25 * R.e ** 3) * Math.sin(M) + 1.25 * R.e * R.e * Math.sin(2 * M);
    const r = rUnits * (1 - R.e * R.e) / (1 + R.e * Math.cos(nu));
    const m = planeMatrix(R.inc, R.node, R.peri);
    const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
    const x = m[0] * xp + m[1] * yp;
    const y = m[4] * xp + m[5] * yp;
    const z = -(m[2] * xp + m[3] * yp);
    _v2.set(x, y, z).applyQuaternion(earth.axisNode.quaternion).add(earth.position);
    R.group.position.copy(_v2);
    R.scale = earth.radiusUnits * R.L;
    R.group.scale.setScalar(R.scale);
    const dvx = -Math.sin(nu), dvy = Math.cos(nu);
    const vx = m[0] * dvx + m[1] * dvy;
    const vy = m[4] * dvx + m[5] * dvy;
    const vz = -(m[2] * dvx + m[3] * dvy);
    const dir = _v1.set(vx, vy, vz).applyQuaternion(earth.axisNode.quaternion).normalize();
    R.group.quaternion.setFromUnitVectors(YAXIS, dir);
    const t = (jd - J2000) * 24 * 60;
    const flick = 0.82 + 0.18 * Math.sin(t * 6.3) + 0.1 * Math.sin(t * 17.7);
    R.flame.scale.setScalar(0.55 * flick);
    R.flame.material.opacity = 0.72 * flick;
    R.forward.copy(dir);
  }

  #applySpin(rt, jd) {
    const body = rt.data;
    const a = spinAngle(body, jd);
    rt.mesh.rotation.y = a;
    if (rt.clouds) {
      const k = (body.clouds && body.clouds.spinScale) || 1;
      rt.clouds.rotation.y = a * k + (body.id === 'venus' ? 0.4 : 0);
    }
    rt.axisYaw = rt.axisNode.rotation.y || 0;
  }

  updateShading() {
    this.#updateEclipses();
    const cam = this.camera;
    // 确保视图矩阵是最新的（片元里用视图空间法线判断昼夜）
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    for (const rt of this.list) {
      if (rt.isSun) continue;
      _v2.copy(rt.position).negate();                 // 太阳在原点
      const len = _v2.length() || 1;
      _v2.multiplyScalar(1 / len);
      if (rt.atmosphere) rt.atmosphere.material.uniforms.uSunDir.value.copy(_v2);
      if (rt.nightUniforms) {
        // 转到视图空间：片元里拿到的 normal 是视图空间
        this.sunDirView.copy(_v2).transformDirection(cam.matrixWorldInverse);
        rt.nightUniforms.uSunDirView.value.copy(this.sunDirView);
      }
      if (rt.ringShadowUniforms) {
        rt.ringShadowUniforms.uRingCenter.value.copy(rt.position);
        rt.ringShadowUniforms.uRingNormal.value.set(rt.axis[0], rt.axis[1], rt.axis[2]);
      }
      if (rt.rings) {
        rt.rings.material.uniforms.uCenter.value.copy(rt.position);
      }
    }
  }

  /**
   * 世界坐标 → 屏幕像素；同时给出该天体的屏幕半径
   * 返回值是复用的临时对象，调用方需立即取值，不要长期持有。
   * @returns {{x:number,y:number,radius:number,visible:boolean}}
   */
  project(worldPos, camera, radiusUnits = 0) {
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    _v1.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
    const inFront = _v1.z < -camera.near;
    _v1.copy(worldPos).project(camera);
    const x = (_v1.x * 0.5 + 0.5) * w;
    const y = (-_v1.y * 0.5 + 0.5) * h;
    let radius = 0;
    if (radiusUnits > 0) {
      const e = camera.matrixWorld.elements;
      _v2.set(e[0], e[1], e[2]).multiplyScalar(radiusUnits);
      _v2.add(worldPos).project(camera);
      radius = Math.hypot((_v2.x - _v1.x) * 0.5 * w, (_v2.y - _v1.y) * 0.5 * h);
    }
    const out = _proj;
    out.x = x; out.y = y; out.radius = radius;
    out.visible = inFront && _v1.z < 1 && x > -180 && x < w + 180 && y > -180 && y < h + 180;
    return out;
  }
}

function imageToCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

/** 让出主线程一帧，卫星贴图分批生成时使用 */
function nextFrame() {
  return new Promise(resolve => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      window.requestAnimationFrame(() => resolve());
    }
  });
}
