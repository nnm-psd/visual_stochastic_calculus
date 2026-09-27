/* Section 3.3 — Itô Isometry.
   For a betting rule H (a function of the current value of W), simulate 10,000 paths and compute
   I = sum H(W_left) × rise and Q = sum H(W_left)² × dt. Plot the running averages of I, I² and Q as
   more paths are included (log scale): I → 0, and I² and Q converge to the same number. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract } = Stoch;

  const root = document.getElementById('isometry');
  const canvas = root.querySelector('.is-canvas');
  const stats = root.querySelector('.is-stats');
  const resampleBtn = root.querySelector('button.resample');

  const PATHS = 10000, STEPS = 200, DT = 1 / STEPS, SD = Math.sqrt(DT), FIRST = 10;
  const RULES = {
    one: { H: () => 1, theory: 1, name: 'H = 1' },
    w: { H: (w) => w, theory: 0.5, name: 'H = W' },
    sign: { H: (w) => Math.sign(w), theory: 1, name: 'H = sign(W)' },
  };
  let seed = 41, view;

  function render() {
    const rule = RULES[root.querySelector('input[name=rule]:checked').value];
    const rand = rng(seed);
    const mI = new Float64Array(PATHS), mI2 = new Float64Array(PATHS), mQ = new Float64Array(PATHS);
    let sI = 0, sI2 = 0, sQ = 0;
    for (let k = 0; k < PATHS; k++) {
      let w = 0, I = 0, Q = 0;
      for (let i = 0; i < STEPS; i++) {
        const hv = rule.H(w), dw = SD * gaussian(rand);
        I += hv * dw; Q += hv * hv * DT; w += dw;
      }
      sI += I; sI2 += I * I; sQ += Q;
      mI[k] = sI / (k + 1); mI2[k] = sI2 / (k + 1); mQ[k] = sQ / (k + 1);
    }

    const { ctx, w, h } = view;
    const lx0 = Math.log10(FIRST), lx1 = Math.log10(PATHS);
    const px = (k) => 40 + ((Math.log10(k + 1) - lx0) / (lx1 - lx0)) * (w - 52);
    const lo = -0.5, hi = 1.6, py = (v) => h - 24 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (h - 44);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    for (const v of [0, 0.5, 1, 1.5]) {
      ctx.beginPath(); ctx.moveTo(40, py(v)); ctx.lineTo(w - 12, py(v)); ctx.stroke();
      ctx.fillText(String(v), 8, py(v) + 4);
    }
    for (const k of [10, 100, 1000, 10000]) ctx.fillText(k.toLocaleString(), Math.min(px(k - 1) - 12, w - 44), h - 6);

    ctx.strokeStyle = color('--fg');
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(40, py(rule.theory)); ctx.lineTo(w - 12, py(rule.theory)); ctx.stroke();
    ctx.setLineDash([]);

    const series = [[mI, '--accent-3'], [mQ, '--accent-2'], [mI2, '--accent']];
    for (const [m, token] of series) {
      ctx.strokeStyle = color(token);
      ctx.lineWidth = 2;
      polyline(ctx, FIRST - 1, PATHS - 1, px, (k) => py(m[k]));
    }
    ctx.fillStyle = color('--accent');
    ctx.fillText('average of (gains)²', 48, 16);
    ctx.fillStyle = color('--accent-2');
    ctx.fillText('average of ∫H² dt', 172, 16);
    ctx.fillStyle = color('--accent-3');
    ctx.fillText('average gains', 286, 16);

    stats.textContent =
      `${rule.name}, after ${PATHS.toLocaleString()} paths: average gains ${mI[PATHS - 1].toFixed(3)} (theory 0). ` +
      `Average of gains² ${mI2[PATHS - 1].toFixed(3)}, average of ∫H² dt ${mQ[PATHS - 1].toFixed(3)} (theory: both ${rule.theory}).`;
  }

  root.querySelectorAll('input[name=rule]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.5);
  render();
})();
