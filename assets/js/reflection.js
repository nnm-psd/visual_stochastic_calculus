/* Section 2.3 — Reflection Principle.
   3,000 Brownian paths on [0, 1]. Drag the level a: count paths whose maximum reaches a and
   compare with twice the paths that end above a. The orange path (the drawn path that climbs
   highest, so it reaches most levels) is mirrored in the level after it first touches it. Paths are simulated once per seed; moving a only recounts. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, normalCdf } = Stoch;

  const root = document.getElementById('reflection');
  const canvas = root.querySelector('.rf-canvas');
  const aIn = root.querySelector('input[name=a]');
  const aOut = aIn.nextElementSibling;
  const stats = root.querySelector('.rf-stats');
  const resampleBtn = root.querySelector('button.resample');

  const STEPS = 2000, PATHS = 3000, SHOWN = 50, DRAW_EVERY = 4, SD = Math.sqrt(1 / STEPS);
  const Y = 3;
  let seed = 21, maxes, ends, drawn, heroIdx, view;

  function simulate() {
    const rand = rng(seed);
    maxes = new Float64Array(PATHS);
    ends = new Float64Array(PATHS);
    drawn = [];
    for (let k = 0; k < PATHS; k++) {
      const keep = k < SHOWN ? new Float32Array(STEPS + 1) : null;
      let w = 0, m = 0;
      for (let i = 1; i <= STEPS; i++) {
        w += SD * gaussian(rand);
        if (w > m) m = w;
        if (keep) keep[i] = w;
      }
      maxes[k] = m; ends[k] = w;
      if (keep) drawn.push(keep);
    }
    heroIdx = 0;
    for (let k = 1; k < SHOWN; k++) if (maxes[k] > maxes[heroIdx]) heroIdx = k;
  }

  function render() {
    const a = +aIn.value;
    aOut.value = a.toFixed(2);
    const { ctx, w, h } = view;
    const px = (i) => (i / STEPS) * w;
    const py = (v) => h / 2 - (v / Y) * (h / 2 - 8);

    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

    const line = (p, from, to, map) => {
      ctx.beginPath();
      for (let i = from; i <= to; i += DRAW_EVERY) (i > from ? ctx.lineTo(px(i), py(map(p[i]))) : ctx.moveTo(px(i), py(map(p[i]))));
      ctx.lineTo(px(to), py(map(p[to])));
      ctx.stroke();
    };
    const id = (v) => v;

    // Background paths: blue if they reach the level, grey if not.
    ctx.lineWidth = 0.75;
    for (let k = 0; k < SHOWN; k++) {
      if (k === heroIdx) continue;
      ctx.strokeStyle = maxes[k] >= a ? color('--accent-2') : color('--faint');
      ctx.globalAlpha = maxes[k] >= a ? 0.45 : 1;
      line(drawn[k], 0, STEPS, id);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color('--accent-3');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, py(a)); ctx.lineTo(w, py(a)); ctx.stroke();
    ctx.fillStyle = color('--accent-3');
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('level a', 8, py(a) - 6);

    // Orange path, mirrored in the level after its first touch.
    const hero = drawn[heroIdx];
    let tau = -1;
    for (let i = 0; i <= STEPS; i++) if (hero[i] >= a) { tau = i; break; }
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    line(hero, 0, STEPS, id);
    if (tau >= 0) {
      ctx.setLineDash([5, 4]);
      line(hero, tau, STEPS, (v) => 2 * a - v);
      ctx.setLineDash([]);
      ctx.fillStyle = color('--accent');
      ctx.beginPath(); ctx.arc(px(tau), py(hero[tau]), 5, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('t = 0', 4, h - 6);
    ctx.fillText('t = 1', w - 34, h - 6);

    let reached = 0, above = 0;
    for (let k = 0; k < PATHS; k++) { if (maxes[k] >= a) reached++; if (ends[k] >= a) above++; }
    const pct = (x) => (100 * x).toFixed(1) + '%';
    stats.innerHTML =
      `<span>Paths that reached a: <strong>${pct(reached / PATHS)}</strong>.</span> ` +
      `<span>Twice the paths that <em>end</em> above a: <strong>${pct((2 * above) / PATHS)}</strong>.</span> ` +
      `<span>Theory for both: ${pct(2 * (1 - normalCdf(a)))}.</span>` +
      (tau < 0 ? ' <span>(The orange path never reaches this level. Lower a or resample to see a reflection.)</span>' : '');
  }

  aIn.addEventListener('input', () => { root.querySelector('.takeaway').hidden = false; render(); });
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5); render(); });

  simulate();
  view = setupCanvas(canvas, 0.5);
  render();
})();
