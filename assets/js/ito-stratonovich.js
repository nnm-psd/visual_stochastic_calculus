/* Section 4.3 — Itô vs Stratonovich.
   The same noise drives dX = X dW read two ways: Itô (left-end rule, Euler steps) and Stratonovich
   (midpoint rule, Heun steps). A toggle adds the conversion drift ½X dt to the Itô equation,
   after which the two paths coincide. Exact solutions: Itô e^{W - t/2}, Stratonovich e^{W}. */
Stoch.lazy('strat', function () {
  'use strict';
  const { rng, brownianPath, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('strat');
  const canvas = root.querySelector('.st-canvas');
  const driftIn = root.querySelector('input[name=drift]');
  const stats = root.querySelector('.st-stats');
  const resampleBtn = root.querySelector('button.resample');

  const STEPS = 2000, DT = 1 / STEPS;
  let seed = 71, W, view;

  function render() {
    const addDrift = driftIn.checked;
    const ito = new Float64Array(STEPS + 1), strat = new Float64Array(STEPS + 1);
    ito[0] = strat[0] = 1;
    for (let i = 0; i < STEPS; i++) {
      const d = W[i + 1] - W[i];
      ito[i + 1] = ito[i] + (addDrift ? 0.5 * ito[i] * DT : 0) + ito[i] * d;
      const guess = strat[i] + strat[i] * d;              // Heun: average the slope at both ends
      strat[i + 1] = strat[i] + 0.5 * (strat[i] + guess) * d;
    }

    const { ctx, w, h } = view;
    let hi = 0;
    for (const arr of [ito, strat]) for (const v of arr) hi = Math.max(hi, v);
    const px = (i) => (i / STEPS) * w, py = (v) => h - 10 - (v / (hi * 1.1)) * (h - 32);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(1)); ctx.lineTo(w, py(1)); ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = color('--accent-3');
    ctx.globalAlpha = 0.6;
    polyline(ctx, 0, STEPS, px, (i) => py(strat[i]));
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = color('--accent');
    polyline(ctx, 0, STEPS, px, (i) => py(ito[i]));

    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['Stratonovich: dX = X ∘ dW (thick)', '--accent-3'], [addDrift ? 'Itô: dX = ½X dt + X dW' : 'Itô: dX = X dW', '--accent']], 8, 14, w - 16);
    ctx.fillStyle = color('--muted');
    ctx.fillText('X = 1', w - 40, py(1) - 4);

    const w1 = W[STEPS];
    stats.textContent =
      `At t = 1: Stratonovich ${strat[STEPS].toFixed(3)} (exact e^W = ${Math.exp(w1).toFixed(3)}); ` +
      `Itô ${ito[STEPS].toFixed(3)} (exact ${addDrift ? 'e^W = ' + Math.exp(w1).toFixed(3) : 'e^(W − t/2) = ' + Math.exp(w1 - 0.5).toFixed(3)}).`;
  }

  driftIn.addEventListener('change', render);
  resampleBtn.addEventListener('click', () => { seed += 1; W = brownianPath(STEPS, rng(seed)); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.45); render(); });
  revealOnInteract(root);
  W = brownianPath(STEPS, rng(seed));
  view = setupCanvas(canvas, 0.45);
  render();
});
