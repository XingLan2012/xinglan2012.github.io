import { World } from '../scene/world';
import { ALL_BODIES } from '../data/bodies';
import { T, bodyName, fmtSpeed, onLangChange } from '../i18n';

// Builds the control HTML overlay and wires it to the World instance.
// Kept dependency-free (plain DOM) so the demo has no UI-framework weight.
// The markup lives in mount() so a language change can rebuild it in place
// (the panel owns its own host element — the tour overlay is a sibling).

export function buildUI(world: World, onStartTour: () => void): () => void {
  const app = document.getElementById('app')!;
  app.innerHTML = '<div id="panel-host"></div>';
  const host = app.querySelector('#panel-host') as HTMLElement;

  let scaleSeg!: HTMLElement;
  let scaleHint!: HTMLElement;
  let physSeg!: HTMLElement;
  let dimSeg!: HTMLElement;
  let speed!: HTMLInputElement;
  let speedVal!: HTMLElement;
  let pauseBtn!: HTMLButtonElement;
  let focus!: HTMLSelectElement;
  let selected = 'earth';

  function mount(): void {
    const ui = T();
    host.innerHTML = `
    <div class="panel" id="controls">
      <h1>${ui.title}</h1>
      <p class="sub">${ui.sub}</p>

      <div class="group">
        <div class="glabel">${ui.scaleModel}</div>
        <div class="seg" id="scaleSeg">
          <button data-v="visual" class="on">${ui.visual}</button>
          <button data-v="real">${ui.realScale}</button>
        </div>
        <div class="hint" id="scaleHint"></div>
      </div>

      <div class="group">
        <div class="glabel">${ui.physics}</div>
        <div class="seg" id="physSeg">
          <button data-v="kepler" class="on">${ui.kepler}</button>
          <button data-v="nbody">${ui.nbody}</button>
        </div>
        <div class="hint" id="physHint"></div>
      </div>

      <div class="group">
        <div class="glabel">${ui.dimension}</div>
        <div class="seg" id="dimSeg">
          <button data-v="3d" class="on">${ui.dim3d}</button>
          <button data-v="2d">${ui.dim2d}</button>
        </div>
        <div class="hint">${ui.dimHint}</div>
      </div>

      <div class="group">
        <label class="chk"><input type="checkbox" id="cOrbits" checked> ${ui.orbits}</label>
        <label class="chk"><input type="checkbox" id="cMoons"> ${ui.moons} <span class="tag">${ui.heavier}</span></label>
        <label class="chk"><input type="checkbox" id="cProj"> ${ui.projection}</label>
        <label class="chk"><input type="checkbox" id="cLabels" checked> ${ui.labels}</label>
      </div>

      <div class="group">
        <div class="glabel">${ui.time} · <span id="speedVal"></span></div>
        <input type="range" id="speed" min="0" max="100" value="42">
        <div class="row">
          <button id="pause">${ui.pause}</button>
          <button id="reset">${ui.reset}</button>
        </div>
      </div>

      <div class="group">
        <div class="glabel">${ui.focusCamera}</div>
        <select id="focus"></select>
      </div>

      <button id="tourBtn" class="tour-restart">${ui.replayTour}</button>
    </div>
  `;

    // ---- scale segment ----
    scaleSeg = host.querySelector('#scaleSeg')!;
    scaleHint = host.querySelector('#scaleHint') as HTMLElement;
    const setScaleHint = (v: string) => {
      scaleHint.textContent = v === 'real' ? T().scaleHintReal : T().scaleHintVisual;
    };
    setScaleHint(world.state.scaleMode);
    scaleSeg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      seg(scaleSeg, b);
      const v = b.dataset.v as 'visual' | 'real';
      world.setScaleMode(v);
      setScaleHint(v);
    });

    // ---- physics segment ----
    physSeg = host.querySelector('#physSeg')!;
    const physHint = host.querySelector('#physHint') as HTMLElement;
    const setPhysHint = (v: string) => {
      physHint.textContent = v === 'kepler' ? T().keplerHint : T().nbodyHint;
    };
    setPhysHint(world.state.physics);
    physSeg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      seg(physSeg, b);
      const v = b.dataset.v as 'kepler' | 'nbody';
      world.setPhysics(v);
      setPhysHint(v);
    });

    // ---- dimension segment ----
    dimSeg = host.querySelector('#dimSeg')!;
    dimSeg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      seg(dimSeg, b);
      world.setTwoD(b.dataset.v === '2d');
    });

    // ---- checkboxes ----
    (host.querySelector('#cOrbits') as HTMLInputElement).addEventListener('change', (e) => {
      world.state.showOrbits = (e.target as HTMLInputElement).checked;
    });
    (host.querySelector('#cProj') as HTMLInputElement).addEventListener('change', (e) => {
      world.state.showProjection = (e.target as HTMLInputElement).checked;
    });
    (host.querySelector('#cLabels') as HTMLInputElement).addEventListener('change', (e) => {
      world.state.showLabels = (e.target as HTMLInputElement).checked;
    });
    (host.querySelector('#cMoons') as HTMLInputElement).addEventListener('change', (e) => {
      world.setShowMoons((e.target as HTMLInputElement).checked);
    });

    (host.querySelector('#tourBtn') as HTMLButtonElement).addEventListener('click', onStartTour);

    // ---- time ----
    speed = host.querySelector('#speed') as HTMLInputElement;
    speedVal = host.querySelector('#speedVal') as HTMLElement;
    speed.addEventListener('input', applySpeed);

    pauseBtn = host.querySelector('#pause') as HTMLButtonElement;
    pauseBtn.addEventListener('click', () => {
      world.state.paused = !world.state.paused;
      pauseBtn.textContent = world.state.paused ? T().play : T().pause;
    });
    (host.querySelector('#reset') as HTMLButtonElement).addEventListener('click', () => {
      world.simDays = 0;
      if (world.state.physics === 'nbody') world.setPhysics('nbody');
    });

    // ---- focus selector ----
    focus = host.querySelector('#focus') as HTMLSelectElement;
    for (const b of ALL_BODIES) {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = bodyName(b.id, b.name);
      focus.appendChild(o);
    }
    focus.value = selected;
    focus.addEventListener('change', () => {
      selected = focus.value;
      world.focusOn(selected);
    });
  }

  // Map slider 0..100 to ~0.2 .. 4000 days/sec, logarithmically.
  function applySpeed(): void {
    const t = +speed.value / 100;
    const dps = 0.2 * Math.pow(20000, t);
    world.state.daysPerSecond = dps;
    speedVal.textContent = fmtSpeed(dps);
  }

  // Reflect world state into the controls (the tour mutates state directly).
  function setSeg(container: Element, value: string): void {
    container.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', (b as HTMLElement).dataset.v === value));
  }

  function setPhysHintOf(v: string): void {
    const h = host.querySelector('#physHint');
    if (h) h.textContent = v === 'kepler' ? T().keplerHint : T().nbodyHint;
  }
  function setScaleHintOf(v: string): void {
    const h = host.querySelector('#scaleHint');
    if (h) h.textContent = v === 'real' ? T().scaleHintReal : T().scaleHintVisual;
  }

  function sync(): void {
    const st = world.state;
    setSeg(scaleSeg, st.scaleMode);
    setSeg(physSeg, st.physics);
    setSeg(dimSeg, st.twoD ? '2d' : '3d');
    setPhysHintOf(st.physics);
    setScaleHintOf(st.scaleMode);
    (host.querySelector('#cOrbits') as HTMLInputElement).checked = st.showOrbits;
    (host.querySelector('#cProj') as HTMLInputElement).checked = st.showProjection;
    (host.querySelector('#cLabels') as HTMLInputElement).checked = st.showLabels;
    (host.querySelector('#cMoons') as HTMLInputElement).checked = st.showMoons;
    // Invert the log speed mapping to position the slider.
    const t = Math.log(st.daysPerSecond / 0.2) / Math.log(20000);
    speed.value = String(Math.round(Math.max(0, Math.min(1, t)) * 100));
    speedVal.textContent = fmtSpeed(st.daysPerSecond);
    pauseBtn.textContent = st.paused ? T().play : T().pause;
  }

  mount();
  sync();

  // Rebuild the panel in the new language, then restore every control from the
  // live world state (a language switch never changes the simulation).
  onLangChange(() => { mount(); sync(); });

  return sync;
}

// ---- helpers ----
function seg(container: Element, active: Element): void {
  container.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
  active.classList.add('on');
}
