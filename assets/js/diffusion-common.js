/* Chapter 7 shared model. The "data" is a two-bump Gaussian mixture; the forward (noising) process
   is the Ornstein–Uhlenbeck SDE dX = -X dt + √2 dW, whose long-run distribution is N(0, 1).
   After time t each bump is still Gaussian (mean scaled by e^-t, variance moved toward 1), so the
   noised density and its score are exact; a real diffusion model learns the score with a network. */
(function (global) {
  'use strict';
  const W = [0.35, 0.65], M = [-2, 1.5], S = [0.3, 0.5];
  const SPLIT = -0.25;  // midpoint between the bumps: decides which bump a sample "belongs" to

  function components(t) {
    const a = Math.exp(-t), b = 1 - a * a;
    return W.map((w, i) => {
      const v = S[i] * S[i] * a * a + b;
      return { logw: Math.log(w) - 0.5 * Math.log(2 * Math.PI * v), mean: M[i] * a, v };
    });
  }

  // Density p(t, x) of the noised data.
  function density(t, x) {
    let p = 0;
    for (const c of components(t)) p += Math.exp(c.logw - ((x - c.mean) ** 2) / (2 * c.v));
    return p;
  }

  // Score function x -> d/dx log p(t, x) at a fixed time, via log-sum-exp so it never divides 0 by 0.
  function scoreAt(t) {
    const cs = components(t);
    return function (x) {
      let best = -Infinity;
      const logs = cs.map((c) => { const l = c.logw - ((x - c.mean) ** 2) / (2 * c.v); best = Math.max(best, l); return l; });
      let p = 0, dp = 0;
      cs.forEach((c, i) => { const r = Math.exp(logs[i] - best); p += r; dp += (r * -(x - c.mean)) / c.v; });
      return dp / p;
    };
  }

  function sampleData(rand) {
    const k = rand() < W[0] ? 0 : 1;
    return M[k] + S[k] * Stoch.gaussian(rand);
  }

  global.Diffusion = { W, M, S, SPLIT, density, scoreAt, sampleData };
})(window);
