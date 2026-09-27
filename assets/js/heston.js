/* Section 10.2 — Stochastic Volatility (Heston).
   dS = rS dt + √v S dW1, dv = κ(θ − v)dt + ξ√v dW2, corr(dW1, dW2) = ρ. Left: one path of the price
   and of its volatility √v. Right: the implied-volatility smile from exact (Fourier) prices, with
   Monte Carlo prices (20,000 paths) as dots to confirm them. */
Stoch.lazy('heston', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;
  const { hestonCall, impliedVol } = Fin;

  const root = document.getElementById('heston');
  const canvas = root.querySelector('.hs-canvas');
  const rhoIn = root.querySelector('input[name=rho]');
  const xiIn = root.querySelector('input[name=xi]');
  const stats = root.querySelector('.hs-stats');
  const resampleBtn = root.querySelector('button.resample');

  const P = { T: 1, r: 0.02, v0: 0.04, kappa: 2, theta: 0.04, S0: 100 };
  const STEPS = 100, PATHS = 20000, KS = Array.from({ length: 25 }, (_, i) => 70 + i * 2.5), MC_KS = [75, 85, 95, 100, 105, 115, 125];
  let seed = 241, noise, view;

  function simulate() {
    const rand = rng(seed);
    noise = new Float64Array(PATHS * STEPS * 2);
    for (let i = 0; i < noise.length; i++) noise[i] = gaussian(rand);
  }

  // Full-truncation Euler scheme; returns terminal prices and the first path for display.
  function monteCarlo(rho, xi) {
    const dt = P.T / STEPS, c = Math.sqrt(1 - rho * rho), ST = new Float64Array(PATHS), path = [], vols = [];
    for (let k = 0; k < PATHS; k++) {
      let lnS = Math.log(P.S0), v = P.v0;
      for (let i = 0; i < STEPS; i++) {
        const z1 = noise[(k * STEPS + i) * 2], z2 = rho * z1 + c * noise[(k * STEPS + i) * 2 + 1], vp = Math.max(v, 0);
        if (k === 0) { path.push(Math.exp(lnS)); vols.push(Math.sqrt(vp)); }
        lnS += (P.r - 0.5 * vp) * dt + Math.sqrt(vp * dt) * z1;
        v += P.kappa * (P.theta - vp) * dt + xi * Math.sqrt(vp * dt) * z2;
      }
      ST[k] = Math.exp(lnS);
      if (k === 0) { path.push(ST[k]); vols.push(Math.sqrt(Math.max(v, 0))); }
    }
    return { ST, path, vols };
  }

  function render() {
    const rho = +rhoIn.value, xi = +xiIn.value, p = { ...P, rho, xi };
    rhoIn.nextElementSibling.value = rho.toFixed(2);
    xiIn.nextElementSibling.value = xi.toFixed(2);
    const exactIV = KS.map((K) => impliedVol(hestonCall(K, p), P.S0, K, P.T, P.r));
    const mc = monteCarlo(rho, xi), disc = Math.exp(-P.r * P.T);
    const mcIV = MC_KS.map((K) => { let s = 0; for (const x of mc.ST) s += Math.max(x - K, 0); return impliedVol((disc * s) / PATHS, P.S0, K, P.T, P.r); });

    const { ctx, w, h } = view, split = w * 0.46, half = h / 2;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    // Left: price path (top) and volatility path (bottom).
    const tx = (i) => 8 + (i / STEPS) * (split - 16);
    const pmin = Math.min(...mc.path), pmax = Math.max(...mc.path), vmax = Math.max(...mc.vols, 0.3);
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 1.75;
    polyline(ctx, 0, STEPS, tx, (i) => half - 10 - ((mc.path[i] - pmin) / (pmax - pmin || 1)) * (half - 34));
    ctx.strokeStyle = color('--accent-3');
    polyline(ctx, 0, STEPS, tx, (i) => h - 10 - (mc.vols[i] / vmax) * (half - 34));
    ctx.strokeStyle = color('--border'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, half); ctx.lineTo(split, half); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['one price path', '--accent']], 8, 14, split - 16);
    legend(ctx, [['its volatility √v', '--accent-3']], 8, half + 14, split - 16);

    // Right: smile.
    const all = exactIV.concat(mcIV).filter(Number.isFinite), lo = Math.min(...all) - 0.01, hi = Math.max(...all) + 0.01;
    const x0 = split + 36, x1 = w - 10;
    const qx = (K) => x0 + ((K - 70) / 60) * (x1 - x0), qy = (v) => h - 24 - ((v - lo) / (hi - lo)) * (h - 52);
    ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 2.5;
    polyline(ctx, 0, KS.length - 1, (i) => qx(KS[i]), (i) => qy(exactIV[i]));
    ctx.fillStyle = color('--accent');
    MC_KS.forEach((K, i) => { if (Number.isFinite(mcIV[i])) { ctx.beginPath(); ctx.arc(qx(K), qy(mcIV[i]), 4, 0, 2 * Math.PI); ctx.fill(); } });
    ctx.fillStyle = color('--muted');
    for (const K of [70, 100, 130]) ctx.fillText(String(K), qx(K) - 9, h - 6);
    for (const v of [lo + 0.01, hi - 0.01]) ctx.fillText(`${(v * 100).toFixed(0)}%`, split + 4, qy(v) + 4);
    legend(ctx, [['implied vol, exact', '--accent-2'], ['Monte Carlo', '--accent']], x0, 14, x1 - x0);

    const at = (K) => exactIV[KS.indexOf(K)], feller = 2 * P.kappa * P.theta;
    stats.textContent =
      `Implied volatility at strikes 80 / 100 / 120: ${(at(80) * 100).toFixed(1)}% / ${(at(100) * 100).toFixed(1)}% / ${(at(120) * 100).toFixed(1)}%. ` +
      `Monte Carlo vs exact at strike 100: ${(mcIV[3] * 100).toFixed(2)}% vs ${(at(100) * 100).toFixed(2)}%. ` +
      `Feller condition 2κθ ≥ ξ²: ${feller.toFixed(2)} ${feller >= xi * xi ? '≥' : '<'} ${(xi * xi).toFixed(2)} (${feller >= xi * xi ? 'variance stays positive' : 'variance can touch 0'}).`;
  }

  rhoIn.addEventListener('input', render);
  xiIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 270); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.5, 270);
  render();
});
