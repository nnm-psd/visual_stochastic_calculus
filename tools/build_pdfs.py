"""Export every chapter as a PDF (pdf/<chapter>.pdf) with headless Chrome's print-to-PDF.

    python tools/build_pdfs.py

Pages are opened with "?print": every section starts at once, drawers open, takeaways and answers
show, and the light theme is used. Re-run after changing a chapter so its PDF stays current.
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_pages import find_chrome  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS = ['brownian-motion', 'variation', 'ito-integral', 'ito-lemma', 'sde', 'applications', 'diffusion-models', 'beyond', 'pricing', 'volatility', 'rates', 'interview']


def main():
    chrome = find_chrome()
    out_dir = ROOT / 'pdf'
    out_dir.mkdir(exist_ok=True)
    for slug in CHAPTERS:
        out = out_dir / f'{slug}.pdf'
        url = (ROOT / slug / 'index.html').as_uri() + '?print'
        subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
                        '--window-size=900,1200', '--virtual-time-budget=20000', f'--print-to-pdf={out}', url],
                       capture_output=True, timeout=300, check=False)
        size = out.stat().st_size if out.exists() else 0
        print(f'{"ok  " if size else "FAIL"} pdf/{slug}.pdf  {size / 1e6:.1f} MB')
        if not size:
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
