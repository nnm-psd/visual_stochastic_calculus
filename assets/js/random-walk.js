/* Section 1.1 — From Random Walk to Brownian Motion.
   Left: rescaled walks W^(n)_t = S_floor(nt) / sqrt(n) on [0, 1].
   Right: sideways histogram of W^(n)_1 over many walks against the N(0, 1) density. */
Stoch.lazy('random-walk', function () {
  'use strict';
  const { rng, scaledWalk, scaledWalkEnd, normalPdf, setupCanvas, color } = Stoch;

  const root = document.getElementById('random-walk');
  const canvas = root.querySelector('.rw-canvas');
  const slider = root.querySelector('input[name=n]');
  const nOut = slider.nextElementSibling;
  const stats = root.querySelector('.rw-stats');
  const resampleBtn = root.querySelector('button.resample');

  const WALKS = 1000;       // endpoints in the histogram
  const SHOWN = 12;         // faint background paths
  const Y = 3.5;            // y-axis range [-Y, Y]
  const PATH_FRAC = 0.76;   // share of width for the path panel
  let seed = 1;
  let data = null;
  let view;

  function nFromSlider() { return Math.round(Math.pow(10, +slider.value)); }

  function simulate(n) {
    const rand = rng(seed);
    const paths = [];
    for (let k = 0; k <= SHOWN; k++) paths.push(scaledWalk(n, rand));
    const ends = new Float64Array(WALKS);
    for (let k = 0; k < WALKS; k++) ends[k] = scaledWalkEnd(n, rand);
    return { n, paths, ends };
  }

  // Bins centred on the lattice points (2k - n)/sqrt(n), so small n shows the discrete
  // distribution honestly, and at least 0.25 wide so large n is not too spiky.
  function histogram(n, ends) {
    const spacing = 2 / Math.sqrt(n);
    const bw = spacing * Math.max(1, Math.ceil(0.25 / spacing));
    const x0 = -Math.sqrt(n);
    const counts = new Map();
    for (const v of ends) {
      const b = Math.round((v - x0) / bw);
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return { bw, bins: [...counts].map(([b, c]) => ({ center: x0 + b * bw, density: c / (WALKS * bw) })) };
  }

  function draw() {
    const { ctx, w, h } = view;
    const pw = w * PATH_FRAC, gap = 8;
    const yPix = (v) => h / 2 - (v / Y) * (h / 2 - 6);

    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    // Axes: zero line and t = 1 marker.
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yPix(0)); ctx.lineTo(pw, yPix(0));
    ctx.moveTo(pw, 0); ctx.lineTo(pw, h);
    ctx.stroke();
    ctx.fillStyle = color('--muted');
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('t = 0', 4, h - 6);
    ctx.fillText('t = 1', pw - 34, h - 6);

    // Paths as step functions, since W^(n) is constant between steps.
    const { n, paths, ends } = data;
    const drawPath = (p) => {
      ctx.beginPath();
      ctx.moveTo(0, yPix(p[0]));
      for (let i = 1; i <= n; i++) {
        const x = (i / n) * pw;
        ctx.lineTo(x, yPix(p[i - 1]));
        ctx.lineTo(x, yPix(p[i]));
      }
      ctx.stroke();
    };
    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 1;
    for (let k = 1; k <= SHOWN; k++) drawPath(paths[k]);
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    drawPath(paths[0]);

    // Sideways histogram of the endpoints.
    const hx = pw + gap, hw = w - hx - 4;
    const dScale = hw / 0.6;  // density 0.6 fills the panel (N(0,1) peak is about 0.40)
    const { bw, bins } = histogram(n, ends);
    ctx.fillStyle = color('--accent-2');
    for (const { center, density } of bins) {
      const top = yPix(center + bw / 2), bottom = yPix(center - bw / 2);
      ctx.fillRect(hx, top + 0.5, Math.min(density * dScale, hw), Math.max(bottom - top - 1, 1));
    }
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let v = -Y; v <= Y; v += 0.05) {
      const x = hx + normalPdf(v) * dScale, y = yPix(v);
      v === -Y ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = color('--muted');
    ctx.fillText('N(0, 1)', hx + 4, 16);
  }

  function update() {
    const n = nFromSlider();
    nOut.value = n.toLocaleString();
    data = simulate(n);
    const mean = data.ends.reduce((a, b) => a + b, 0) / WALKS;
    const variance = data.ends.reduce((a, b) => a + (b - mean) ** 2, 0) / (WALKS - 1);
    stats.textContent = `Across ${WALKS.toLocaleString()} walks, W₁ has mean ${mean.toFixed(3)} and variance ${variance.toFixed(3)}. Theory: 0 and 1.`;
    draw();
  }

  // Coalesce slider drags into one simulation per frame.
  let pending = false;
  slider.addEventListener('input', () => {
    root.querySelector('.takeaway').hidden = false;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  });
  resampleBtn.addEventListener('click', () => { seed += 1; update(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5); draw(); });

  view = setupCanvas(canvas, 0.5);
  update();
});
