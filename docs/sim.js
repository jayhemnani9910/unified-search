const Strategy = {
  RANDOM_WALK: "random_walk",
  LEVY_FLIGHT: "levy_flight",
  GRADIENT_ASCENT: "gradient_ascent",
  SURGE_CAST: "surge_cast",
  SWARM_STIGMERGY: "swarm_stigmergy",
};

const STRATEGY_LABELS = {
  [Strategy.RANDOM_WALK]: "Random Walk",
  [Strategy.LEVY_FLIGHT]: "Levy Flight",
  [Strategy.GRADIENT_ASCENT]: "Gradient Ascent",
  [Strategy.SURGE_CAST]: "Surge-Cast",
  [Strategy.SWARM_STIGMERGY]: "Swarm Stigmergy",
};

const SPEED_PRESETS = {
  fast: {
    size: 60,
    numAgents: 12,
    numTargets: 3,
    maxSteps: 260,
  },
  balanced: {
    size: 80,
    numAgents: 16,
    numTargets: 3,
    maxSteps: 360,
  },
  quality: {
    size: 110,
    numAgents: 24,
    numTargets: 4,
    maxSteps: 520,
  },
};

function createRNG(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function pareto(rng, alpha) {
  const u = 1 - rng();
  return Math.pow(u, -1 / alpha) - 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function vecScale(a, s) {
  return [a[0] * s, a[1] * s];
}

function vecNorm(a) {
  return Math.hypot(a[0], a[1]);
}

function vecUnit(a) {
  const n = vecNorm(a);
  if (n < 1e-9) return [0, 0];
  return [a[0] / n, a[1] / n];
}

class Environment {
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;
    this.size = cfg.size;
    this.targets = this.initTargets(cfg.numTargets);
    this.signalField = Array.from({ length: this.size }, () => new Float32Array(this.size));
    this.pheromoneField = Array.from({ length: this.size }, () => new Float32Array(this.size));
    this.puffs = [];
    this.updateStaticField();
  }

  initTargets(count) {
    const targets = [];
    for (let i = 0; i < count; i += 1) {
      targets.push([
        Math.floor(5 + this.rng() * (this.size - 10)),
        Math.floor(5 + this.rng() * (this.size - 10)),
      ]);
    }
    return targets;
  }

  updateStaticField() {
    for (let x = 0; x < this.size; x += 1) {
      for (let y = 0; y < this.size; y += 1) {
        let signal = 0;
        for (const t of this.targets) {
          const dx = x - t[0];
          const dy = y - t[1];
          const dist = Math.hypot(dx, dy);
          signal += this.cfg.signalStrength / (1 + (dist / this.cfg.signalDecay) ** 2);
        }
        this.signalField[x][y] = signal;
      }
    }
  }

  step() {
    for (let x = 0; x < this.size; x += 1) {
      const row = this.pheromoneField[x];
      for (let y = 0; y < this.size; y += 1) {
        row[y] *= this.cfg.pheromoneDecay;
      }
    }

    if (this.cfg.plumeMode === "turbulent") {
      this.updatePuffs();
    }
  }

  updatePuffs() {
    for (const t of this.targets) {
      if (this.rng() < this.cfg.puffRate) {
        const jitter = [randn(this.rng) * 1.5, randn(this.rng) * 1.5];
        this.puffs.push({ pos: vecAdd(t, jitter), age: 0 });
      }
    }

    const wind = this.cfg.wind;
    const newPuffs = [];
    for (const puff of this.puffs) {
      puff.age += 1;
      if (puff.age > this.cfg.puffLifetime) {
        continue;
      }
      const advect = vecScale(wind, this.cfg.puffAdvect);
      const diffuse = [randn(this.rng) * this.cfg.puffDiffusion, randn(this.rng) * this.cfg.puffDiffusion];
      puff.pos = this.applyBoundary(vecAdd(puff.pos, vecAdd(advect, diffuse)));
      newPuffs.push(puff);
    }
    this.puffs = newPuffs;
  }

  applyBoundary(pos) {
    const out = [pos[0], pos[1]];
    if (this.cfg.boundary === "wrap") {
      out[0] = (out[0] + this.size) % this.size;
      out[1] = (out[1] + this.size) % this.size;
      return out;
    }
    for (let i = 0; i < 2; i += 1) {
      if (out[i] < 0) out[i] = -out[i];
      if (out[i] > this.size - 1) out[i] = 2 * (this.size - 1) - out[i];
    }
    return out;
  }

  getSignal(pos) {
    const x = Math.floor(clamp(pos[0], 0, this.size - 1));
    const y = Math.floor(clamp(pos[1], 0, this.size - 1));
    let base = 0;

    if (this.cfg.plumeMode === "static") {
      base = this.signalField[x][y];
    } else {
      for (const puff of this.puffs) {
        const dx = pos[0] - puff.pos[0];
        const dy = pos[1] - puff.pos[1];
        const dist = Math.hypot(dx, dy);
        base += this.cfg.signalStrength * Math.exp(-(dist ** 2) / (2 * this.cfg.puffDiffusion ** 2));
      }
    }

    const noise = randn(this.rng) * this.cfg.sensingNoise;
    return Math.max(0, base + noise);
  }

  addPheromone(pos) {
    const x = Math.floor(clamp(pos[0], 0, this.size - 1));
    const y = Math.floor(clamp(pos[1], 0, this.size - 1));
    this.pheromoneField[x][y] += this.cfg.pheromoneDeposit;
  }

  pheromoneAt(pos) {
    const x = Math.floor(clamp(pos[0], 0, this.size - 1));
    const y = Math.floor(clamp(pos[1], 0, this.size - 1));
    return this.pheromoneField[x][y];
  }
}

class Agent {
  constructor(id, env, strategy, cfg, rng) {
    this.id = id;
    this.env = env;
    this.strategy = strategy;
    this.cfg = cfg;
    this.rng = rng;
    this.pos = [rng() * (env.size - 1), rng() * (env.size - 1)];
    const angle = rng() * 2 * Math.PI;
    this.velocity = [Math.cos(angle) * cfg.stepSize, Math.sin(angle) * cfg.stepSize];
    this.energy = cfg.energyInit;

    this.mode = "EXPLORE";
    this.castTimer = 0;
    this.castSign = 1;
  }

  sense() {
    this.energy -= this.cfg.senseCost;
    return this.env.getSignal(this.pos);
  }

  step(agents) {
    if (this.energy <= 0) return;
    const signal = this.sense();

    if (this.strategy === Strategy.RANDOM_WALK) {
      this.randomWalk();
    } else if (this.strategy === Strategy.LEVY_FLIGHT) {
      this.levyFlight();
    } else if (this.strategy === Strategy.GRADIENT_ASCENT) {
      this.gradientAscent();
    } else if (this.strategy === Strategy.SURGE_CAST) {
      this.surgeCast(signal);
    } else if (this.strategy === Strategy.SWARM_STIGMERGY) {
      this.swarmStigmergy(signal, agents);
    }

    this.applyMotion();
  }

  randomWalk() {
    const angle = this.rng() * 2 * Math.PI;
    this.velocity = [Math.cos(angle) * this.cfg.stepSize, Math.sin(angle) * this.cfg.stepSize];
  }

  levyFlight() {
    const alpha = Math.max(0.1, this.cfg.levyMu - 1);
    let step = (1 + pareto(this.rng, alpha)) * this.cfg.levyScale;
    step = Math.min(step, this.cfg.levyMaxStep);
    const angle = this.rng() * 2 * Math.PI;
    this.velocity = [Math.cos(angle) * step, Math.sin(angle) * step];
  }

  gradientAscent() {
    const grad = this.estimateGradient();
    if (vecNorm(grad) < 1e-6) {
      this.randomWalk();
      return;
    }
    this.velocity = vecScale(vecUnit(grad), this.cfg.stepSize);
  }

  surgeCast(signal) {
    const windDir = vecUnit(this.cfg.wind);

    if (signal >= this.cfg.surgeThreshold) {
      this.mode = "SURGE";
      this.castTimer = this.cfg.castSteps;
      this.velocity = vecScale(windDir, this.cfg.surgeSpeed);
      return;
    }

    if (this.mode === "SURGE") {
      this.mode = "CAST";
      this.castTimer = this.cfg.castSteps;
    }

    if (this.mode === "CAST" && this.castTimer > 0) {
      this.castTimer -= 1;
      const perp = [-windDir[1] * this.castSign, windDir[0] * this.castSign];
      if (this.castTimer % this.cfg.castTurnPeriod === 0) {
        this.castSign *= -1;
      }
      this.velocity = vecScale(perp, this.cfg.castSpeed);
      return;
    }

    this.mode = "EXPLORE";
    this.levyFlight();
  }

  swarmStigmergy(signal, agents) {
    this.env.addPheromone(this.pos);

    const grad = this.estimateGradient();
    const gradDir = vecUnit(grad);
    let repulse = [0, 0];

    for (const other of agents) {
      if (other === this) continue;
      const delta = vecSub(this.pos, other.pos);
      const dist = vecNorm(delta) + 1e-6;
      if (dist < this.cfg.neighborRadius) {
        const push = vecScale(vecUnit(delta), 1 / dist);
        repulse = vecAdd(repulse, push);
      }
    }

    const pher = this.env.pheromoneAt(this.pos);
    const pherForce = vecScale(gradDir, -pher * this.cfg.pheromoneRepulsion);
    const neighborForce = vecScale(repulse, this.cfg.neighborRepulsion);
    const randForce = [randn(this.rng) * 0.4, randn(this.rng) * 0.4];

    let direction;
    if (signal >= this.cfg.surgeThreshold) {
      direction = vecAdd(vecScale(gradDir, 3), vecScale(neighborForce, 0.3));
    } else {
      direction = vecAdd(vecAdd(vecScale(this.velocity, this.cfg.inertia), pherForce), vecAdd(neighborForce, randForce));
    }

    if (vecNorm(direction) < 1e-6) {
      this.randomWalk();
      return;
    }

    this.velocity = vecScale(vecUnit(direction), this.cfg.stepSize);
  }

  estimateGradient() {
    const eps = this.cfg.gradStep;
    const x = this.pos[0];
    const y = this.pos[1];
    const sX1 = this.env.getSignal([x + eps, y]);
    const sX0 = this.env.getSignal([x - eps, y]);
    const sY1 = this.env.getSignal([x, y + eps]);
    const sY0 = this.env.getSignal([x, y - eps]);
    return [sX1 - sX0, sY1 - sY0];
  }

  applyMotion() {
    const speed = vecNorm(this.velocity);
    if (speed > this.cfg.maxSpeed) {
      this.velocity = vecScale(vecUnit(this.velocity), this.cfg.maxSpeed);
    }
    this.energy -= this.cfg.moveCost * speed * speed;
    this.pos = this.env.applyBoundary(vecAdd(this.pos, this.velocity));
  }
}

function buildConfig(options) {
  const preset = SPEED_PRESETS[options.speed] || SPEED_PRESETS.balanced;
  return {
    size: preset.size,
    numAgents: preset.numAgents,
    numTargets: preset.numTargets,
    maxSteps: preset.maxSteps,
    detectionRadius: 2,
    sensingNoise: 0.15,
    signalStrength: 110,
    signalDecay: 1.0,
    boundary: "reflect",
    stepSize: 1.0,
    maxSpeed: 3.6,
    inertia: 0.3,
    energyInit: 1500,
    moveCost: 0.6,
    senseCost: 0.4,
    levyMu: 2.0,
    levyScale: 1.0,
    levyMaxStep: 30,
    gradStep: 1.0,
    surgeThreshold: 6.0,
    surgeSpeed: 2.4,
    castSpeed: 2.0,
    castSteps: 18,
    castTurnPeriod: 5,
    pheromoneDecay: 0.96,
    pheromoneDeposit: 1.0,
    pheromoneRepulsion: 1.6,
    neighborRepulsion: 1.4,
    neighborRadius: 6,
    wind: [1.0, 0.0],
    plumeMode: options.plume,
    puffRate: 0.25,
    puffLifetime: 80,
    puffDiffusion: 2.0,
    puffAdvect: 0.9,
  };
}

function runTrial(strategy, cfg, rngSeed) {
  const rng = createRNG(rngSeed);
  const env = new Environment(cfg, rng);
  const agents = Array.from({ length: cfg.numAgents }, (_, i) => new Agent(i, env, strategy, cfg, rng));

  const found = new Set();
  let stepsToFirst = cfg.maxSteps;
  let lastStep = cfg.maxSteps;

  for (let step = 0; step < cfg.maxSteps; step += 1) {
    env.step();
    for (const agent of agents) {
      agent.step(agents);
      for (let idx = 0; idx < env.targets.length; idx += 1) {
        if (found.has(idx)) continue;
        const target = env.targets[idx];
        const dx = agent.pos[0] - target[0];
        const dy = agent.pos[1] - target[1];
        const dist = Math.hypot(dx, dy);
        if (dist <= cfg.detectionRadius) {
          found.add(idx);
          if (stepsToFirst === cfg.maxSteps) {
            stepsToFirst = step + 1;
          }
        }
      }
    }

    if (found.size === cfg.numTargets) {
      lastStep = step + 1;
      break;
    }
  }

  const energyUsed = agents.reduce((sum, agent) => sum + (cfg.energyInit - Math.max(agent.energy, 0)), 0);
  return {
    stepsToFirst,
    stepsToAll: lastStep,
    found: found.size,
    energyUsed,
    foundAll: found.size === cfg.numTargets,
  };
}

async function runLeaderboard(options, statusEl) {
  const cfg = buildConfig(options);
  const strategies = [
    Strategy.RANDOM_WALK,
    Strategy.LEVY_FLIGHT,
    Strategy.GRADIENT_ASCENT,
    Strategy.SURGE_CAST,
    Strategy.SWARM_STIGMERGY,
  ];

  const results = {};
  const seedBase = Date.now();

  for (const strategy of strategies) {
    let totals = {
      stepsToFirst: 0,
      stepsToAll: 0,
      energy: 0,
      success: 0,
    };

    for (let t = 0; t < options.trials; t += 1) {
      const res = runTrial(strategy, cfg, seedBase + t * 101 + strategies.indexOf(strategy) * 997);
      totals.stepsToFirst += res.stepsToFirst;
      totals.stepsToAll += res.stepsToAll;
      totals.energy += res.energyUsed;
      totals.success += res.foundAll ? 1 : 0;

      if (t % 2 === 0) {
        statusEl.textContent = `Running ${STRATEGY_LABELS[strategy]} (${t + 1}/${options.trials})...`;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    results[strategy] = {
      avgStepsToFirst: totals.stepsToFirst / options.trials,
      avgStepsToAll: totals.stepsToAll / options.trials,
      avgEnergy: totals.energy / options.trials,
      successRate: totals.success / options.trials,
    };
  }

  return results;
}

function renderResults(results) {
  const table = document.getElementById("sim-table");
  table.innerHTML = "";

  Object.keys(results).forEach((strategyKey) => {
    const res = results[strategyKey];
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${STRATEGY_LABELS[strategyKey]}</td>
      <td>${res.avgStepsToFirst.toFixed(1)}</td>
      <td>${res.avgStepsToAll.toFixed(1)}</td>
      <td>${(res.successRate * 100).toFixed(0)}%</td>
      <td>${res.avgEnergy.toFixed(0)}</td>
    `;

    table.appendChild(row);
  });
}

function renderCharts(results) {
  const stepsCanvas = document.getElementById("chart-steps");
  const successCanvas = document.getElementById("chart-success");
  if (!stepsCanvas || !successCanvas) return;

  const labels = Object.keys(results).map((key) => STRATEGY_LABELS[key]);
  const stepsValues = Object.keys(results).map((key) => results[key].avgStepsToFirst);
  const successValues = Object.keys(results).map((key) => results[key].successRate * 100);

  drawBarChart(stepsCanvas, labels, stepsValues, "#3b6c8f", "Steps");
  drawBarChart(successCanvas, labels, successValues, "#e0764b", "%");
}

function drawBarChart(canvas, labels, values, color, unit) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const padding = 36;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxValue = Math.max(...values, 1);
  const barWidth = chartWidth / values.length - 10;

  ctx.fillStyle = "#efe4d2";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d8c9b2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  values.forEach((value, idx) => {
    const x = padding + idx * (barWidth + 10);
    const barHeight = (value / maxValue) * chartHeight;
    const y = height - padding - barHeight;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#1f2420";
    ctx.font = "11px IBM Plex Sans, sans-serif";
    ctx.fillText(Math.round(value).toString(), x, y - 6);

    const label = labels[idx].split(" ")[0];
    ctx.fillStyle = "#3a3f3b";
    ctx.fillText(label, x, height - padding + 16);
  });

  ctx.fillStyle = "#3a3f3b";
  ctx.font = "11px IBM Plex Sans, sans-serif";
  ctx.fillText(unit, width - padding + 6, padding + 6);
}

function buildCsv(results) {
  const header = ["Strategy", "AvgStepsToFirst", "AvgStepsToAll", "SuccessRate", "AvgEnergy"];
  const rows = [header.join(",")];

  Object.keys(results).forEach((key) => {
    const res = results[key];
    rows.push([
      STRATEGY_LABELS[key],
      res.avgStepsToFirst.toFixed(1),
      res.avgStepsToAll.toFixed(1),
      res.successRate.toFixed(2),
      res.avgEnergy.toFixed(1),
    ].join(","));
  });

  return rows.join("\n");
}

function initAnimation() {
  const canvas = document.getElementById("sim-canvas");
  const startBtn = document.getElementById("anim-start");
  const stopBtn = document.getElementById("anim-stop");
  const strategySelect = document.getElementById("anim-strategy");

  if (!canvas || !startBtn || !stopBtn || !strategySelect) return;

  let animFrame = null;
  let env = null;
  let agents = null;
  let cfg = null;
  let rngSeed = Date.now();

  const ctx = canvas.getContext("2d");

  function resetSimulation(strategyKey) {
    rngSeed += 1234;
    const rng = createRNG(rngSeed);
    cfg = buildConfig({ trials: 1, plume: "turbulent", speed: "fast" });
    env = new Environment(cfg, rng);
    agents = Array.from({ length: cfg.numAgents }, (_, i) => new Agent(i, env, strategyKey, cfg, rng));
  }

  function draw() {
    if (!env || !agents) return;
    env.step();
    agents.forEach((agent) => agent.step(agents));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1c2a30";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / env.size;
    const scaleY = canvas.height / env.size;

    if (env.puffs && env.puffs.length) {
      ctx.fillStyle = "rgba(224,118,75,0.15)";
      env.puffs.slice(0, 50).forEach((puff) => {
        ctx.beginPath();
        ctx.arc(puff.pos[0] * scaleX, puff.pos[1] * scaleY, 12, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.fillStyle = "#f5d1a0";
    env.targets.forEach((t) => {
      ctx.beginPath();
      ctx.arc(t[0] * scaleX, t[1] * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    agents.forEach((agent) => {
      ctx.fillStyle = "#7db1c7";
      ctx.beginPath();
      ctx.arc(agent.pos[0] * scaleX, agent.pos[1] * scaleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    animFrame = requestAnimationFrame(draw);
  }

  startBtn.addEventListener("click", () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    const strategyKey = strategySelect.value;
    resetSimulation(strategyKey);
    draw();
  });

  stopBtn.addEventListener("click", () => {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  });
}

function initSimulator() {
  const runButton = document.getElementById("sim-run");
  const trialsInput = document.getElementById("sim-trials");
  const plumeSelect = document.getElementById("sim-plume");
  const speedSelect = document.getElementById("sim-speed");
  const statusEl = document.getElementById("sim-status");
  const downloadBtn = document.getElementById("sim-download");

  if (!runButton) return;

  runButton.addEventListener("click", async () => {
    const trials = Math.max(1, Math.min(30, Number(trialsInput.value) || 8));
    const plume = plumeSelect.value;
    const speed = speedSelect.value;

    runButton.disabled = true;
    statusEl.textContent = "Starting simulation...";

    const results = await runLeaderboard({ trials, plume, speed }, statusEl);
    renderResults(results);
    renderCharts(results);

    statusEl.textContent = "Complete.";
    runButton.disabled = false;

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const csv = buildCsv(results);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `digital-lab-results-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    }
  });
}

initSimulator();
initAnimation();
