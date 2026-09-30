/**
 * 材质与着色器
 * ------------
 * · 太阳：表面粒化 + 临边昏暗 + 动态扰动，外挂两层日冕辉光
 * · 大气：菲涅尔边缘散射，只照亮被太阳照到的一侧
 * · 夜面城市灯光：注入 standard 材质，仅在背光面自发光（地球）
 * · 土星环影：解析式圆盘-球体阴影，环在行星上的投影 + 行星在环上的投影
 */

import * as THREE from 'three';

const COMMON_NOISE = /* glsl */`
  float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm2(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
`;

/* ── 太阳表面 ───────────────────────────────────────────── */
export function sunSurfaceMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uIntensity: { value: 1.35 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      void main(){
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      ${COMMON_NOISE}
      void main(){
        // 缓慢对流：两层噪声错位采样，模拟米粒组织流动
        float t = uTime * 0.012;
        vec2 warp = vec2(fbm2(vUv*7.0 + t), fbm2(vUv*7.0 - t + 11.3)) - 0.5;
        vec3 c = texture2D(uMap, vUv + warp*0.006).rgb;
        float gran = fbm2(vUv * 140.0 + warp * 2.0);
        c *= 0.82 + gran * 0.42;
        float limb = pow(max(dot(normalize(vN), normalize(vView)), 0.0), 0.42);
        c *= mix(0.5, 1.42, limb);
        // 让色温略偏暖，超出 1.0 的部分交给 bloom
        gl_FragColor = vec4(c * uIntensity * vec3(1.0, 0.94, 0.82), 1.0);
      }
    `,
  });
}

/* ── 日冕 / 辉光 ────────────────────────────────────────── */
export function coronaMaterial(color = 0xffb347) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 2.6 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vView;
      varying vec3 vLocal;
      void main(){
        vLocal = normalize(position);
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vN;
      varying vec3 vView;
      void main(){
        float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0), uPower);
        gl_FragColor = vec4(uColor * f * uIntensity, f);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/* ── 行星大气 ───────────────────────────────────────────── */
export function atmosphereMaterial({ color, power = 3.0, intensity = 1.0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },   // 世界坐标，指向太阳
    },
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vView;
      varying vec3 vWorldN;
      void main(){
        vN = normalize(normalMatrix * normal);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform vec3 uSunDir;
      varying vec3 vN;
      varying vec3 vView;
      varying vec3 vWorldN;
      void main(){
        float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0), uPower);
        float sun = smoothstep(-0.45, 0.55, dot(normalize(vWorldN), normalize(uSunDir)));
        float a = fres * uIntensity * (0.06 + 1.25 * sun);
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/* ── 云层 ───────────────────────────────────────────────── */
export function cloudMaterial(tex, { color = 0xffffff, opacity = 0.85, useMap = false } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: useMap ? tex : null,
    alphaMap: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
}

/* ── 行星本体 ───────────────────────────────────────────── */
/**
 * @param {object} opts map / normalMap / roughnessMap / color / bumpScale …
 */
export function planetMaterial(opts) {
  const mat = new THREE.MeshStandardMaterial({
    map: opts.map || null,
    normalMap: opts.normalMap || null,
    roughnessMap: opts.roughnessMap || null,
    color: opts.color != null ? opts.color : 0xffffff,
    roughness: opts.roughness != null ? opts.roughness : 0.92,
    metalness: 0.0,
  });
  if (opts.normalMap) mat.normalScale = new THREE.Vector2(opts.bumpScale || 1, opts.bumpScale || 1);
  return mat;
}

/** 注入夜面城市灯光（地球） */
export function enableNightLights(mat) {
  const uniforms = { uSunDirView: { value: new THREE.Vector3(0, 0, 1) } };
  mat.onBeforeCompile = shader => {
    shader.uniforms.uSunDirView = uniforms.uSunDirView;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float night = smoothstep(0.22, -0.16, dot(normal, uSunDirView));
        totalEmissiveRadiance *= night;`);
  };
  mat.needsUpdate = true;
  return uniforms;
}

/** 注入土星环投影（环在行星表面的阴影） */
export function enableRingShadow(mat, opts) {
  const uniforms = {
    uSunPos: { value: new THREE.Vector3() },
    uRingCenter: { value: new THREE.Vector3() },
    uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
    uRingInner: { value: opts.inner },
    uRingOuter: { value: opts.outer },
    uRingShadow: { value: opts.strength != null ? opts.strength : 0.78 },
  };
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRingWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRingWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRingWPos;
        uniform vec3 uSunPos;
        uniform vec3 uRingCenter;
        uniform vec3 uRingNormal;
        uniform float uRingInner;
        uniform float uRingOuter;
        uniform float uRingShadow;
        float ringShadowFactor(){
          vec3 rd = normalize(uSunPos - vRingWPos);
          float dn = dot(rd, uRingNormal);
          if (abs(dn) < 1e-4) return 1.0;
          float t = dot(uRingCenter - vRingWPos, uRingNormal) / dn;
          if (t <= 0.0) return 1.0;
          vec3 hit = vRingWPos + rd * t;
          float rad = length(hit - uRingCenter);
          float e = (uRingOuter - uRingInner) * 0.012;
          float band = smoothstep(uRingInner - e, uRingInner + e, rad) *
                       (1.0 - smoothstep(uRingOuter - e, uRingOuter + e, rad));
          float grazing = smoothstep(0.0, 0.28, abs(dn));
          return 1.0 - uRingShadow * band * grazing;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= ringShadowFactor();`);
  };
  mat.needsUpdate = true;
  return uniforms;
}

/* ── 环 ─────────────────────────────────────────────────── */
/** 环几何：位于 XZ 平面（法线 +Y），u = 径向归一化 */
export function makeRingGeometry(inner, outer, segments = 320) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    pos.push(ca * inner, 0, sa * inner, ca * outer, 0, sa * outer);
    uv.push(0, 0, 1, 0);
    if (i < segments) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function ringMaterial({ map, opacity = 1, color = 0xffffff, planetRadius = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) },
      uSunPos: { value: new THREE.Vector3() },
      uCenter: { value: new THREE.Vector3() },
      uPlanetR: { value: planetRadius },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vNrm;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vNrm = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec3 uSunPos;
      uniform vec3 uCenter;
      uniform float uPlanetR;
      varying vec2 vUv;
      varying vec3 vWPos;
      varying vec3 vNrm;
      void main(){
        vec4 tex = texture2D(uMap, vec2(vUv.x, 0.5));
        if (tex.a * uOpacity < 0.004) discard;
        vec3 toSun = uSunPos - vWPos;
        float dist = length(toSun);
        vec3 dir = toSun / max(dist, 1e-5);
        // 环：大量冰屑以散射为主，光照方向接近平行环面时最亮
        float lit = 0.42 + 0.58 * abs(dot(normalize(vNrm), dir));
        // 行星投在环上的阴影
        vec3 oc = uCenter - vWPos;
        float tca = dot(oc, dir);
        float d = sqrt(max(dot(oc, oc) - tca * tca, 0.0));
        float shade = tca > 0.0 ? 1.0 - smoothstep(uPlanetR * 0.92, uPlanetR * 1.22, d) : 0.0;
        vec3 col = tex.rgb * uColor * lit * (1.0 - 0.82 * shade);
        gl_FragColor = vec4(col * uOpacity, tex.a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
