"""Run every "Show the code" snippet on the site and compare it with its published output.

    python tools/check_snippets.py            # check (exit code 1 on any mismatch)
    python tools/check_snippets.py --update   # re-run and rewrite the published outputs

Text must match exactly. Numbers may differ by at most 1.5 units in their last printed digit,
which absorbs floating-point differences between CPUs but catches any real change in results.
"""
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['brownian-motion', 'variation', 'ito-integral', 'ito-lemma', 'sde', 'applications', 'diffusion-models', 'beyond', 'pricing', 'volatility', 'rates', 'interview']
BLOCK = re.compile(
    r'(<summary>Show the code \(Python \+ NumPy\)</summary>\s*<pre><code>)(.*?)(</code></pre>\s*'
    r'<p class="ref">Output when we ran it:</p>\s*<pre><code>)(.*?)(</code></pre>)', re.S)
NUMBER = re.compile(r'[-+]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?')


def run(code):
    with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
    try:
        r = subprocess.run([sys.executable, f.name], capture_output=True, text=True, timeout=600)
    finally:
        Path(f.name).unlink()
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def same(expected, actual):
    """Equal text, and numbers equal up to rounding in the last printed digit."""
    if NUMBER.sub('#', expected) != NUMBER.sub('#', actual):
        return False
    for e, a in zip(NUMBER.findall(expected), NUMBER.findall(actual)):
        decimals = len(e.split('e')[0].split('.')[1]) if '.' in e else 0
        if abs(float(e.replace(',', '')) - float(a.replace(',', ''))) > 1.5 * 10 ** -decimals + 1e-12:
            return False
    return True


def section_of(page, pos):
    ids = re.findall(r'<section id="([^"]+)"', page[:pos])
    return ids[-1] if ids else '?'


def main(update):
    failures = checked = 0
    for slug in PAGES:
        path = ROOT / slug / 'index.html'
        page = path.read_text(encoding='utf-8')
        out, last = [], 0
        for m in BLOCK.finditer(page):
            name = f'{slug}#{section_of(page, m.start())}'
            expected = html.unescape(m.group(4)).strip()
            try:
                actual = run(html.unescape(m.group(2)))
            except Exception as err:  # noqa: BLE001 - report any snippet crash
                print(f'FAIL {name}: snippet crashed\n{err}\n')
                failures += 1
                continue
            checked += 1
            if update:
                out.append(page[last:m.start(4)] + html.escape(actual, quote=False))
                last = m.end(4)
            elif not same(expected, actual):
                print(f'FAIL {name}: output changed\n--- published\n{expected}\n--- now\n{actual}\n')
                failures += 1
            else:
                print(f'ok   {name}')
        if update:
            path.write_text(''.join(out) + page[last:], encoding='utf-8')
    print(f'\n{checked} snippets run, {failures} failed' + (' (outputs rewritten)' if update else ''))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252
    sys.exit(main('--update' in sys.argv))
