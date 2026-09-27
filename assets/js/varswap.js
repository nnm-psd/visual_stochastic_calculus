/* Section 10.3 — Variance Swaps.
   A variance swap pays realized variance minus a fixed strike. Its fair strike can be replicated by a
   static strip of out-of-the-money options weighted by 1/K² (plus dynamic trading in the stock).
   Model: Heston (ρ = −0.7, ξ = 0.5, κ = 2, θ = 0.04), r = 0, one year. Left: each option's
   contribution to the strip. Right: realized variance over 4,000 simulated years, against the fair
   strike and the strip's value. */
Stoch.lazy('varswap', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, revealOnInteract, legend } = Stoch;
  const { hestonCall } = Fin;

  const root = document.getElementById('varswap');
  const canvas = root.querySelector('.vs-canvas');
  const nIn = root.querySelector('input[name=n]');
  const v0In = root.querySelector('input[name=v0]');
  const stats = root.querySelector('.vs-stats');
  const resampleBtn = root.querySelector('button.resample');

  const BASE = { T: 1, r: 0, kappa: 2, theta: 0.04, xi: 0.5, rho: -0.7, S0: 100 };
  const KMIN = 30, KMAX = 300, PATHS = 4000, DAYS = 252;
  let seed = 251, view;

  function render() {
    const n = +nIn.value, vol0 = +v0In.value, p = { ...BASE, v0: vol0 * vol0 };
    nIn.nextElementSibling.value = n;
    v0In.nextElementSibling.value = `${(vol0 * 100).toFixed(0)}%`;
    const fair = p.theta + ((p.v0 - p.theta) * (1 - Math.exp(-p.kappa * p.T))) / (p.kappa * p.T);

    // Strip: n strikes evenly spaced on [KMIN, KMAX]; puts below the forward (S0, r = 0), calls above.
    const dK = (KMAX - KMIN) / (n - 1), strip = [];
    let rep = 0;
    for (let j = 0; j < n; j++) {
      const K = KMIN + j * dK, call = hestonCall(K, p), otm = K < p.S0 ? call - p.S0 + K : call;
      const wgt = j === 0 || j === n - 1 ? 0.5 : 1, contrib = (2 / p.T) * wgt * (otm / (K * K)) * dK;
      strip.push([K, contrib]); rep += contrib;
    }

    // Realized variance from daily log returns under Heston (full-truncation Euler).
    const rand = rng(seed), dt = p.T / DAYS, c = Math.sqrt(1 - p.rho * p.rho), rv = new Float64Array(PATHS);
    for (let k = 0; k < PATHS; k++) {
      let v = p.v0, sum = 0;
      for (let i = 0; i < DAYS; i++) {
        const z1 = gaussian(rand), z2 = p.rho * z1 + c * gaussian(rand), vp = Math.max(v, 0);
        const ret = -0.5 * vp * dt + Math.sqrt(vp * dt) * z1;
        sum += ret * ret;
        v += p.kappa * (p.theta - vp) * dt + p.xi * Math.sqrt(vp * dt) * z2;
      }
      rv[k] = sum / p.T;
    }
    let m = 0; for (const x of rv) m += x / PATHS;
    let s2 = 0; for (const x of rv) s2 += (x - m) ** 2;
    const se = Math.sqrt(s2 / (PATHS - 1) / PATHS);

    const { ctx, w, h } = view, split = w * 0.5;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    // Left: strip contributions.
    const cmax = Math.max(...strip.map((q) => q[1]));
    const px = (K) => 10 + ((K - KMIN) / (KMAX - KMIN)) * (split - 20), py = (v) => h - 22 - (v / cmax) * (h - 52);
    const bw = Math.max(1.5, ((split - 20) / n) * 0.7);
    strip.forEach(([K, v]) => { ctx.fillStyle = color(K < p.S0 ? '--accent-3' : '--accent-2'); ctx.fillRect(px(K) - bw / 2, py(v), bw, h - 22 - py(v)); });
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const K of [50, 100, 200, 300]) ctx.fillText(String(K), px(K) - 9, h - 6);
    legend(ctx, [['puts', '--accent-3'], ['calls: price / K², per strike', '--accent-2']], 10, 14, split - 20);

    // Right: realized variance histogram.
    const x0 = split + 10, x1 = w - 10, vlo = 0, vhi = 0.12, bins = 40, counts = new Float64Array(bins);
    for (const x of rv) { const b = Math.floor(((x - vlo) / (vhi - vlo)) * bins); if (b >= 0 && b < bins) counts[b]++; }
    const hmax = Math.max(...counts), qx = (v) => x0 + ((v - vlo) / (vhi - vlo)) * (x1 - x0);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    ctx.fillStyle = color('--faint');
    counts.forEach((cnt, b) => { const hh = (cnt / hmax) * (h - 60); ctx.fillRect(qx(vlo + (b * (vhi - vlo)) / bins) + 0.5, h - 22 - hh, (x1 - x0) / bins - 1, hh); });
    ctx.strokeStyle = color('--fg'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(qx(fair), 30); ctx.lineTo(qx(fair), h - 22); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(qx(rep), 30); ctx.lineTo(qx(rep), h - 22); ctx.stroke();
    ctx.fillStyle = color('--muted');
    for (const v of [0, 0.04, 0.08, 0.12]) ctx.fillText(v.toFixed(2), qx(v) - 10, h - 6);
    legend(ctx, [['realized variance, 4,000 years', '--muted'], ['strip value', '--accent'], ['dashed: fair strike', '--fg']], x0, 14, x1 - x0);

    stats.textContent =
      `Fair variance strike ${fair.toFixed(5)} (volatility ${(Math.sqrt(fair) * 100).toFixed(2)}%). Option strip with ${n} strikes: ${rep.toFixed(5)}. ` +
      `Average realized variance over ${PATHS.toLocaleString()} simulated years: ${m.toFixed(5)} ± ${se.toFixed(5)}.`;
  }

  nIn.addEventListener('input', render);
  v0In.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 250); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.5, 250);
  render();
});
