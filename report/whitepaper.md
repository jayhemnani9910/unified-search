# The Unified Theory of Autonomous Search
From biological heuristics to entropic laws in sparse target detection

## Executive summary

This whitepaper proposes a unified view of autonomous search as a physics and information problem: rare targets embedded in a large, noisy space must be found by agents that have limited energy, memory, and communication. We synthesize biological and engineering findings into a single switching rule that decides when to explore (cover distance) and when to exploit (increase information). The project includes a "Digital Lab" simulator to test strategies in a controlled, repeatable environment.

Key idea: the best strategy is not a single algorithm. It is a state switch driven by local information gain relative to energy cost. This produces intermittent, multi-phase search with sharp transitions between ballistic relocation and slow detection.

## 1. The nature of sparse search

Sparse target detection appears in biology (immune cells, insect odor tracking), robotics (search and rescue, exploration), and software (malicious code scanning). In all cases, the searcher is constrained by limited sensing and energy, and the environment introduces uncertainty through noise, occlusion, or turbulence. The literature shows that strong local cues are often absent or intermittent at macroscopic scales, especially in turbulent transport where odor or signal packets arrive as sparse filaments rather than smooth gradients. [1]

This motivates a model in which search should be optimized for: (a) coverage under uncertainty, and (b) rapid switching when informative cues become available.

## 2. Digital Lab: simulation architecture

The Digital Lab is the experimental testbed of this project. It is a 2D bounded environment with configurable boundary conditions (reflect or wrap), optional turbulent signal plumes, and energy-limited agents. The simulator runs Monte Carlo trials across strategy classes and produces metrics for time-to-find, energy usage, and success rate.

### 2.1 Environment

- **World**: 2D continuous domain with obstacles optional (future extension).
- **Signal field**: either static inverse-square decay or turbulent puffs that are advected by wind and diffuse stochastically.
- **Noise**: additive Gaussian sensor noise.
- **Pheromones**: a decaying field for stigmergic memory.

### 2.2 Agents

- **Local sensing only**: each agent can sample signal at its position and a local neighborhood.
- **Energy budget**: movement cost scales with speed; sensing cost scales with time.
- **Simple state**: each agent uses a small state machine (for intermittent or surge-cast behaviors).

### 2.3 Metrics

- `steps_to_first`: time to first detection.
- `steps_to_all`: time to detect all targets.
- `energy_used`: aggregate energy cost.
- `success_rate`: fraction of trials that find all targets.

## 3. Rule family A: blind search physics

When signal is absent or below threshold, the search becomes geometric. The fundamental fact is that simple random walks in low dimensions are recurrent: in 1D and 2D they return to previously visited locations with probability 1, producing heavy oversampling. This is one reason why pure Brownian exploration is inefficient in sparse domains. [5]

### 3.1 Brownian motion (baseline)

- **Definition**: random steps with short, bounded length and random angles.
- **Effect**: thorough local coverage but high redundancy; slow growth of explored area.

### 3.2 Levy flight / Levy walk

- **Definition**: step lengths are heavy-tailed, producing rare long jumps.
- **Effect**: breaks recurrence and reduces oversampling in sparse target settings.
- **Caveat**: Levy advantages are not universal; in biased or bounded contexts, Brownian strategies can dominate. [3][4]

### 3.3 Intermittent search

Intermittent search alternates **detection** and **relocation** phases. The Bénichou et al. review demonstrates that switching between slow, detectable motion and fast, blind relocation can minimize search time across many models, providing a theoretical foundation for the switching logic. [2]

The Digital Lab implements this idea in a simplified two-state policy and extends it with Levy-distributed relocation durations for robustness.

## 4. Rule family B: signal navigation

When the signal becomes intermittent and filamentary, local gradients can be misleading. The infotaxis framework explicitly models the search as expected information gain and has been shown to handle turbulent plumes where classical chemotaxis fails. [1]

### 4.1 Infotaxis (information-driven)

- **Principle**: move to maximize expected information gain.
- **Strength**: robust in turbulent plumes.
- **Cost**: high computational load due to belief updates.

### 4.2 Surge-cast (bio-mimetic)

Insects exhibit a computationally cheap approximation: when a signal is detected, move upwind (surge); when it is lost, cast crosswind to reacquire the plume. Reviews of odor-guided locomotion emphasize this surge/cast motif as a core behavior in insect odor tracking. [6]

The simulator implements surge-cast as a minimal finite-state controller, consistent with recent PNAS work showing that small memory controllers can reproduce biologically plausible search behaviors. [7]

