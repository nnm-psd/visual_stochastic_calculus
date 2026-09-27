/* Section 8.2 — The Kalman–Bucy Filter.
   Hidden signal: dX = -θX dt + σ dW (OU). Observations: dY = X dt + r dV. The filter tracks the best
   estimate m_t = E[X_t | observations] and its variance P_t:
     dm = -θ m dt + (P/r²)(dY - m dt),   dP/dt = -2θP + σ² - P²/r².
   Readings are shown as averages of dY/dt over 0.1 time units (a noisy view of X). */
Stoch.lazy('kalman', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('kalman');
  const canvas = root.querySelector('.kf-canvas');
  const rIn = root.querySelector('input[name=r]');
  const stats = root.querySelector('.kf-stats');
  const resampleBtn = root.querySelector('button.resample');

  const THETA = 1, SIGMA = 1, T = 10, STEPS = 2000, DT = T / STEPS, BLOCK = 20;
  let seed = 191, dW, dV, view;

  function simulate() {
    const rand = rng(seed);
    dW = new Float64Array(STEPS); dV = new Float64Array(STEPS);
    for (let i = 0; i < STEPS; i++) { dW[i] = Math.sqrt(DT) * gaussian(rand); dV[i] = Math.sqrt(DT) * gaussian(rand); }
  }

  function render() {
    const r = +rIn.value;
    rIn.nextElementSibling.value = r.toFixed(2);
    const x = new Float64Array(STEPS + 1), m = new Float64Array(STEPS + 1), P = new Float64Array(STEPS + 1);
    const readings = [];
    P[0] = (SIGMA * SIGMA) / (2 * THETA);   // start with no information: the long-run variance of X (x[0] = m[0] = 0)
    let block = 0;
    for (let i = 0; i < STEPS; i++) {
      const dY = x[i] * DT + r * dV[i];
      const K = P[i] / (r * r);
      m[i + 1] = m[i] - THETA * m[i] * DT + K * (dY - m[i] * DT);
      P[i + 1] = P[i] + (-2 * THETA * P[i] + SIGMA * SIGMA - (P[i] * P[i]) / (r * r)) * DT;
      x[i + 1] = x[i] - THETA * x[i] * DT + SIGMA * dW[i];
      block += dY;
      if ((i + 1) % BLOCK === 0) { readings.push([(i + 1 - BLOCK / 2) * DT, block / (BLOCK * DT)]); block = 0; }
    }

    let errF = 0, errR = 0, inside = 0, errPrior = 0;
    for (let i = 1; i <= STEPS; i++) {
      errF += (m[i] - x[i]) ** 2;
      errPrior += x[i] ** 2;
      if (Math.abs(m[i] - x[i]) <= 2 * Math.sqrt(P[i])) inside++;
    }
    for (const [t, v] of readings) errR += (v - x[Math.round(t / DT)]) ** 2;
    const pInf = r * r * (Math.sqrt(THETA * THETA + (SIGMA * SIGMA) / (r * r)) - THETA);

    const { ctx, w, h } = view, Y = 3;
    const px = (t) => (t / T) * w, py = (v) => h / 2 - (Math.max(-Y, Math.min(Y, v)) / Y) * (h / 2 - 26);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

    // Uncertainty band: m ± 2√P.
    ctx.fillStyle = color('--accent');
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i += 4) ctx.lineTo(px(i * DT), py(m[i] + 2 * Math.sqrt(P[i])));
    for (let i = STEPS; i >= 0; i -= 4) ctx.lineTo(px(i * DT), py(m[i] - 2 * Math.sqrt(P[i])));
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.55;
    for (const [t, v] of readings) { ctx.beginPath(); ctx.arc(px(t), py(v), 2, 0, 2 * Math.PI); ctx.fill(); }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.25;
    polyline(ctx, 0, STEPS, (i) => px(i * DT), (i) => py(x[i]));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    polyline(ctx, 0, STEPS, (i) => px(i * DT), (i) => py(m[i]));

    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['hidden signal (thick grey)', '--muted'], ['noisy readings', '--accent-2'], ['filter estimate ± 2√P', '--accent']], 8, 14, w - 16);

    const rms = (s, n) => Math.sqrt(s / n).toFixed(3);
    stats.textContent =
      `Typical error: filter ${rms(errF, STEPS)}, raw readings ${rms(errR, readings.length)}, guessing 0 with no data ${rms(errPrior, STEPS)}. ` +
      `The truth stayed inside the band ${(inside / STEPS * 100).toFixed(1)}% of the time (theory: about 95% on average; a single path varies). ` +
      `Long-run band half-width 2√P∞ = ${(2 * Math.sqrt(pInf)).toFixed(3)}.`;
  }

  rIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 240); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.5, 240);
  render();
});
