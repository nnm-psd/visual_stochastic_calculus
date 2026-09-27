/* Section 6.2 — Change of Measure (Girsanov).
   Paths X_t = W_t + λt drift upward. Give each path the weight Z = exp(-λ W_1 - λ²/2): with those
   weights, the average path is flat and the end values follow N(0, 1), as if there were no drift.
   Left: the fan (opacity = weight when reweighting) and the (weighted) average path.
   Right: the (weighted) histogram of end values. */
Stoch.lazy('girsanov', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, normalPdf, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('girsanov');
  const canvas = root.querySelector('.gs-canvas');
  const lamIn = root.querySelector('input[name=lambda]');
  const weightIn = root.querySelector('input[name=reweight]');
  const stats = root.querySelector('.gs-stats');
  const resampleBtn = root.querySelector('button.resample');

  const PATHS = 2000, STEPS = 200, SHOWN = 80, Y = 4, PATH_FRAC = 0.72, BINS = 32;
  let seed = 121, W, view;

  function simulate() {
    const rand = rng(seed), sd = Math.sqrt(1 / STEPS);
    W = new Float64Array(PATHS * (STEPS + 1));
    for (let k = 0; k < PATHS; k++) {
      const o = k * (STEPS + 1);
      for (let i = 0; i < STEPS; i++) W[o + i + 1] = W[o + i] + sd * gaussian(rand);
    }
  }

  function render() {
    const lam = +lamIn.value, reweight = weightIn.checked;
    lamIn.nextElementSibling.value = lam.toFixed(2);
    const X = (k, i) => W[k * (STEPS + 1) + i] + lam * (i / STEPS);
    const Z = new Float64Array(PATHS);
    let zSum = 0, zMax = 0;
    for (let k = 0; k < PATHS; k++) {
      Z[k] = reweight ? Math.exp(-lam * W[k * (STEPS + 1) + STEPS] - 0.5 * lam * lam) : 1;
      zSum += Z[k]; zMax = Math.max(zMax, Z[k]);
    }
    const mean = new Float64Array(STEPS + 1);
    for (let k = 0; k < PATHS; k++) for (let i = 0; i <= STEPS; i++) mean[i] += (Z[k] * X(k, i)) / zSum;

    const { ctx, w, h } = view, pw = w * PATH_FRAC;
    const px = (i) => (i / STEPS) * pw, py = (v) => h / 2 - (v / Y) * (h / 2 - 10);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(pw, py(0)); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();

    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 1;
    for (let k = 0; k < SHOWN; k++) {
      ctx.globalAlpha = reweight ? Math.min(0.9, 0.04 + 0.9 * Math.sqrt(Z[k] / zMax)) : 0.18;
      polyline(ctx, 0, STEPS, px, (i) => py(X(k, i)));
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = color('--muted');
    polyline(ctx, 0, STEPS, px, (i) => py((lam * i) / STEPS));
    ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 3;
    polyline(ctx, 0, STEPS, px, (i) => py(mean[i]));

    // Weighted histogram of end values against N(0, 1) or N(λ, 1).
    const hx = pw + 6, hw = w - hx - 4, bw = (2 * Y) / BINS, dens = new Float64Array(BINS);
    for (let k = 0; k < PATHS; k++) {
      const b = Math.floor((X(k, STEPS) + Y) / bw);
      if (b >= 0 && b < BINS) dens[b] += Z[k] / (zSum * bw);
    }
    const dScale = hw / 0.6;
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    dens.forEach((d, b) => { const y0 = py(-Y + b * bw), y1 = py(-Y + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, Math.min(d * dScale, hw), y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    const centre = reweight ? 0 : lam;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 1.5;
    polyline(ctx, 0, 200, (j) => hx + normalPdf(-Y + (j / 200) * 2 * Y - centre) * dScale, (j) => py(-Y + (j / 200) * 2 * Y));
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [[reweight ? 'weighted average path' : 'average path', '--accent'], ['dashed: the drift line λt', '--muted']], 8, 14, pw - 16);
    ctx.fillStyle = color('--muted');
    ctx.fillText(`values at t = 1`, hx + 2, 14);

    stats.textContent = reweight
      ? `Weighted average of X₁: ${mean[STEPS].toFixed(3)} (theory: 0). Average weight: ${(zSum / PATHS).toFixed(3)} (theory: 1). The curve on the right is N(0, 1): no drift.`
      : `Plain average of X₁: ${mean[STEPS].toFixed(3)} (theory: λ = ${lam.toFixed(2)}). The curve on the right is N(λ, 1).`;
  }

  lamIn.addEventListener('input', render);
  weightIn.addEventListener('change', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.55);
  render();
});
