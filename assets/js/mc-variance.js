/* Section 9.1 — Monte Carlo & Variance Reduction.
   Price a European call four ways from the same 20,000 normal draws (plain, antithetic, control
   variate on S_T, importance sampling with the mean shifted to the strike). The chart shows the
   running estimate with a 95% band as more payoffs are averaged; the stats compare standard errors. */
Stoch.lazy('mc', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;
  const { bs } = Fin;

  const root = document.getElementById('mc');
  const canvas = root.querySelector('.mc-canvas');
  const kIn = root.querySelector('input[name=K]');
  const stats = root.querySelector('.mc-stats');
  const resampleBtn = root.querySelector('button.resample');

  const S0 = 100, SIGMA = 0.2, R = 0.03, T = 1, N = 20000, FIRST = 50;
  const NAMES = { plain: 'plain', anti: 'antithetic', cv: 'control variate', is: 'importance sampling' };
  let seed = 201, Z, view;

  function simulate() { const rand = rng(seed); Z = new Float64Array(N); for (let i = 0; i < N; i++) Z[i] = gaussian(rand); }

  // Per-sample estimates for each method, all using at most N payoff evaluations.
  function samples(K) {
    const drift = (R - 0.5 * SIGMA * SIGMA) * T, vol = SIGMA * Math.sqrt(T), disc = Math.exp(-R * T);
    const ST = (z) => S0 * Math.exp(drift + vol * z), pay = (z) => disc * Math.max(ST(z) - K, 0);
    const plain = Float64Array.from(Z, pay);
    const anti = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) anti[i] = 0.5 * (pay(Z[i]) + pay(-Z[i]));
    // Control variate: S_T has known mean S0 e^{rT}; beta = Cov(payoff, S_T) / Var(S_T).
    const X = Float64Array.from(Z, ST), mX = S0 * Math.exp(R * T);
    let mp = 0, mx = 0; for (let i = 0; i < N; i++) { mp += plain[i] / N; mx += X[i] / N; }
    let cov = 0, vx = 0; for (let i = 0; i < N; i++) { cov += (plain[i] - mp) * (X[i] - mx); vx += (X[i] - mx) ** 2; }
    const beta = cov / vx, cv = Float64Array.from(plain, (p, i) => p - beta * (X[i] - mX));
    // Importance sampling: draw Z + θ (paths centred on the strike), reweight by the Girsanov factor.
    const th = Math.max(0, (Math.log(K / S0) - drift) / vol);
    const is = Float64Array.from(Z, (z) => { const zs = z + th; return pay(zs) * Math.exp(-th * zs + 0.5 * th * th); });
    return { plain, anti, cv, is, th };
  }

  const summary = (a) => {
    let m = 0; for (const v of a) m += v / a.length;
    let s = 0; for (const v of a) s += (v - m) ** 2;
    return { mean: m, se: Math.sqrt(s / (a.length - 1) / a.length) };
  };

  function render() {
    const K = +kIn.value, method = root.querySelector('input[name=method]:checked').value;
    kIn.nextElementSibling.value = K;
    const exact = bs(S0, K, T, R, SIGMA).call, S = samples(K), ys = S[method];
    const evalsPer = method === 'anti' ? 2 : 1;

    const { ctx, w, h } = view;
    const lx0 = Math.log10(FIRST * evalsPer), lx1 = Math.log10(N);
    const px = (evals) => 44 + ((Math.log10(evals) - lx0) / (lx1 - lx0)) * (w - 56);
    const pts = [];
    let sum = 0, sum2 = 0;
    for (let i = 0; i < ys.length; i++) {
      sum += ys[i]; sum2 += ys[i] * ys[i];
      const n = i + 1;
      if (n >= FIRST && (n % Math.max(1, Math.floor(n / 60)) === 0 || n === ys.length)) {
        const m = sum / n, se = Math.sqrt(Math.max(sum2 / n - m * m, 0) / n);
        pts.push([n * evalsPer, m, se]);
      }
    }
    const spread = Math.max(exact * 0.6, 0.05), lo = exact - spread, hi = exact + spread;
    const py = (v) => h - 24 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (h - 48);
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color('--accent'); ctx.globalAlpha = 0.18;
    ctx.beginPath();
    pts.forEach(([n, m, se], i) => (i ? ctx.lineTo(px(n), py(m + 1.96 * se)) : ctx.moveTo(px(n), py(m + 1.96 * se))));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(px(pts[i][0]), py(pts[i][1] - 1.96 * pts[i][2]));
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(44, py(exact)); ctx.lineTo(w - 12, py(exact)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 2;
    polyline(ctx, 0, pts.length - 1, (i) => px(pts[i][0]), (i) => py(pts[i][1]));
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const n of [100, 1000, 10000]) if (n >= FIRST * evalsPer) ctx.fillText(n.toLocaleString(), px(n) - 12, h - 6);
    ctx.fillText(exact.toFixed(2), 4, py(exact) + 4);
    legend(ctx, [[`${NAMES[method]}: running estimate ± 95%`, '--accent'], ['dashed: Black–Scholes price', '--muted']], 48, 16, w - 60);

    const res = Object.fromEntries(Object.keys(NAMES).map((k) => [k, summary(S[k])]));
    // Every method used 20,000 payoff evaluations, so squared standard errors compare equal cost.
    const base = res.plain.se ** 2, eff = (k) => base / res[k].se ** 2;
    stats.textContent =
      `Strike ${K}: Black–Scholes price ${exact.toFixed(4)}. With 20,000 payoff evaluations each: ` +
      Object.keys(NAMES).map((k) => `${NAMES[k]} ${res[k].mean.toFixed(4)} ± ${res[k].se.toFixed(4)}` +
        (k === 'plain' ? '' : eff(k) < 1.1 ? ' (no gain at this strike)' : ` (${eff(k).toFixed(1)}× less variance)`)).join('; ') + '.';
  }

  kIn.addEventListener('input', render);
  root.querySelectorAll('input[name=method]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 240); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.5, 240);
  render();
});
