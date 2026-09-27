/* Section 3.2 — Building the Integral.
   The reader drags 8 bars to set a bet size for each of 8 equal periods. Gains = sum of bet × rise.
   The orange path shows gains along one Brownian path; the histogram shows final gains over 2,000
   paths. With bets fixed per period, each path only needs its 8 period rises. */
Stoch.lazy('betting', function () {
  'use strict';
  const { rng, gaussian, brownianPath, setupCanvas, color, polyline, normalPdf, histogram, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('betting');
  const barsCanvas = root.querySelector('.bt-bars');
  const lineCanvas = root.querySelector('.bt-lines');
  const histCanvas = root.querySelector('.bt-hist');
  const stats = root.querySelector('.bt-stats');
  const resetBtn = root.querySelector('button.reset');
  const resampleBtn = root.querySelector('button.resample');

  const PERIODS = 8, STEPS = 256, PER = STEPS / PERIODS, PATHS = 2000, HMAX = 2, SNAP = 0.25;
  const DEFAULT = [1, 2, 0.5, -1, -1, 0, 1.5, 1];
  let bets = DEFAULT.slice(), seed = 31, hero, rises, barsView, lineView, histView, painting = false, selected = 0;

  function simulate() {
    const rand = rng(seed);
    hero = brownianPath(STEPS, rand);
    rises = new Float64Array(PATHS * PERIODS);
    const sd = Math.sqrt(1 / PERIODS);
    for (let k = 0; k < rises.length; k++) rises[k] = sd * gaussian(rand);
  }

  function drawBars() {
    const { ctx, w, h } = barsView, bw = w / PERIODS;
    const py = (v) => h / 2 - (v / HMAX) * (h / 2 - 14);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    bets.forEach((b, j) => {
      ctx.fillStyle = color('--accent-3');
      const y0 = py(0), y1 = py(b);
      ctx.fillRect(j * bw + 6, Math.min(y0, y1), bw - 12, Math.max(Math.abs(y1 - y0), 1.5));
      ctx.fillStyle = color('--muted');
      ctx.fillText(b.toFixed(2).replace(/\.?0+$/, ''), j * bw + 8, b >= 0 ? py(0) + 14 : py(0) - 5);
      if (document.activeElement === barsCanvas && j === selected) {
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 2;
        ctx.strokeRect(j * bw + 3, 16, bw - 6, h - 20);
      }
    });
    ctx.fillText('bet size per period (drag to change)', 8, 12);
  }

  function drawLines() {
    const { ctx, w, h } = lineView;
    const gains = new Float64Array(STEPS + 1);
    for (let i = 1; i <= STEPS; i++) gains[i] = gains[i - 1] + bets[Math.floor((i - 1) / PER)] * (hero[i] - hero[i - 1]);
    let lo = -1, hi = 1;
    for (let i = 0; i <= STEPS; i++) { lo = Math.min(lo, hero[i], gains[i]); hi = Math.max(hi, hero[i], gains[i]); }
    const px = (i) => (i / STEPS) * w, py = (v) => h - 10 - ((v - lo) / (hi - lo)) * (h - 30);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    for (let j = 1; j < PERIODS; j++) { ctx.beginPath(); ctx.moveTo(px(j * PER), 0); ctx.lineTo(px(j * PER), h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
    ctx.strokeStyle = color('--accent-2');
    ctx.lineWidth = 1.5;
    polyline(ctx, 0, STEPS, px, (i) => py(hero[i]));
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2.25;
    polyline(ctx, 0, STEPS, px, (i) => py(gains[i]));
    ctx.font = '12px system-ui, sans-serif';
    legend(ctx, [['price W', '--accent-2'], ['your gains', '--accent']], 8, 14, w - 16);
  }

  function drawHist() {
    const finals = new Float64Array(PATHS);
    for (let k = 0; k < PATHS; k++) { let g = 0; for (let j = 0; j < PERIODS; j++) g += bets[j] * rises[k * PERIODS + j]; finals[k] = g; }
    const mean = finals.reduce((a, b) => a + b, 0) / PATHS;
    const variance = finals.reduce((a, b) => a + (b - mean) ** 2, 0) / (PATHS - 1);
    const theoryVar = bets.reduce((a, b) => a + b * b, 0) / PERIODS;

    const { ctx, w, h } = histView, R = 4.5, bins = 36;
    const { bw, density } = histogram(finals, -R, R, bins);
    const px = (v) => ((v + R) / (2 * R)) * w, py = (d) => h - 18 - d * (h - 40) * 1.6;
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color('--accent');
    ctx.globalAlpha = 0.75;
    density.forEach((d, b) => ctx.fillRect(px(-R + b * bw) + 0.5, py(d), px(bw - R) - 1, py(0) - py(d)));
    ctx.globalAlpha = 1;
    if (theoryVar > 0) {
      const sd = Math.sqrt(theoryVar);
      ctx.strokeStyle = color('--fg');
      ctx.lineWidth = 1.5;
      polyline(ctx, 0, 200, (i) => px(-R + (i / 200) * 2 * R), (i) => py(normalPdf((-R + (i / 200) * 2 * R) / sd) / sd));
    }
    ctx.strokeStyle = color('--border');
    ctx.beginPath(); ctx.moveTo(px(0), 20); ctx.lineTo(px(0), h - 18); ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText('final gains, 2,000 paths', 8, 14);
    ctx.fillText('0', px(0) - 3, h - 4);

    stats.textContent =
      `Across ${PATHS.toLocaleString()} paths, final gains average ${mean.toFixed(3)} (theory: 0) ` +
      `with variance ${variance.toFixed(3)} (theory: sum of bet² × 1/8 = ${theoryVar.toFixed(3)}).`;
  }

  function render() { drawBars(); drawLines(); drawHist(); }

  function paint(e) {
    const r = barsCanvas.getBoundingClientRect(), { w, h } = barsView;
    const j = Math.min(PERIODS - 1, Math.max(0, Math.floor(((e.clientX - r.left) / w) * PERIODS)));
    const v = ((h / 2 - (e.clientY - r.top)) / (h / 2 - 14)) * HMAX;
    bets[j] = Math.max(-HMAX, Math.min(HMAX, Math.round(v / SNAP) * SNAP));
    render();
  }
  barsCanvas.addEventListener('pointerdown', (e) => { painting = true; barsCanvas.setPointerCapture(e.pointerId); paint(e); });
  barsCanvas.addEventListener('pointermove', (e) => { if (painting) paint(e); });
  barsCanvas.addEventListener('pointerup', () => { painting = false; });
  barsCanvas.addEventListener('pointercancel', () => { painting = false; });

  // Keyboard: ← → choose a period, ↑ ↓ change its bet by 0.25.
  barsCanvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') selected = Math.max(0, selected - 1);
    else if (e.key === 'ArrowRight') selected = Math.min(PERIODS - 1, selected + 1);
    else if (e.key === 'ArrowUp') bets[selected] = Math.min(HMAX, bets[selected] + SNAP);
    else if (e.key === 'ArrowDown') bets[selected] = Math.max(-HMAX, bets[selected] - SNAP);
    else return;
    e.preventDefault();
    root.querySelector('.takeaway').hidden = false;
    render();
  });
  barsCanvas.addEventListener('focus', drawBars);
  barsCanvas.addEventListener('blur', drawBars);

  resetBtn.addEventListener('click', () => { bets = new Array(PERIODS).fill(1); render(); });
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  function layout() {
    barsView = setupCanvas(barsCanvas, 0.22, 150);
    lineView = setupCanvas(lineCanvas, 0.6);
    histView = setupCanvas(histCanvas, 0.9);
    render();
  }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  simulate();
  layout();
});
