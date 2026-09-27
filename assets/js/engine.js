/* Shared simulation engine: seeded RNG, random-walk paths, canvas helpers.
   Classic script (no modules) so pages open straight from file:// with no build step. */
(function (global) {
  'use strict';

  // mulberry32: small, fast, seedable PRNG returning floats in [0, 1).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Standard normal draw via Box–Muller.
  function gaussian(rand) {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  // Rescaled simple random walk W^(n)_{i/n} = S_i / sqrt(n), i = 0..n.
  function scaledWalk(n, rand) {
    const w = new Float64Array(n + 1);
    const step = 1 / Math.sqrt(n);
    for (let i = 1; i <= n; i++) w[i] = w[i - 1] + (rand() < 0.5 ? -step : step);
    return w;
  }

  // Endpoint S_n / sqrt(n) only, without storing the path.
  function scaledWalkEnd(n, rand) {
    let s = 0;
    for (let i = 0; i < n; i++) s += rand() < 0.5 ? -1 : 1;
    return s / Math.sqrt(n);
  }

  // Brownian path on [0, 1] sampled at `steps` equal intervals: independent N(0, 1/steps) increments.
  function brownianPath(steps, rand) {
    const w = new Float64Array(steps + 1);
    const sd = Math.sqrt(1 / steps);
    for (let i = 1; i <= steps; i++) w[i] = w[i - 1] + sd * gaussian(rand);
    return w;
  }

  // Deterministic standard normal for node (level, index) of a dyadic tree.
  function hashGaussian(seed, level, index) {
    const hi = Math.floor(index / 4294967296), lo = index >>> 0;
    let h = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(level + 2, 0xC2B2AE35);
    h = Math.imul(h ^ lo, 0x27D4EB2F); h ^= h >>> 15;
    h = Math.imul(h ^ hi, 0x165667B1); h ^= h >>> 13;
    return gaussian(rng(h));
  }

  // Lévy construction of a Brownian path on [0, 1]: W_1 ~ N(0, 1), and the midpoint of every
  // dyadic interval of length d is (left + right)/2 + N(0, d/4) (the Brownian-bridge rule).
  // Every node is seeded by its position, so any window can be sampled at any zoom and always
  // shows the same path. sample(a, b, level) returns the values at the points k/2^level in [a, b].
  function levyPath(seed) {
    const w1 = hashGaussian(seed, -1, 0);
    return function sample(a, b, level) {
      const ts = [], ws = [];
      (function fill(lv, i, wl, wr) {
        const d = Math.pow(2, -lv), l = i * d, r = l + d;
        if (r < a || l > b) return;
        if (lv === level) {
          if (l >= a) { ts.push(l); ws.push(wl); }
          if (r > b || r === 1) { ts.push(r); ws.push(wr); }
          return;
        }
        const mid = (wl + wr) / 2 + Math.sqrt(d / 4) * hashGaussian(seed, lv, i);
        fill(lv + 1, 2 * i, wl, mid);
        fill(lv + 1, 2 * i + 1, mid, wr);
      })(0, 0, 0, w1);
      return { ts, ws };
    };
  }

  function normalPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // P(Z <= x) for a standard normal Z. Abramowitz & Stegun 7.1.26 erf approximation, |error| < 1.5e-7.
  function normalCdf(x) {
    const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - poly * Math.exp(-z * z);
    return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  }

  // Size a canvas to its CSS width (height = width * aspect) at device pixel ratio.
  function setupCanvas(canvas, aspect) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = Math.round(w * aspect);
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // Read a color token from :root so canvases follow the light/dark theme.
  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Stroke a polyline through points i = from..to, mapped by xAt(i) and yAt(i).
  function polyline(ctx, from, to, xAt, yAt) {
    ctx.beginPath();
    for (let i = from; i <= to; i++) (i > from ? ctx.lineTo(xAt(i), yAt(i)) : ctx.moveTo(xAt(i), yAt(i)));
    ctx.stroke();
  }

  // Density histogram of `values` on [lo, hi] with `bins` equal bins (values outside are dropped).
  function histogram(values, lo, hi, bins) {
    const counts = new Float64Array(bins), bw = (hi - lo) / bins;
    for (const v of values) {
      const b = Math.floor((v - lo) / bw);
      if (b >= 0 && b < bins) counts[b]++;
    }
    return { bw, density: counts.map((c) => c / (values.length * bw)) };
  }

  // Unhide a section's .takeaway after the reader's first interaction with its controls or charts.
  function revealOnInteract(root) {
    const show = () => { root.querySelector('.takeaway').hidden = false; };
    root.querySelector('.controls').addEventListener('input', show);
    root.querySelector('.controls').addEventListener('click', show);
    root.querySelectorAll('canvas').forEach((c) => c.addEventListener('pointerdown', show));
  }

  // "Predict first" blocks: <div class="predict" data-answer="b"> with option buttons carrying
  // data-choice, and a .predict-result paragraph. The verdict waits until the section's takeaway is
  // revealed (the reader has tried the chart), or shows at once if it already is.
  function initPredictions() {
    document.querySelectorAll('.predict').forEach((box) => {
      const section = box.closest('section'), takeaway = section.querySelector('.takeaway');
      const result = box.querySelector('.predict-result'), buttons = box.querySelectorAll('.predict-options button');
      let choice = null;
      const verdict = () => {
        const right = choice === box.dataset.answer;
        const correct = box.querySelector(`[data-choice="${box.dataset.answer}"]`).textContent;
        result.innerHTML = right
          ? `<strong>You predicted it.</strong> ${box.dataset.explain}`
          : `<strong>Not quite:</strong> the answer is "${correct}". ${box.dataset.explain}`;
      };
      buttons.forEach((b) => b.addEventListener('click', () => {
        choice = b.dataset.choice;
        buttons.forEach((x) => { x.disabled = true; x.classList.toggle('chosen', x === b); });
        result.hidden = false;
        if (takeaway.hidden) result.textContent = 'Noted. Now try the chart below and see if you were right.';
        else verdict();
      }));
      new MutationObserver(() => { if (!takeaway.hidden && choice) verdict(); })
        .observe(takeaway, { attributes: true, attributeFilter: ['hidden'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPredictions);
  else initPredictions();

  global.Stoch = {
    polyline, histogram, revealOnInteract, rng, gaussian, scaledWalk, scaledWalkEnd, brownianPath, levyPath, normalPdf, normalCdf, setupCanvas, color };
})(window);
