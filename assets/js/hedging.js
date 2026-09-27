/* Section 6.1 — Black–Scholes by Hedging.
   Sell a call option for its Black–Scholes price, then delta-hedge it by holding Δ = N(d1) shares,
   rebalanced N times over the year. 1,000 stock paths (252 trading days, real-world drift μ).
   Left: option value vs hedge portfolio along one path. Right: final profit/loss over all paths. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, normalCdf, histogram, revealOnInteract } = Stoch;

  const root = document.getElementById('hedge');
  const valCanvas = root.querySelector('.hd-value');
  const histCanvas = root.querySelector('.hd-hist');
  const nIn = root.querySelector('input[name=n]');
  const stats = root.querySelector('.hd-stats');
  const resampleBtn = root.querySelector('button.resample');

  const S0 = 100, K = 100, SIGMA = 0.2, MU = 0.1, DAYS = 252, PATHS = 1000, R = 6;
  const CHOICES = [1, 2, 4, 6, 12, 21, 42, 63, 126, 252];  // rebalances per year, all dividing 252
  let seed = 111, S, valView, histView;

  function call(s, tau) {
    if (tau <= 0) return { price: Math.max(s - K, 0), delta: s > K ? 1 : 0 };
    const v = SIGMA * Math.sqrt(tau), d1 = (Math.log(s / K) + 0.5 * v * v) / v;
    return { price: s * normalCdf(d1) - K * normalCdf(d1 - v), delta: normalCdf(d1) };
  }

  function simulate() {
    const rand = rng(seed), dt = 1 / DAYS, drift = (MU - 0.5 * SIGMA * SIGMA) * dt, sd = SIGMA * Math.sqrt(dt);
    S = new Float64Array(PATHS * (DAYS + 1));
    for (let k = 0; k < PATHS; k++) {
      const o = k * (DAYS + 1);
      S[o] = S0;
      for (let i = 0; i < DAYS; i++) S[o + i + 1] = S[o + i] * Math.exp(drift + sd * gaussian(rand));
    }
  }

  // Portfolio value each day for path k: start with the premium, hold Δ from the last rebalance.
  function hedgePath(k, n) {
    const o = k * (DAYS + 1), every = DAYS / n, V = new Float64Array(DAYS + 1);
    V[0] = call(S0, 1).price;
    let delta = 0;
    for (let i = 0; i < DAYS; i++) {
      if (i % every === 0) delta = call(S[o + i], 1 - i / DAYS).delta;
      V[i + 1] = V[i] + delta * (S[o + i + 1] - S[o + i]);
    }
    return V;
  }

  function render() {
    const n = CHOICES[+nIn.value];
    const often = n === 252 ? 'daily' : n === 1 ? 'once a year' : `${n} times a year`;
    nIn.nextElementSibling.value = often;
    const premium = call(S0, 1).price;

    const pnl = new Float64Array(PATHS);
    for (let k = 0; k < PATHS; k++) {
      const V = hedgePath(k, n);
      pnl[k] = V[DAYS] - Math.max(S[k * (DAYS + 1) + DAYS] - K, 0);
    }
    const mean = pnl.reduce((a, b) => a + b, 0) / PATHS;
    const sd = Math.sqrt(pnl.reduce((a, b) => a + (b - mean) ** 2, 0) / (PATHS - 1));

    {
      const { ctx, w, h } = valView, V = hedgePath(0, n);
      const C = new Float64Array(DAYS + 1);
      for (let i = 0; i <= DAYS; i++) C[i] = call(S[i], 1 - i / DAYS).price;
      let hi = 1;
      for (let i = 0; i <= DAYS; i++) hi = Math.max(hi, C[i], V[i]);
      const lo = Math.min(0, ...V);
      const px = (i) => (i / DAYS) * w, py = (v) => h - 12 - ((v - lo) / (hi * 1.1 - lo)) * (h - 34);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
      const every = DAYS / n;
      if (n <= 42) for (let i = 0; i < DAYS; i += every) { ctx.beginPath(); ctx.moveTo(px(i), 22); ctx.lineTo(px(i), h - 12); ctx.stroke(); }
      ctx.strokeStyle = color('--fg');
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.18;
      polyline(ctx, 0, DAYS, px, (i) => py(C[i]));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2;
      polyline(ctx, 0, DAYS, px, (i) => py(V[i]));
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText("option's value (thick grey)", 8, 14);
      ctx.fillStyle = color('--accent');
      ctx.fillText('your hedge portfolio', 170, 14);
      ctx.fillStyle = color('--muted');
      ctx.fillText('0', 4, py(0) - 3);
    }

    {
      const { ctx, w, h } = histView, bins = 40;
      const { bw, density } = histogram(pnl, -R, R, bins);
      const px = (v) => ((v + R) / (2 * R)) * w, py = (d) => h - 18 - Math.min(d / 1.2, 1) * (h - 40);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color('--accent-2');
      ctx.globalAlpha = 0.8;
      density.forEach((d, b) => ctx.fillRect(px(-R + b * bw) + 0.5, py(d), px(-R + bw) - 1, py(0) - py(d)));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color('--fg');
      ctx.beginPath(); ctx.moveTo(px(0), 22); ctx.lineTo(px(0), h - 18); ctx.stroke();
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText('final profit / loss, 1,000 paths', 8, 14);
      ctx.fillText('0', px(0) - 3, h - 4);
      ctx.fillText(`−${R}`, 2, h - 4);
      ctx.fillText(`+${R}`, w - 18, h - 4);
    }

    stats.textContent =
      `Black–Scholes price of the option: ${premium.toFixed(3)}. Rebalancing ${often}: ` +
      `average profit/loss ${mean.toFixed(3)}, spread (standard deviation) ${sd.toFixed(3)}. ` +
      `Theory: the spread shrinks like 1/√(rebalances), so 4× more rebalancing roughly halves it.`;
  }

  nIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  function layout() { valView = setupCanvas(valCanvas, 0.62); histView = setupCanvas(histCanvas, 0.85); render(); }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  simulate();
  layout();
})();
