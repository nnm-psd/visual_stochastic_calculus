/* Section 11.1 — Short-Rate Models (Vasicek).
   dr = a(b − r)dt + σ dW with long-run level b = 5%. Left: simulated short-rate paths over 10 years
   with the mean and a ±2 standard-deviation band. Right: the yield curve y(T) = −ln P(0,T)/T from the
   closed-form bond price, with Monte Carlo bond prices (2,000 paths) as dots. */
Stoch.lazy('shortrate', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend, normalCdf } = Stoch;
  const { vasicekBond } = Fin;

  const root = document.getElementById('shortrate');
  const canvas = root.querySelector('.sr-canvas');
  const r0In = root.querySelector('input[name=r0]');
  const aIn = root.querySelector('input[name=a]');
  const sIn = root.querySelector('input[name=sigma]');
  const stats = root.querySelector('.sr-stats');

  const B = 0.05, HORIZON = 10, SHOWN = 30, MC_T = [1, 2, 5, 10], PATHS = 2000, DT = 0.01;
  let view;

  function render() {
    const r0 = +r0In.value, a = +aIn.value, sigma = +sIn.value;
    r0In.nextElementSibling.value = `${(r0 * 100).toFixed(1)}%`;
    aIn.nextElementSibling.value = a.toFixed(2);
    sIn.nextElementSibling.value = `${(sigma * 100).toFixed(1)}%`;
    const mean = (t) => r0 * Math.exp(-a * t) + B * (1 - Math.exp(-a * t));
    const sd = (t) => sigma * Math.sqrt((1 - Math.exp(-2 * a * t)) / (2 * a));
    const yieldAt = (T) => -Math.log(vasicekBond(r0, T, a, B, sigma)) / T;

    // Monte Carlo: short-rate paths (Euler) and bond prices E[exp(−∫r dt)] at a few maturities.
    const rand = rng(261), steps = Math.round(HORIZON / DT), paths = [], integral = MC_T.map(() => new Float64Array(PATHS));
    for (let k = 0; k < PATHS; k++) {
      let r = r0, I = 0;
      const keep = k < SHOWN ? [r] : null;
      for (let i = 1; i <= steps; i++) {
        I += r * DT;
        r += a * (B - r) * DT + sigma * Math.sqrt(DT) * gaussian(rand);
        if (keep && i % 10 === 0) keep.push(r);
        const j = MC_T.indexOf(Math.round(i * DT * 1000) / 1000);
        if (j >= 0) integral[j][k] = I;
      }
      if (keep) paths.push(keep);
    }
    const mcYield = MC_T.map((T, j) => { let s = 0; for (const I of integral[j]) s += Math.exp(-I); return -Math.log(s / PATHS) / T; });

    const { ctx, w, h } = view, split = w * 0.52;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    // Left: rate paths.
    const lo = -0.04, hi = 0.14, py = (v) => h - 20 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (h - 46);
    const tx = (t) => 34 + (t / HORIZON) * (split - 44);
    ctx.fillStyle = color('--accent'); ctx.globalAlpha = 0.12; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const t = (i / 100) * HORIZON; i ? ctx.lineTo(tx(t), py(mean(t) + 2 * sd(t))) : ctx.moveTo(tx(t), py(mean(t) + 2 * sd(t))); }
    for (let i = 100; i >= 0; i--) { const t = (i / 100) * HORIZON; ctx.lineTo(tx(t), py(mean(t) - 2 * sd(t))); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(tx(0), py(0)); ctx.lineTo(tx(HORIZON), py(0)); ctx.stroke();
    ctx.strokeStyle = color('--faint'); ctx.lineWidth = 1;
    for (const p of paths) polyline(ctx, 0, p.length - 1, (i) => tx((i / (p.length - 1)) * HORIZON), (i) => py(p[i]));
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    polyline(ctx, 0, 100, (i) => tx((i / 100) * HORIZON), (i) => py(mean((i / 100) * HORIZON))); ctx.setLineDash([]);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const v of [0, 0.05, 0.1]) ctx.fillText(`${(v * 100).toFixed(0)}%`, 2, py(v) + 4);
    ctx.fillText('0', tx(0) - 3, h - 6); ctx.fillText('10 years', tx(HORIZON) - 44, h - 6);
    legend(ctx, [['short rate: paths, mean ± 2 sd', '--accent']], 34, 14, split - 44);

    // Right: yield curve.
    const x0 = split + 34, x1 = w - 10, Tmax = 30, ys = [];
    for (let i = 1; i <= 120; i++) ys.push([(i / 120) * Tmax, yieldAt((i / 120) * Tmax)]);
    const vals = ys.map((q) => q[1]).concat(mcYield, [r0]), ylo = Math.min(...vals) - 0.004, yhi = Math.max(...vals) + 0.004;
    const qx = (T) => x0 + (T / Tmax) * (x1 - x0), qy = (v) => h - 20 - ((v - ylo) / (yhi - ylo)) * (h - 46);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 2.5;
    polyline(ctx, 0, ys.length - 1, (i) => qx(ys[i][0]), (i) => qy(ys[i][1]));
    ctx.fillStyle = color('--accent');
    MC_T.forEach((T, j) => { ctx.beginPath(); ctx.arc(qx(T), qy(mcYield[j]), 4, 0, 2 * Math.PI); ctx.fill(); });
    ctx.fillStyle = color('--muted');
    for (const v of [ylo + 0.004, yhi - 0.004]) ctx.fillText(`${(v * 100).toFixed(1)}%`, split + 2, qy(v) + 4);
    for (const T of [0, 10, 20, 30]) ctx.fillText(`${T}y`, qx(T) - 6, h - 6);
    legend(ctx, [['yield curve (exact)', '--accent-2'], ['Monte Carlo', '--accent']], x0, 14, x1 - x0);

    stats.textContent =
      `Yields at 1 / 5 / 10 / 30 years: ${[1, 5, 10, 30].map((T) => (yieldAt(T) * 100).toFixed(2) + '%').join(' / ')}. ` +
      `Monte Carlo at 5 years: ${(mcYield[2] * 100).toFixed(2)}%. Chance the short rate is negative in 5 years: ${(normalCdf(-mean(5) / sd(5)) * 100).toFixed(1)}%. ` +
      `Half-life of deviations from 5%: ${(Math.log(2) / a).toFixed(1)} years.`;
  }

  [r0In, aIn, sIn].forEach((el) => el.addEventListener('input', render));
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 250); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.5, 250);
  render();
});
