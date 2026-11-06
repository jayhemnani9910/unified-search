# Contributing

Thanks for taking a look. Bug fixes, new search strategies and corrections to the whitepaper are all welcome.

I try to reply to issues within a few days.

## Setup

Python 3.10 or newer.

```bash
git clone https://github.com/jayhemnani9910/unified-search.git
cd unified-search
python -m venv .venv && source .venv/bin/activate
pip install -r sim/requirements.txt ruff
```

## Checks

These are what CI runs. Please run them before opening a PR.

```bash
ruff check .
cd sim && python run_leaderboard.py --trials 1 --save-plots && cd ..
diff -r -x demo.gif docs site
```

There are no unit tests yet. The second line is a smoke run of all five strategies (about 10 s).

## The site

`docs/` is what GitHub Pages serves. `site/` is a copy of it. If you change one, copy the change to the other, or `diff` above fails. Open `docs/index.html` in a browser to check it.

## Style

- Python: match the code around you, and keep `ruff check .` clean.
- JS: plain browser JavaScript, no build step, no dependencies.
- Whitepaper: claims about the literature need a reference in the list at the bottom.

## Pull requests

- Branch off `main`, one change per PR.
- Say what you changed and how you checked it.
- If you change simulator behavior, paste a leaderboard run before and after.

## Bugs

Open an issue with the bug report template: the command or page, what you expected, what happened, your Python version and OS.
