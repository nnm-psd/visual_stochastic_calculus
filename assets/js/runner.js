/* "Run it here": every "Show the code" snippet can be edited and run in the browser with Pyodide
   (Python and NumPy compiled to WebAssembly). Python runs in a Web Worker so the page stays
   responsive, and Stop simply terminates the worker. Pyodide 0.26.4 ships NumPy 1.26.4, the version
   the published outputs were produced with, so an unedited snippet should reproduce them. Nothing is
   downloaded until the reader presses Run (about 10 MB the first time, then cached by the browser). */
(function () {
  'use strict';
  if (/[?&]print\b/.test(location.search)) return;  // printed pages keep the static code

  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const WORKER_SRC = `
    importScripts('${PYODIDE}pyodide.js');
    let ready = null;
    self.onmessage = async (e) => {
      const { id, code } = e.data;
      try {
        if (!ready) ready = loadPyodide({ indexURL: '${PYODIDE}' }).then(async (py) => { await py.loadPackage('numpy'); return py; });
        const py = await ready;
        self.postMessage({ id, type: 'status', text: 'Running…' });
        py.setStdout({ batched: (s) => self.postMessage({ id, type: 'out', text: s }) });
        py.setStderr({ batched: (s) => self.postMessage({ id, type: 'out', text: s }) });
        const scope = py.globals.get('dict')();
        const t0 = performance.now();
        try { await py.runPythonAsync(code, { globals: scope }); } finally { scope.destroy(); }
        self.postMessage({ id, type: 'done', ms: performance.now() - t0 });
      } catch (err) {
        self.postMessage({ id, type: 'error', text: String(err.message || err) });
      }
    };`;

  let worker = null, nextId = 0, booted = false;
  const handlers = new Map();

  function getWorker() {
    if (!worker) {
      const w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
      // A stopped worker can still deliver a late event; only the current worker may report.
      w.onmessage = (e) => { if (w !== worker) return; const h = handlers.get(e.data.id); if (h) h(e.data); };
      w.onerror = (e) => {
        e.preventDefault();
        if (w !== worker) return;
        handlers.forEach((h) => h({ type: 'error', text: e.message || 'Python could not be loaded.' }));
      };
      worker = w;
    }
    return worker;
  }

  function stopAll() {
    if (worker) worker.terminate();
    worker = null;
    booted = false;
    handlers.forEach((h) => h({ type: 'error', text: 'Stopped.' }));
    handlers.clear();
  }

  // Same rule as tools/check_snippets.py: equal text, numbers equal up to the last printed digit.
  const NUMBER = /[-+]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?/g;
  function sameOutput(expected, actual) {
    if (expected.replace(NUMBER, '#') !== actual.replace(NUMBER, '#')) return false;
    const e = expected.match(NUMBER) || [], a = actual.match(NUMBER) || [];
    return e.every((x, i) => {
      const decimals = x.split('e')[0].includes('.') ? x.split('e')[0].split('.')[1].length : 0;
      return Math.abs(parseFloat(x.replace(/,/g, '')) - parseFloat(a[i].replace(/,/g, ''))) <= 1.5 * 10 ** -decimals + 1e-12;
    });
  }

  function enhance(drawer) {
    const [codePre, publishedPre] = drawer.querySelectorAll('pre');
    const original = codePre.textContent;
    const published = publishedPre ? publishedPre.textContent.trim() : '';

    const editor = document.createElement('textarea');
    editor.className = 'code-edit';
    editor.value = original;
    editor.spellcheck = false;
    editor.wrap = 'off';
    editor.rows = original.split('\n').length + 1;
    editor.setAttribute('aria-label', 'Python code (editable)');
    codePre.replaceWith(editor);

    const bar = document.createElement('div');
    bar.className = 'runbar';
    bar.innerHTML = '<button type="button" class="run">Run in browser</button>' +
      '<button type="button" class="reset-code">Reset code</button>' +
      '<button type="button" class="stop" hidden>Stop</button>' +
      '<span class="run-status" aria-live="polite"></span>';
    const label = document.createElement('p');
    label.className = 'ref';
    label.textContent = 'Output of your run:';
    label.hidden = true;
    const out = document.createElement('pre');
    out.className = 'run-output';
    out.hidden = true;
    editor.after(bar, label, out);

    const runBtn = bar.querySelector('.run'), stopBtn = bar.querySelector('.stop'), status = bar.querySelector('.run-status');
    const finish = () => { runBtn.disabled = false; stopBtn.hidden = true; };

    function run() {
      const id = ++nextId, lines = [];
      runBtn.disabled = true;
      stopBtn.hidden = false;
      label.hidden = out.hidden = false;
      out.textContent = '';
      status.textContent = booted ? 'Running…' : 'Loading Python and NumPy (about 10 MB, first run only)…';
      handlers.set(id, (m) => {
        if (m.type === 'status') { booted = true; status.textContent = m.text; }
        else if (m.type === 'out') { lines.push(m.text); out.textContent = lines.join('\n'); }
        else {
          handlers.delete(id);
          finish();
          if (m.type === 'error') {
            out.textContent = (lines.join('\n') + '\n' + m.text).trim();
            status.textContent = m.text === 'Stopped.' ? 'Stopped.' : 'Python reported an error (see output).';
          } else {
            const edited = editor.value !== original;
            const match = !edited && published && sameOutput(published, lines.join('\n').trim());
            status.textContent = `Finished in ${(m.ms / 1000).toFixed(1)} s.` +
              (edited ? ' (Code edited, so the output may differ from the published one.)'
                : match ? ' Matches the published output ✓' : ' Differs from the published output.');
          }
        }
      });
      getWorker().postMessage({ id, code: editor.value });
    }

    runBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', stopAll);
    bar.querySelector('.reset-code').addEventListener('click', () => { editor.value = original; status.textContent = 'Code reset.'; });
    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !runBtn.disabled) { e.preventDefault(); run(); }
    });
  }

  document.querySelectorAll('details.drawer').forEach((drawer) => {
    if (!drawer.querySelector('summary').textContent.startsWith('Show the code')) return;
    // Build the editor when the drawer is first opened (keeps page load light).
    const once = () => { if (drawer.open) { drawer.removeEventListener('toggle', once); enhance(drawer); } };
    drawer.addEventListener('toggle', once);
  });
})();
