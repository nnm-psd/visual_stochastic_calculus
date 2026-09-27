/* Section 7.4 — Langevin Sampling.
   Particles follow dX = s(X) dt + √2 dW, where s is the score of the two-bump data density π, whose
   long-run distribution is π itself. Starting all particles in one bump shows the catch: the valley
   between the bumps is almost never crossed, so the proportions stay wrong. */
Stoch.lazy('langevin', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, histogram, revealOnInteract } = Stoch;
  const { density, scoreAt, SPLIT, W } = Diffusion;

  const root = document.getElementById('langevin');
  const canvas = root.querySelector('.lg-canvas');
  const tIn = root.querySelector('input[name=t]');
  const playBtn = root.querySelector('button.play');
  const stats = root.querySelector('.lg-stats');

  const PARTICLES = 2000, SHOWN = 40, T = 10, FRAMES = 200, SUB = 10, DT = T / FRAMES / SUB;
  const LO = -4, HI = 4, PATH_FRAC = 0.62, PLAY_MS = 7000, LEFT_BUMP = -1.4;
  const score = scoreAt(0);
  let positions, visited, view, play = null, simulatedFor = null;

  function simulate(start) {
    const rand = rng(171), sd = Math.sqrt(2 * DT);
    positions = new Float32Array((FRAMES + 1) * PARTICLES);
    visited = new Int32Array(FRAMES + 1);  // particles that have ever been inside the left bump (x < -1.4)
    const x = new Float64Array(PARTICLES), seen = new Uint8Array(PARTICLES);
    for (let k = 0; k < PARTICLES; k++) {
      x[k] = start === 'right' ? 1.5 + 0.5 * gaussian(rand) : LO + rand() * (HI - LO);
      seen[k] = x[k] < LEFT_BUMP ? 1 : 0;
      positions[k] = x[k];
    }
    let total = seen.reduce((a, b) => a + b, 0);
    visited[0] = total;
    for (let f = 1; f <= FRAMES; f++) {
      for (let k = 0; k < PARTICLES; k++) {
        for (let j = 0; j < SUB; j++) x[k] += DT * score(x[k]) + sd * gaussian(rand);
        if (!seen[k] && x[k] < LEFT_BUMP) { seen[k] = 1; total++; }
        positions[f * PARTICLES + k] = x[k];
      }
      visited[f] = total;
    }
    simulatedFor = start;
  }

  function render() {
    const start = root.querySelector('input[name=start]:checked').value;
    if (start !== simulatedFor) simulate(start);
    const f = Math.round((+tIn.value * FRAMES) / T), t = (f / FRAMES) * T;
    tIn.nextElementSibling.value = t.toFixed(1);
    const { ctx, w, h } = view, pw = w * PATH_FRAC;
    const px = (fr) => (fr / FRAMES) * pw, py = (v) => h - 10 - ((v - LO) / (HI - LO)) * (h - 30);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, py(SPLIT)); ctx.lineTo(pw, py(SPLIT)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, h); ctx.stroke();

    ctx.strokeStyle = color('--faint');
    ctx.lineWidth = 0.9;
    for (let k = 0; k < SHOWN; k++) polyline(ctx, 0, f, px, (fr) => py(positions[fr * PARTICLES + k]));
    ctx.fillStyle = color('--accent');
    for (let k = 0; k < SHOWN; k++) { ctx.beginPath(); ctx.arc(px(f), py(positions[f * PARTICLES + k]), 2.2, 0, 2 * Math.PI); ctx.fill(); }

    const hx = pw + 6, hw = w - hx - 4, dScale = hw / 1.6;
    const now = positions.subarray(f * PARTICLES, (f + 1) * PARTICLES);
    const { bw, density: dens } = histogram(now, LO, HI, 48);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    dens.forEach((d, b) => { const y0 = py(LO + b * bw), y1 = py(LO + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, Math.min(d * dScale, hw), y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 2;
    polyline(ctx, 0, 200, (i) => hx + Math.min(density(0, LO + (i / 200) * (HI - LO)) * dScale, hw), (i) => py(LO + (i / 200) * (HI - LO)));
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('particles over time (dashed: the valley)', 8, 14);
    ctx.fillText('now vs target', hx + 2, 14);

    let left = 0;
    for (const v of now) if (v < SPLIT) left++;
    stats.textContent =
      `t = ${t.toFixed(1)}: ${(left / PARTICLES * 100).toFixed(1)}% of particles are in the left bump (target: ${W[0] * 100}%). ` +
      `Particles that have ever reached the left bump: ${visited[f].toLocaleString()} of ${PARTICLES.toLocaleString()}.`;
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
  root.querySelectorAll('input[name=start]').forEach((r) => r.addEventListener('change', () => { stopPlay(); render(); }));
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.55, 240); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.55, 240);
  render();
});
