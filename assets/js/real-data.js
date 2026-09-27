/* Section 11.3 — Models Meet Data.
   Real daily data from FRED (public domain): the EUR/USD exchange rate and the 10-year US Treasury
   yield. For EUR/USD the log returns are tested against the GBM assumptions (a log-scale histogram
   against the normal curve, and autocorrelations of returns and of their sizes). For the yield, an
   Ornstein–Uhlenbeck (Vasicek) model is fitted by regression over the chosen years. */
Stoch.lazy('data', function () {
  'use strict';
  const { setupCanvas, color, polyline, normalPdf, revealOnInteract, legend } = Stoch;

  const root = document.getElementById('data');
  const canvas = root.querySelector('.rd-canvas');
  const fromIn = root.querySelector('input[name=from]');
  const toIn = root.querySelector('input[name=to]');
  const stats = root.querySelector('.rd-stats');

  const series = {};
  for (const [key, s] of Object.entries(FRED)) {
    const [y0, m0, d0] = s.start.split('-').map(Number), t0 = Date.UTC(y0, m0 - 1, d0);
    series[key] = { years: s.day.map((d) => new Date(t0 + d * 86400000).getUTCFullYear() + new Date(t0 + d * 86400000).getUTCMonth() / 12), value: s.value };
  }
  let view;

  const moments = (x) => { let m = 0; for (const v of x) m += v / x.length; let s2 = 0; for (const v of x) s2 += (v - m) ** 2; return { m, sd: Math.sqrt(s2 / (x.length - 1)) }; };
  const autocorr = (x, lag) => { const { m } = moments(x); let num = 0, den = 0; for (let i = 0; i < x.length; i++) { den += (x[i] - m) ** 2; if (i + lag < x.length) num += (x[i] - m) * (x[i + lag] - m); } return num / den; };

  function window_(key) {
    const lo = +fromIn.value, hi = +toIn.value + 1, s = series[key], idx = [];
    for (let i = 0; i < s.years.length; i++) if (s.years[i] >= lo && s.years[i] < hi) idx.push(i);
    return { years: idx.map((i) => s.years[i]), value: idx.map((i) => s.value[i]) };
  }

  function renderFx(ctx, w, h) {
    const { value } = window_('DEXUSEU');
    const r = []; for (let i = 1; i < value.length; i++) r.push(Math.log(value[i] / value[i - 1]));
    const { m, sd } = moments(r), z = r.map((x) => (x - m) / sd);
    let k4 = 0, beyond = 0; for (const v of z) { k4 += v ** 4 / z.length; if (Math.abs(v) > 4) beyond++; }
    const split = w * 0.5;
    // Left: log-scale histogram of standardized returns vs N(0, 1).
    const R = 6, bins = 48, bw = (2 * R) / bins, counts = new Float64Array(bins);
    for (const v of z) { const b = Math.floor((v + R) / bw); if (b >= 0 && b < bins) counts[b]++; }
    const LOG0 = -4.5, qx = (v) => 10 + ((v + R) / (2 * R)) * (split - 20), qy = (d) => h - 20 - ((Math.max(Math.log10(d), LOG0) - LOG0) / -LOG0) * (h - 46);
    ctx.fillStyle = color('--accent-2'); ctx.globalAlpha = 0.75;
    counts.forEach((c, b) => { if (c) { const d = c / (z.length * bw); ctx.fillRect(qx(-R + b * bw) + 0.5, qy(d), (split - 20) / bins - 1, h - 20 - qy(d)); } });
    ctx.globalAlpha = 1; ctx.strokeStyle = color('--fg'); ctx.lineWidth = 1.5;
    polyline(ctx, 0, 200, (i) => qx(-R + (i / 200) * 2 * R), (i) => qy(normalPdf(-R + (i / 200) * 2 * R)));
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const v of [-6, -3, 0, 3, 6]) ctx.fillText(String(v), qx(v) - 4, h - 6);
    legend(ctx, [['daily returns in sd units (log scale)', '--accent-2'], ['normal', '--fg']], 10, 14, split - 20);
    // Right: autocorrelation of returns and of |returns|.
    const LAGS = 40, x0 = split + 10, x1 = w - 10, band = 2 / Math.sqrt(r.length), absr = r.map(Math.abs);
    const acR = [], acA = []; for (let L = 1; L <= LAGS; L++) { acR.push(autocorr(r, L)); acA.push(autocorr(absr, L)); }
    const top = Math.max(0.3, ...acA) + 0.02, lx = (L) => x0 + ((L - 0.5) / LAGS) * (x1 - x0), ly = (v) => h / 2 + 10 - (v / top) * (h / 2 - 30);
    ctx.strokeStyle = color('--border'); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.moveTo(x0, ly(0)); ctx.lineTo(x1, ly(0)); ctx.stroke();
    ctx.fillStyle = color('--viz-bg'); ctx.strokeStyle = color('--muted'); ctx.setLineDash([3, 3]);
    for (const v of [band, -band]) { ctx.beginPath(); ctx.moveTo(x0, ly(v)); ctx.lineTo(x1, ly(v)); ctx.stroke(); }
    ctx.setLineDash([]);
    const bwid = (x1 - x0) / LAGS / 2.4;
    for (let L = 1; L <= LAGS; L++) {
      ctx.fillStyle = color('--faint'); ctx.fillRect(lx(L) - bwid, Math.min(ly(0), ly(acR[L - 1])), bwid, Math.abs(ly(acR[L - 1]) - ly(0)));
      ctx.fillStyle = color('--accent'); ctx.fillRect(lx(L), Math.min(ly(0), ly(acA[L - 1])), bwid, Math.abs(ly(acA[L - 1]) - ly(0)));
    }
    ctx.fillStyle = color('--muted'); ctx.fillText('lag 1', lx(1) - 8, h - 6); ctx.fillText('40 days', x1 - 44, h - 6);
    legend(ctx, [['autocorrelation of returns', '--muted'], ['of their sizes |r|', '--accent'], ['dashed: noise band', '--muted']], x0, 14, x1 - x0);
    return `EUR/USD, ${+fromIn.value}–${+toIn.value}, ${r.length.toLocaleString()} days: volatility ${(sd * Math.sqrt(252) * 100).toFixed(1)}% a year, kurtosis ${k4.toFixed(2)} (normal: 3). ` +
      `Moves beyond 4 standard deviations: ${(beyond / z.length * 100).toFixed(3)}% of days (normal: 0.006%). ` +
      `Autocorrelation at lag 1: returns ${acR[0].toFixed(3)}, sizes ${acA[0].toFixed(3)}; sizes at lag 20: ${acA[19].toFixed(3)}.`;
  }

  function renderYield(ctx, w, h) {
    const { years, value } = window_('DGS10'), y = value.map((v) => v / 100), dt = 1 / 252;
    // OU fit by regression y_{t+1} = α + β y_t + ε  →  a = −ln β / dt, mean = α/(1 − β).
    let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = y.length - 1;
    for (let i = 0; i < n; i++) { sx += y[i]; sy += y[i + 1]; sxx += y[i] * y[i]; sxy += y[i] * y[i + 1]; }
    const beta = (n * sxy - sx * sy) / (n * sxx - sx * sx), alpha = (sy - beta * sx) / n;
    let rss = 0; for (let i = 0; i < n; i++) rss += (y[i + 1] - alpha - beta * y[i]) ** 2;
    const a = -Math.log(beta) / dt, mean = alpha / (1 - beta), sigma = Math.sqrt(rss / (n - 2)) * Math.sqrt((2 * a) / (1 - beta * beta));
    const statSd = sigma / Math.sqrt(2 * a);
    const lo = Math.min(...y, mean - 2 * statSd) - 0.005, hi = Math.max(...y, mean + 2 * statSd) + 0.005;
    const px = (t) => 36 + ((t - years[0]) / (years[years.length - 1] - years[0] || 1)) * (w - 46), py = (v) => h - 20 - ((v - lo) / (hi - lo)) * (h - 46);
    ctx.fillStyle = color('--accent'); ctx.globalAlpha = 0.12;
    if (Number.isFinite(statSd)) ctx.fillRect(36, py(mean + 2 * statSd), w - 46, py(mean - 2 * statSd) - py(mean + 2 * statSd));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color('--accent-2'); ctx.lineWidth = 1.25;
    polyline(ctx, 0, y.length - 1, (i) => px(years[i]), (i) => py(y[i]));
    ctx.strokeStyle = color('--accent'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    if (Number.isFinite(mean)) { ctx.beginPath(); ctx.moveTo(36, py(mean)); ctx.lineTo(w - 10, py(mean)); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = color('--muted');
    for (const v of [lo + 0.005, (lo + hi) / 2, hi - 0.005]) ctx.fillText(`${(v * 100).toFixed(1)}%`, 2, py(v) + 4);
    ctx.fillText(String(+fromIn.value), 36, h - 6); ctx.fillText(String(+toIn.value), w - 42, h - 6);
    legend(ctx, [['10-year Treasury yield', '--accent-2'], ['fitted long-run mean ± 2 sd', '--accent']], 36, 14, w - 46);
    const stable = beta < 1 && a > 0;
    return `10-year yield, ${+fromIn.value}–${+toIn.value}: fitted mean-reversion speed ${a.toFixed(2)} a year (half-life ${stable ? (Math.log(2) / a).toFixed(1) + ' years' : 'none: no mean reversion detected'}), ` +
      `long-run mean ${(mean * 100).toFixed(2)}%, volatility ${(sigma * 100).toFixed(2)} points a year. Change the years and watch how much these "constants" move.`;
  }

  function render() {
    const key = root.querySelector('input[name=dataset]:checked').value;
    const minYear = key === 'fx' ? 1999 : 1990;
    fromIn.min = minYear;
    if (+fromIn.value < minYear) fromIn.value = minYear;
    if (+toIn.value <= +fromIn.value) toIn.value = Math.min(2025, +fromIn.value + 1);
    fromIn.nextElementSibling.value = fromIn.value; toIn.nextElementSibling.value = toIn.value;
    const { ctx, w, h } = view;
    ctx.fillStyle = color('--viz-bg'); ctx.fillRect(0, 0, w, h);
    stats.textContent = key === 'fx' ? renderFx(ctx, w, h) : renderYield(ctx, w, h);
  }

  [fromIn, toIn].forEach((el) => el.addEventListener('input', render));
  root.querySelectorAll('input[name=dataset]').forEach((r) => r.addEventListener('change', render));
  window.addEventListener('resize', () => { view = setupCanvas(canvas, 0.5, 260); render(); });
  revealOnInteract(root);
  view = setupCanvas(canvas, 0.5, 260);
  render();
});
