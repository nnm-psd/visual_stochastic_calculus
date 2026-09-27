/* Interview practice: mark questions as solved (kept in this browser only), see how many remain, and
   jump to a random unsolved question for timed practice. */
(function () {
  'use strict';
  const KEY = 'solved';
  const boxes = [...document.querySelectorAll('.question input[type=checkbox][data-q]')];
  const count = document.querySelector('.solved-count');

  const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) { /* storage unavailable */ } };

  function update() {
    const solved = boxes.filter((b) => b.checked).length;
    count.textContent = `${solved} of ${boxes.length} solved`;
    boxes.forEach((b) => b.closest('.question').classList.toggle('is-solved', b.checked));
  }

  const done = load();
  boxes.forEach((b) => {
    b.checked = done.has(b.dataset.q);
    b.addEventListener('change', () => {
      const s = load();
      if (b.checked) s.add(b.dataset.q); else s.delete(b.dataset.q);
      save(s);
      update();
    });
  });

  document.querySelector('.practice-bar .random').addEventListener('click', () => {
    const open = boxes.filter((b) => !b.checked);
    if (!open.length) { count.textContent = `All ${boxes.length} solved. Reset to practise again.`; return; }
    const q = open[Math.floor(Math.random() * open.length)].closest('.question');
    q.querySelectorAll('details').forEach((d) => { d.open = false; });
    q.scrollIntoView({ behavior: 'smooth', block: 'start' });
    q.classList.add('flash');
    setTimeout(() => q.classList.remove('flash'), 1600);
  });
  document.querySelector('.practice-bar .reset-solved').addEventListener('click', () => {
    save(new Set());
    boxes.forEach((b) => { b.checked = false; });
    update();
  });
  update();
})();
