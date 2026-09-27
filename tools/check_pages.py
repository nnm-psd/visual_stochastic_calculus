"""Smoke-test every page of the site in headless Chrome.

    python tools/check_pages.py

Fails (exit code 1) if a page logs anything to the console (the site logs nothing when healthy),
if a page with formulas did not get its math rendered by KaTeX, or if an internal link or script
path does not exist. Set CHROME to the browser binary if it is not found automatically.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'notation/index.html', 'about/index.html'] + [f'{d}/index.html' for d in
         ['brownian-motion', 'variation', 'ito-integral', 'ito-lemma', 'sde', 'applications', 'diffusion-models', 'beyond', 'pricing', 'volatility', 'rates', 'interview']]
BENIGN = ('Canvas2D: Multiple readback operations',)  # browser performance hints, not errors


def find_chrome():
    candidates = [os.environ.get('CHROME'), shutil.which('google-chrome'), shutil.which('google-chrome-stable'),
                  shutil.which('chromium'), shutil.which('chromium-browser'), shutil.which('chrome'),
                  r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                  r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit('Chrome not found: set the CHROME environment variable to the browser binary.')


def console_and_dom(chrome, page):
    r = subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--enable-logging=stderr', '--v=0',
                        '--window-size=900,1200', '--virtual-time-budget=8000', '--dump-dom', page.as_uri() + '?all'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    messages = [re.sub(r'^.*?CONSOLE[^\]]*\] ', '', line) for line in r.stderr.splitlines() if 'CONSOLE' in line]
    return [m for m in messages if not m.strip('"').startswith(BENIGN)], r.stdout


def broken_links():
    bad = []
    for page in ROOT.rglob('*.html'):
        if '.git' in page.parts:
            continue
        for ref in re.findall(r'(?:href|src)="([^"#:]+)(?:#[^"]*)?"', page.read_text(encoding='utf-8')):
            if not (page.parent / ref).resolve().exists():
                bad.append(f'{page.relative_to(ROOT)} -> {ref}')
    return bad


def progress_mismatches():
    """Every section on a chapter page must be listed in progress.js (and vice versa)."""
    listed = dict(re.findall(r"'([\w-]+)': \[([^\]]*)\]", (ROOT / 'assets/js/progress.js').read_text(encoding='utf-8')))
    bad = []
    for slug, ids in listed.items():
        want = set(re.findall(r"'([\w-]+)'", ids))
        have = set(re.findall(r'<section id="([^"]+)" class="section">', (ROOT / slug / 'index.html').read_text(encoding='utf-8')))
        if want != have:
            bad.append(f'{slug}: progress.js lists {sorted(want)}, page has {sorted(have)}')
    return bad


def main():
    chrome, failures = find_chrome(), 0
    for rel in PAGES:
        page = ROOT / rel
        messages, dom = console_and_dom(chrome, page)
        has_math = '$' in page.read_text(encoding='utf-8')
        problems = messages + ([] if not has_math or 'class="katex"' in dom else ['math was not rendered by KaTeX'])
        # A '$' left in visible text after rendering means an unpaired math delimiter (e.g. a currency sign).
        visible = re.sub(r'<(script|style|pre|textarea|annotation)\b.*?</\1>', '', dom, flags=re.S)
        visible = re.sub(r'<[^>]+>', '', visible)
        if '$' in visible:
            i = visible.index('$')
            problems.append('unrendered $ near: ' + ' '.join(visible[max(0, i - 60):i + 40].split()))
        if problems:
            failures += 1
            print(f'FAIL {rel}')
            for p in problems:
                print(f'       {p}')
        else:
            print(f'ok   {rel}')
    for m in progress_mismatches():
        print(f'FAIL progress list {m}')
        failures += 1
    links = broken_links()
    for b in links:
        print(f'FAIL broken link {b}')
    failures += len(links)
    print(f'\n{len(PAGES)} pages checked, {failures} problem(s)')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252
    sys.exit(main())
