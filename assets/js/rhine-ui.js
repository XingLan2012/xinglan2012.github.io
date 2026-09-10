/* ============================================================================
 * 界面设置控制器
 *   · 左上角设置面板：博客默认界面 / Rhine Lab 三维终端（跳转 /rhine/）
 *   · WebGL 能力检测：终端依赖 WebGL，不支持时禁用入口并提示，默认界面不受影响
 *
 * Rhine Lab 终端为独立应用（RhineLabUI, MIT License, © 2026 LBEILC），
 * 以静态产物形式置于 /rhine/，本站只提供内容数据，不改动其 3D 与加载逻辑。
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------- WebGL 能力检测 ---------------------------- */

  var support = (function detect() {
    try {
      var canvas = document.createElement('canvas');
      var gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!gl) return { ok: false, version: 0 };
      var isGL2 =
        typeof WebGL2RenderingContext !== 'undefined' &&
        gl instanceof WebGL2RenderingContext;
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return { ok: true, version: isGL2 ? 2 : 1 };
    } catch (e) {
      return { ok: false, version: 0 };
    }
  })();

  /* -------------------------------- 面板交互 -------------------------------- */

  var btn, panel, note, opts;

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

  function syncNote() {
    if (!note) return;
    var entry = opts && opts.querySelector('[data-ui-opt="rhine"]');
    if (!support.ok) {
      note.className = 'ui-switch-note warn';
      note.textContent = '⚠ 本浏览器不支持 WebGL，Rhine Lab 终端已禁用（默认界面不受影响）';
      if (entry) entry.classList.add('disabled');
      if (entry) entry.setAttribute('aria-disabled', 'true');
    } else {
      note.className = 'ui-switch-note';
      note.textContent = '✓ WebGL ' + support.version + '.0 可用 · 终端可进入';
      if (entry) entry.classList.remove('disabled');
      if (entry) entry.removeAttribute('aria-disabled');
    }
  }

  function init() {
    btn = document.getElementById('uiSwitchBtn');
    panel = document.getElementById('uiSwitchPanel');
    note = document.getElementById('uiSwitchNote');
    opts = document.getElementById('uiStyleOpts');

    if (btn && panel) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePanel();
      });
      // 打开「碎星之列」时收起设置面板（互斥）
      var pendant = document.getElementById('crystalPendant');
      if (pendant) pendant.addEventListener('click', closePanel);
      document.addEventListener('click', function (e) {
        if (!panel.classList.contains('open')) return;
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        closePanel();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel();
      });
    }

    // 无 WebGL 时拦截终端入口
    if (opts) {
      opts.addEventListener('click', function (e) {
        var target = e.target.closest('[data-ui-opt="rhine"]');
        if (!target) return;
        if (!support.ok) {
          e.preventDefault();
          syncNote();
        }
      });
    }

    syncNote();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RhineUI = { support: support };
})();
