# Unified Theory of Autonomous Search

![The Pages site: run the leaderboard in the browser, then watch one strategy move](docs/demo.gif)

A whitepaper and browser simulator that races five strategies for finding rare targets in noise.

[![CI](https://github.com/jayhemnani9910/unified-search/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jayhemnani9910/unified-search/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Try it: **https://jayhemnani9910.github.io/unified-search/**. Scroll to "Run the leaderboard in your browser" and press Run.

## Run the Python simulator

```bash
git clone https://github.com/jayhemnani9910/unified-search.git && cd unified-search/sim && pip install -r requirements.txt && python run_leaderboard.py --trials 20 --plume turbulent --save-plots
```

It prints a leaderboard and, with `--save-plots`, writes `avg_steps_to_first.png` and `success_rate.png` to `sim/figures/` (change with `--outdir`). Flags: `--trials` (default 10), `--plume static|turbulent` (default static). One trial of all five strategies takes about 10 s on the static plume and 30 s on the turbulent one on my laptop.

## What it compares

A 120x120 world holds 4 hidden targets. 24 agents start at random spots, each with an energy budget that drains with movement and sensing. They can only sense a noisy signal where they stand. A trial ends when every target is found or after 600 steps.

The five strategies:

- **Random walk**: a new random heading every step.
- **Levy flight**: random heading, heavy-tailed (Pareto) step length, capped at 40.
- **Gradient ascent**: samples the signal around itself and climbs it.
- **Surge-cast**: moves along the wind when the signal is strong, zigzags crosswind when it drops, falls back to Levy flight otherwise. Modeled on how insects track odor.
- **Swarm stigmergy**: agents drop a decaying pheromone and get pushed away from it and from each other, then follow the signal gradient when it is strong.

The signal is either a static field around each target or turbulent puffs that drift with the wind and spread out. Each strategy is scored on steps to first find, steps to find all, success rate (all targets found) and energy used.

All numbers above are `Config` defaults in `sim/digital_lab.py`. The browser version in `docs/sim.js` is a smaller port (60 to 110 wide, 12 to 24 agents, seeded RNG) so it runs in a few seconds.

## The whitepaper

[`report/whitepaper.md`](report/whitepaper.md) pulls the strategies together into one switching rule: explore with long relocations when local information is poor, exploit with slow local search when the cues get reliable. It covers blind search (Brownian, Levy, intermittent search), signal navigation (infotaxis, surge-cast) and teamwork (PSO, stigmergy, quorum rules), with 10 references including Vergassola et al. on infotaxis (Nature, 2007) and Benichou et al. on intermittent search (Rev. Mod. Phys., 2011).

## Layout

- `report/whitepaper.md`: the paper, with references
- `docs/`: the GitHub Pages site (HTML, CSS, in-browser simulator)
- `site/`: a copy of `docs/` (CI checks they match)
- `sim/`: Python simulator and leaderboard runner

To view the site locally, open `docs/index.html` in a browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