## 5. Rule family C: local teamwork

### 5.1 Particle swarm optimization (PSO)

PSO uses social information to bias each agent toward its own best and the swarm best. It was introduced by Kennedy and Eberhart in 1995 and provides a common engineering baseline for swarm coordination. [9]

In sparse search, PSO requires modification: agents must first **repel** to maximize coverage, then **attract** to consolidate once a target is found.

### 5.2 Stigmergy

Stigmergy is indirect coordination via environmental traces. The defining mechanism is that traces left by an agent stimulate subsequent actions by itself or others, enabling coordination without direct messaging. [8]

In the Digital Lab, stigmergy is implemented as a decaying pheromone grid that repels agents from already explored regions, accelerating coverage.

### 5.3 Quorum thresholds

Collective decisions can be stabilized by a quorum rule. The k-unanimity decision model shows how swarms reach consensus using positive feedback without explicit global measurements. [10]

The simulator uses a simplified quorum trigger to reduce false positives under sensor noise.

## 6. The Law of Search (switching rule)

The unified view can be expressed as a single switching condition that compares information gain to energy cost. Define a local confidence ratio:

```
chi = (signal / noise) * (1 / rho_est) * energy
```

where:

- `signal / noise` estimates local information quality,
- `rho_est` estimates target density from encounter rate,
- `energy` is remaining energy budget.

**Decision**:

- If `chi` is low: **explore** with Levy or ballistic relocation.
- If `chi` is high: **exploit** with Brownian, surge-cast, or local coordination.

This single rule produces the phase transitions observed in effective search systems: fast coverage when information is scarce, and tight local search when cues become reliable.

## 7. How this project implements the theory

The Digital Lab provides:

- A **static** and **turbulent** signal field model.
- Strategy implementations: random walk, Levy flight, gradient ascent, surge-cast, and swarm stigmergy.
- A leaderboard runner that averages performance across trials.
- Optional plots for rapid comparison.

Run the simulator via `sim/run_leaderboard.py` to generate metrics and plots.

## References

[1] Vergassola, M., Villermaux, E., Shraiman, B. I. "Infotaxis as a strategy for searching without gradients." Nature 445, 406-409 (2007). DOI: 10.1038/nature05464. Source: nature.com. 

[2] Benichou, O., Loverdo, C., Moreau, M., Voituriez, R. "Intermittent search strategies." Reviews of Modern Physics 83, 81-129 (2011). DOI: 10.1103/RevModPhys.83.81. Source: ebscohost.com. 

[3] Lomholt, M. A., Koren, T., Metzler, R., Klafter, J. "Levy strategies in intermittent search processes are advantageous." PNAS 105(32), 11055-11059 (2008). DOI: 10.1073/pnas.0803117105. Source: pnas.org. 

[4] Palyulin, V. V., Chechkin, A. V., Metzler, R. "Levy flights do not always optimize random blind search for sparse targets." PNAS 111(8), 2931-2936 (2014). DOI: 10.1073/pnas.1320424111. Source: pnas.org. 

[5] Weisstein, E. W. "Polya's Random Walk Constants." MathWorld. Source: mathworld.wolfram.com. 

[6] Wechsler, S. P., Bhandawat, V. "Behavioral algorithms and neural mechanisms underlying odor-modulated locomotion in insects." J Exp Biol 226(1) (2023). DOI: 10.1242/jeb.200261. Source: pmc.ncbi.nlm.nih.gov. 

[7] Verano, K. V. B., Panizon, E., Celani, A. "Olfactory search with finite-state controllers." PNAS 120(34) (2023). DOI: 10.1073/pnas.2304230120. Source: pmc.ncbi.nlm.nih.gov. 

[8] Heylighen, F. "Stigmergy as a universal coordination mechanism I: Definition and components." Cognitive Systems Research 38, 4-13 (2016). DOI: 10.1016/j.cogsys.2015.12.002. Source: sciencedirect.com. 

[9] Kennedy, J., Eberhart, R. "Particle swarm optimization." Proc. IEEE International Conference on Neural Networks (1995), 1942-1948. DOI: 10.1109/ICNN.1995.488968. Source: dblp.org. 

[10] Scheidler, A., Brutschy, A., Ferrante, E., Dorigo, M. "The k-unanimity rule for self-organized decision-making in swarms of robots." IEEE Trans. Cybernetics 46(5), 1175-1188 (2016). DOI: 10.1109/TCYB.2015.2429118. Source: research.vu.nl.
