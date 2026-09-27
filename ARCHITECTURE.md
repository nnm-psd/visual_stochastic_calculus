# Information Architecture — Visual Stochastic Calculus

A visual introduction to stochastic calculus, built as explorable explanations. It follows the
structure of [Seeing Theory](https://seeing-theory.brown.edu/): **6 chapters × 3 sections**, one
core interaction per section.

## 1. Structural model (borrowed from Seeing Theory)

Seeing Theory has 6 chapters with 3 sections each. Each section follows the same pattern:
**heading → 2–4 sentences of prose → one formula → one interactive demo → parameter controls**.
A chapter menu links every chapter.

This site keeps that shape exactly. It adds one rule: **each section has a single "aha" to
deliver**. If a section needs two interactions, split it into two sections.

### Section template

| Slot | Content | Constraint |
|---|---|---|
| Heading | Concept name | ≤ 4 words |
| Prose | What to look at and what to try | 2–4 sentences, ends with a prompt ("Drag *n* up and watch…") |
| Formula | The one identity this section proves visually | KaTeX, one line |
| Symbols | Every symbol and piece of notation in the formula, defined in everyday words | Assume no background. No unexplained ⟨ ⟩, ⌊ ⌋, ~, →, N(0,1), "variance", etc. Add a tiny worked example where it helps |
| In plain words | The formula read aloud as a sentence, plus *why* it is true intuitively | 2–4 sentences. Use an everyday comparison where one exists (e.g. car vs particle) |
| Core interaction | Simulation the reader manipulates | Must make the formula *visible* |
| Controls | Sliders, toggles, "resample" button | ≤ 3 controls |
| Takeaway | One sentence, revealed after interaction | States the formula in words. Any named theorem is glossed |
| Predict first | A 3-option question placed right after the first paragraph (`.predict`, handled by `engine.js`) | Must not be answerable from the text above it. Verdict appears once the takeaway is revealed |
| Going deeper | Collapsed `<details class="drawer">`: precise statement, proof sketch, references | Cite book and section, or paper and journal. No unverified claims |
| Show the code | Collapsed drawer: a standalone Python + NumPy script (≤ 25 lines) plus its real output | Every snippet is run before publishing, and the output shown is the actual output |

**Audience:** readers with high-school algebra and no probability background. Jargon is defined
where it first appears, including in the prose above the formula.

## 2. Site map

```
/                         Landing — one live Brownian path, chapter grid
/brownian-motion/         Ch 1  Definition
/variation/               Ch 2  Properties
/ito-integral/            Ch 3  Definition of the integral
/ito-lemma/               Ch 4  The calculus
/sde/                     Ch 5  Dynamics
/applications/            Ch 6  Applications
/diffusion-models/        Ch 7  Diffusion models (generative AI)
/beyond/                  Ch 8  Beyond Brownian motion (jumps, filtering)
/pdf/                     One exported PDF per chapter
/notation/                Generated symbol index
```

The chapter order follows the standard teaching order of Shreve, *Stochastic Calculus for
Finance II*: Brownian motion (ch 3), then stochastic calculus (ch 4), then risk-neutral pricing
(ch 5), then connections with PDEs (ch 6). Each chapter depends only on earlier ones.

## 3. Chapters and core interactions

### Ch 1 — Brownian Motion *(definition)*

| Section | Formula | Core interaction |
|---|---|---|
| Opener: A Jittering Particle *(unnumbered, physical intuition)* | $\langle \Delta x^2 \rangle = 2Dt$ | After [MinuteLabs' Brownian Motion lab](https://labs.minutelabs.io/Brownian-Motion/): a heavy particle takes elastic kicks from 1,600 hidden molecules. Controls: Energy, Mass ratio, Show molecules, Reset. A strip plots the particle's x(t), which is the bridge to 1.1. |
| 1.1 From Random Walk to Brownian Motion | $W^{(n)}_t = \tfrac{1}{\sqrt n} S_{\lfloor nt \rfloor} \to W_t$ | Slider *n* (steps) from 10 to 10⁴. The path rescales live, and a histogram of $W^{(n)}_1$ over 1,000 walks converges to the N(0,1) curve. |
| 1.2 Defining Properties | $W_t - W_s \sim N(0, t-s)$, independent increments | Drag two time intervals A and B across a fan of 500 paths. A scatter of each path's rise over A against its rise over B, with a dashed theoretical 95% ellipse, shows spread equal to interval length and no tilt. **Overlap the intervals and the cloud tilts** (correlation = overlap / $\sqrt{\lvert A\rvert \lvert B\rvert}$), which shows why the definition says *non-overlapping*. |
| 1.3 Rough Paths | $\lvert W_{t+h}-W_t\rvert \sim \sqrt h \gg h$ | Infinite zoom on one path next to a smooth curve. The smooth curve flattens into a line; the Brownian path stays equally rough (self-similarity). **This is where ordinary calculus breaks.** |

### Ch 2 — Variation & Martingales *(properties)*

| Section | Formula | Core interaction |
|---|---|---|
| 2.1 Quadratic Variation | $\sum (\Delta W)^2 \to t$, while $\sum \lvert\Delta W\rvert \to \infty$ | Slider for the partition size *n*. Two running sums are plotted: total variation grows without bound, while quadratic variation locks onto the line $y=t$. A histogram of the QV sum narrows (variance $2t^2/n$). **This is the "$dW^2 = dt$" moment.** |
| 2.2 Martingales | $\mathbb E[W_t \mid \mathcal F_s] = W_s$ | Drag a "freeze" cursor to time *s*, and 100 continuations fan out from $W_s$. Their mean stays flat at $W_s$. Toggle to $W_t^2$ (the fan's mean drifts up) and then $W_t^2 - t$ (flat again). |
| 2.3 Reflection Principle | $P(\max_{s\le t} W_s \ge a) = 2P(W_t \ge a)$ | Drag the level *a*. Once a path first hits *a*, a reflected copy is drawn. A counter compares the empirical probability of the maximum with $2P(W_t \ge a)$. |

### Ch 3 — The Itô Integral *(definition)*

| Section | Formula | Core interaction |
|---|---|---|
| 3.1 Where You Evaluate Matters | $\sum W_{t_i^\theta}\Delta W_i \to \tfrac12 W_t^2 + (\theta-\tfrac12)t$ | Slider θ ∈ [0,1] sets the evaluation point inside each interval (the rectangles move on the chart). The limit changes with θ. θ = 0 gives Itô, θ = ½ gives Stratonovich. **This is why a convention is needed.** |
| 3.2 Building the Integral | $\int_0^t H_s\,dW_s = \lim \sum H_{t_i}(W_{t_{i+1}}-W_{t_i})$ | "Betting" view: the reader paints a step integrand *H* (position size) that may only use past information. The gains process is drawn as a running sum. Refining the steps approaches the Itô integral. |
| 3.3 Itô Isometry | $\mathbb E\big[(\int H\,dW)^2\big] = \mathbb E\int H^2\,dt$ | Pick *H* from a preset list ($1$, $W_s$, $\operatorname{sign}W_s$). Monte Carlo estimates of both sides converge together as the path count grows. A mean-zero readout shows the martingale property. |

### Ch 4 — Itô's Lemma *(the calculus)*

| Section | Formula | Core interaction |
|---|---|---|
| 4.1 The Surviving Second-Order Term | $df = f'\,dW + \tfrac12 f''\,dW^2 + \dots$ | A stacked bar chart of the Taylor-term contributions summed over a path. As *n* grows, the $\tfrac12 f''(\Delta W)^2$ bar converges to a nonzero value while the higher-order bars vanish. |
| 4.2 Itô's Lemma in Action | $df(W_t) = f'(W_t)\,dW_t + \tfrac12 f''(W_t)\,dt$ | Choose *f* ($x^2$, $e^x$, $\sin x$). Three curves are drawn on one path: the true $f(W_t)$, the Itô reconstruction (it overlaps), and the naive chain rule (the drift gap grows visibly). |
| 4.3 Itô vs Stratonovich | $X\circ dW = X\,dW + \tfrac12\,d\langle X,W\rangle$ | The same noise drives $dX = X\circ dW$ and $dX = X\,dW$ side by side. A toggle adds the conversion drift, and the two paths coincide. |
| 4.4 Two Brownian Motions | $dW^{(1)}dW^{(2)} = \rho\,dt$, $d(XY) = X\,dY + Y\,dX + dX\,dY$ | A ρ slider mixes two Brownian motions. Panels show both paths, the pair in the plane, and the running cross-variation settling on ρt. The stats check the Itô product rule. |

### Ch 5 — Stochastic Differential Equations *(dynamics)*

| Section | Formula | Core interaction |
|---|---|---|
| 5.1 Euler–Maruyama | $X_{k+1} = X_k + \mu\,\Delta t + \sigma\,\Delta W_k$ | Slider for the step size. The numerical GBM path is compared with the exact solution *driven by the same Brownian path*. A log-log error plot shows strong order ½. |
| 5.2 A Zoo of Diffusions | GBM, OU $dX=\theta(\mu-X)dt+\sigma dW$, CIR | A model picker plus parameter sliders. The chart shows a fan of paths with the evolving marginal density overlaid, together with analytic markers (OU stationary variance $\sigma^2/2\theta$; the CIR Feller condition $2\kappa\theta \ge \sigma^2$ lights up when violated). |
| 5.3 Paths ↔ Densities (Fokker–Planck) | $\partial_t p = -\partial_x(\mu p) + \tfrac12\partial_{xx}(\sigma^2 p)$ | A particle cloud evolves on the left. On the right, a histogram of the cloud tracks the numerically solved PDE density. Scrubbing time moves both. **This bridges the probability view and the PDE view.** |

### Ch 6 — Applications

| Section | Formula | Core interaction |
|---|---|---|
| 6.1 Black–Scholes by Hedging | $dV = \Delta\,dS$ (replication) | Delta-hedge a call along simulated GBM paths. A slider sets the rebalance frequency, and the P&L histogram shrinks toward 0 (std ∝ $1/\sqrt N$). The hedge cost converges to the Black–Scholes price. |
| 6.2 Change of Measure (Girsanov) | $\tfrac{dQ}{dP} = e^{-\lambda W_T - \frac12\lambda^2 T}$ | Paths with drift λ are colored by their Radon–Nikodym weight. Toggle "reweight": the weighted mean path goes flat, so the drift is removed. **This is risk-neutral pricing, visually.** |
| 6.3 Feynman–Kac | $u(t,x) = \mathbb E[g(X_T)\mid X_t = x]$ | Click any point (t, x) on the PDE solution heatmap. Paths launch from it, and the running average of $g(X_T)$ converges to the heatmap value at that point. |

### Ch 7 — Diffusion Models *(generative AI)*

The data is a known two-bump Gaussian mixture, so the score is exact (`assets/js/diffusion-common.js`).
A real model learns the score with a neural network, and the page says so.

| Section | Formula | Core interaction |
|---|---|---|
| 7.1 Forward: Data to Noise | $dX = -X\,dt + \sqrt2\,dW$, $X_t = e^{-t}X_0 + \sqrt{1-e^{-2t}}Z$ | Scrub time as 3,000 samples are noised. The histogram melts from two bumps into N(0, 1), with a "distance from pure noise" readout. |
| 7.2 The Score | $s(t,x) = \partial_x \log p(t,x)$ | A noise-level slider. The density is on top; the score curve and arrows below point toward "more likely". |
| 7.3 Noise to Data | $dX = [-X - 2s(t,X)]\,dt + \sqrt2\,d\overline W$ (backward in time) | Run 3,000 noise samples backward with the reverse SDE, the probability-flow ODE, or the SDE without the score (which fails). The histogram is compared with the data. |

| 7.4 Langevin Sampling | $dX = s(X)\,dt + \sqrt2\,dW \Rightarrow X_t \sim \pi$ | Particles start in one bump or spread out; scrub time. Shapes settle fast, proportions don't: only a handful ever cross the valley (metastability), which is why diffusion models anneal the noise. |

### Ch 8 — Beyond Brownian Motion *(extensions)*

| Section | Formula | Core interaction |
|---|---|---|
| 8.1 Jumps | $X_t = \sigma W_t + \sum_{k \le N_t} J_k$, $[X]_t = \sigma^2 t + \sum J_k^2$ | Jump rate and share-of-variance sliders at fixed total variance; a log-scale histogram shows fat tails (kurtosis $3 + 3s^2/\lambda$). |
| 8.2 The Kalman–Bucy Filter | $dm = -\theta m\,dt + \tfrac{P}{r^2}(dY - m\,dt)$, Riccati for $P$ | Measurement-noise slider: hidden OU signal, noisy readings, the estimate with its ±2√P band (about 95% coverage). |

## 4. Cross-cutting design decisions

| Decision | Choice | Why |
|---|---|---|
| Rendering | Canvas 2D; add D3.js only when a section needs real axes or scales | Seeing Theory uses D3. So far Canvas plus about 40 lines of pointer-event code (1.2 interval dragging) has covered every need with no dependency. |
| Scripts | Classic `<script>` files sharing a `Stoch` global (`assets/js/engine.js`) | Pages open straight from `file://` with no build step. ES modules would need a server. |
| Accessibility | Every drag or click interaction also works from the keyboard (canvas `tabindex=0`, arrow keys), with the keys named in the caption | Pointer-only charts shut out keyboard users |
| Notation index | `notation/index.html` is generated from the glossaries by `python tools/build_notation.py` | One lookup page without hand-maintaining a copy. Re-run after editing any glossary |
| Continuous checks | GitHub Actions runs `tools/check_snippets.py` (snippet output vs published, ±1.5 in the last printed digit, NumPy pinned), `tools/check_pages.py` (headless Chrome: no console output, KaTeX rendered, links resolve) and a notation-freshness diff | Stops a future edit from silently breaking a chart or leaving a published result out of date |
| Loading | Each section script is wrapped in `Stoch.lazy(id, …)` and runs only when the section is within 600 px of the viewport; `?all` / `?print` run everything at once | Chapter pages became usable in 0.4–0.7 s instead of 1.5–3.5 s on an emulated phone (4× CPU slowdown) |
| Phones | Charts have a minimum height (`setupCanvas(canvas, aspect, minHeight)`), legends wrap (`Stoch.legend`), wide formulas scroll inside their own box with edge shadows | Tested by emulating a 390 px phone with touch through the DevTools protocol (not a physical device) |
| Learning aids | Progress per section in `localStorage` (`assets/js/progress.js`, whose chapter list CI checks against the pages), an end-of-chapter recap quiz, and per-chapter PDFs from `tools/build_pdfs.py` | Lets readers track and revisit what they have done; PDFs for offline study |
| Screen readers | Every stats line and prediction/quiz verdict is an `aria-live="polite"` region | Updated numbers are announced, not silently replaced |
| Run it here | `assets/js/runner.js` turns each code drawer into an editor with Run/Stop/Reset; Pyodide 0.26.4 (NumPy 1.26.4, the pinned version) runs in a Web Worker, loaded only on first Run | Readers can change and re-run every program; unedited runs report whether they match the published output (all 26 did) |
| Trust | About page (author, AI assistance, how content is checked, privacy), footer on every page, `LICENSE` (MIT, code) + `LICENSE-CONTENT.md` (CC BY 4.0, text/figures), `CITATION.cff`, GitHub issue form for error reports | What a lecturer or student looks for before relying on a site |
| Sharing | Each page has a description, canonical URL, Open Graph and Twitter card tags; `assets/og-image.png` (1200×630) and favicons; `sitemap.xml` | Links pasted into chat or social apps show a proper preview card |
| Math | KaTeX | Fast and static. The Wilmott QF deck uses the same. |
| Randomness | Seeded RNG per section (`Stoch.rng`), with Resample buttons that bump the seed | Reproducible screenshots and tests. Same-noise comparisons (4.3, 5.1, 5.2, 7.3) reuse one random stream. (A single hero path shared across sections was planned but not built.) |
| Architecture | Static site, one page per chapter, no backend | All simulation is client-side. It is cheap to host (GitHub Pages) and matches Seeing Theory. |
| Controls budget | ≤ 3 per section | Keeps each section to one idea. Seeing Theory uses 1–2. |

## 5. Build order (MVP first)

**Status:** All 8 chapters (25 sections + the Ch 1 opener) are built: `brownian-motion/`,
`variation/`, `ito-integral/`, `ito-lemma/` (incl. 4.4), `sde/`, `applications/`, `diffusion-models/` (incl. 7.4), `beyond/`. Pages link with a prev/next
chapter nav. Shared helpers live in `assets/js/engine.js`; each section has its own script. The 1.3 zoom uses the Lévy (Brownian-bridge)
construction in `engine.js` (`levyPath`), which gives one consistent path at any zoom up to ×10⁶.

1. **MVP (Ch 1–4, 12 sections):** the definition → properties → integral → lemma arc. These
   carry the "aha" moments (1.3, 2.1, 3.1, 4.2) that no existing site covers together.
2. **v1 (Ch 5):** SDEs, which reuse the Ch 1 path engine.
3. **v2 (Ch 6):** Applications, which reuse the Ch 5 solvers.

Shared engine to build first: seeded Gaussian RNG → Brownian path generator (with refinement
and Brownian-bridge subdivision for the 1.3 zoom and the 2.1 partitions) → path-fan renderer →
histogram and density overlay.
