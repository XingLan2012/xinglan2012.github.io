/* ============================================================================
 * Rhine Lab 第二 UI 控制器
 *   · 界面风格切换：默认（星澜）/ Rhine Lab，偏好持久化于 localStorage
 *   · WebGL 能力检测：不支持时自动禁用背景动效，第二 UI 仍可正常使用
 *   · 背景动效：原生 WebGL 片元着色器绘制纸感网格 + 扫描线（无外部依赖）
 *
 * 设计语言取自 RhineLabUI (MIT License, © 2026 LBEILC)
 * ========================================================================== */
(function () {
  'use strict';

  var PREF_KEY = 'rhine_ui_pref';   // 'default' | 'rhine'
  var FX_KEY = 'rhine_ui_fx';       // 'on' | 'off'
  var html = document.documentElement;

  /* ------------------------------ 偏好读写 ------------------------------ */

  function readPref(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writePref(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) { /* 隐私模式下静默失败 */ }
  }

  /* ---------------------------- WebGL 能力检测 ---------------------------- */

  var glSupport = (function detect() {
    try {
      var canvas = document.createElement('canvas');
      var gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!gl) return { ok: false, version: 0 };
      var isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      // 主动释放探测用的上下文，避免占用浏览器上下文配额
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return { ok: true, version: isGL2 ? 2 : 1 };
    } catch (e) {
      return { ok: false, version: 0 };
    }
  })();

  /* ------------------------------ 主题应用 ------------------------------ */

  function currentUI() {
    return html.classList.contains('ui-rhine') ? 'rhine' : 'default';
  }

  function applyUI(mode) {
    if (mode === 'rhine') {
      html.classList.add('ui-rhine');
      html.setAttribute('data-ui', 'rhine');
      startFxIfPossible();
    } else {
      html.classList.remove('ui-rhine');
      html.setAttribute('data-ui', 'default');
      stopFx();
      // 默认界面恢复全局轮播背景
      var ss = document.getElementById('bgSlideshow');
      if (ss) ss.style.display = '';
    }
    syncControls();
  }

  function setUI(mode) {
    writePref(PREF_KEY, mode);
    applyUI(mode);
  }

  /* ------------------------------ 控件同步 ------------------------------ */

  var btn, panel, note, styleOpts, fxOpts;

  function syncControls() {
    if (!btn) return;
    var mode = currentUI();
    var fx = readPref(FX_KEY, 'on');

    if (styleOpts) {
      Array.prototype.forEach.call(styleOpts.children, function (el) {
        el.classList.toggle('active', el.getAttribute('data-ui-opt') === mode);
      });
    }
    if (fxOpts) {
      Array.prototype.forEach.call(fxOpts.children, function (el) {
        var v = el.getAttribute('data-fx-opt');
        var active = v === fx;
        el.classList.toggle('active', active);
        // 无 WebGL 时禁用动效开关
        el.disabled = (v === 'on') && !glSupport.ok;
      });
    }
    if (note) {
      if (!glSupport.ok) {
        note.className = 'ui-switch-note warn';
        note.textContent = '⚠ 本浏览器不支持 WebGL，背景动效已禁用（界面本身不受影响）';
      } else if (mode !== 'rhine') {
        note.className = 'ui-switch-note';
        note.textContent = '✓ WebGL ' + glSupport.version + '.0 可用 · 当前为默认界面';
      } else {
        note.className = 'ui-switch-note';
        note.textContent = '✓ WebGL ' + glSupport.version + '.0 可用 · Rhine Lab 界面运行中';
      }
    }
  }

  function openPanel() {
    if (!panel) return;
    // 与左上角「碎星之列」面板互斥，避免两个面板重叠
    var crystalPanel = document.getElementById('crystalPanel');
    var pendant = document.getElementById('crystalPendant');
    if (crystalPanel && crystalPanel.classList.contains('open') && pendant) pendant.click();
    panel.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (panel && panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  /* --------------------- WebGL 背景动效（原生实现） --------------------- */

  var fx = { gl: null, canvas: null, raf: 0, program: null, start: 0, running: false };

  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    '',
    'float gridLine(float coord, float spacing, float width) {',
    '  float f = fract(coord / spacing);',
    '  float d = min(f, 1.0 - f) * spacing;',
    '  return 1.0 - smoothstep(0.0, width, d);',
    '}',
    '',
    'void main() {',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 uv = frag / u_res.xy;',
    '  vec3 paper  = vec3(0.910, 0.898, 0.882);',
    '  vec3 bronze = vec3(0.651, 0.490, 0.282);',
    '',
    '  float g = max(gridLine(frag.x, 72.0, 1.0), gridLine(frag.y, 72.0, 1.0));',
    '  vec3 col = mix(paper, bronze, g * 0.09);',
    '',
    '  float scanY = fract(u_time * 0.035) * u_res.y;',
    '  float band = 1.0 - smoothstep(0.0, 110.0, abs(frag.y - scanY));',
    '  col = mix(col, bronze, band * 0.045);',
    '',
    '  vec2 p = uv * 6.0;',
    '  float node = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    vec2 c = vec2(0.5 + 0.42 * sin(u_time * 0.05 + float(i) * 2.1),',
    '                  0.5 + 0.42 * cos(u_time * 0.04 + float(i) * 1.7));',
    '    node += 1.0 - smoothstep(0.0, 0.16, length(uv - c));',
    '  }',
    '  col = mix(col, bronze, node * 0.045);',
    '',
    '  float vig = 1.0 - 0.09 * length(uv - 0.5);',
    '  col *= vig;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initFx() {
    if (fx.gl || !glSupport.ok) return !!fx.gl;
    var canvas = document.createElement('canvas');
    canvas.id = 'rhine-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
          || canvas.getContext('experimental-webgl');
    if (!gl) {
      canvas.parentNode.removeChild(canvas);
      return false;
    }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      canvas.parentNode.removeChild(canvas);
      return false;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.parentNode.removeChild(canvas);
      return false;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    fx.gl = gl;
    fx.canvas = canvas;
    fx.program = prog;
    fx.uRes = gl.getUniformLocation(prog, 'u_res');
    fx.uTime = gl.getUniformLocation(prog, 'u_time');
    resizeFx();
    return true;
  }

  function resizeFx() {
    if (!fx.gl || !fx.canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(window.innerWidth * dpr);
    var h = Math.floor(window.innerHeight * dpr);
    if (fx.canvas.width !== w || fx.canvas.height !== h) {
      fx.canvas.width = w;
      fx.canvas.height = h;
      fx.gl.viewport(0, 0, w, h);
    }
  }

  function frame(ts) {
    if (!fx.running) return;
    if (!fx.start) fx.start = ts;
    var gl = fx.gl;
    if (gl && !document.hidden) {
      resizeFx();
      gl.uniform2f(fx.uRes, fx.canvas.width, fx.canvas.height);
      gl.uniform1f(fx.uTime, (ts - fx.start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    fx.raf = requestAnimationFrame(frame);
  }

  function startFxIfPossible() {
    if (currentUI() !== 'rhine') return;
    if (readPref(FX_KEY, 'on') !== 'on') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!initFx()) return;
    if (!fx.running) {
      fx.running = true;
      fx.raf = requestAnimationFrame(frame);
    }
  }

  function stopFx() {
    fx.running = false;
    if (fx.raf) cancelAnimationFrame(fx.raf);
    fx.raf = 0;
    if (fx.canvas && fx.canvas.parentNode) fx.canvas.parentNode.removeChild(fx.canvas);
    if (fx.gl) {
      var lose = fx.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
    fx.gl = null;
    fx.canvas = null;
    fx.program = null;
    fx.start = 0;
  }

  /* -------------------------------- 初始化 -------------------------------- */

  function init() {
    btn = document.getElementById('uiSwitchBtn');
    panel = document.getElementById('uiSwitchPanel');
    note = document.getElementById('uiSwitchNote');
    styleOpts = document.getElementById('uiStyleOpts');
    fxOpts = document.getElementById('uiFxOpts');

    if (btn && panel) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePanel();
      });
      // 打开「碎星之列」时收起设置面板（互斥）
      var pendant = document.getElementById('crystalPendant');
      if (pendant) {
        pendant.addEventListener('click', function () {
          closePanel();
        });
      }
      document.addEventListener('click', function (e) {
        if (!panel.classList.contains('open')) return;
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        closePanel();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel();
      });
    }

    if (styleOpts) {
      styleOpts.addEventListener('click', function (e) {
        var target = e.target.closest('[data-ui-opt]');
        if (!target) return;
        setUI(target.getAttribute('data-ui-opt'));
      });
    }

    if (fxOpts) {
      fxOpts.addEventListener('click', function (e) {
        var target = e.target.closest('[data-fx-opt]');
        if (!target || target.disabled) return;
        var value = target.getAttribute('data-fx-opt');
        if (value === 'on' && !glSupport.ok) return;
        writePref(FX_KEY, value);
        if (value === 'on') startFxIfPossible();
        else stopFx();
        syncControls();
      });
    }

    // 依据已保存（或 head 内联脚本已应用）的偏好同步界面状态
    applyUI(readPref(PREF_KEY, 'default'));

    window.addEventListener('resize', resizeFx);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && fx.running) {
        fx.start = 0;
        fx.raf = requestAnimationFrame(frame);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 供其他脚本/调试使用
  window.RhineUI = {
    support: glSupport,
    get: currentUI,
    set: setUI
  };
})();
