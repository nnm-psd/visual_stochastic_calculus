/* Section 4.2 — Itô's Lemma in Action.
   Along one path (16,384 steps), rebuild f(W_t) from its increments two ways:
   Itô: f(0) + Σ f'(W)ΔW + Σ ½f''(W)Δt, and the naive chain rule: f(0) + Σ f'(W)ΔW.
   Itô's version lies on top of the true curve; the naive one drifts away by ½∫f''dt. */
(function () {
  'use strict';
  const { rng, brownianPath, setupCanvas, color, polyline, revealOnInteract } = Stoch;

  const root = document.getElementById('lemma');
  const canvas = root.querySelector('.lm-canvas');
  const stats = root.querySelector('.lm-stats');
  const resampleBtn = root.querySelector('button.resample');

  const STEPS = 16384, DT = 1 / STEPS;
  const FUNCS = {
    sq: { f: (x) => x * x, d1: (x) => 2 * x, d2: () => 2, name: 'x²' },
    exp: { f: Math.exp, d1: Math.exp, d2: Math.exp, name: 'eˣ' },
    sin: { f: Math.sin, d1: Math.cos, d2: (x) => -Math.sin(x), name: 'sin x' },
  };
  let seed = 61, W, view;

  function render() {
    const F = FUNCS[root.querySelector('input[name=fn2]:checked').value];
    const truth = new Float64Array(STEPS + 1), ito = new Float64Array(STEPS + 1), naive = new Float64Array(STEPS + 1);
    truth[0] = ito[0] = naive[0] = F.f(W[0]);
    for (let i = 0; i < STEPS; i++) {
      const x = W[i], d = W[i + 1] - x;
      truth[i + 1] = F.f(W[i + 1]);
      naive[i + 1] = naive[i] + F.d1(x) * d;
      ito[i + 1] = ito[i] + F.d1(x) * d + 0.5 * F.d2(x) * DT;
    }

    const { ctx, w, h } = view;
    let lo = Infinity, hi = -Infinity;
    for (const arr of [truth, ito, naive]) for (const v of arr) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = (hi - lo) * 0.08;
    const px = (i) => (i / STEPS) * w, py = (v) => h - 10 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (h - 32);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.18;
    polyline(ctx, 0, STEPS, px, (i) => py(truth[i]));
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = color('--accent-3');
    polyline(ctx, 0, STEPS, px, (i) => py(naive[i]));
    ctx.strokeStyle = color('--accent');
    polyline(ctx, 0, STEPS, px, (i) => py(ito[i]));

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText(`true f(W) = ${F.name} (thick grey)`, 8, 14);
    ctx.fillStyle = color('--accent');
    ctx.fillText('Itô rebuild', 190, 14);
    ctx.fillStyle = color('--accent-3');
    ctx.fillText('naive chain rule', 270, 14);

    stats.textContent =
      `At t = 1: true value ${truth[STEPS].toFixed(3)}, Itô rebuild ${ito[STEPS].toFixed(3)}, naive chain rule ${naive[STEPS].toFixed(3)}. ` +
      `The naive rule is off by ${(truth[STEPS] - naive[STEPS]).toFixed(3)}: the missing ½∫f″(W)dt = ${(ito[STEPS] - naive[STEPS]).toFixed(3)}, up to a small error from using ${STEPS.toLocaleString()} finite steps.`;
  }

  root.querySelectorAll('input[name=fn2]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; W = brownianPath(STEPS, rng(seed)); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5); render(); });
  revealOnInteract(root);
  W = brownianPath(STEPS, rng(seed));
  view = setupCanvas(canvas, 0.5);
  render();
})();
