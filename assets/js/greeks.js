/* Section 9.2 — Greeks by Simulation.
   Delta and gamma of a European call estimated four ways from 20,000 paths: finite differences with
   independent random numbers, finite differences with common random numbers, the pathwise method
   (delta only) and the likelihood-ratio method. Each estimate is drawn with a ±2 SE bar against the
   exact Black–Scholes value; the bump size h shows the bias–variance trade-off of finite differences. */
Stoch.lazy('greeks', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, revealOnInteract, legend } = Stoch;
  const { bs } = Fin;

  const root = document.getElementById('greeks');
  const canvas = root.querySelector('.gk-canvas');
  const hIn = root.querySelector('input[name=h]');
  const stats = root.querySelector('.gk-stats');
  const resampleBtn = root.querySelector('button.resample');

  const S0 = 100, K = 100, SIGMA = 0.2, R = 0.03, T = 1, N = 20000;
  let seed = 211, Z1, Z2, Z3, view;

  function simulate() {
    const rand = rng(seed);
    Z1 = new Float64Array(N); Z2 = new Float64Array(N); Z3 = new Float64Array(N);
    for (let i = 0; i < N; i++) { Z1[i] = gaussian(rand); Z2[i] = gaussian(rand); Z3[i] = gaussian(rand); }
  }

  const mean = (f) => { let s = 0, s2 = 0; for (let i = 0; i < N; i++) { const y = f(i); s += y; s2 += y * y; } const m = s / N; return { m, se: Math.sqrt(Math.max(s2 / N - m * m, 0) / N) }; };

  function render() {
    const greek = root.querySelector('input[name=greek]:checked').value, h = Math.pow(10, +hIn.value);
    hIn.nextElementSibling.value = h < 0.1 ? h.toFixed(3) : h.toFixed(2);
    const drift = (R - 0.5 * SIGMA * SIGMA) * T, vol = SIGMA * Math.sqrt(T), disc = Math.exp(-R * T);
    const pay = (S, z) => disc * Math.max(S * Math.exp(drift + vol * z) - K, 0);
    const ST = (z) => S0 * Math.exp(drift + vol * z);
    const exactB = bs(S0, K, T, R, SIGMA), exact = greek === 'delta' ? exactB.delta : exactB.gamma;

    let rows;
    if (greek === 'delta') {
      rows = [
        ['finite difference, independent', mean((i) => (pay(S0 + h, Z1[i]) - pay(S0 - h, Z2[i])) / (2 * h))],
        ['finite difference, common numbers', mean((i) => (pay(S0 + h, Z1[i]) - pay(S0 - h, Z1[i])) / (2 * h))],
        ['pathwise', mean((i) => (ST(Z1[i]) > K ? disc * ST(Z1[i]) / S0 : 0))],
        ['likelihood ratio', mean((i) => pay(S0, Z1[i]) * Z1[i] / (S0 * vol))],
      ];
    } else {
      rows = [
        ['finite difference, independent', mean((i) => (pay(S0 + h, Z1[i]) - 2 * pay(S0, Z2[i]) + pay(S0 - h, Z3[i])) / (h * h))],
        ['finite difference, common numbers', mean((i) => (pay(S0 + h, Z1[i]) - 2 * pay(S0, Z1[i]) + pay(S0 - h, Z1[i])) / (h * h))],
        ['pathwise', null],
        ['likelihood ratio', mean((i) => pay(S0, Z1[i]) * ((Z1[i] * Z1[i] - 1) / (S0 * S0 * vol * vol) - Z1[i] / (S0 * S0 * vol)))],
      ];
    }

    const { ctx, w, h: H } = view, labelW = Math.min(230, w * 0.42), rowH = (H - 40) / rows.length;
    const valid = rows.filter((r) => r[1]);
    const halfSpan = Math.max(Math.abs(exact) * 0.25, ...valid.map((r) => Math.abs(r[1].m - exact) + 2 * r[1].se)) * 1.1;
    const cap = Math.abs(exact) * 3 + 0.05;
    const span = Math.min(halfSpan, cap);
    const px = (v) => labelW + ((Math.min(Math.max(v, exact - span), exact + span) - (exact - span)) / (2 * span)) * (w - labelW - 16);
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, H);
    ctx.strokeStyle = color('--fg'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(px(exact), 26); ctx.lineTo(px(exact), H - 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '13px system-ui, sans-serif';
    rows.forEach(([label, r], k) => {
      const y = 34 + k * rowH + rowH / 2;
      ctx.fillStyle = color('--fg'); ctx.fillText(label, 8, y + 4);
      if (!r) { ctx.fillStyle = color('--muted'); ctx.fillText('not available: the payoff has a kink', labelW, y + 4); return; }
      const lo = r.m - 2 * r.se, hi = r.m + 2 * r.se;
      ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px(lo), y); ctx.lineTo(px(hi), y); ctx.stroke();
      ctx.fillStyle = color('--accent'); ctx.beginPath(); ctx.arc(px(r.m), y, 5, 0, 2 * Math.PI); ctx.fill();
      if (hi > exact + span || lo < exact - span) { ctx.fillStyle = color('--muted'); ctx.fillText('bar runs off the chart', px(exact) + 8, y - 8); }
    });
    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [[`${greek}: estimate ± 2 standard errors`, '--accent'], [`dashed: exact ${exact.toFixed(greek === 'delta' ? 4 : 5)}`, '--muted']], 8, 16, w - 16);

    const d = greek === 'delta' ? 4 : 5;
    stats.textContent = `Bump h = ${hIn.nextElementSibling.value}. ` + rows.filter((r) => r[1])
      .map(([label, r]) => `${label}: ${r.m.toFixed(d)} ± ${r.se.toFixed(d)}`).join('; ') + `. Exact ${greek}: ${exact.toFixed(d)}.`;
  }

  hIn.addEventListener('input', render);
  root.querySelectorAll('input[name=greek]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.45, 240); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.45, 240);
  render();
});
