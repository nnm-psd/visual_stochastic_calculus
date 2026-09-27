/* Light / dark theme switch. The page follows the operating system's setting until the reader
   presses the header button; their choice is then stored and applied on every page (an inline
   snippet in each <head> applies it before first paint). Charts are canvases that read colors
   when drawn, so a resize event is dispatched to make every section redraw in the new colors. */
(function () {
  'use strict';
  const root = document.documentElement;
  const osDark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (osDark.matches ? 'dark' : 'light');

  function label(button) {
    const next = current() === 'dark' ? 'light' : 'dark';
    button.textContent = next === 'dark' ? 'Dark mode' : 'Light mode';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
  }

  function redraw() { window.dispatchEvent(new Event('resize')); }

  document.querySelectorAll('.theme-toggle').forEach((button) => {
    label(button);
    button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable: choice lasts for this page only */ }
      document.querySelectorAll('.theme-toggle').forEach(label);
      redraw();
    });
  });

  // If the reader has not chosen, follow the operating system when it changes.
  osDark.addEventListener('change', () => {
    if (root.dataset.theme) return;
    document.querySelectorAll('.theme-toggle').forEach(label);
    redraw();
  });
})();
