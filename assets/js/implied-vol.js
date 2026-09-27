/* Section 10.1 — Implied Volatility & the Smile.
   Prices come from Merton's jump-diffusion (σ = 15% plus jumps); each is inverted through Black–Scholes
   to the volatility that reproduces it. Left: the implied-volatility smile across strikes. Right: the
   risk-neutral density of S_T read off the prices (Breeden–Litzenberger), against the lognormal density
   Black–Scholes would assume at the at-the-money volatility. */
Stoch.lazy('implied', function () {
  'use strict';
  const { setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;
  const { mertonCall, impliedVol } = Fin;

  const root = document.getElementById('implied');
  const canvas = root.querySelector('.iv-canvas');
  const lamIn = root.querySelector('input[name=lam]');
  const muIn = root.querySelector('input[name=mu]');
  const dIn = root.querySelector('input[name=dj]');
  const stats = root.querySelector('.iv-stats');

  const S0 = 100, T = 0.5, R = 0.02, SIGMA = 0.15, K0 = 60, K1 = 140, NK = 81;
  let view;

  function render() {
    const lam = +lamIn.value, muJ = +muIn.value, dJ = +dIn.value;
    lamIn.nextElementSibling.value = lam.toFixed(1);
    muIn.nextElementSibling.value = `${muJ > 0 ? '+' : ''}${(muJ * 100).toFixed(0)}%`;
    dIn.nextElementSibling.value = `${(dJ * 100).toFixed(0)}%`;
    const Ks = Array.from({ length: NK }, (_, i) => K0 + (i * (K1 - K0)) / (NK - 1));
    const prices = Ks.map((K) => mertonCall(S0, K, T, R, SIGMA, lam, muJ, dJ));
    const ivs = prices.map((c, i) => impliedVol(c, S0, Ks[i], T, R));
    const iv = (K) => ivs[Math.round(((K - K0) / (K1 - K0)) * (NK - 1))];
    const atm = iv(100);

    // Breeden–Litzenberger: density of S_T = e^{rT} ∂²C/∂K².
    const dK = (K1 - K0) / (NK - 1), dens = [];
    for (let i = 1; i < NK - 1; i++) dens.push([Ks[i], (Math.exp(R * T) * (prices[i + 1] - 2 * prices[i] + prices[i - 1])) / (dK * dK)]);
    const logn = (s) => { const m = Math.log(S0) + (R - 0.5 * atm * atm) * T, v = atm * Math.sqrt(T); return Math.exp(-0.5 * ((Math.log(s) - m) / v) ** 2) / (s * v * Math.sqrt(2 * Math.PI)); };

    const { ctx, w, h } = view, split = w * 0.55;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    // Smile panel.
    const valid = ivs.filter(Number.isFinite), vlo = Math.min(SIGMA, ...valid) - 0.02, vhi = Math.max(SIGMA, ...valid) + 0.02;
    const px = (K) => 36 + ((K - K0) / (K1 - K0)) * (split - 48), py = (v) => h - 24 - ((v - vlo) / (vhi - vlo)) * (h - 52);
    ctx.strokeStyle = color('--muted'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(px(K0), py(SIGMA)); ctx.lineTo(px(K1), py(SIGMA)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 2.5;
    polyline(ctx, 0, NK - 1, (i) => px(Ks[i]), (i) => py(Number.isFinite(ivs[i]) ? ivs[i] : vlo));
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(px(100), 22); ctx.lineTo(px(100), h - 22); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const K of [60, 80, 100, 120, 140]) ctx.fillText(String(K), px(K) - 9, h - 6);
    for (const v of [vlo + 0.02, vhi - 0.02]) ctx.fillText(`${(v * 100).toFixed(0)}%`, 2, py(v) + 4);
    legend(ctx, [['implied volatility by strike', '--accent'], ['dashed: diffusion σ = 15%', '--muted']], 36, 16, split - 48);

    // Density panel.
    const x0 = split + 12, x1 = w - 10, dmax = Math.max(...dens.map((d) => d[1]), logn(S0)) * 1.1;
    const qx = (K) => x0 + ((K - K0) / (K1 - K0)) * (x1 - x0), qy = (d) => h - 24 - (Math.max(d, 0) / dmax) * (h - 52);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    ctx.strokeStyle = color('--muted'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.25;
    polyline(ctx, 0, 200, (i) => qx(K0 + (i / 200) * (K1 - K0)), (i) => qy(logn(K0 + (i / 200) * (K1 - K0)))); ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 2.5;
    polyline(ctx, 0, dens.length - 1, (i) => qx(dens[i][0]), (i) => qy(dens[i][1]));
    ctx.fillStyle = color('--muted');
    for (const K of [60, 100, 140]) ctx.fillText(String(K), qx(K) - 9, h - 6);
    legend(ctx, [['density of S_T from prices', '--accent-2'], ['dashed: lognormal at ATM vol', '--muted']], x0, 16, x1 - x0);

    stats.textContent =
      `Implied volatility at strikes 80 / 100 / 120: ${(iv(80) * 100).toFixed(1)}% / ${(atm * 100).toFixed(1)}% / ${(iv(120) * 100).toFixed(1)}%. ` +
      `Skew (90 minus 110): ${((iv(90) - iv(110)) * 100).toFixed(1)} points. Expected number of jumps in the 6 months: ${(lam * T).toFixed(2)}.`;
  }

  [lamIn, muIn, dIn].forEach((el) => el.addEventListener('input', render));
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 250); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.5, 250);
  render();
});
