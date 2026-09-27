/* Section 6.3 — Feynman–Kac.
   Heat equation ∂u/∂t + ½∂²u/∂x² = 0 on [0, 1] with final condition u(1, x) = g(x), g a tent.
   The heatmap is the equation's exact solution (Gaussian quadrature). Click a point (t, x):
   Brownian paths start there, and the running average of g at their end values converges to u(t, x). */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, normalPdf, revealOnInteract } = Stoch;

  const root = document.getElementById('fk');
  const mapCanvas = root.querySelector('.fk-map');
  const avgCanvas = root.querySelector('.fk-avg');
  const stats = root.querySelector('.fk-stats');
  const resampleBtn = root.querySelector('button.resample');

  const T = 1, XLO = -3, XHI = 3, NT = 100, NXC = 90, SAMPLES = 3000, SHOWN = 25, PATH_STEPS = 80;
  const g = (x) => Math.max(0, 1 - Math.abs(x));
  let seed = 131, point = { t: 0.3, x: 0.8 }, grid, mapView, avgView, mapLayer;

  // u(t, x) = E[g(x + W_{T-t})] by quadrature over the standard normal.
  function u(t, x) {
    const tau = T - t;
    if (tau <= 1e-9) return g(x);
    const s = Math.sqrt(tau), dz = 0.05;
    let sum = 0;
    for (let z = -6; z <= 6; z += dz) sum += g(x + s * z) * normalPdf(z) * dz;
    return sum;
  }

  function computeGrid() {
    grid = new Float64Array(NT * NXC);
    for (let i = 0; i < NT; i++) for (let j = 0; j < NXC; j++) {
      grid[i * NXC + j] = u(((i + 0.5) / NT) * T, XLO + ((j + 0.5) / NXC) * (XHI - XLO));
    }
  }

  const px = (t) => (t / T) * mapView.w;
  const py = (x) => mapView.h - ((x - XLO) / (XHI - XLO)) * mapView.h;

  function drawMapLayer() {
    mapLayer = document.createElement('canvas');
    mapLayer.width = mapCanvas.width;
    mapLayer.height = mapCanvas.height;
    // One pixel per grid cell, then scaled up smoothly: no seams between cells.
    const small = document.createElement('canvas');
    small.width = NT;
    small.height = NXC;
    const sctx = small.getContext('2d');
    sctx.fillStyle = color('--viz-bg');
    sctx.fillRect(0, 0, NT, NXC);
    sctx.fillStyle = color('--accent-2');
    for (let i = 0; i < NT; i++) for (let j = 0; j < NXC; j++) {
      sctx.globalAlpha = grid[i * NXC + j];  // g ≤ 1, so u ≤ 1
      sctx.fillRect(i, NXC - 1 - j, 1, 1);
    }
    const ctx = mapLayer.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, mapLayer.width, mapLayer.height);
  }

  function render() {
    const rand = rng(seed * 7919 + Math.round(point.t * 1000) * 13 + Math.round(point.x * 1000));
    const tau = T - point.t, target = u(point.t, point.x);

    // Estimates from end values only (exactly distributed), plus a few full paths to draw.
    const running = new Float64Array(SAMPLES);
    let sum = 0;
    for (let k = 0; k < SAMPLES; k++) { sum += g(point.x + Math.sqrt(tau) * gaussian(rand)); running[k] = sum / (k + 1); }

    {
      const { ctx, w, h } = mapView;
      ctx.drawImage(mapLayer, 0, 0, w, h);
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      const n = Math.max(1, Math.round(PATH_STEPS * tau)), sd = Math.sqrt(tau / n);
      for (let k = 0; k < SHOWN; k++) {
        let x = point.x;
        ctx.beginPath(); ctx.moveTo(px(point.t), py(x));
        for (let i = 1; i <= n; i++) { x += sd * gaussian(rand); ctx.lineTo(px(point.t + (i / n) * tau), py(x)); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color('--accent');
      ctx.strokeStyle = color('--card');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(point.t), py(point.x), 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--fg');
      ctx.fillText('t = 0', 4, h - 6);
      ctx.fillText('t = 1: u = g', w - 72, h - 6);
      ctx.fillText('x = 0', 4, py(0) - 4);
    }

    {
      const { ctx, w, h } = avgView;
      const lx0 = 1, lx1 = Math.log10(SAMPLES);
      const ax = (k) => 8 + ((Math.log10(k + 1) - lx0) / (lx1 - lx0)) * (w - 16);
      const hi = Math.max(0.2, target * 2), ay = (v) => h - 22 - (Math.min(Math.max(v, 0), hi) / hi) * (h - 44);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--fg');
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(8, ay(target)); ctx.lineTo(w - 8, ay(target)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2;
      polyline(ctx, 9, SAMPLES - 1, ax, (k) => ay(running[k]));
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText('running average of g(end value)', 8, 14);
      ctx.fillText('dashed: the equation', 8, 30);
      ctx.fillText('10', 8, h - 6);
      ctx.fillText(SAMPLES.toLocaleString() + ' paths', w - 70, h - 6);
    }

    stats.textContent =
      `Point t = ${point.t.toFixed(2)}, x = ${point.x.toFixed(2)}. Average of g over ${SAMPLES.toLocaleString()} random paths: ` +
      `${running[SAMPLES - 1].toFixed(4)}. Heat-equation solution u(t, x): ${target.toFixed(4)}.`;
  }

  mapCanvas.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    point = {
      t: Math.min(Math.max(((e.clientX - r.left) / mapView.w) * T, 0), 0.98),
      x: XLO + (1 - (e.clientY - r.top) / mapView.h) * (XHI - XLO),
    };
    render();
  });
  // Keyboard: arrows move the starting point (Shift = 5× larger steps).
  mapCanvas.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') point.t = Math.max(0, point.t - 0.02 * k);
    else if (e.key === 'ArrowRight') point.t = Math.min(0.98, point.t + 0.02 * k);
    else if (e.key === 'ArrowUp') point.x = Math.min(XHI, point.x + 0.1 * k);
    else if (e.key === 'ArrowDown') point.x = Math.max(XLO, point.x - 0.1 * k);
    else return;
    e.preventDefault();
    root.querySelector('.takeaway').hidden = false;
    render();
  });
  resampleBtn.addEventListener('click', () => { seed += 1; render(); });
  function layout() {
    mapView = setupCanvas(mapCanvas, 0.62);
    avgView = setupCanvas(avgCanvas, 0.85);
    drawMapLayer();
    render();
  }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  computeGrid();
  layout();
})();
