/* Section 11.2 — Merton's Portfolio Problem.
   Keep a constant fraction π of wealth in a stock (μ = 8%, σ = 20%) and the rest in cash (r = 2%),
   rebalancing continuously. Left: 40 wealth paths over 10 years (log scale). Right: the certainty-
   equivalent growth rate r + π(μ − r) − ½γπ²σ² for CRRA risk aversion γ, peaking at π* = (μ − r)/(γσ²). */
Stoch.lazy('merton', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend, normalCdf } = Stoch;

  const root = document.getElementById('merton');
  const canvas = root.querySelector('.mp-canvas');
  const piIn = root.querySelector('input[name=pi]');
  const gIn = root.querySelector('input[name=gamma]');
  const stats = root.querySelector('.mp-stats');
  const resampleBtn = root.querySelector('button.resample');

  const MU = 0.08, R = 0.02, SIGMA = 0.2, YEARS = 10, STEPS = 120, SHOWN = 40;
  let seed = 271, Z, view;

  function simulate() { const rand = rng(seed); Z = new Float64Array(SHOWN * STEPS); for (let i = 0; i < Z.length; i++) Z[i] = gaussian(rand); }

  function render() {
    const pi = +piIn.value, gamma = +gIn.value, star = (MU - R) / (gamma * SIGMA * SIGMA);
    piIn.nextElementSibling.value = `${(pi * 100).toFixed(0)}%`;
    gIn.nextElementSibling.value = gamma.toFixed(1);
    const ce = (p) => R + p * (MU - R) - 0.5 * gamma * p * p * SIGMA * SIGMA;
    const logDrift = R + pi * (MU - R) - 0.5 * pi * pi * SIGMA * SIGMA, dt = YEARS / STEPS;

    const { ctx, w, h } = view, split = w * 0.5;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    // Left: wealth paths, same shocks for every π so only the strategy changes.
    const lo = Math.log(0.25), hi = Math.log(8), tx = (i) => 36 + (i / STEPS) * (split - 46), py = (lx) => h - 20 - ((Math.min(Math.max(lx, lo), hi) - lo) / (hi - lo)) * (h - 46);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(tx(0), py(0)); ctx.lineTo(tx(STEPS), py(0)); ctx.stroke();
    ctx.strokeStyle = color('--accent'); ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (let k = 0; k < SHOWN; k++) {
      let lx = 0; const pts = [0];
      for (let i = 0; i < STEPS; i++) { lx += logDrift * dt + pi * SIGMA * Math.sqrt(dt) * Z[k * STEPS + i]; pts.push(lx); }
      polyline(ctx, 0, STEPS, tx, (i) => py(pts[i]));
    }
    ctx.globalAlpha = 1;
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const v of [0.25, 1, 4]) ctx.fillText(`${v}×`, 4, py(Math.log(v)) + 4);
    ctx.fillText('10 years', tx(STEPS) - 44, h - 6);
    legend(ctx, [[`wealth with ${(pi * 100).toFixed(0)}% in stock`, '--accent']], 36, 14, split - 46);

    // Right: certainty-equivalent growth against π.
    const x0 = split + 36, x1 = w - 10, PMAX = 2.5, vals = [];
    for (let i = 0; i <= 100; i++) vals.push(ce((i / 100) * PMAX));
    const vlo = Math.max(Math.min(...vals), -0.1), vhi = Math.max(...vals) + 0.005;
    const qx = (p) => x0 + (p / PMAX) * (x1 - x0), qy = (v) => h - 20 - ((Math.min(Math.max(v, vlo), vhi) - vlo) / (vhi - vlo)) * (h - 46);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.moveTo(x0, qy(R)); ctx.lineTo(x1, qy(R)); ctx.stroke();
    ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 2.5;
    // Draw only the part of the curve inside the chart; very high leverage falls off the bottom.
    let last = 100; while (last > 1 && vals[last] < vlo) last--;
    polyline(ctx, 0, last, (i) => qx((i / 100) * PMAX), (i) => qy(vals[i]));
    ctx.strokeStyle = color('--fg'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.25;
    if (star <= PMAX) { ctx.beginPath(); ctx.moveTo(qx(star), 24); ctx.lineTo(qx(star), h - 20); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = color('--accent'); ctx.beginPath(); ctx.arc(qx(pi), qy(ce(pi)), 6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = color('--muted');
    for (const p of [0, 1, 2]) ctx.fillText(`${p * 100}%`, qx(p) - 10, h - 6);
    ctx.fillText('cash rate', x1 - 56, qy(R) - 4);
    legend(ctx, [['certainty-equivalent growth', '--accent-2'], ['dashed: optimum π*', '--fg']], x0, 14, x1 - x0);

    const lossProb = normalCdf((-logDrift * YEARS) / (pi * SIGMA * Math.sqrt(YEARS) || 1e-9));
    stats.textContent =
      `Optimal stock fraction π* = (μ − r)/(γσ²) = ${(star * 100).toFixed(0)}%. Your ${(pi * 100).toFixed(0)}%: certainty-equivalent growth ${(ce(pi) * 100).toFixed(2)}% a year ` +
      `(best possible ${(ce(star) * 100).toFixed(2)}%, cash ${(R * 100).toFixed(1)}%). Chance of ending the 10 years below the starting wealth: ${(pi > 0 ? lossProb * 100 : 0).toFixed(1)}%.`;
  }

  piIn.addEventListener('input', render);
  gIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 250); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.5, 250);
  render();
});
