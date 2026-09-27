/* Section 5.1 — Euler–Maruyama.
   Geometric Brownian motion dS = μS dt + σS dW has an exact solution, so the numerical scheme can be
   checked against it using the same Brownian path. Left: exact vs Euler–Maruyama with N steps.
   Right: average error at t = 1 over 500 paths for N = 2..1024, on log–log axes. */
Stoch.lazy('euler', function () {
  'use strict';
  const { rng, brownianPath, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('euler');
  const pathCanvas = root.querySelector('.em-path');
  const errCanvas = root.querySelector('.em-err');
  const kIn = root.querySelector('input[name=k]');
  const stats = root.querySelector('.em-stats');
  const resampleBtn = root.querySelector('button.resample');

  const MU = 0.2, SIGMA = 0.8, FINE = 1024, KMAX = 10, ERR_PATHS = 500;
  const exact = (w, t) => Math.exp((MU - 0.5 * SIGMA * SIGMA) * t + SIGMA * w);
  let seed = 81, hero, errors, pathView, errView;

  // Euler–Maruyama on N = 2^k steps, using sums of the fine increments of path W.
  function em(W, k) {
    const N = 1 << k, stride = FINE / N, dt = 1 / N, out = new Float64Array(N + 1);
    out[0] = 1;
    for (let i = 0; i < N; i++) {
      const dw = W[(i + 1) * stride] - W[i * stride];
      out[i + 1] = out[i] + MU * out[i] * dt + SIGMA * out[i] * dw;
    }
    return out;
  }

  function simulate() {
    const rand = rng(seed);
    hero = brownianPath(FINE, rand);
    errors = new Float64Array(KMAX + 1);
    for (let p = 0; p < ERR_PATHS; p++) {
      const W = brownianPath(FINE, rand), truth = exact(W[FINE], 1);
      for (let k = 1; k <= KMAX; k++) errors[k] += Math.abs(em(W, k)[1 << k] - truth) / ERR_PATHS;
    }
  }

  function render() {
    const k = +kIn.value, N = 1 << k, approx = em(hero, k);
    kIn.nextElementSibling.value = N.toLocaleString();

    {
      const { ctx, w, h } = pathView;
      let hi = 0;
      for (let i = 0; i <= FINE; i++) hi = Math.max(hi, exact(hero[i], i / FINE));
      for (const v of approx) hi = Math.max(hi, v);
      const px = (t) => t * w, py = (v) => h - 10 - (v / (hi * 1.1)) * (h - 30);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--fg');
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.18;
      polyline(ctx, 0, FINE, (i) => px(i / FINE), (i) => py(exact(hero[i], i / FINE)));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2;
      polyline(ctx, 0, N, (i) => px(i / N), (i) => py(approx[i]));
      if (N <= 32) {
        ctx.fillStyle = color('--accent');
        for (let i = 0; i <= N; i++) { ctx.beginPath(); ctx.arc(px(i / N), py(approx[i]), 3.5, 0, 2 * Math.PI); ctx.fill(); }
      }
      ctx.font = '12px system-ui, sans-serif';
      legend(ctx, [['exact solution (thick grey)', '--muted'], [`Euler–Maruyama, ${N} steps`, '--accent']], 8, 14, w - 16);
    }

    {
      const { ctx, w, h } = errView;
      const lx = (kk) => 36 + ((kk - 1) / (KMAX - 1)) * (w - 50);  // log2(N) axis
      const lyMin = Math.log10(errors[KMAX]) - 0.3, lyMax = Math.log10(errors[1]) + 0.3;
      const ly = (e) => h - 24 - ((Math.log10(e) - lyMin) / (lyMax - lyMin)) * (h - 48);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      // Reference slope: error ∝ (1/N)^(1/2), anchored at the first point.
      ctx.strokeStyle = color('--fg');
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.25;
      polyline(ctx, 1, KMAX, lx, (kk) => ly(errors[1] * Math.pow(2, -(kk - 1) / 2)));
      ctx.setLineDash([]);
      ctx.strokeStyle = color('--accent-2');
      ctx.lineWidth = 2;
      polyline(ctx, 1, KMAX, lx, (kk) => ly(errors[kk]));
      for (let kk = 1; kk <= KMAX; kk++) {
        ctx.fillStyle = kk === k ? color('--accent') : color('--accent-2');
        ctx.beginPath(); ctx.arc(lx(kk), ly(errors[kk]), kk === k ? 6 : 3.5, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText('average error at t = 1 (log scale)', 8, 14);
      ctx.fillText('dashed: error ∝ √Δt', 8, 30);
      for (const kk of [1, 4, 7, 10]) ctx.fillText(String(1 << kk), lx(kk) - 8, h - 6);
    }

    stats.textContent =
      `With ${N} steps (Δt = 1/${N}), this path ends at ${approx[N].toFixed(3)} vs exact ${exact(hero[FINE], 1).toFixed(3)}. ` +
      `Average error over ${ERR_PATHS} paths: ${errors[k].toFixed(4)}. ` +
      (k > 2 ? `Quadrupling the steps from ${N / 4} cut the error by a factor of ${(errors[k - 2] / errors[k]).toFixed(2)} (theory: about 2).` : '');
  }

  kIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  function layout() { pathView = setupCanvas(pathCanvas, 0.62); errView = setupCanvas(errCanvas, 0.85); render(); }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  simulate();
  layout();
});
