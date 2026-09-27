/* Section 8.1 — Jumps.
   X_t = σ W_t + (sum of N_t jumps), N a Poisson process with rate λ and jumps J ~ N(0, δ²).
   The total variance at t = 1 is held at 1: a share of it comes from jumps (σ² = 1 − share,
   λδ² = share). Left: paths. Right: histogram of X_1 over 20,000 paths on a log scale, against the
   standard bell curve with the same variance, so fat tails are visible. */
Stoch.lazy('jumps', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, normalPdf, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('jumps');
  const canvas = root.querySelector('.jp-canvas');
  const lamIn = root.querySelector('input[name=lambda]');
  const shareIn = root.querySelector('input[name=share]');
  const stats = root.querySelector('.jp-stats');
  const resampleBtn = root.querySelector('button.resample');

  const PATHS = 20000, SHOWN = 30, STEPS = 400, DT = 1 / STEPS, Y = 4, PATH_FRAC = 0.6, R = 5, BINS = 40;
  let seed = 181, view;

  // Poisson(mean) draw by counting exponential gaps (Knuth); means here are small per step.
  function poisson(mean, rand) {
    const limit = Math.exp(-mean);
    let k = 0, p = rand();
    while (p > limit) { k++; p *= rand(); }
    return k;
  }

  function render() {
    const lam = +lamIn.value, share = +shareIn.value;
    lamIn.nextElementSibling.value = lam.toFixed(1);
    shareIn.nextElementSibling.value = `${Math.round(share * 100)}%`;
    const sigma = Math.sqrt(1 - share), delta = Math.sqrt(share / lam), sdStep = sigma * Math.sqrt(DT);

    const rand = rng(seed), ends = new Float64Array(PATHS), paths = [];
    let heroQV = 0, heroJumps = 0, heroJumpSq = 0;
    for (let k = 0; k < PATHS; k++) {
      const keep = k < SHOWN ? new Float64Array(STEPS + 1) : null;
      let x = 0;
      if (k < SHOWN) {
        for (let i = 1; i <= STEPS; i++) {
          let dx = sdStep * gaussian(rand);
          const n = poisson(lam * DT, rand);
          for (let j = 0; j < n; j++) { const J = delta * gaussian(rand); dx += J; if (k === 0) { heroJumps++; heroJumpSq += J * J; } }
          if (k === 0) heroQV += dx * dx;
          x += dx;
          keep[i] = x;
        }
        paths.push(keep);
      } else {
        // Only the end value is needed: σW_1 plus a Poisson(λ) number of jumps.
        x = sigma * gaussian(rand);
        const n = poisson(lam, rand);
        for (let j = 0; j < n; j++) x += delta * gaussian(rand);
      }
      ends[k] = x;
    }

    const { ctx, w, h } = view, pw = w * PATH_FRAC;
    const px = (i) => (i / STEPS) * pw, py = (v) => h / 2 - (v / Y) * (h / 2 - 10);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(pw, py(0)); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();
    ctx.strokeStyle = color('--faint');
    for (const p of paths.slice(1)) polyline(ctx, 0, STEPS, px, (i) => py(p[i]));
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    polyline(ctx, 0, STEPS, px, (i) => py(paths[0][i]));

    // Log-scale histogram of X_1 (horizontal axis: value, drawn in the right panel).
    const hx = pw + 8, hw = w - hx - 6, counts = new Float64Array(BINS), bw = (2 * R) / BINS;
    let m4 = 0, tail = 0;
    for (const v of ends) {
      const b = Math.floor((v + R) / bw);
      if (b >= 0 && b < BINS) counts[b]++;
      m4 += v ** 4; if (Math.abs(v) > 3) tail++;
    }
    const LOGMIN = -4.5, LOGMAX = 0;
    const qx = (v) => hx + ((v + R) / (2 * R)) * hw, qy = (d) => h - 22 - ((Math.max(Math.log10(d), LOGMIN) - LOGMIN) / (LOGMAX - LOGMIN)) * (h - 50);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.75;
    counts.forEach((c, b) => { if (c) { const d = c / (PATHS * bw); ctx.fillRect(qx(-R + b * bw) + 0.5, qy(d), qx(bw - R) - hx - 1, h - 22 - qy(d)); } });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 1.5;
    polyline(ctx, 0, 200, (i) => qx(-R + (i / 200) * 2 * R), (i) => qy(normalPdf(-R + (i / 200) * 2 * R)));
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['paths (orange: one path)', '--muted']], 8, 14, pw - 16);
    ctx.fillStyle = color('--muted');
    ctx.fillText('X₁, log scale', hx + 2, 14);
    ctx.fillText('−5', hx, h - 6);
    ctx.fillText('0', qx(0) - 3, h - 6);
    ctx.fillText('5', w - 12, h - 6);

    const kurt = m4 / PATHS;  // variance is 1 by construction, so E[X^4] is the kurtosis
    stats.textContent =
      `Kurtosis of X₁: ${kurt.toFixed(2)} (bell curve: 3; theory here: ${(3 + (3 * share * share) / lam).toFixed(2)}). ` +
      `Share of |X₁| > 3: ${(tail / PATHS * 100).toFixed(2)}% (bell curve: 0.27%). ` +
      `Orange path: ${heroJumps} jumps; its sum of squared steps ${heroQV.toFixed(3)} ≈ σ²t + Σ J² = ${(sigma * sigma + heroJumpSq).toFixed(3)}.`;
  }

  lamIn.addEventListener('input', render);
  shareIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55, 240); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.55, 240);
  render();
});
