/* Shared pricing formulas for chapters 9–11 (Black–Scholes, barrier, Merton jump-diffusion, Heston,
   Vasicek), each checked against simulation before use (see the Python snippets on the pages). */
(function (global) {
  'use strict';
  const { normalCdf: N, normalPdf: phi } = Stoch;

  // Black–Scholes with interest rate r (no dividends).
  function bs(S, K, T, r, sigma) {
    const v = sigma * Math.sqrt(T), d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / v, d2 = d1 - v;
    const disc = Math.exp(-r * T);
    return {
      call: S * N(d1) - K * disc * N(d2),
      put: K * disc * N(-d2) - S * N(-d1),
      delta: N(d1),
      gamma: phi(d1) / (S * v),
      vega: S * Math.sqrt(T) * phi(d1),
      d1, d2,
    };
  }

  // Implied volatility by bisection (robust; call prices are increasing in sigma).
  function impliedVol(price, S, K, T, r) {
    let lo = 1e-4, hi = 4;
    if (price <= Math.max(S - K * Math.exp(-r * T), 0) + 1e-12) return NaN;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (bs(S, K, T, r, mid).call < price) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  // Continuously monitored down-and-out call, barrier B <= K (reflection principle).
  function downOutCall(S, K, B, T, r, sigma) {
    const lam = (r + 0.5 * sigma * sigma) / (sigma * sigma), v = sigma * Math.sqrt(T);
    const y = Math.log((B * B) / (S * K)) / v + lam * v;
    const cdi = S * Math.pow(B / S, 2 * lam) * N(y) - K * Math.exp(-r * T) * Math.pow(B / S, 2 * lam - 2) * N(y - v);
    return bs(S, K, T, r, sigma).call - cdi;
  }

  // Merton (1976) jump-diffusion call: Poisson(λ) jumps with log-size N(muJ, dJ²).
  function mertonCall(S, K, T, r, sigma, lam, muJ, dJ) {
    const k = Math.exp(muJ + 0.5 * dJ * dJ) - 1, lp = lam * (1 + k);
    let total = 0, weight = Math.exp(-lp * T);
    for (let n = 0; n < 80; n++) {
      if (n > 0) weight *= (lp * T) / n;
      const sn = Math.sqrt(sigma * sigma + (n * dJ * dJ) / T), rn = r - lam * k + (n * Math.log(1 + k)) / T;
      total += weight * bs(S, K, T, rn, sn).call;
    }
    return total;
  }

  // Minimal complex arithmetic for the Heston characteristic function.
  const C = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q]; },
    exp: (a) => { const m = Math.exp(a[0]); return [m * Math.cos(a[1]), m * Math.sin(a[1])]; },
    log: (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])],
    sqrt: (a) => { const m = Math.sqrt(Math.hypot(a[0], a[1])), t = 0.5 * Math.atan2(a[1], a[0]); return [m * Math.cos(t), m * Math.sin(t)]; },
    scale: (a, s) => [a[0] * s, a[1] * s],
  };

  // Heston characteristic function of ln S_T at complex argument u ("little Heston trap" form).
  function hestonCF(u, p) {
    const { T, r, v0, kappa, theta, xi, rho, S0 } = p;
    const iu = [-u[1], u[0]];                                   // i·u
    const b = C.sub([kappa, 0], C.scale(iu, rho * xi));         // κ − ρξiu
    const d = C.sqrt(C.add(C.mul(b, b), C.scale(C.add(iu, C.mul(u, u)), xi * xi)));
    const g = C.div(C.sub(b, d), C.add(b, d));
    const e = C.exp(C.scale(d, -T));
    const one = [1, 0];
    const logTerm = C.log(C.div(C.sub(one, C.mul(g, e)), C.sub(one, g)));
    const Cc = C.add(C.scale(iu, r * T), C.scale(C.sub(C.scale(C.sub(b, d), T), C.scale(logTerm, 2)), (kappa * theta) / (xi * xi)));
    const D = C.mul(C.scale(C.sub(b, d), 1 / (xi * xi)), C.div(C.sub(one, e), C.sub(one, C.mul(g, e))));
    return C.exp(C.add(C.add(Cc, C.scale(D, v0)), C.scale(iu, Math.log(S0))));
  }

  // Heston call price by Fourier inversion (trapezoid rule on [0, 200]).
  function hestonCall(K, p, n = 1600, umax = 200) {
    const lnK = Math.log(K), du = umax / n, norm = hestonCF([0, -1], p);
    let P1 = 0, P2 = 0;
    for (let j = 0; j <= n; j++) {
      const u = 1e-6 + j * du, w = j === 0 || j === n ? 0.5 : 1;
      const eK = [Math.cos(-u * lnK), Math.sin(-u * lnK)], denom = [0, u];  // e^{-iu lnK}, iu
      const f1 = C.div(C.mul(eK, hestonCF([u, -1], p)), C.mul(denom, norm));
      const f2 = C.div(C.mul(eK, hestonCF([u, 0], p)), denom);
      P1 += w * f1[0] * du; P2 += w * f2[0] * du;
    }
    P1 = 0.5 + P1 / Math.PI; P2 = 0.5 + P2 / Math.PI;
    return p.S0 * P1 - K * Math.exp(-p.r * p.T) * P2;
  }

  // Vasicek zero-coupon bond price P(0, T) for dr = a(b − r)dt + σ dW.
  function vasicekBond(r0, T, a, b, sigma) {
    const B = (1 - Math.exp(-a * T)) / a;
    const lnA = ((B - T) * (a * a * b - 0.5 * sigma * sigma)) / (a * a) - (sigma * sigma * B * B) / (4 * a);
    return Math.exp(lnA - B * r0);
  }

  global.Fin = { bs, impliedVol, downOutCall, mertonCall, hestonCF, hestonCall, vasicekBond };
})(window);
