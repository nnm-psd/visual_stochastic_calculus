/* Section 1.2 — Defining Properties.
   Left: a fan of Brownian paths with two draggable time intervals A and B.
   Right: each path's rise over A plotted against its rise over B, with the theoretical 95% ellipse.
   Interval edges are stored in hundredths of a time unit so lengths display exactly. */
Stoch.lazy('increments', function () {
  'use strict';
  const { rng, brownianPath, setupCanvas, color } = Stoch;

  const root = document.getElementById('increments');
  const pathCanvas = root.querySelector('.inc-paths');
  const scatterCanvas = root.querySelector('.inc-scatter');
  const stats = root.querySelector('.inc-stats');
  const resampleBtn = root.querySelector('button.resample');

  const PATHS = 500, STEPS = 400, PER_HUNDREDTH = STEPS / 100;
  const SHOWN = 100;                              // faint paths drawn (all 500 feed the scatter)
  const Y = 3;                                    // path panel y-range [-Y, Y]
  const S = 2.6;                                  // scatter axis range [-S, S]
  const R95 = Math.sqrt(-2 * Math.log(0.05));     // radius holding 95% of a 2-D standard normal
  const EDGE_PX = 10, MIN_WIDTH = 2;

  const bands = [
    { name: 'A', lo: 15, hi: 35, token: '--accent-2' },
    { name: 'B', lo: 55, hi: 85, token: '--accent-3' },
  ];
  let seed = 1, paths = [], pathView, scatterView, fanLayer, drag = null, selected = 0;

  function simulate() {
    const rand = rng(seed);
    paths = [];
    for (let k = 0; k < PATHS; k++) paths.push(brownianPath(STEPS, rand));
  }

  const rise = (p, b) => p[b.hi * PER_HUNDREDTH] - p[b.lo * PER_HUNDREDTH];
  const yPix = (v, h) => h / 2 - (v / Y) * (h / 2 - 4);

  // The faint fan only changes on resample or resize, so draw it once into an offscreen layer.
  function drawFanLayer() {
    const { w, h } = pathView;
    fanLayer = document.createElement('canvas');
    fanLayer.width = pathCanvas.width;
    fanLayer.height = pathCanvas.height;
    const ctx = fanLayer.getContext('2d');
    ctx.setTransform(pathCanvas.width / w, 0, 0, pathCanvas.height / h, 0, 0);
    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 0.75;
    for (let k = 1; k <= SHOWN; k++) {
      const p = paths[k];
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const x = (i / STEPS) * w, y = yPix(p[i], h);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawPaths() {
    const { ctx, w, h } = pathView;
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    bands.forEach((b, row) => {
      const x0 = (b.lo / 100) * w, x1 = (b.hi / 100) * w;
      ctx.fillStyle = color(b.token);
      ctx.globalAlpha = 0.16;
      ctx.fillRect(x0, 0, x1 - x0, h);
      ctx.globalAlpha = 1;
      ctx.fillRect(x0 - 1, 0, 2, h);
      ctx.fillRect(x1 - 1, 0, 2, h);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(b.name, x0 + 5, 16 + row * 16);  // stacked so labels never collide
      if (document.activeElement === pathCanvas && row === selected) ctx.fillRect(x0, 0, x1 - x0, 4);  // keyboard focus
    });

    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, yPix(0, h)); ctx.lineTo(w, yPix(0, h)); ctx.stroke();
    ctx.drawImage(fanLayer, 0, 0, w, h);

    // Hero path, with dots where it enters and leaves each interval.
    const hero = paths[0];
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * w, y = yPix(hero[i], h);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = color('--accent');
    for (const b of bands) {
      for (const k of [b.lo, b.hi]) {
        ctx.beginPath();
        ctx.arc((k / 100) * w, yPix(hero[k * PER_HUNDREDTH], h), 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.fillStyle = color('--muted');
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('t = 0', 4, h - 6);
    ctx.fillText('t = 1', w - 34, h - 6);
  }

  function drawScatter(ra, rb) {
    const { ctx, w, h } = scatterView;
    const px = (v) => w / 2 + (v / S) * (w / 2);
    const py = (v) => h / 2 - (v / S) * (h / 2);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0));
    ctx.moveTo(px(0), 0); ctx.lineTo(px(0), h);
    ctx.stroke();

    // Theoretical 95% ellipse: covariance [[|A|, overlap], [overlap, |B|]], drawn via its Cholesky factor.
    const [A, B] = bands;
    const a = (A.hi - A.lo) / 100, b = (B.hi - B.lo) / 100, c = overlap() / 100;
    const l11 = Math.sqrt(a), l21 = c / l11, l22 = Math.sqrt(Math.max(b - l21 * l21, 0));
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const th = (k / 120) * 2 * Math.PI, u = R95 * Math.cos(th), v = R95 * Math.sin(th);
      const x = px(l11 * u), y = py(l21 * u + l22 * v);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color('--faint');
    for (let k = 1; k < PATHS; k++) {
      ctx.beginPath();
      ctx.arc(px(ra[k]), py(rb[k]), 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = color('--accent');
    ctx.beginPath();
    ctx.arc(px(ra[0]), py(rb[0]), 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color(A.token);
    ctx.fillText('rise over A →', w - 84, py(0) - 6);
    ctx.fillStyle = color(B.token);
    ctx.fillText('↑ rise over B', px(0) + 6, 14);
  }

  function overlap() {
    const [A, B] = bands;
    return Math.max(0, Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo));
  }

  function render() {
    const [A, B] = bands;
    const ra = new Float64Array(PATHS), rb = new Float64Array(PATHS);
    for (let k = 0; k < PATHS; k++) { ra[k] = rise(paths[k], A); rb[k] = rise(paths[k], B); }

    // Rises have mean 0 in theory, so the sample moments below are taken about 0.
    let saa = 0, sbb = 0, sab = 0;
    for (let k = 0; k < PATHS; k++) { saa += ra[k] * ra[k]; sbb += rb[k] * rb[k]; sab += ra[k] * rb[k]; }
    const va = saa / PATHS, vb = sbb / PATHS, corr = sab / Math.sqrt(saa * sbb);
    const la = (A.hi - A.lo) / 100, lb = (B.hi - B.lo) / 100;
    const corrTheory = overlap() / 100 / Math.sqrt(la * lb);
    const fmt = (k) => (k / 100).toFixed(2);
    stats.innerHTML =
      `<span>A = [${fmt(A.lo)}, ${fmt(A.hi)}]: variance of rise ${va.toFixed(3)}, theory ${la.toFixed(2)}.</span> ` +
      `<span>B = [${fmt(B.lo)}, ${fmt(B.hi)}]: variance of rise ${vb.toFixed(3)}, theory ${lb.toFixed(2)}.</span> ` +
      `<span>Correlation of the two rises: ${corr.toFixed(2)}, theory ${corrTheory.toFixed(2)}.</span>`;

    drawPaths();
    drawScatter(ra, rb);
  }

  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  // Dragging: grab an edge to resize an interval, or its middle to slide it.
  function hit(t) {
    const tol = (EDGE_PX / pathView.w) * 100;
    const order = [...bands].reverse();  // B is drawn on top, so it wins ties
    for (const b of order) {
      if (Math.abs(t - b.lo) < tol) return { b, part: 'lo' };
      if (Math.abs(t - b.hi) < tol) return { b, part: 'hi' };
    }
    for (const b of order) if (t > b.lo && t < b.hi) return { b, part: 'move' };
    return null;
  }
  const tAt = (e) => ((e.clientX - pathCanvas.getBoundingClientRect().left) / pathView.w) * 100;

  pathCanvas.addEventListener('pointerdown', (e) => {
    const t = tAt(e), h = hit(t);
    if (!h) return;
    drag = { ...h, t0: t, lo0: h.b.lo, hi0: h.b.hi };
    pathCanvas.setPointerCapture(e.pointerId);
    root.querySelector('.takeaway').hidden = false;
  });
  pathCanvas.addEventListener('pointermove', (e) => {
    const t = tAt(e);
    if (!drag) {
      const h = hit(t);
      pathCanvas.style.cursor = h ? (h.part === 'move' ? 'grab' : 'ew-resize') : 'default';
      return;
    }
    const k = Math.round(Math.min(Math.max(t, 0), 100)), { b } = drag;
    if (drag.part === 'lo') b.lo = Math.max(0, Math.min(k, b.hi - MIN_WIDTH));
    else if (drag.part === 'hi') b.hi = Math.min(100, Math.max(k, b.lo + MIN_WIDTH));
    else {
      const width = drag.hi0 - drag.lo0;
      b.lo = Math.min(Math.max(drag.lo0 + Math.round(t - drag.t0), 0), 100 - width);
      b.hi = b.lo + width;
    }
    scheduleRender();
  });
  const endDrag = () => { drag = null; };
  pathCanvas.addEventListener('pointerup', endDrag);
  pathCanvas.addEventListener('pointercancel', endDrag);

  // Keyboard: A / B picks an interval, ← → slide it, ↑ ↓ widen or narrow it (Shift = 5× faster).
  pathCanvas.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'b') { selected = key === 'a' ? 0 : 1; scheduleRender(); return; }
    const b = bands[selected], step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const width = b.hi - b.lo, d = e.key === 'ArrowLeft' ? -step : step;
      b.lo = Math.min(Math.max(b.lo + d, 0), 100 - width);
      b.hi = b.lo + width;
    } else if (e.key === 'ArrowUp') b.hi = Math.min(100, b.hi + step);
    else if (e.key === 'ArrowDown') b.hi = Math.max(b.lo + MIN_WIDTH, b.hi - step);
    else return;
    e.preventDefault();
    root.querySelector('.takeaway').hidden = false;
    scheduleRender();
  });
  pathCanvas.addEventListener('focus', scheduleRender);
  pathCanvas.addEventListener('blur', scheduleRender);

  function layout() {
    pathView = setupCanvas(pathCanvas, 0.62);
    scatterView = setupCanvas(scatterCanvas, 1);
    drawFanLayer();
    render();
  }

  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); drawFanLayer(); render(); });
  window.addEventListener('resize', layout);

  simulate();
  layout();
});
