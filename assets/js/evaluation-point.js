/* Section 3.1 — Where You Evaluate Matters.
   Approximate the integral of W against dW by sums of W(evaluation point) × rise, where the evaluation
   point sits a fraction θ of the way through each piece. One Lévy path (2^16 pieces) is reused, so
   θ can take any value k/16 even at the finest ruler of 2^12 pieces. */
(function () {
  'use strict';
  const { levyPath, setupCanvas, color, polyline, revealOnInteract } = Stoch;

  const root = document.getElementById('eval-point');
  const pathCanvas = root.querySelector('.ep-path');
  const sumCanvas = root.querySelector('.ep-sum');
  const thetaIn = root.querySelector('input[name=theta]');
  const kIn = root.querySelector('input[name=k]');
  const stats = root.querySelector('.ep-stats');
  const resampleBtn = root.querySelector('button.resample');

  const LEVEL = 16, FINE = 1 << LEVEL, REF_EVERY = 64;
  let seed = 8, W, pathView, sumView;

  function simulate() { W = levyPath(seed)(0, 1, LEVEL).ws; }

  function render() {
    const n = 1 << +kIn.value, stride = FINE / n;
    const off = Math.round(+thetaIn.value * stride), theta = off / stride;
    thetaIn.nextElementSibling.value = theta.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    kIn.nextElementSibling.value = n.toLocaleString();

    const S = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) S[i + 1] = S[i] + W[i * stride + off] * (W[(i + 1) * stride] - W[i * stride]);

    // Path panel: the path, piece boundaries and the evaluation points.
    {
      const { ctx, w, h } = pathView;
      let lo = Infinity, hi = -Infinity;
      for (const v of W) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const py = (v) => h - 10 - ((v - lo) / (hi - lo)) * (h - 20), px = (i) => (i / FINE) * w;
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      if (n <= 64) {
        ctx.strokeStyle = color('--border');
        ctx.lineWidth = 1;
        for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(px(i * stride), 0); ctx.lineTo(px(i * stride), h); ctx.stroke(); }
      }
      ctx.strokeStyle = color('--faint');
      ctx.lineWidth = 1.5;
      polyline(ctx, 0, FINE / 8, (j) => px(j * 8), (j) => py(W[j * 8]));
      if (n <= 64) {
        ctx.fillStyle = color('--accent');
        for (let i = 0; i < n; i++) {
          const j = i * stride + off;
          ctx.beginPath(); ctx.arc(px(j), py(W[j]), 3.5, 0, 2 * Math.PI); ctx.fill();
        }
      }
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText(n <= 64 ? 'orange dots: where W is evaluated in each piece' : 'dots hidden above 64 pieces', 8, 14);
    }

    // Sum panel: running sum against the three reference curves.
    {
      const { ctx, w, h } = sumView;
      const ref = (j, th) => 0.5 * W[j] * W[j] + (th - 0.5) * (j / FINE);
      let lo = 0, hi = 0;
      for (let j = 0; j <= FINE; j += REF_EVERY) for (const th of [0, 0.5, 1]) { const v = ref(j, th); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (const v of S) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const pad = (hi - lo) * 0.1 || 0.1;
      const px = (t) => t * w, py = (v) => h - 20 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (h - 40);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

      const refLine = (th, token, dash) => {
        ctx.strokeStyle = color(token);
        ctx.lineWidth = 1.5;
        ctx.setLineDash(dash);
        polyline(ctx, 0, FINE / REF_EVERY, (j) => px((j * REF_EVERY) / FINE), (j) => py(ref(j * REF_EVERY, th)));
        ctx.setLineDash([]);
      };
      refLine(0, '--accent-2', [2, 3]);
      refLine(0.5, '--accent-3', [7, 4]);
      if (theta !== 0 && theta !== 0.5) refLine(theta, '--fg', []);

      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2.25;
      polyline(ctx, 0, n, (i) => px(i / n), (i) => py(S[i]));

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--accent');
      ctx.fillText('your sum', 8, 14);
      ctx.fillStyle = color('--accent-2');
      ctx.fillText('···· Itô: ½W² − ½t', 80, 14);
      ctx.fillStyle = color('--accent-3');
      ctx.fillText('— — ordinary calculus: ½W²', 206, 14);
    }

    const w1 = W[FINE];
    const theory = 0.5 * w1 * w1 + (theta - 0.5);
    stats.textContent =
      `With θ = ${thetaIn.nextElementSibling.value} and n = ${n.toLocaleString()} pieces, the sum at t = 1 is ${S[n].toFixed(3)}. ` +
      `Theory for this θ: ½W₁² + (θ − ½) = ${theory.toFixed(3)}. ` +
      `For comparison: θ = 0 (Itô) gives ${(0.5 * w1 * w1 - 0.5).toFixed(3)}, θ = ½ (ordinary calculus's answer) gives ${(0.5 * w1 * w1).toFixed(3)}.`;
  }

  thetaIn.addEventListener('input', render);
  kIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  function layout() { pathView = setupCanvas(pathCanvas, 0.32); sumView = setupCanvas(sumCanvas, 0.42); render(); }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  simulate();
  layout();
})();
