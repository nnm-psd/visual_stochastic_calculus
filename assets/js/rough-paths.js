/* Section 1.3 — Rough Paths.
   Two panels zoom toward the same moment t = 0.5: a smooth curve and a Brownian path.
   Each panel rescales vertically to fit, so the question is only "does it straighten out?". */
Stoch.lazy('rough', function () {
  'use strict';
  const { levyPath, setupCanvas, color } = Stoch;

  const root = document.getElementById('rough');
  const smoothCanvas = root.querySelector('.rp-smooth');
  const roughCanvas = root.querySelector('.rp-rough');
  const zoomIn = root.querySelector('input[name=zoom]');
  const zoomOut = zoomIn.nextElementSibling;
  const playBtn = root.querySelector('button.play');
  const resampleBtn = root.querySelector('button.resample');

  const T0 = 0.5;          // the moment both panels zoom toward
  const POINTS = 600;      // samples across the window
  const MAX_EXP = 6;       // zoom up to 10^6
  const PLAY_MS = 9000;    // full zoom animation length
  const smooth = (t) => 0.8 * Math.sin(2 * Math.PI * 1.3 * t) + 0.4 * Math.sin(2 * Math.PI * 3.1 * t + 1);

  let seed = 3, path = levyPath(seed), smoothView, roughView, play = null;

  const fmt = (x) => (x >= 100 ? Math.round(x).toLocaleString() : x.toPrecision(3));
  const fmtWidth = (h) => (h >= 0.001 ? String(+h.toPrecision(3)) : h.toExponential(0).replace('e-', ' × 10⁻').replace(/\d+$/, (d) => [...d].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')));

  function drawPanel(view, ts, ys, a, h, token, title) {
    const { ctx, w, h: H } = view;
    let lo = Infinity, hi = -Infinity;
    for (const y of ys) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const height = hi - lo, span = (height || 1e-300) * 1.25, mid = (hi + lo) / 2;
    const px = (t) => ((t - a) / h) * w;
    const py = (v) => H / 2 - ((v - mid) / span) * (H - 44);

    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, H);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(T0), 22); ctx.lineTo(px(T0), H - 22); ctx.stroke();

    ctx.strokeStyle = color(token);
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ts.forEach((t, i) => (i ? ctx.lineTo(px(t), py(ys[i])) : ctx.moveTo(px(t), py(ys[i]))));
    ctx.stroke();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = color(token);
    ctx.fillText(title, 8, 16);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--muted');
    ctx.fillText(`height ÷ width = ${fmt(height / h)}`, 8, H - 8);
    const wl = `width ${fmtWidth(h)}`;
    ctx.fillText(wl, w - ctx.measureText(wl).width - 8, H - 8);
  }

  function render() {
    const exp = +zoomIn.value, h = Math.pow(10, -exp), a = T0 - h / 2, b = T0 + h / 2;
    zoomOut.value = '×' + Math.round(Math.pow(10, exp)).toLocaleString();

    const ts = [], ys = [];
    for (let i = 0; i <= POINTS; i++) { const t = a + (i / POINTS) * h; ts.push(t); ys.push(smooth(t)); }
    drawPanel(smoothView, ts, ys, a, h, '--accent-2', 'Smooth curve');

    const level = Math.ceil(Math.log2(POINTS / h));
    const bm = path(a, b, level);
    drawPanel(roughView, bm.ts, bm.ws, a, h, '--accent', 'Brownian path');
  }

  function stopPlay() {
    if (!play) return;
    cancelAnimationFrame(play.raf);
    play = null;
    playBtn.textContent = 'Play zoom';
  }

  function startPlay() {
    const from = +zoomIn.value >= MAX_EXP ? 0 : +zoomIn.value;
    const t0 = performance.now(), dur = PLAY_MS * (1 - from / MAX_EXP);
    play = {};
    playBtn.textContent = 'Pause';
    root.querySelector('.takeaway').hidden = false;
    const tick = (now) => {
      const f = Math.min((now - t0) / dur, 1);
      zoomIn.value = from + (MAX_EXP - from) * f;
      render();
      if (f < 1) play.raf = requestAnimationFrame(tick);
      else stopPlay();
    };
    play.raf = requestAnimationFrame(tick);
  }

  zoomIn.addEventListener('input', () => {
    stopPlay();
    root.querySelector('.takeaway').hidden = false;
    render();
  });
  playBtn.addEventListener('click', () => (play ? stopPlay() : startPlay()));
  resampleBtn.addEventListener('click', () => { seed += 1; path = levyPath(seed); render(); });

  function layout() {
    smoothView = setupCanvas(smoothCanvas, 0.75);
    roughView = setupCanvas(roughCanvas, 0.75);
    render();
  }
  window.addEventListener('resize', layout);
  layout();
});
