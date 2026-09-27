/* Section 2.2 — Martingales.
   Freeze one path at time s, fan out many possible futures from there, and plot their average.
   The process shown can be W_t, W_t^2 or W_t^2 - t. The futures reuse one random stream, so
   dragging s moves the fan smoothly instead of reshuffling it. */
Stoch.lazy('martingale', function () {
  'use strict';
  const { rng, gaussian, brownianPath, setupCanvas, color } = Stoch;

  const root = document.getElementById('martingale');
  const canvas = root.querySelector('.mg-canvas');
  const sIn = root.querySelector('input[name=s]');
  const sOut = sIn.nextElementSibling;
  const stats = root.querySelector('.mg-stats');
  const resampleBtn = root.querySelector('button.resample');

  const STEPS = 400, FUTURES = 400, SHOWN = 60, SD = Math.sqrt(1 / STEPS);
  const PROCESSES = {
    w: { f: (w) => w, lo: -3, hi: 3, name: 'W', drift: 0 },
    w2: { f: (w) => w * w, lo: -0.5, hi: 5.5, name: 'W²', drift: 1 },
    w2t: { f: (w, t) => w * w - t, lo: -1.5, hi: 4.5, name: 'W² − t', drift: 0 },
  };
  let seed = 11, hero, view;

  const proc = () => PROCESSES[root.querySelector('input[name=proc]:checked').value];

  function render() {
    const p = proc(), s = +sIn.value, si = Math.round(s * STEPS);
    sOut.value = s.toFixed(2);
    const { ctx, w, h } = view;
    const px = (i) => (i / STEPS) * w;
    const py = (v) => h - 8 - ((Math.min(Math.max(v, p.lo), p.hi) - p.lo) / (p.hi - p.lo)) * (h - 30);

    // Futures from (s, W_s): accumulate the average of f along the way, keep SHOWN of them to draw.
    const rand = rng(seed * 7919 + 1);
    const mean = new Float64Array(STEPS + 1), shown = [];
    for (let k = 0; k < FUTURES; k++) {
      let x = hero[si];
      const line = k < SHOWN ? [] : null;
      for (let i = si; i <= STEPS; i++) {
        if (i > si) x += SD * gaussian(rand);
        const v = p.f(x, i / STEPS);
        mean[i] += v / FUTURES;
        if (line) line.push(v);
      }
      if (line) shown.push(line);
    }
    const frozen = p.f(hero[si], s);

    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(si), 20); ctx.lineTo(px(si), h); ctx.stroke();

    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 0.75;
    for (const line of shown) {
      ctx.beginPath();
      line.forEach((v, j) => (j ? ctx.lineTo(px(si + j), py(v)) : ctx.moveTo(px(si + j), py(v))));
      ctx.stroke();
    }

    // Reference: the frozen value carried forward.
    ctx.strokeStyle = color('--fg');
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(px(si), py(frozen)); ctx.lineTo(w, py(frozen)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = color('--accent-2');
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = si; i <= STEPS; i++) (i > si ? ctx.lineTo(px(i), py(mean[i])) : ctx.moveTo(px(i), py(mean[i])));
    ctx.stroke();

    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= si; i++) (i ? ctx.lineTo(px(i), py(p.f(hero[i], i / STEPS))) : ctx.moveTo(px(i), py(p.f(hero[i], 0))));
    ctx.stroke();
    ctx.fillStyle = color('--accent');
    ctx.beginPath(); ctx.arc(px(si), py(frozen), 4.5, 0, 2 * Math.PI); ctx.fill();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText(`showing ${p.name}`, 8, 14);
    ctx.fillText(`s = ${s.toFixed(2)}`, Math.min(px(si) + 6, w - 50), 14);
    ctx.fillText('t = 1', w - 34, h - 12);

    const theory = frozen + p.drift * (1 - s);
    stats.textContent =
      `Value of ${p.name} at the freeze time: ${frozen.toFixed(3)}. ` +
      `Average of ${FUTURES} futures at t = 1: ${mean[STEPS].toFixed(3)}. ` +
      `Theory: ${theory.toFixed(3)}` + (p.drift ? ` (the frozen value plus the remaining time 1 − s).` : ` (exactly the frozen value).`);
  }

  function reveal() { root.querySelector('.takeaway').hidden = false; }
  sIn.addEventListener('input', () => { reveal(); render(); });
  root.querySelectorAll('input[name=proc]').forEach((r) => r.addEventListener('change', () => { reveal(); render(); }));
  resampleBtn.addEventListener('click', () => { seed += 1; hero = brownianPath(STEPS, rng(seed)); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5); render(); });

  hero = brownianPath(STEPS, rng(seed));
  view = setupCanvas(canvas, 0.5);
  render();
});
