/**
 * 场景骨架：渲染器 / 相机 / 控制器 / 灯光 / 星场 / 后期
 *
 * 渲染管线：线性 HDR 渲染到浮点缓冲 → UnrealBloom → ACES 色调映射 → sRGB
 * 这样太阳与恒星的高光才会自然溢出，而不是靠假的光晕贴图。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { starSprite, milkywayTexture } from './textures.js';

const AMBIENT = 0x1b2334;

export function createScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
      stencil: false,
    });
  } catch (err) {
    throw new Error('本页需要 WebGL2，当前浏览器或显卡驱动未提供。');
  }
  const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
  let pixelRatio = maxRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x03050a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  /* 近裁面必须远小于最小卫星的显示半径（1.2×10⁻⁶ 单位），
     否则把镜头推到小卫星跟前时，近半个球体会被裁掉，看上去就是「放大后什么都没有」。
     对数深度缓冲下 1e-8 与 9×10⁵ 的跨度完全可以承受。 */
  const camera = new THREE.PerspectiveCamera(48, 1, 1e-8, 900000);
  camera.position.set(0, 46, 96);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 1.9;   // 真实比例尺下缩放跨度达 10^8，滚轮需更快
  controls.panSpeed = 0.6;
  controls.minDistance = 1e-6;
  controls.maxDistance = 300000;
  controls.minPolarAngle = 0.001;
  controls.maxPolarAngle = Math.PI - 0.001;

  /* 光照：太阳为唯一主光源（视觉上做温和衰减，避免外行星全黑） */
  const sunLight = new THREE.PointLight(0xfff2dc, 100, 0, 1.1);
  scene.add(sunLight);
  const ambient = new THREE.AmbientLight(AMBIENT, 0.72);
  scene.add(ambient);

  /* 银河背景 */
  // 星场半径必须大于「全览」机位（约 17 万单位），否则拉远后背景会整片消失
  const skyR = 320000;
  {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(skyR, 64, 32),
      new THREE.MeshBasicMaterial({
        map: milkywayTexture(),
        side: THREE.BackSide,
        // 参考图的空间是接近纯黑的：银河只留一层几乎看不见的尘埃，
        // 换成高亮度会让画面泛黄、把轨道线和行星全压下去。
        color: 0x1d2126,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    sky.rotation.y = -1.1;
    sky.rotation.z = 0.34;
    sky.renderOrder = -10;
    scene.add(sky);
  }

  /* 程序化恒星星点：远、亮、带色 */
  /* 星点直径不小于约 2.6px：再小就落到亚像素区间，
     相机一动就会整片闪烁（实测旋转时上部星空区有 5.5% 像素帧间跳变 >25）。 */
  const stars = makeStarLayer(skyR * 0.92, 1400, 2.8, 0.5);
  scene.add(stars);
  scene.add(makeStarLayer(skyR * 0.8, 5200, 2.2, 0.34));

  /* 后期
     注意：一旦走 EffectComposer，WebGLRenderer 的 antialias 就失效了
     （渲染目标是 FBO，不是默认帧缓冲），所以显式给渲染目标开 MSAA。
     细轨道线与行星边缘在真实比例尺下非常细，抗锯齿是画质的关键。 */
  /* 太阳体积光（神光）
     沿「当前像素 → 太阳屏幕位置」采样，只累加超过阈值的亮部，
     于是太阳的强光会沿着视线方向拉出光轴；密度与强度都可调。
     放在泛光之前，所以光轴本身也会被 bloom 柔化一层。 */
  const GodRayShader = {
    uniforms: {
      tDiffuse: { value: null },
      uSun: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0.50 },
      uDensity: { value: 0.62 },
      uDecay: { value: 0.955 },
      uThreshold: { value: 0.48 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform vec2 uSun;
      uniform float uStrength, uDensity, uDecay, uThreshold;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec2 delta = (uSun - vUv) * uDensity / 28.0;
        vec2 uv = vUv;
        vec3 acc = vec3(0.0);
        float w = 1.0;
        for (int i = 0; i < 28; i++) {
          uv += delta;
          vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
          float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
          /* 过渡带拉到 1.7：原来 0.9 太窄，远处亮点的亮度只要在阈值附近抖动，
             光轴就会整段忽明忽暗。 */
          acc += s * smoothstep(uThreshold, uThreshold + 1.7, l) * w;
          w *= uDecay;
        }
        gl_FragColor = vec4(base.rgb + acc * uStrength / 28.0 * 2.2, base.a);
      }
    `,
  };

  /* 调色与暗角
     轻微冷调阴影 + 暗角 + 一点点对比，模仿电影感调色。
     放在色调映射之前，作用在 HDR 线性值上。 */
  const GradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      uVignette: { value: 0.40 },
      uTint: { value: new THREE.Vector3(0.965, 0.99, 1.045) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uVignette;
      uniform vec3 uTint;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        /* 只做乘性调色与暗角。
           这一步在线性 HDR 上、色调映射之前，
           任何「以 0.18 为轴」的对比度拉伸都会把暗部推成负数后截断成纯黑。 */
        vec3 c = base.rgb * uTint;
        float d = distance(vUv, vec2(0.5));
        c *= 1.0 - uVignette * smoothstep(0.30, 0.80, d);
        gl_FragColor = vec4(max(c, 0.0), base.a);
      }
    `,
  };

  let composer = null;
  let bloomPass = null;
  let godRayPass = null;
  const bloom = { strength: 0.30, threshold: 1.35 };
  // 轨道线在真实比例尺下只有一根发丝宽，MSAA 是画质的关键。
  // 设备支持就上 8×，不支持再退回 4× / 关闭。
  const maxS = renderer.capabilities.maxSamples || 0;
  const samples = Math.min(8, maxS);
  try {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples,
      depthBuffer: true,
      stencilBuffer: false,
    });
    rt.texture.name = 'solar.rt1';
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloom.strength, 0.34, bloom.threshold);
    composer.addPass(bloomPass);
    godRayPass = new ShaderPass(GodRayShader);
    composer.addPass(godRayPass);
    composer.addPass(new ShaderPass(GradeShader));
    composer.addPass(new OutputPass());
    if (samples > 0) composer.renderTarget1.texture.name = 'solar.rt1';
  } catch (err) {
    console.warn('[solar] 后期管线不可用，退回直接渲染', err);
    composer = null;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
  }

  /** 自适应画质：按实测帧率升降渲染分辨率（1 ~ 设备像素比） */
  function setPixelRatio(r) {
    const v = Math.max(0.6, Math.min(maxRatio, r));
    if (Math.abs(v - pixelRatio) < 0.01) return pixelRatio;
    pixelRatio = v;
    renderer.setPixelRatio(v);
    if (composer) composer.setPixelRatio(v);
    resize();
    return pixelRatio;
  }

  let source = 'composer';
  function render() {
    if (composer) {
      try { composer.render(); return; } catch (err) {
        if (source === 'composer') { console.warn('[solar] 后期渲染失败，退回直接渲染', err); source = 'direct'; }
        composer = null;
      }
    }
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, controls, sunLight, ambient,
    resize, render, skyR, bloom, setPixelRatio,
    godRay: godRayPass,
    get pixelRatio() { return pixelRatio; },
    maxPixelRatio: maxRatio,
    samples,
  };
}

function makeStarLayer(radius, count = 1400, size = 2.6, brightness = 1) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // 球面均匀分布
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radius * (0.94 + Math.random() * 0.06);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
    // 色温分布：偏蓝白居多，少量橙红
    const t = Math.random();
    const hue = t < 0.62 ? 0.58 + Math.random() * 0.06 : (t < 0.88 ? 0.12 + Math.random() * 0.04 : 0.02);
    const sat = t < 0.62 ? 0.10 + Math.random() * 0.22 : 0.35 + Math.random() * 0.3;
    c.setHSL(hue, sat, 0.72 + Math.random() * 0.24);
    const b = brightness * (0.45 + Math.random() * 0.75);
    col[i * 3] = c.r * b;
    col[i * 3 + 1] = c.g * b;
    col[i * 3 + 2] = c.b * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    map: starSprite(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}
