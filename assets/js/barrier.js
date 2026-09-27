/* Section 9.3 — Barrier Options.
   A down-and-out call (S0 = K = 100, barrier 90) dies if the price ever touches the barrier. Checking
   the barrier only at discrete dates misses crossings in between, so plain Monte Carlo overprices it.
   The Brownian-bridge correction kills each path between dates with the exact crossing probability.
   Left: paths at the chosen monitoring frequency. Right: price vs monitoring frequency. */
Stoch.lazy('barrier', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;
  const { downOutCall } = Fin;

  const root = document.getElementById('barrier');
  const canvas = root.querySelector('.br-canvas');
  const fIn = root.querySelector('input[name=freq]');
  const stats = root.querySelector('.br-stats');
  const resampleBtn = root.querySelector('button.resample');

  const S0 = 100, K = 100, B = 90, SIGMA = 0.2, R = 0.03, T = 1, N = 10000, SHOWN = 36;
  const FREQS = [4, 12, 52, 252, 1000];
  const LABELS = ['quarterly', 'monthly', 'weekly', 'daily', '1,000 times a year'];
  let seed = 221, results, view;

  function simulate() {
    const rand = rng(seed), disc = Math.exp(-R * T), lnB = Math.log(B);
    results = FREQS.map((steps) => {
      const dt = T / steps, drift = (R - 0.5 * SIGMA * SIGMA) * dt, sd = SIGMA * Math.sqrt(dt), s2dt = SIGMA * SIGMA * dt;
      let sN = 0, sN2 = 0, sB = 0, sB2 = 0;
      const shown = [];
      for (let k = 0; k < N; k++) {
        let x = Math.log(S0), alive = 1, survive = 1;
        const line = k < SHOWN ? [x] : null;
        for (let i = 0; i < steps; i++) {
          const nx = x + drift + sd * gaussian(rand);
          if (nx <= lnB) alive = 0;
          // Brownian bridge: probability the path dipped below the barrier between the two dates.
          if (alive) survive *= 1 - Math.exp((-2 * (x - lnB) * (nx - lnB)) / s2dt);
          x = nx;
          if (line) line.push(x);
        }
        const payoff = disc * Math.max(Math.exp(x) - K, 0);
        const pn = alive * payoff, pb = alive * survive * payoff;
        sN += pn; sN2 += pn * pn; sB += pb; sB2 += pb * pb;
        if (line) shown.push({ line, alive });
      }
      const se = (s, s2) => Math.sqrt(Math.max(s2 / N - (s / N) ** 2, 0) / N);
      return { naive: sN / N, naiveSE: se(sN, sN2), bridge: sB / N, bridgeSE: se(sB, sB2), shown };
    });
  }

  function render() {
    const j = +fIn.value, res = results[j], exact = downOutCall(S0, K, B, T, R, SIGMA);
    fIn.nextElementSibling.value = LABELS[j];
    const { ctx, w, h } = view, split = w * 0.55;

    // Left: paths at this frequency; knocked-out paths grey.
    const lo = Math.log(70), hi = Math.log(160);
    const px = (i, n) => (i / n) * (split - 8), py = (x) => h - 12 - ((Math.min(Math.max(x, lo), hi) - lo) / (hi - lo)) * (h - 34);
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    for (const { line, alive } of res.shown) {
      ctx.strokeStyle = alive ? color('--accent') : color('--faint');
      ctx.globalAlpha = alive ? 0.55 : 1; ctx.lineWidth = 1;
      polyline(ctx, 0, line.length - 1, (i) => px(i, line.length - 1), (i) => py(line[i]));
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--accent-3'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, py(Math.log(B))); ctx.lineTo(split - 8, py(Math.log(B))); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--accent-3'); ctx.fillText('barrier 90', 4, py(Math.log(B)) + 14);
    legend(ctx, [[`paths checked ${LABELS[j]}`, '--muted'], ['alive', '--accent']], 6, 14, split - 16);

    // Right: price vs monitoring frequency.
    const x0 = split + 12, x1 = w - 12;
    const vals = results.flatMap((r) => [r.naive + 2 * r.naiveSE, r.bridge - 2 * r.bridgeSE]).concat([exact]);
    const vlo = Math.min(...vals) - 0.2, vhi = Math.max(...vals) + 0.2;
    const qx = (k) => x0 + (k / (FREQS.length - 1)) * (x1 - x0), qy = (v) => h - 30 - ((v - vlo) / (vhi - vlo)) * (h - 64);
    ctx.strokeStyle = color('--border'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    ctx.strokeStyle = color('--fg'); ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x0, qy(exact)); ctx.lineTo(x1, qy(exact)); ctx.stroke(); ctx.setLineDash([]);
    for (const [key, token] of [['naive', '--accent'], ['bridge', '--accent-2']]) {
      ctx.strokeStyle = color(token); ctx.fillStyle = color(token); ctx.lineWidth = 2;
      polyline(ctx, 0, FREQS.length - 1, qx, (k) => qy(results[k][key]));
      results.forEach((r, k) => {
        const se = r[key + 'SE'];
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(qx(k), qy(r[key] - 2 * se)); ctx.lineTo(qx(k), qy(r[key] + 2 * se)); ctx.stroke();
        ctx.beginPath(); ctx.arc(qx(k), qy(r[key]), k === j ? 5.5 : 3.5, 0, 2 * Math.PI); ctx.fill();
      });
    }
    ctx.fillStyle = color('--muted');
    ['4', '12', '52', '252', '1000'].forEach((t, k) => ctx.fillText(t, Math.min(qx(k) - 8, x1 - ctx.measureText(t).width), h - 8));
    legend(ctx, [['checked only at dates', '--accent'], ['with bridge correction', '--accent-2'], ['dashed: exact', '--muted']], x0, 14, x1 - x0);

    stats.textContent =
      `Exact price (barrier watched continuously): ${exact.toFixed(3)}. Checked ${LABELS[j]}: plain Monte Carlo ${res.naive.toFixed(3)} ± ${res.naiveSE.toFixed(3)}, ` +
      `with the Brownian-bridge correction ${res.bridge.toFixed(3)} ± ${res.bridgeSE.toFixed(3)}.`;
  }

  fIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55, 260); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.55, 260);
  render();
});
