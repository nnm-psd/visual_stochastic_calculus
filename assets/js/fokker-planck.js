/* Section 5.3 — Paths ↔ Densities (Fokker–Planck).
   3,000 particles follow the Ornstein–Uhlenbeck SDE dX = -θX dt + σ dW from near x = 2.
   Separately, the Fokker–Planck PDE for their density is solved on a grid by finite differences.
   Scrub time: the particle histogram and the PDE curve should move together. */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, histogram, revealOnInteract } = Stoch;

  const root = document.getElementById('fp');
  const canvas = root.querySelector('.fp-canvas');
  const tIn = root.querySelector('input[name=t]');
  const playBtn = root.querySelector('button.play');
  const resampleBtn = root.querySelector('button.resample');
  const stats = root.querySelector('.fp-stats');

  const THETA = 1, SIGMA = 1, X0 = 2, X0_SD = 0.15;
  const PARTICLES = 3000, SHOWN = 40, T = 3, FRAMES = 150, SUB = 4, DT = T / FRAMES / SUB;
  const GX0 = -4, GX1 = 5, NX = 181, DX = (GX1 - GX0) / (NX - 1), PDE_SUB = 20, PDE_DT = T / FRAMES / PDE_SUB;
  const PATH_FRAC = 0.66, PLAY_MS = 6000;
  let seed = 101, positions, density, view, play = null;

  // Particles: positions[frame * PARTICLES + k].
  function simulate() {
    const rand = rng(seed);
    positions = new Float32Array((FRAMES + 1) * PARTICLES);
    const x = new Float64Array(PARTICLES);
    for (let k = 0; k < PARTICLES; k++) positions[k] = x[k] = X0 + X0_SD * gaussian(rand);
    const sd = SIGMA * Math.sqrt(DT);
    for (let f = 1; f <= FRAMES; f++) {
      for (let k = 0; k < PARTICLES; k++) {
        for (let j = 0; j < SUB; j++) x[k] += -THETA * x[k] * DT + sd * gaussian(rand);
        positions[f * PARTICLES + k] = x[k];
      }
    }
  }

  // Fokker–Planck: ∂p/∂t = ∂x(θ x p) + ½σ² ∂xx p, explicit finite differences, p = 0 at the edges.
  function solvePDE() {
    density = [];
    let p = new Float64Array(NX), q = new Float64Array(NX);
    for (let i = 0; i < NX; i++) {
      const z = (GX0 + i * DX - X0) / X0_SD;
      p[i] = Math.exp(-0.5 * z * z) / (X0_SD * Math.sqrt(2 * Math.PI));
    }
    density.push(p.slice());
    const D = 0.5 * SIGMA * SIGMA;
    for (let f = 1; f <= FRAMES; f++) {
      for (let j = 0; j < PDE_SUB; j++) {
        for (let i = 1; i < NX - 1; i++) {
          const xl = GX0 + (i - 1) * DX, xr = GX0 + (i + 1) * DX;
          const drift = (THETA * xr * p[i + 1] - THETA * xl * p[i - 1]) / (2 * DX);
          const diff = (D * (p[i + 1] - 2 * p[i] + p[i - 1])) / (DX * DX);
          q[i] = p[i] + PDE_DT * (drift + diff);
        }
        q[0] = q[NX - 1] = 0;
        [p, q] = [q, p];
      }
      density.push(p.slice());
    }
  }

  function render() {
    const f = Math.round(+tIn.value * FRAMES / T), t = (f / FRAMES) * T;
    tIn.nextElementSibling.value = t.toFixed(2);
    const { ctx, w, h } = view, pw = w * PATH_FRAC, lo = -3, hi = 3.5;
    const px = (fr) => (fr / FRAMES) * pw, py = (v) => h - 10 - ((v - lo) / (hi - lo)) * (h - 30);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(pw, py(0)); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();

    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 0.9;
    for (let k = 0; k < SHOWN; k++) polyline(ctx, 0, f, px, (fr) => py(positions[fr * PARTICLES + k]));
    ctx.fillStyle = color('--accent');
    for (let k = 0; k < SHOWN; k++) { ctx.beginPath(); ctx.arc(px(f), py(positions[f * PARTICLES + k]), 2.2, 0, 2 * Math.PI); ctx.fill(); }
    ctx.strokeStyle = color('--accent');
    ctx.beginPath(); ctx.moveTo(px(f), 20); ctx.lineTo(px(f), h); ctx.stroke();

    const hx = pw + 6, hw = w - hx - 4, dScale = hw / 1.4;
    const now = positions.subarray(f * PARTICLES, (f + 1) * PARTICLES);
    const { bw, density: dens } = histogram(now, lo, hi, 40);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    dens.forEach((d, b) => { const y0 = py(lo + b * bw), y1 = py(lo + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, Math.min(d * dScale, hw), y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 2;
    const p = density[f];
    polyline(ctx, 0, NX - 1, (i) => hx + Math.min(p[i] * dScale, hw), (i) => py(GX0 + i * DX));
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('particle paths over time', 8, 14);
    ctx.fillText('density now', hx + 2, 14);

    let m = 0, m2 = 0, pm = 0, pm2 = 0;
    for (const v of now) { m += v / PARTICLES; m2 += (v * v) / PARTICLES; }
    for (let i = 0; i < NX; i++) { const x = GX0 + i * DX; pm += p[i] * x * DX; pm2 += p[i] * x * x * DX; }
    const e = Math.exp(-THETA * t);
    const sdTheory = Math.sqrt(X0_SD * X0_SD * e * e + (SIGMA * SIGMA / (2 * THETA)) * (1 - e * e));
    stats.textContent =
      `t = ${t.toFixed(2)}. Average position: particles ${m.toFixed(3)}, equation ${pm.toFixed(3)}, exact ${(X0 * e).toFixed(3)}. ` +
      `Spread (standard deviation): particles ${Math.sqrt(m2 - m * m).toFixed(3)}, equation ${Math.sqrt(pm2 - pm * pm).toFixed(3)}, exact ${sdTheory.toFixed(3)}.`;
  }

  function stopPlay() { if (play) cancelAnimationFrame(play.raf); play = null; playBtn.textContent = 'Play'; }
  function startPlay() {
    const from = +tIn.value >= T ? 0 : +tIn.value, t0 = performance.now(), dur = PLAY_MS * (1 - from / T);
    play = {};
    playBtn.textContent = 'Pause';
    const tick = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      tIn.value = from + (T - from) * k;
      render();
      if (k < 1) play.raf = requestAnimationFrame(tick); else stopPlay();
    };
    play.raf = requestAnimationFrame(tick);
  }

  tIn.addEventListener('input', () => { stopPlay(); render(); });
  playBtn.addEventListener('click', () => (play ? stopPlay() : startPlay()));
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55); render(); });
  revealOnInteract(root);
  simulate();
  solvePDE();
  view = setupCanvas(canvas, 0.55);
  render();
})();
