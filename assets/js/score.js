/* Section 7.2 — The Score.
   At a chosen noise level t: top, the noised density p(t, x); bottom, its score d/dx log p(t, x),
   drawn as a curve and as arrows along the axis showing which way is "more likely". */
Stoch.lazy('score', function () {
  'use strict';
  const { setupCanvas, color, polyline, normalPdf, revealOnInteract } = Stoch;
  const { density, scoreAt } = Diffusion;

  const root = document.getElementById('score');
  const canvas = root.querySelector('.sc-canvas');
  const tIn = root.querySelector('input[name=t]');
  const stats = root.querySelector('.sc-stats');

  const LO = -4, HI = 4, ARROWS = 25, SMAX = 12;
  let view;

  function render() {
    const t = +tIn.value, s = scoreAt(t);
    tIn.nextElementSibling.value = t.toFixed(2);
    const { ctx, w, h } = view, split = h * 0.5;
    const px = (x) => ((x - LO) / (HI - LO)) * w;
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);

    // Top: density.
    const pMax = Math.max(0.45, ...Array.from({ length: 161 }, (_, i) => density(t, LO + (i / 160) * (HI - LO))));
    const pyTop = (p) => split - 8 - (p / pMax) * (split - 30);
    ctx.fillStyle = color('--accent-2');
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(px(LO), pyTop(0));
    for (let i = 0; i <= 200; i++) { const x = LO + (i / 200) * (HI - LO); ctx.lineTo(px(x), pyTop(density(t, x))); }
    ctx.lineTo(px(HI), pyTop(0)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--accent-2');
    ctx.lineWidth = 2;
    polyline(ctx, 0, 200, (i) => px(LO + (i / 200) * (HI - LO)), (i) => pyTop(density(t, LO + (i / 200) * (HI - LO))));
    ctx.strokeStyle = color('--muted');
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.25;
    polyline(ctx, 0, 200, (i) => px(LO + (i / 200) * (HI - LO)), (i) => pyTop(normalPdf(LO + (i / 200) * (HI - LO))));
    ctx.setLineDash([]);

    // Bottom: score curve and arrows.
    const mid = split + (h - split) / 2, pyBot = (v) => mid - (Math.max(-SMAX, Math.min(SMAX, v)) / SMAX) * ((h - split) / 2 - 10);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, split); ctx.lineTo(w, split); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    polyline(ctx, 0, 200, (i) => px(LO + (i / 200) * (HI - LO)), (i) => pyBot(s(LO + (i / 200) * (HI - LO))));

    ctx.strokeStyle = color('--fg');
    ctx.fillStyle = color('--fg');
    ctx.lineWidth = 1.5;
    for (let i = 0; i < ARROWS; i++) {
      const x = LO + ((i + 0.5) / ARROWS) * (HI - LO), v = s(x);
      const len = Math.max(-1, Math.min(1, v / SMAX)) * (w / ARROWS) * 1.6;
      if (Math.abs(len) < 2) continue;
      const x0 = px(x), x1 = x0 + len, dir = Math.sign(len);
      ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, mid); ctx.lineTo(x1 - dir * 5, mid - 4); ctx.lineTo(x1 - dir * 5, mid + 4); ctx.closePath(); ctx.fill();
    }

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = color('--accent-2');
    ctx.fillText('density p(t, x); dashed: pure noise', 8, 14);
    const label = 'score: slope of log p. Arrows point uphill, toward "more likely"';
    ctx.fillStyle = color('--viz-bg');
    ctx.globalAlpha = 0.85;
    ctx.fillRect(4, split + 3, ctx.measureText(label).width + 8, 17);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color('--accent');
    ctx.fillText(label, 8, split + 16);
    ctx.fillStyle = color('--muted');
    for (const x of [-3, 0, 3]) ctx.fillText(String(x), px(x) - 4, h - 4);

    stats.textContent =
      `t = ${t.toFixed(2)}. Score at x = −3, 0, 3: ${[-3, 0, 3].map((x) => s(x).toFixed(2)).join(', ')}. ` +
      `Pure noise's score, −x, would give 3.00, 0.00, −3.00.`;
  }

  tIn.addEventListener('input', render);
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.62); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.62);
  render();
});
