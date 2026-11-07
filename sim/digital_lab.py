"""Digital Lab simulator for autonomous search strategies.

This module defines the environment, agent behaviors, and trial runner.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from enum import Enum

import numpy as np


class Strategy(Enum):
    RANDOM_WALK = "random_walk"
    LEVY_FLIGHT = "levy_flight"
    GRADIENT_ASCENT = "gradient_ascent"
    SURGE_CAST = "surge_cast"
    SWARM_STIGMERGY = "swarm_stigmergy"


@dataclass
class Config:
    size: int = 120
    num_agents: int = 24
    num_targets: int = 4
    max_steps: int = 600
    detection_radius: float = 2.0
    sensing_noise: float = 0.15
    signal_strength: float = 120.0
    signal_decay: float = 1.0
    boundary: str = "reflect"  # or "wrap"

    # Motion
    step_size: float = 1.0
    max_speed: float = 3.5
    inertia: float = 0.3

    # Energy
    energy_init: float = 2000.0
    move_cost: float = 0.6
    sense_cost: float = 0.4

    # Levy
    levy_mu: float = 2.0
    levy_scale: float = 1.0
    levy_max_step: float = 40.0

    # Gradient sampling
    grad_step: float = 1.0

    # Surge-cast
    surge_threshold: float = 6.0
    surge_speed: float = 2.5
    cast_speed: float = 2.0
    cast_steps: int = 20
    cast_turn_period: int = 5

    # Swarm stigmergy
    pheromone_decay: float = 0.96
    pheromone_deposit: float = 1.0
    pheromone_repulsion: float = 1.6
    neighbor_repulsion: float = 1.4
    neighbor_radius: float = 6.0

    # Plume / wind
    wind: tuple[float, float] = (1.0, 0.0)
    plume_mode: str = "static"  # or "turbulent"
    puff_rate: float = 0.25
    puff_lifetime: int = 80
    puff_diffusion: float = 2.2
    puff_advect: float = 0.9


@dataclass
class TrialResult:
    steps_to_first: int
    steps_to_all: int
    found: int
    energy_used: float
    found_all: bool


class Environment:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.size = cfg.size
        self.targets = self._init_targets(cfg.num_targets)
        self.signal_field = np.zeros((self.size, self.size), dtype=float)
        self.pheromone_field = np.zeros((self.size, self.size), dtype=float)
        self.puffs: list[dict[str, float]] = []
        self._update_static_field()

    def _init_targets(self, count: int) -> list[np.ndarray]:
        targets = []
        for _ in range(count):
            targets.append(
                np.array([
                    random.randint(5, self.size - 6),
                    random.randint(5, self.size - 6),
                ], dtype=float)
            )
        return targets

    def _update_static_field(self) -> None:
        for x in range(self.size):
            for y in range(self.size):
                signal = 0.0
                pos = np.array([x, y], dtype=float)
                for t in self.targets:
                    dist = np.linalg.norm(pos - t)
                    signal += self.cfg.signal_strength / (1.0 + (dist / self.cfg.signal_decay) ** 2)
                self.signal_field[x, y] = signal

    def step(self) -> None:
        # Pheromone evaporation
        self.pheromone_field *= self.cfg.pheromone_decay

        if self.cfg.plume_mode == "turbulent":
            self._update_puffs()

    def _update_puffs(self) -> None:
        # Spawn puffs near targets
        for t in self.targets:
            if random.random() < self.cfg.puff_rate:
                jitter = np.random.randn(2) * 1.5
                self.puffs.append({
                    "pos": (t + jitter).astype(float),
                    "age": 0.0,
                })

        wind = np.array(self.cfg.wind, dtype=float)
        new_puffs = []
        for puff in self.puffs:
            puff["age"] += 1.0
            if puff["age"] > self.cfg.puff_lifetime:
                continue
            advect = wind * self.cfg.puff_advect
            diffuse = np.random.randn(2) * self.cfg.puff_diffusion
            puff["pos"] = puff["pos"] + advect + diffuse
            puff["pos"] = self._apply_boundary(puff["pos"])
            new_puffs.append(puff)
        self.puffs = new_puffs

    def _apply_boundary(self, pos: np.ndarray) -> np.ndarray:
        if self.cfg.boundary == "wrap":
            return np.array([pos[0] % self.size, pos[1] % self.size])
        # reflect
        pos = pos.copy()
        for i in (0, 1):
            if pos[i] < 0:
                pos[i] = -pos[i]
            if pos[i] > self.size - 1:
                pos[i] = 2 * (self.size - 1) - pos[i]
        return pos

    def get_signal(self, pos: np.ndarray) -> float:
        x = int(np.clip(pos[0], 0, self.size - 1))
        y = int(np.clip(pos[1], 0, self.size - 1))

        if self.cfg.plume_mode == "static":
            base = self.signal_field[x, y]
        else:
            base = 0.0
            for puff in self.puffs:
                dist = np.linalg.norm(pos - puff["pos"])
                base += self.cfg.signal_strength * math.exp(-dist ** 2 / (2 * (self.cfg.puff_diffusion ** 2)))

        noise = np.random.normal(0.0, self.cfg.sensing_noise)
        return max(0.0, base + noise)

    def add_pheromone(self, pos: np.ndarray) -> None:
        x = int(np.clip(pos[0], 0, self.size - 1))
        y = int(np.clip(pos[1], 0, self.size - 1))
        self.pheromone_field[x, y] += self.cfg.pheromone_deposit

    def pheromone_at(self, pos: np.ndarray) -> float:
        x = int(np.clip(pos[0], 0, self.size - 1))
        y = int(np.clip(pos[1], 0, self.size - 1))
        return self.pheromone_field[x, y]


class Agent:
    def __init__(self, agent_id: int, env: Environment, strategy: Strategy, cfg: Config):
        self.id = agent_id
        self.env = env
        self.strategy = strategy
        self.cfg = cfg
        self.pos = np.array([
            random.uniform(0, env.size - 1),
            random.uniform(0, env.size - 1)
        ], dtype=float)
        angle = random.uniform(0.0, 2.0 * math.pi)
        self.velocity = np.array([math.cos(angle), math.sin(angle)], dtype=float) * cfg.step_size
        self.energy = cfg.energy_init

        # Surge-cast memory
        self.mode = "EXPLORE"
        self.cast_timer = 0
        self.cast_sign = 1.0

    def sense(self) -> float:
        self.energy -= self.cfg.sense_cost
        return self.env.get_signal(self.pos)

    def step(self, agents: list[Agent]) -> None:
        if self.energy <= 0:
            return

        signal = self.sense()

        if self.strategy == Strategy.RANDOM_WALK:
            self._random_walk()
        elif self.strategy == Strategy.LEVY_FLIGHT:
            self._levy_flight()
        elif self.strategy == Strategy.GRADIENT_ASCENT:
            self._gradient_ascent(signal)
        elif self.strategy == Strategy.SURGE_CAST:
            self._surge_cast(signal)
        elif self.strategy == Strategy.SWARM_STIGMERGY:
            self._swarm_stigmergy(signal, agents)

        self._apply_motion()

    def _random_walk(self) -> None:
        angle = random.uniform(0.0, 2.0 * math.pi)
        self.velocity = np.array([math.cos(angle), math.sin(angle)], dtype=float) * self.cfg.step_size

    def _levy_flight(self) -> None:
        mu = max(1.05, self.cfg.levy_mu)
        step = (1.0 + np.random.pareto(mu - 1.0)) * self.cfg.levy_scale
        step = min(step, self.cfg.levy_max_step)
        angle = random.uniform(0.0, 2.0 * math.pi)
        self.velocity = np.array([math.cos(angle), math.sin(angle)], dtype=float) * step

    def _gradient_ascent(self, current_signal: float) -> None:
        grad = self._estimate_gradient()
        if np.linalg.norm(grad) < 1e-6:
            self._random_walk()
            return
        grad_dir = grad / (np.linalg.norm(grad) + 1e-9)
        self.velocity = grad_dir * self.cfg.step_size

    def _surge_cast(self, signal: float) -> None:
        wind = np.array(self.cfg.wind, dtype=float)
        wind_norm = np.linalg.norm(wind) + 1e-9
        wind_dir = wind / wind_norm

        if signal >= self.cfg.surge_threshold:
            self.mode = "SURGE"
            self.cast_timer = self.cfg.cast_steps
            self.velocity = wind_dir * self.cfg.surge_speed
            return

        if self.mode == "SURGE":
            self.mode = "CAST"
            self.cast_timer = self.cfg.cast_steps

        if self.mode == "CAST" and self.cast_timer > 0:
            self.cast_timer -= 1
            perp = np.array([-wind_dir[1], wind_dir[0]]) * self.cast_sign
            if self.cast_timer % self.cfg.cast_turn_period == 0:
                self.cast_sign *= -1.0
            self.velocity = perp * self.cfg.cast_speed
            return

        self.mode = "EXPLORE"
        self._levy_flight()

    def _swarm_stigmergy(self, signal: float, agents: list[Agent]) -> None:
        self.env.add_pheromone(self.pos)

        grad = self._estimate_gradient()
        grad_norm = np.linalg.norm(grad)
        grad_dir = grad / (grad_norm + 1e-9)

        repulse = np.zeros(2, dtype=float)
        for other in agents:
            if other is self:
                continue
            delta = self.pos - other.pos
            dist = np.linalg.norm(delta) + 1e-6
            if dist < self.cfg.neighbor_radius:
                repulse += (delta / dist) / dist

        pher = self.env.pheromone_at(self.pos)
        pher_force = -grad_dir * pher * self.cfg.pheromone_repulsion
        neighbor_force = repulse * self.cfg.neighbor_repulsion
        rand_force = np.random.randn(2) * 0.4

        if signal >= self.cfg.surge_threshold:
            target_force = grad_dir * 3.0
            direction = target_force + 0.3 * neighbor_force
        else:
            direction = (
                self.cfg.inertia * self.velocity
                + pher_force
                + neighbor_force
                + rand_force
            )

        if np.linalg.norm(direction) < 1e-6:
            self._random_walk()
            return

        direction = direction / (np.linalg.norm(direction) + 1e-9)
        self.velocity = direction * self.cfg.step_size

    def _estimate_gradient(self) -> np.ndarray:
        eps = self.cfg.grad_step
        x, y = self.pos
        s_x1 = self.env.get_signal(np.array([x + eps, y]))
        s_x0 = self.env.get_signal(np.array([x - eps, y]))
        s_y1 = self.env.get_signal(np.array([x, y + eps]))
        s_y0 = self.env.get_signal(np.array([x, y - eps]))
        return np.array([s_x1 - s_x0, s_y1 - s_y0], dtype=float)

    def _apply_motion(self) -> None:
        speed = np.linalg.norm(self.velocity)
        if speed > self.cfg.max_speed:
            self.velocity = self.velocity / (speed + 1e-9) * self.cfg.max_speed

        self.energy -= self.cfg.move_cost * (speed ** 2)
        new_pos = self.pos + self.velocity
        self.pos = self.env._apply_boundary(new_pos)


def run_trial(strategy: Strategy, cfg: Config, seed: int | None = None) -> TrialResult:
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    env = Environment(cfg)
    agents = [Agent(i, env, strategy, cfg) for i in range(cfg.num_agents)]

    found_set = set()
    first_found_step = cfg.max_steps

    for step in range(cfg.max_steps):
        env.step()

        for agent in agents:
            agent.step(agents)

            for idx, target in enumerate(env.targets):
                if idx in found_set:
                    continue
                if np.linalg.norm(agent.pos - target) <= cfg.detection_radius:
                    found_set.add(idx)
                    if first_found_step == cfg.max_steps:
                        first_found_step = step + 1

        if len(found_set) == cfg.num_targets:
            break

    steps_to_all = step + 1
    energy_used = sum(cfg.energy_init - max(a.energy, 0.0) for a in agents)
    return TrialResult(
        steps_to_first=first_found_step,
        steps_to_all=steps_to_all,
        found=len(found_set),
        energy_used=energy_used,
        found_all=len(found_set) == cfg.num_targets,
    )


def leaderboard(strategies: list[Strategy], cfg: Config, trials: int = 10, seed: int | None = None) -> dict[str, dict[str, float]]:
    results: dict[str, dict[str, float]] = {}

    for strategy in strategies:
        totals = {
            "steps_to_first": 0.0,
            "steps_to_all": 0.0,
            "energy": 0.0,
            "success": 0.0,
        }
        for t in range(trials):
            res = run_trial(strategy, cfg, seed=(seed + t if seed is not None else None))
            totals["steps_to_first"] += res.steps_to_first
            totals["steps_to_all"] += res.steps_to_all
            totals["energy"] += res.energy_used
            totals["success"] += 1.0 if res.found_all else 0.0

        results[strategy.value] = {
            "avg_steps_to_first": totals["steps_to_first"] / trials,
            "avg_steps_to_all": totals["steps_to_all"] / trials,
            "avg_energy": totals["energy"] / trials,
            "success_rate": totals["success"] / trials,
        }

    return results
