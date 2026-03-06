# Unified Theory of Autonomous Search

A compact project that pairs a research-style whitepaper with a runnable "Digital Lab" simulator and a bold, single-page web experience. The simulator is designed to compare search strategies (random walk, Levy flight, gradient ascent, surge-cast, and swarm stigmergy) under noisy, sparse target conditions.

## Project layout

- `report/whitepaper.md` - main report (whitepaper tone, with citations)
- `docs/` - GitHub Pages site (HTML/CSS/JS + in-browser simulator)
- `site/` - source copy of the site (mirrors `docs/`)
- `sim/` - Python simulator (CLI + plots)

## Quickstart (simulator)

```bash
cd sim
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run_leaderboard.py --trials 20 --plume turbulent --save-plots
```

Outputs plot PNGs to `sim/figures/`.

## Website

Open `docs/index.html` in a browser (same content as GitHub Pages). The References section mirrors the whitepaper sources. This keeps the site self-contained.

## Notes

- The simulator is intentionally compact and deterministic enough for repeated experiments.
- For deeper theoretical background and citations, see `report/whitepaper.md`.
