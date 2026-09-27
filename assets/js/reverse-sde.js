/* Section 7.3 — Noise to Data: the Reverse-Time SDE.
   3,000 particles start as pure noise N(0, 1) at t = 3 and are run backward to t = 0 by one of:
   the reverse-time SDE (uses the score), the probability-flow ODE (uses the score, no noise), or the
   reverse SDE with the score term deleted. Left: paths, with time running backward left to right.
   Right: where the particles end, against the true data density. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, histogram, revealOnInteract } = Stoch;
  const { density, scoreAt, SPLIT, W, M, S } = Diffusion;

  const root = document.getElementById('reverse');
  const canvas = root.querySelector('.rv-canvas');
  const stats = root.querySelector('.rv-stats');
  const resampleBtn = root.querySelector('button.resample');

  const PARTICLES = 3000, SHOWN = 40, T = 3, STEPS = 600, H = T / STEPS, KEEP = 4;
  const LO = -4, HI = 4, PATH_FRAC = 0.62;
  let seed = 161, view;

  function run(mode) {
    const rand = rng(seed), x = new Float64Array(PARTICLES), frames = STEPS / KEEP;
    const paths = Array.from({ length: SHOWN }, () => new Float64Array(frames + 1));
    for (let k = 0; k < PARTICLES; k++) x[k] = gaussian(rand);
    for (let k = 0; k < SHOWN; k++) paths[k][0] = x[k];
    const sd = Math.sqrt(2 * H);
    for (let i = 0; i < STEPS; i++) {
      const s = scoreAt(T - i * H);
      for (let k = 0; k < PARTICLES; k++) {
        const z = gaussian(rand);   // drawn in every mode, so all three share the same random numbers
        if (mode === 'sde') x[k] += H * (x[k] + 2 * s(x[k])) + sd * z;
        else if (mode === 'ode') x[k] += H * (x[k] + s(x[k]));
        else x[k] += H * x[k] + sd * z;
      }
      if ((i + 1) % KEEP === 0) for (let k = 0; k < SHOWN; k++) paths[k][(i + 1) / KEEP] = x[k];
    }
    return { x, paths, frames };
  }

  function render() {
    const mode = root.querySelector('input[name=mode]:checked').value;
    const { x, paths, frames } = run(mode);
    const { ctx, w, h } = view, pw = w * PATH_FRAC;
    const px = (fr) => (fr / frames) * pw, py = (v) => h - 10 - ((v - LO) / (HI - LO)) * (h - 30);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(pw, py(0)); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();
    ctx.strokeStyle = color('--accent');
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    for (const p of paths) polyline(ctx, 0, frames, px, (fr) => py(p[fr]));
    ctx.globalAlpha = 1;

    const hx = pw + 6, hw = w - hx - 4, dScale = hw / 1.5;
    const { bw, density: dens } = histogram(x, LO, HI, 48);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    dens.forEach((d, b) => { const y0 = py(LO + b * bw), y1 = py(LO + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, Math.min(d * dScale, hw), y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 2;
    polyline(ctx, 0, 200, (i) => hx + Math.min(density(0, LO + (i / 200) * (HI - LO)) * dScale, hw), (i) => py(LO + (i / 200) * (HI - LO)));
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    const label = 'noise (t = 3) → generated samples (t = 0)';
    ctx.fillStyle = color('--viz-bg');
    ctx.globalAlpha = 0.85;
    ctx.fillRect(4, 2, ctx.measureText(label).width + 8, 17);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color('--muted');
    ctx.fillText(label, 8, 14);
    ctx.fillText('samples vs data', hx + 2, 14);

    let nl = 0, sl = 0, sl2 = 0, nr = 0, sr = 0, sr2 = 0, out = 0;
    for (const v of x) {
      if (v < LO || v > HI) out++;
      if (v < SPLIT) { nl++; sl += v; sl2 += v * v; } else { nr++; sr += v; sr2 += v * v; }
    }
    const ml = sl / nl, mr = sr / nr, sdl = Math.sqrt(sl2 / nl - ml * ml), sdr = Math.sqrt(sr2 / nr - mr * mr);
    stats.textContent =
      `Share in the left bump: ${(nl / PARTICLES * 100).toFixed(1)}% (data: ${W[0] * 100}%). ` +
      `Bump centres ${ml.toFixed(2)} and ${mr.toFixed(2)} (data: ${M[0]} and ${M[1]}); ` +
      `widths ${sdl.toFixed(2)} and ${sdr.toFixed(2)} (data: ${S[0]} and ${S[1]}).` +
      (out ? ` ${(out / PARTICLES * 100).toFixed(1)}% of samples ended off the chart (beyond ±4).` : '');
  }

  root.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.55);
  render();
})();
