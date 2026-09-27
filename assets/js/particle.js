/* Ch 1 opener — a heavy particle kicked by many light molecules (after MinuteLabs' Brownian Motion lab).
   Elastic hard-disk collisions between the particle and each molecule; molecules do not collide
   with each other. They start with Gaussian (Maxwell–Boltzmann) velocities, so the gas is already
   in equilibrium. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color } = Stoch;

  const root = document.getElementById('particle');
  const box = root.querySelector('.pm-box');
  const strip = root.querySelector('.pm-strip');
  const energyIn = root.querySelector('input[name=energy]');
  const massIn = root.querySelector('input[name=mass]');
  const showIn = root.querySelector('input[name=show]');
  const resetBtn = root.querySelector('button.reset');

  const W = 600, H = 360;          // world size (units)
  const N = 1600;                  // molecules
  const r = 2, R = 22;             // molecule / particle radius
  const BASE_SPEED = 140;          // molecule speed std per axis at energy 1 (units/s)
  const SUBSTEPS = 4;
  const DT = 1 / 60 / SUBSTEPS;
  const TRAIL_MAX = 4000;
  const SERIES_MAX = 1800;         // 30 s of x(t) at 60 fps

  const mx = new Float64Array(N), my = new Float64Array(N);
  const mvx = new Float64Array(N), mvy = new Float64Array(N);
  const big = { x: 0, y: 0, vx: 0, vy: 0, m: 40 };
  let energy = 1;
  let trail = [], series = [];
  let boxView, stripView;
  let running = false;

  function massFromSlider() { return Math.round(Math.pow(10, +massIn.value)); }

  function reset() {
    const rand = rng(2027);
    big.x = W / 2; big.y = H / 2; big.vx = 0; big.vy = 0;
    const speed = BASE_SPEED * Math.sqrt(energy);
    for (let i = 0; i < N; i++) {
      do {
        mx[i] = r + rand() * (W - 2 * r);
        my[i] = r + rand() * (H - 2 * r);
      } while (Math.hypot(mx[i] - big.x, my[i] - big.y) < R + r + 1);
      mvx[i] = gaussian(rand) * speed;
      mvy[i] = gaussian(rand) * speed;
    }
    trail = [];
    series = [];
  }

  function step() {
    const M = big.m, minD = R + r;
    big.x += big.vx * DT; big.y += big.vy * DT;
    if (big.x < R) { big.x = R; big.vx = Math.abs(big.vx); }
    if (big.x > W - R) { big.x = W - R; big.vx = -Math.abs(big.vx); }
    if (big.y < R) { big.y = R; big.vy = Math.abs(big.vy); }
    if (big.y > H - R) { big.y = H - R; big.vy = -Math.abs(big.vy); }

    for (let i = 0; i < N; i++) {
      let x = mx[i] + mvx[i] * DT, y = my[i] + mvy[i] * DT;
      if (x < r) { x = r; mvx[i] = Math.abs(mvx[i]); }
      if (x > W - r) { x = W - r; mvx[i] = -Math.abs(mvx[i]); }
      if (y < r) { y = r; mvy[i] = Math.abs(mvy[i]); }
      if (y > H - r) { y = H - r; mvy[i] = -Math.abs(mvy[i]); }

      const dx = x - big.x, dy = y - big.y, d2 = dx * dx + dy * dy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d;
        const rel = (mvx[i] - big.vx) * nx + (mvy[i] - big.vy) * ny;
        if (rel < 0) {
          // Elastic collision, molecule mass 1, particle mass M; momentum is conserved.
          const km = 2 * M / (1 + M) * rel, kM = 2 / (1 + M) * rel;
          mvx[i] -= km * nx; mvy[i] -= km * ny;
          big.vx += kM * nx; big.vy += kM * ny;
        }
        x = big.x + nx * minD; y = big.y + ny * minD;
      }
      mx[i] = x; my[i] = y;
    }
  }

  function drawBox() {
    const { ctx, w, h } = boxView, s = w / W;
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    if (showIn.checked) {
      ctx.fillStyle = color('--molecule');
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        ctx.moveTo(mx[i] * s + r * s, my[i] * s);
        ctx.arc(mx[i] * s, my[i] * s, r * s, 0, 2 * Math.PI);
      }
      ctx.fill();
    }

    if (trail.length > 1) {
      ctx.strokeStyle = color('--accent-2');
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(trail[0][0] * s, trail[0][1] * s);
      for (const [x, y] of trail) ctx.lineTo(x * s, y * s);
      ctx.stroke();
    }

    ctx.fillStyle = color('--accent');
    ctx.beginPath();
    ctx.arc(big.x * s, big.y * s, R * s, 0, 2 * Math.PI);
    ctx.fill();
  }

  function drawStrip() {
    const { ctx, w, h } = stripView;
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    if (series.length < 2) return;
    // Autoscale to the recent range: the particle wanders far less than the box width.
    let lo = Infinity, hi = -Infinity;
    for (const x of series) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    const mid = (lo + hi) / 2, half = Math.max((hi - lo) / 2, 10) * 1.15;
    const yScale = (h / 2) / half;
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    series.forEach((x, i) => {
      const px = (i / (SERIES_MAX - 1)) * w, py = h / 2 - (x - mid) * yScale;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  }

  function frame() {
    if (!running) return;
    for (let k = 0; k < SUBSTEPS; k++) step();
    trail.push([big.x, big.y]);
    if (trail.length > TRAIL_MAX) trail.shift();
    series.push(big.x);
    if (series.length > SERIES_MAX) series.shift();
    drawBox();
    drawStrip();
    requestAnimationFrame(frame);
  }

  function layout() {
    boxView = setupCanvas(box, H / W);
    stripView = setupCanvas(strip, 0.18);
    drawBox();
    drawStrip();
  }

  function revealTakeaway() { root.querySelector('.takeaway').hidden = false; }

  energyIn.addEventListener('input', () => {
    const next = +energyIn.value, f = Math.sqrt(next / energy);
    for (let i = 0; i < N; i++) { mvx[i] *= f; mvy[i] *= f; }
    big.vx *= f; big.vy *= f;
    energy = next;
    energyIn.nextElementSibling.value = next.toFixed(1);
    revealTakeaway();
  });
  massIn.addEventListener('input', () => {
    const next = massFromSlider(), f = Math.sqrt(big.m / next);  // keep the particle's kinetic energy
    big.vx *= f; big.vy *= f;
    big.m = next;
    massIn.nextElementSibling.value = next;
    revealTakeaway();
  });
  showIn.addEventListener('change', () => { drawBox(); revealTakeaway(); });
  resetBtn.addEventListener('click', () => { reset(); drawBox(); drawStrip(); });
  window.addEventListener('resize', layout);

  // Animate only while on screen.
  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(frame); }
    if (!visible) running = false;
  }).observe(box);

  big.m = massFromSlider();
  massIn.nextElementSibling.value = big.m;
  reset();
  layout();
})();
