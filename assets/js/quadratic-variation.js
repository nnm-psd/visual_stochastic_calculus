/* Section 2.1 — Quadratic Variation.
   One Brownian path on [0, 1] (Lévy construction, 2^16 pieces) measured with n = 2^k equal pieces.
   The same path is reused at every n, so only the ruler changes. Two running sums are plotted:
   sum of |rises| (grows without bound) and sum of squared rises (locks onto the line y = t). */
(function () {
  'use strict';
  const { levyPath, setupCanvas, color } = Stoch;

  const root = document.getElementById('qv');
  const pathCanvas = root.querySelector('.qv-path');
  const tvCanvas = root.querySelector('.qv-tv');
  const qvCanvas = root.querySelector('.qv-qv');
  const slider = root.querySelector('input[name=k]');
  const nOut = slider.nextElementSibling;
  const stats = root.querySelector('.qv-stats');
  const resampleBtn = root.querySelector('button.resample');

  const LEVEL = 16, FINE = 1 << LEVEL;
  const QV_MAX = 1.6;  // y-range of the squared-rises panel
  const smooth = (t) => 0.8 * Math.sin(2 * Math.PI * 1.3 * t) + 0.4 * Math.sin(2 * Math.PI * 3.1 * t + 1);

  let seed = 5, W, pathView, tvView, qvView;

  function simulate() { W = levyPath(seed)(0, 1, LEVEL).ws; }

  function sums(n) {
    const stride = FINE / n, tv = new Float64Array(n + 1), qv = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const d = W[(i + 1) * stride] - W[i * stride];
      tv[i + 1] = tv[i] + Math.abs(d);
      qv[i + 1] = qv[i] + d * d;
    }
    return { tv, qv };
  }

  function smoothQV(n) {
    let s = 0;
    for (let i = 0; i < n; i++) { const d = smooth((i + 1) / n) - smooth(i / n); s += d * d; }
    return s;
  }

  function drawPath(n) {
    const { ctx, w, h } = pathView;
    let lo = Infinity, hi = -Infinity;
    for (const v of W) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = (hi - lo) * 0.08, py = (v) => h - 6 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (h - 12);

    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= FINE; i += 4) { const x = (i / FINE) * w; i ? ctx.lineTo(x, py(W[i])) : ctx.moveTo(x, py(W[i])); }
    ctx.stroke();

    // The ruler: straight chords between the n + 1 partition points.
    const stride = FINE / n;
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const x = (i / n) * w, y = py(W[i * stride]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (n <= 64) {
      ctx.fillStyle = color('--accent');
      for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.arc((i / n) * w, py(W[i * stride]), 3.5, 0, 2 * Math.PI); ctx.fill(); }
    }
  }

  function drawSum(view, values, n, yMax, token, title, diagonal) {
    const { ctx, w, h } = view;
    const px = (t) => 8 + t * (w - 16), py = (v) => h - 22 - (v / yMax) * (h - 48);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(1), py(0)); ctx.stroke();

    if (diagonal) {
      ctx.strokeStyle = color('--fg');
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(1), py(1)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color('--muted');
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('y = t', px(1) - 34, py(1) - 6);
    }

    ctx.strokeStyle = color(token);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / 2000));
    for (let i = 0; i <= n; i += step) { const x = px(i / n), y = py(Math.min(values[i], yMax)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineTo(px(1), py(Math.min(values[n], yMax)));
    ctx.stroke();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = color(token);
    ctx.fillText(title, 8, 16);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('t = 0', px(0), h - 6);
    ctx.fillText(`total at t = 1: ${values[n] >= 100 ? values[n].toFixed(0) : values[n].toFixed(3)}`, px(1) - 118, h - 6);
  }

  function render() {
    const k = +slider.value, n = 1 << k;
    nOut.value = n.toLocaleString();
    const { tv, qv } = sums(n);
    drawPath(n);
    drawSum(tvView, tv, n, Math.max(tv[n] * 1.1, 1), '--accent-3', 'Sum of |rises|', false);
    drawSum(qvView, qv, n, QV_MAX, '--accent-2', 'Sum of squared rises', true);
    stats.textContent =
      `With n = ${n.toLocaleString()} pieces: sum of |rises| = ${tv[n].toFixed(2)} ` +
      `(theory: about √(2n/π) = ${Math.sqrt((2 * n) / Math.PI).toFixed(2)}, doubling every time n quadruples). ` +
      `Sum of squared rises = ${qv[n].toFixed(3)} (theory: 1, give or take about ${Math.sqrt(2 / n).toFixed(3)}). ` +
      `For comparison, the smooth curve from section 1.3 has sum of squared rises ${smoothQV(n).toPrecision(3)}.`;
  }

  slider.addEventListener('input', () => { root.querySelector('.takeaway').hidden = false; render(); });
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });

  function layout() {
    pathView = setupCanvas(pathCanvas, 0.36);
    tvView = setupCanvas(tvCanvas, 0.62);
    qvView = setupCanvas(qvCanvas, 0.62);
    render();
  }
  window.addEventListener('resize', layout);
  simulate();
  layout();
})();
