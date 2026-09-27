/* Section 5.2 — A Zoo of Diffusions.
   Three classic SDEs share one fixed stream of Gaussian noise (200 paths × 400 steps on [0, 2]),
   so moving a slider changes the model, not the luck. Left: the fan of paths. Right: the spread
   of end values, with the exact density where one is simple (GBM: log-normal, OU: normal). */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, normalPdf, histogram, revealOnInteract } = Stoch;

  const root = document.getElementById('zoo');
  const canvas = root.querySelector('.zoo-canvas');
  const p1In = root.querySelector('input[name=p1]'), p2In = root.querySelector('input[name=p2]');
  const p1Label = root.querySelector('.p1-label'), p2Label = root.querySelector('.p2-label');
  const stats = root.querySelector('.zoo-stats');

  const PATHS = 200, STEPS = 400, T = 2, DT = T / STEPS, SD = Math.sqrt(DT), SHOWN = 60, PATH_FRAC = 0.72;
  const MODELS = {
    gbm: {
      p1: ['growth μ', -0.5, 1, 0.3], p2: ['volatility σ', 0.05, 1, 0.4], x0: 1, range: [0, 5],
      step: (x, a, s, z) => x + a * x * DT + s * x * z,
    },
    ou: {
      p1: ['pull strength θ', 0.1, 5, 1], p2: ['noise σ', 0.1, 1.5, 0.6], x0: 2, range: [-2.5, 3],
      step: (x, a, s, z) => x + a * (0 - x) * DT + s * z,
    },
    cir: {
      p1: ['pull strength κ', 0.1, 5, 1], p2: ['noise σ', 0.1, 1.5, 0.5], x0: 1, range: [0, 3.5],
      // Kept at or above 0: the square root needs a non-negative argument.
      step: (x, a, s, z) => Math.max(x + a * (1 - x) * DT + s * Math.sqrt(x) * z, 0),
    },
  };
  let noise, view, current = null;

  function makeNoise() {
    const rand = rng(91);
    noise = new Float64Array(PATHS * STEPS);
    for (let i = 0; i < noise.length; i++) noise[i] = SD * gaussian(rand);
  }

  function model() { return root.querySelector('input[name=model]:checked').value; }

  function setModel(name) {
    const M = MODELS[name];
    for (const [input, label, spec] of [[p1In, p1Label, M.p1], [p2In, p2Label, M.p2]]) {
      label.textContent = spec[0];
      input.min = spec[1]; input.max = spec[2]; input.step = 0.01; input.value = spec[3];
    }
    current = name;
  }

  function render() {
    if (model() !== current) setModel(model());
    const M = MODELS[current], a = +p1In.value, s = +p2In.value;
    p1In.nextElementSibling.value = a.toFixed(2);
    p2In.nextElementSibling.value = s.toFixed(2);

    const paths = [], ends = new Float64Array(PATHS);
    let hitZero = 0;
    for (let k = 0; k < PATHS; k++) {
      const line = k < SHOWN ? new Float64Array(STEPS + 1) : null;
      let x = M.x0, touched = false;
      if (line) line[0] = x;
      for (let i = 0; i < STEPS; i++) {
        x = M.step(x, a, s, noise[k * STEPS + i]);
        if (x === 0) touched = true;
        if (line) line[i + 1] = x;
      }
      ends[k] = x;
      if (touched) hitZero++;
      if (line) paths.push(line);
    }

    const { ctx, w, h } = view, pw = w * PATH_FRAC, [lo, hi] = M.range;
    const px = (i) => (i / STEPS) * pw, py = (v) => h - 10 - ((v - lo) / (hi - lo)) * (h - 30);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(pw, py(0)); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();

    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 0.9;
    for (const line of paths.slice(1)) polyline(ctx, 0, STEPS, px, (i) => py(line[i]));

    // Analytic guide lines.
    ctx.strokeStyle = color('--fg');
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    let note = '';
    if (current === 'gbm') {
      polyline(ctx, 0, STEPS, px, (i) => py(M.x0 * Math.exp(a * i * DT)));
      note = `Dashed: the average, e^(μt). Paths spread out in proportion to their own size, so they fan out upward and never cross 0.`;
    } else if (current === 'ou') {
      polyline(ctx, 0, STEPS, px, (i) => py(M.x0 * Math.exp(-a * i * DT)));
      const band = 2 * s / Math.sqrt(2 * a);
      for (const y of [band, -band]) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(pw, py(y)); ctx.stroke(); }
      note = `Dashed curve: the average, pulled back toward 0 like 2e^(−θt). Dashed lines: ±2 × the long-run spread σ/√(2θ) = ±${band.toFixed(2)}.`;
    } else {
      polyline(ctx, 0, STEPS, px, (i) => py(1 + (M.x0 - 1) * Math.exp(-a * i * DT)));
      const feller = 2 * a * 1 >= s * s;
      note = `Feller condition 2κ ≥ σ²: ${(2 * a).toFixed(2)} ${feller ? '≥' : '<'} ${(s * s).toFixed(2)}, so it is ${feller ? 'met: paths are pushed away from 0 (up to simulation error)' : '<strong>violated</strong>: paths can hit 0'}. Paths that touched 0: ${hitZero} of ${PATHS}.`;
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    polyline(ctx, 0, STEPS, px, (i) => py(paths[0][i]));

    // Sideways histogram of end values, plus the exact density where it is simple.
    const hx = pw + 6, hw = w - hx - 4, bins = 30;
    const { bw, density } = histogram(ends, lo, hi, bins);
    const maxD = Math.max(...density, 0.01), dScale = (hw * 0.8) / maxD;
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    density.forEach((d, b) => { const y0 = py(lo + b * bw), y1 = py(lo + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, d * dScale, y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    let pdf = null;
    if (current === 'ou') {
      const m = M.x0 * Math.exp(-a * T), sd = s * Math.sqrt((1 - Math.exp(-2 * a * T)) / (2 * a));
      pdf = (x) => normalPdf((x - m) / sd) / sd;
    } else if (current === 'gbm') {
      const m = (a - 0.5 * s * s) * T, sd = s * Math.sqrt(T);
      pdf = (x) => (x > 0 ? normalPdf((Math.log(x) - m) / sd) / (sd * x) : 0);
    }
    if (pdf) {
      ctx.strokeStyle = color('--fg');
      ctx.lineWidth = 1.5;
      polyline(ctx, 0, 200, (i) => hx + pdf(lo + (i / 200) * (hi - lo)) * dScale, (i) => py(lo + (i / 200) * (hi - lo)));
    }
    ctx.restore();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('t = 0', 4, h - 14);
    ctx.fillText('t = 2', pw - 36, h - 14);
    ctx.fillText('values at t = 2', hx + 2, 14);
    stats.innerHTML = note;
  }

  root.querySelectorAll('input[name=model]').forEach((r) => r.addEventListener('change', render));
  p1In.addEventListener('input', render);
  p2In.addEventListener('input', render);
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55); render(); });
  revealOnInteract(root);
  makeNoise();
  view = setupCanvas(canvas, 0.55);
  render();
})();
