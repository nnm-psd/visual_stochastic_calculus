/* Section 4.1 — The Surviving Second-Order Term.
   Split the change f(W_1) - f(W_0) along one path into Taylor terms summed over n pieces:
   first order f'ΔW, second order ½f''ΔW², third order ⅙f'''ΔW³. As n grows the third-order
   total vanishes, while the second-order total settles to ½∫f''(W)dt instead of 0. */
(function () {
  'use strict';
  const { levyPath, setupCanvas, color, revealOnInteract } = Stoch;

  const root = document.getElementById('taylor');
  const canvas = root.querySelector('.ty-canvas');
  const kIn = root.querySelector('input[name=k]');
  const stats = root.querySelector('.ty-stats');
  const resampleBtn = root.querySelector('button.resample');

  const LEVEL = 16, FINE = 1 << LEVEL;
  const FUNCS = {
    exp: { f: Math.exp, d1: Math.exp, d2: Math.exp, d3: Math.exp, name: 'eˣ' },
    sin: { f: Math.sin, d1: Math.cos, d2: (x) => -Math.sin(x), d3: (x) => -Math.cos(x), name: 'sin x' },
    cube: { f: (x) => x * x * x, d1: (x) => 3 * x * x, d2: (x) => 6 * x, d3: () => 6, name: 'x³' },
  };
  let seed = 51, W, view;

  function simulate() { W = levyPath(seed)(0, 1, LEVEL).ws; }

  function render() {
    const F = FUNCS[root.querySelector('input[name=fn]:checked').value];
    const n = 1 << +kIn.value, stride = FINE / n;
    kIn.nextElementSibling.value = n.toLocaleString();

    let t1 = 0, t2 = 0, t3 = 0;
    for (let i = 0; i < n; i++) {
      const x = W[i * stride], d = W[(i + 1) * stride] - x;
      t1 += F.d1(x) * d; t2 += 0.5 * F.d2(x) * d * d; t3 += (F.d3(x) * d * d * d) / 6;
    }
    let half = 0;  // ½∫f''(W)dt on the finest grid
    for (let i = 0; i < FINE; i++) half += (0.5 * F.d2(W[i])) / FINE;
    const exact = F.f(W[FINE]) - F.f(W[0]);

    const bars = [
      ['first order: Σ f′ ΔW', t1, '--accent-2'],
      ['second order: Σ ½ f″ (ΔW)²', t2, '--accent'],
      ['third order: Σ ⅙ f‴ (ΔW)³', t3, '--accent-3'],
      ['first + second', t1 + t2, '--fg'],
      ['exact change f(W₁) − f(W₀)', exact, '--fg'],
    ];
    const { ctx, w, h } = view;
    const labelW = Math.min(230, w * 0.45), rowH = (h - 16) / bars.length;
    const span = Math.max(1e-9, ...bars.map((b) => Math.abs(b[1])), Math.abs(half)) * 1.15;
    const px = (v) => labelW + ((v + span) / (2 * span)) * (w - labelW - 8);
    ctx.fillStyle = color('--viz-bg');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color('--border');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(0), 4); ctx.lineTo(px(0), h - 4); ctx.stroke();
    ctx.font = '13px system-ui, sans-serif';
    bars.forEach(([label, v, token], r) => {
      const y = 8 + r * rowH, bh = rowH * 0.55;
      ctx.fillStyle = color('--fg');
      ctx.fillText(label, 8, y + bh * 0.8);
      ctx.fillStyle = color(token);
      ctx.globalAlpha = r === 4 ? 0.35 : 0.85;
      ctx.fillRect(Math.min(px(0), px(v)), y, Math.max(Math.abs(px(v) - px(0)), 1.5), bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color('--muted');
      ctx.fillText(v.toFixed(3), v >= 0 ? px(v) + 4 : px(v) - 44, y + bh * 0.8);
    });
    // Marker: where the second-order total is heading.
    const y2 = 8 + rowH;  // row 1 is the second-order bar
    ctx.strokeStyle = color('--fg');
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px(half), y2 - 4); ctx.lineTo(px(half), y2 + rowH * 0.55 + 4); ctx.stroke();
    ctx.setLineDash([]);

    stats.textContent =
      `f(x) = ${F.name}, n = ${n.toLocaleString()} pieces. Second-order total ${t2.toFixed(3)} is heading for ½∫f″(W)dt = ${half.toFixed(3)} (dashed tick), not 0. The remaining gap is random and shrinks roughly like 1/√n. ` +
      `Third-order total ${t3.toFixed(4)} shrinks toward 0. First + second = ${(t1 + t2).toFixed(3)} vs exact ${exact.toFixed(3)}.`;
  }

  kIn.addEventListener('input', render);
  root.querySelectorAll('input[name=fn]').forEach((r) => r.addEventListener('change', render));
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.42); render(); });
  revealOnInteract(root);
  simulate();
  view = setupCanvas(canvas, 0.42);
  render();
})();
