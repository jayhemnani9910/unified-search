"""Run leaderboard experiments for the Digital Lab."""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt

from digital_lab import Config, Strategy, leaderboard


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Digital Lab leaderboard runner")
    parser.add_argument("--trials", type=int, default=10)
    parser.add_argument("--plume", choices=["static", "turbulent"], default="static")
    parser.add_argument("--save-plots", action="store_true")
    parser.add_argument("--outdir", type=str, default="figures")
    return parser.parse_args()


def make_plots(results: dict, outdir: Path) -> None:
    labels = list(results.keys())
    steps = [results[k]["avg_steps_to_first"] for k in labels]
    success = [results[k]["success_rate"] for k in labels]

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.bar(labels, steps, color="#3b6c8f")
    ax.set_title("Avg Steps to First Find")
    ax.set_ylabel("Steps")
    ax.tick_params(axis='x', rotation=25)
    fig.tight_layout()
    fig.savefig(outdir / "avg_steps_to_first.png", dpi=160)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.bar(labels, success, color="#b95f34")
    ax.set_title("Success Rate (All Targets Found)")
    ax.set_ylabel("Rate")
    ax.set_ylim(0, 1)
    ax.tick_params(axis='x', rotation=25)
    fig.tight_layout()
    fig.savefig(outdir / "success_rate.png", dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    args = parse_args()

    cfg = Config(plume_mode=args.plume)
    strategies = [
        Strategy.RANDOM_WALK,
        Strategy.LEVY_FLIGHT,
        Strategy.GRADIENT_ASCENT,
        Strategy.SURGE_CAST,
        Strategy.SWARM_STIGMERGY,
    ]

    results = leaderboard(strategies, cfg, trials=args.trials)

    print("--- DIGITAL LAB LEADERBOARD ---")
    for name, metrics in results.items():
        print(
            f"{name:16} | steps_first={metrics['avg_steps_to_first']:.1f} "
            f"| steps_all={metrics['avg_steps_to_all']:.1f} "
            f"| success={metrics['success_rate']:.2f} "
            f"| energy={metrics['avg_energy']:.1f}"
        )

    if args.save_plots:
        outdir = Path(args.outdir)
        outdir.mkdir(parents=True, exist_ok=True)
        make_plots(results, outdir)
        print(f"Plots saved to {outdir}")
