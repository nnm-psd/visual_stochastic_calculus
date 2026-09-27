/* Section 9.4 — American Options (Longstaff–Schwartz).
   An American put (S0 = K = 100, r = 5%, σ = 20%, one year) may be exercised at any time. Longstaff–
   Schwartz simulates paths, then works backwards: at each date it regresses the discounted future
   cash flow on powers of S (in-the-money paths only) and exercises when the payoff beats that estimate.
   A 1,000-step binomial tree gives the benchmark price and the exact exercise boundary. */
Stoch.lazy('american', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;
  const { bs } = Fin;

  const root = document.getElementById('american');
  const canvas = root.querySelector('.am-canvas');
  const nIn = root.querySelector('input[name=paths]');
  const dIn = root.querySelector('input[name=degree]');
  const stats = root.querySelector('.am-stats');
  const resampleBtn = root.querySelector('button.resample');

  const S0 = 100, K = 100, R = 0.05, SIGMA = 0.2, T = 1, DATES = 50, SHOWN = 30, TREE = 1000;
  let seed = 231, view, tree;

  // Binomial (Cox–Ross–Rubinstein) tree: price and, at each step, the highest price where exercising is optimal.
  function binomial() {
    const dt = T / TREE, u = Math.exp(SIGMA * Math.sqrt(dt)), d = 1 / u, p = (Math.exp(R * dt) - d) / (u - d), df = Math.exp(-R * dt);
    let V = new Float64Array(TREE + 1);
    for (let j = 0; j <= TREE; j++) V[j] = Math.max(K - S0 * Math.pow(u, TREE - 2 * j), 0);
    const boundary = new Float64Array(TREE + 1).fill(NaN);
    boundary[TREE] = K;
    for (let i = TREE - 1; i >= 0; i--) {
      const next = new Float64Array(i + 1);
      for (let j = 0; j <= i; j++) {
        const S = S0 * Math.pow(u, i - 2 * j), hold = df * (p * V[j] + (1 - p) * V[j + 1]), ex = K - S;
        next[j] = Math.max(hold, ex);
        if (ex > hold && ex > 0 && !(boundary[i] >= S)) boundary[i] = S;
      }
      V = next;
    }
    return { price: V[0], boundary };
  }

  // Least squares via normal equations (small systems: degree ≤ 4).
  function regress(xs, ys, deg) {
    const m = deg + 1, A = Array.from({ length: m }, () => new Float64Array(m + 1));
    for (let k = 0; k < xs.length; k++) {
      const pw = [1]; for (let a = 1; a < m; a++) pw.push(pw[a - 1] * xs[k]);
      for (let a = 0; a < m; a++) { for (let b = 0; b < m; b++) A[a][b] += pw[a] * pw[b]; A[a][m] += pw[a] * ys[k]; }
    }
    for (let c = 0; c < m; c++) {
      let piv = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < m; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= m; q++) A[r][q] -= f * A[c][q]; }
    }
    return Array.from({ length: m }, (_, a) => A[a][m] / A[a][a]);
  }

  function render() {
    const M = Math.round(Math.pow(10, +nIn.value) / 100) * 100, deg = +dIn.value;
    nIn.nextElementSibling.value = M.toLocaleString();
    dIn.nextElementSibling.value = ['', 'S', 'S, S²', 'S, S², S³', 'S … S⁴'][deg];
    const rand = rng(seed), dt = T / DATES, drift = (R - 0.5 * SIGMA * SIGMA) * dt, sd = SIGMA * Math.sqrt(dt), df = Math.exp(-R * dt);

    const S = Array.from({ length: DATES + 1 }, () => new Float64Array(M));
    S[0].fill(S0);
    for (let i = 1; i <= DATES; i++) for (let k = 0; k < M; k++) S[i][k] = S[i - 1][k] * Math.exp(drift + sd * gaussian(rand));

    const cash = Float64Array.from(S[DATES], (s) => Math.max(K - s, 0)), exTime = new Int32Array(M).fill(-1);
    for (let k = 0; k < M; k++) if (cash[k] > 0) exTime[k] = DATES;
    const lsmBoundary = new Float64Array(DATES + 1).fill(NaN);
    for (let i = DATES - 1; i >= 1; i--) {
      for (let k = 0; k < M; k++) cash[k] *= df;
      const idx = [], xs = [], ys = [];
      for (let k = 0; k < M; k++) if (S[i][k] < K) { idx.push(k); xs.push(S[i][k] / S0); ys.push(cash[k]); }
      if (idx.length <= deg + 1) continue;
      const c = regress(xs, ys, deg);
      for (let q = 0; q < idx.length; q++) {
        let cont = 0; for (let a = deg; a >= 0; a--) cont = cont * xs[q] + c[a];
        const k = idx[q], ex = K - S[i][k];
        if (ex > cont) { cash[k] = ex; exTime[k] = i; if (!(lsmBoundary[i] >= S[i][k])) lsmBoundary[i] = S[i][k]; }
      }
    }
    let s = 0, s2 = 0;
    for (let k = 0; k < M; k++) { const v = cash[k] * df; s += v; s2 += v * v; }
    const price = s / M, se = Math.sqrt(Math.max(s2 / M - price * price, 0) / M), euro = bs(S0, K, T, R, SIGMA).put;

    const { ctx, w, h } = view, lo = 60, hi = 150;
    const px = (t) => 8 + t * (w - 16), py = (v) => h - 14 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (h - 40);
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(px(0), py(K)); ctx.lineTo(px(1), py(K)); ctx.stroke();
    for (let k = 0; k < SHOWN; k++) {
      const stop = exTime[k] >= 0 ? exTime[k] : DATES;
      ctx.strokeStyle = color('--faint'); ctx.lineWidth = 1;
      polyline(ctx, 0, stop, (i) => px(i / DATES), (i) => py(S[i][k]));
      if (exTime[k] >= 0 && exTime[k] < DATES) {
        ctx.fillStyle = color('--accent'); ctx.beginPath(); ctx.arc(px(exTime[k] / DATES), py(S[exTime[k]][k]), 3.5, 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.strokeStyle = color('--fg'); ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= TREE; i += 5) { const b = tree.boundary[i]; if (!Number.isFinite(b)) continue; started ? ctx.lineTo(px(i / TREE), py(b)) : ctx.moveTo(px(i / TREE), py(b)); started = true; }
    ctx.stroke();
    ctx.fillStyle = color('--accent-2');
    for (let i = 1; i < DATES; i++) if (Number.isFinite(lsmBoundary[i])) { ctx.beginPath(); ctx.arc(px(i / DATES), py(lsmBoundary[i]), 2.5, 0, 2 * Math.PI); ctx.fill(); }
    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['exercise boundary (tree)', '--fg'], ['estimated boundary (LSM)', '--accent-2'], ['early exercise', '--accent'], ['strike 100', '--muted']], 10, 14, w - 20);

    stats.textContent =
      `Longstaff–Schwartz with ${M.toLocaleString()} paths and basis ${dIn.nextElementSibling.value}: ${price.toFixed(3)} ± ${se.toFixed(3)}. ` +
      `Binomial tree (${TREE} steps): ${tree.price.toFixed(3)}. European put (no early exercise): ${euro.toFixed(3)}, so the right to exercise early is worth ${(tree.price - euro).toFixed(3)}.`;
  }

  nIn.addEventListener('input', render);
  dIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 250); render(); });
  revealOnInteract(root);
  tree = binomial();
  view = setupCanvas(canvas, 0.5, 250);
  render();
});
