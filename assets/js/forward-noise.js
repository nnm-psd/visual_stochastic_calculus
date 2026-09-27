/* Section 7.1 — Forward: Data to Noise.
   3,000 samples of the two-bump "data" follow dX = -X dt + √2 dW for 3 time units.
   Left: 40 of the paths up to the current time. Right: histogram now, the exact noised density
   (black) and pure noise N(0, 1) (dashed). */
(function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, histogram, normalPdf, revealOnInteract } = Stoch;
  const { density, sampleData, SPLIT } = Diffusion;

  const root = document.getElementById('forward');
  const canvas = root.querySelector('.fw-canvas');
  const tIn = root.querySelector('input[name=t]');
  const playBtn = root.querySelector('button.play');
  const resampleBtn = root.querySelector('button.resample');
  const stats = root.querySelector('.fw-stats');

  const PARTICLES = 3000, SHOWN = 40, T = 3, FRAMES = 150, SUB = 2, DT = T / FRAMES / SUB;
  const LO = -4, HI = 4, PATH_FRAC = 0.62, PLAY_MS = 6000;
  let seed = 151, positions, view, play = null;

  function simulate() {
    const rand = rng(seed), sd = Math.sqrt(2 * DT);
    positions = new Float32Array((FRAMES + 1) * PARTICLES);
    const x = new Float64Array(PARTICLES);
    for (let k = 0; k < PARTICLES; k++) positions[k] = x[k] = sampleData(rand);
    for (let f = 1; f <= FRAMES; f++) {
      for (let k = 0; k < PARTICLES; k++) {
        for (let j = 0; j < SUB; j++) x[k] += -x[k] * DT + sd * gaussian(rand);
        positions[f * PARTICLES + k] = x[k];
      }
    }
  }

  // Half the area between p(t, ·) and N(0, 1): 1 = completely different, 0 = identical.
  function distanceToNoise(t) {
    let s = 0;
    const dx = 0.01;
    for (let x = -8; x <= 8; x += dx) s += Math.abs(density(t, x) - normalPdf(x)) * dx;
    return s / 2;
  }

  function render() {
    const f = Math.round((+tIn.value * FRAMES) / T), t = (f / FRAMES) * T;
    tIn.nextElementSibling.value = t.toFixed(2);
    const { ctx, w, h } = view, pw = w * PATH_FRAC;
    const px = (fr) => (fr / FRAMES) * pw, py = (v) => h - 10 - ((v - LO) / (HI - LO)) * (h - 30);
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

    const hx = pw + 6, hw = w - hx - 4, dScale = hw / 1.5;
    const now = positions.subarray(f * PARTICLES, (f + 1) * PARTICLES);
    const { bw, density: dens } = histogram(now, LO, HI, 48);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.7;
    dens.forEach((d, b) => { const y0 = py(LO + b * bw), y1 = py(LO + (b + 1) * bw); ctx.fillRect(hx, y1 + 0.5, Math.min(d * dScale, hw), y0 - y1 - 1); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 2;
    polyline(ctx, 0, 200, (i) => hx + Math.min(density(t, LO + (i / 200) * (HI - LO)) * dScale, hw), (i) => py(LO + (i / 200) * (HI - LO)));
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.25;
    polyline(ctx, 0, 200, (i) => hx + normalPdf(LO + (i / 200) * (HI - LO)) * dScale, (i) => py(LO + (i / 200) * (HI - LO)));
    ctx.setLineDash([]);
    ctx.restore();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('data (t = 0) → noise', 8, 14);
    ctx.fillText('distribution now', hx + 2, 14);

    let below = 0;
    for (const v of now) if (v < SPLIT) below++;
    stats.textContent =
      `t = ${t.toFixed(2)}. Distance from pure noise N(0, 1): ${distanceToNoise(t).toFixed(3)} (1 = completely different, 0 = identical). ` +
      `Share of samples left of the valley: ${(below / PARTICLES * 100).toFixed(1)}% (data: 35%, pure noise: 40.1%).`;
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
  view = setupCanvas(canvas, 0.55);
  render();
})();
