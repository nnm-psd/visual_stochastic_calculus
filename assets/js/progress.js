/* Reading progress, kept in this browser only (localStorage). A section counts as done once its
   "Predict first" verdict has been shown, i.e. the reader predicted and then tried the chart.
   Chapter pages mark finished sections with a check; the home page shows progress per chapter.
   CHAPTERS must list every section id: tools/check_pages.py fails if a page and this list disagree. */
(function (global) {
  'use strict';
  const CHAPTERS = {
    'brownian-motion': ['particle', 'random-walk', 'increments', 'rough'],
    'variation': ['qv', 'martingale', 'reflection'],
    'ito-integral': ['eval-point', 'betting', 'isometry'],
    'ito-lemma': ['taylor', 'lemma', 'strat', 'correlated'],
    'sde': ['euler', 'zoo', 'fp'],
    'applications': ['hedge', 'girsanov', 'fk'],
    'diffusion-models': ['forward', 'score', 'reverse', 'langevin'],
    'beyond': ['jumps', 'kalman'],
    'pricing': ['mc', 'greeks', 'barrier', 'american'],
    'volatility': ['implied', 'heston', 'varswap'],
    'rates': ['shortrate', 'merton', 'data'],
  };
  const KEY = 'progress';

  function load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function save(set) {
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (e) { /* storage unavailable */ }
  }

  function markHeading(id) {
    const h2 = document.querySelector(`section#${id} > h2`);
    if (h2 && !h2.querySelector('.done')) h2.insertAdjacentHTML('beforeend', ' <span class="done" title="You finished this section">✓ done</span>');
  }

  function mark(id) {
    const done = load();
    if (done.has(id)) return;
    done.add(id);
    save(done);
    markHeading(id);
  }

  function renderHome() {
    const done = load();
    let total = 0, finished = 0;
    document.querySelectorAll('.chapters li[data-chapter]').forEach((li) => {
      const ids = CHAPTERS[li.dataset.chapter] || [];
      const k = ids.filter((id) => done.has(id)).length;
      total += ids.length; finished += k;
      let bar = li.querySelector('.progress');
      if (!bar) { li.insertAdjacentHTML('beforeend', '<span class="progress"><span class="bar"><span></span></span><span class="count"></span></span>'); bar = li.querySelector('.progress'); }
      bar.querySelector('.bar > span').style.width = `${(100 * k) / ids.length}%`;
      bar.querySelector('.count').textContent = `${k} of ${ids.length} sections`;
    });
    const summary = document.querySelector('.progress-summary');
    if (summary) {
      summary.querySelector('.text').textContent = finished
        ? `You have finished ${finished} of ${total} sections.`
        : `${total} sections. Answer a section's "Predict first" question and try its chart to tick it off.`;
      summary.querySelector('button').hidden = !finished;
    }
  }

  function reset() { save(new Set()); document.querySelectorAll('h2 .done').forEach((d) => d.remove()); renderHome(); }

  load().forEach(markHeading);
  renderHome();
  const resetBtn = document.querySelector('.progress-summary button');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  global.Progress = { CHAPTERS, mark, reset };
})(window);
