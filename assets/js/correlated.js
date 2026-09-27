/* Section 4.4 — Two Brownian Motions.
   Two Brownian motions with correlation ρ, built from independent noise: dW2 = ρ dW1 + √(1-ρ²) dB.
   Panels: both paths over time, the pair as a path in the plane, and the running cross-variation
   Σ ΔW1 ΔW2 against the line ρt. The stats check the product rule d(W1 W2) = W1 dW2 + W2 dW1 + ρ dt. */
Stoch.lazy('correlated', function () {
  'use strict';
  const { rng, gaussian, setupCanvas, color, polyline, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('correlated');
  const pathCanvas = root.querySelector('.cr-paths');
  const planeCanvas = root.querySelector('.cr-plane');
  const crossCanvas = root.querySelector('.cr-cross');
  const rhoIn = root.querySelector('input[name=rho]');
  const stats = root.querySelector('.cr-stats');
  const resampleBtn = root.querySelector('button.resample');

  const STEPS = 4000, SD = Math.sqrt(1 / STEPS);
  let seed = 141, Z1, Z2, pathView, planeView, crossView;

  function simulate() {
    const rand = rng(seed);
    Z1 = new Float64Array(STEPS);
    Z2 = new Float64Array(STEPS);
    for (let i = 0; i < STEPS; i++) { Z1[i] = SD * gaussian(rand); Z2[i] = SD * gaussian(rand); }
  }

  function render() {
    const rho = +rhoIn.value, c = Math.sqrt(1 - rho * rho);
    rhoIn.nextElementSibling.value = rho.toFixed(2);
    const W1 = new Float64Array(STEPS + 1), W2 = new Float64Array(STEPS + 1), cross = new Float64Array(STEPS + 1);
    let i12 = 0, i21 = 0;
    for (let i = 0; i < STEPS; i++) {
      const d1 = Z1[i], d2 = rho * Z1[i] + c * Z2[i];
      i12 += W1[i] * d2; i21 += W2[i] * d1;              // Itô integrals, left-end rule
      W1[i + 1] = W1[i] + d1; W2[i + 1] = W2[i] + d2;
      cross[i + 1] = cross[i] + d1 * d2;
    }
    let R = 1;
    for (let i = 0; i <= STEPS; i++) R = Math.max(R, Math.abs(W1[i]), Math.abs(W2[i]));
    R *= 1.1;

    {
      const { ctx, w, h } = pathView;
      const px = (i) => (i / STEPS) * w, py = (v) => h / 2 - (v / R) * (h / 2 - 8);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = color('--accent-2');
      polyline(ctx, 0, STEPS, px, (i) => py(W1[i]));
      ctx.strokeStyle = color('--accent-3');
      polyline(ctx, 0, STEPS, px, (i) => py(W2[i]));
      ctx.font = '12px system-ui, sans-serif';
      legend(ctx, [['W₁', '--accent-2'], ['W₂', '--accent-3'], ['both over time', '--muted']], 8, 14, w - 16);
    }

    {
      const { ctx, w, h } = planeView;
      const px = (v) => w / 2 + (v / R) * (w / 2 - 8), py = (v) => h / 2 - (v / R) * (h / 2 - 8);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.moveTo(px(0), 0); ctx.lineTo(px(0), h); ctx.stroke();
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 1.25;
      polyline(ctx, 0, STEPS, (i) => px(W1[i]), (i) => py(W2[i]));
      ctx.fillStyle = color('--accent');
      ctx.beginPath(); ctx.arc(px(W1[STEPS]), py(W2[STEPS]), 4.5, 0, 2 * Math.PI); ctx.fill();
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText('(W₁, W₂) as a path in the plane', 8, 14);
    }

    {
      const { ctx, w, h } = crossView;
      const px = (i) => (i / STEPS) * w, py = (v) => h / 2 - (v / 1.25) * (h / 2 - 10);
      ctx.fillStyle = color('--viz-bg');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
      ctx.strokeStyle = color('--fg');
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(rho)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2;
      polyline(ctx, 0, STEPS, px, (i) => py(cross[i]));
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = color('--muted');
      ctx.fillText('running sum of (rise of W₁) × (rise of W₂); dashed: ρt', 8, 14);
    }

    const prod = W1[STEPS] * W2[STEPS];
    stats.textContent =
      `Sum of (rise of W₁ × rise of W₂) up to t = 1: ${cross[STEPS].toFixed(3)} (theory: ρ = ${rho.toFixed(2)}). ` +
      `Product rule at t = 1: W₁W₂ = ${prod.toFixed(3)}. ∫W₁dW₂ + ∫W₂dW₁ = ${(i12 + i21).toFixed(3)}, ` +
      `plus the extra ρt = ${(i12 + i21 + rho).toFixed(3)}.`;
  }

  rhoIn.addEventListener('input', render);
  resampleBtn.addEventListener('click', () => { seed += 1; simulate(); render(); });
  function layout() {
    pathView = setupCanvas(pathCanvas, 0.6);
    planeView = setupCanvas(planeCanvas, 1);
    crossView = setupCanvas(crossCanvas, 0.28, 150);
    render();
  }
  window.addEventListener('resize', layout);
  revealOnInteract(root);
  simulate();
  layout();
});
