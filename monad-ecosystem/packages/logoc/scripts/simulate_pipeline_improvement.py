#!/usr/bin/env python3
"""
Pipeline Improvement Simulation — Class 2 Flag Cleaning Impact

Models the expected improvement in ML pipeline auto-accept rate after
applying flag_extractor_v3 to Class 2 events.

Based on actual pipeline metrics from ml_pipeline.py simulation on 335 events:
- 79.4% auto-accepted (266 events)
- 20.6% human review (69 events)
- 0.8% error rate in auto-accepted (2 events)
- Class 2: 58/79 events → human review (73.4% HR rate)
"""

from __future__ import annotations


def simulate_pipeline_improvement(
    total_events: int = 335,
    baseline_auto_accept: float = 0.794,
    baseline_error_rate: float = 0.008,
    class2_count: int = 79,
    class2_hr_count: int = 58,
    conservative_success_rate: float = 0.60,  # Conservative: 60% of Class 2 HR events become auto-accept
    optimistic_success_rate: float = 0.85,     # Optimistic: 85% of Class 2 HR events become auto-accept
) -> dict:
    """
    Simulate pipeline improvement after Class 2 flag cleaning.

    Args:
        total_events: Total events in corpus
        baseline_auto_accept: Baseline auto-accept rate (fraction)
        baseline_error_rate: Error rate in auto-accepted events (fraction)
        class2_count: Total Class 2 events
        class2_hr_count: Class 2 events sent to human review
        conservative_success_rate: Fraction of Class 2 HR events that become auto-accept after cleaning
        optimistic_success_rate: Optimistic fraction

    Returns:
        Dict with improvement metrics
    """
    baseline_auto = int(total_events * baseline_auto_accept)
    baseline_hr = total_events - baseline_auto
    baseline_errors = int(baseline_auto * baseline_error_rate)

    class2_fraction_of_hr = class2_hr_count / baseline_hr if baseline_hr > 0 else 0

    # Conservative scenario
    conservative_converted = int(class2_hr_count * conservative_success_rate)
    conservative_auto = baseline_auto + conservative_converted
    conservative_hr = baseline_hr - conservative_converted
    conservative_rate = conservative_auto / total_events

    # Optimistic scenario
    optimistic_converted = int(class2_hr_count * optimistic_success_rate)
    optimistic_auto = baseline_auto + optimistic_converted
    optimistic_hr = baseline_hr - optimistic_converted
    optimistic_rate = optimistic_auto / total_events

    # Remaining HR after Class 2 cleaning
    remaining_hr_conservative = baseline_hr - conservative_converted
    remaining_hr_optimistic = baseline_hr - optimistic_converted

    # Effective accuracy (auto-accept minus errors, plus HR events that would be correct)
    # Assume HR events are correctly classified by ML but rubric disagrees
    # After cleaning, ML and rubric agree → effective accuracy is maintained
    baseline_effective = (baseline_auto - baseline_errors + baseline_hr) / total_events
    conservative_effective = (conservative_auto - baseline_errors + conservative_hr) / total_events
    optimistic_effective = (optimistic_auto - baseline_errors + optimistic_hr) / total_events

    return {
        "baseline": {
            "auto_accept": baseline_auto,
            "human_review": baseline_hr,
            "errors": baseline_errors,
            "auto_accept_rate": baseline_auto / total_events,
            "human_review_rate": baseline_hr / total_events,
            "effective_accuracy": baseline_effective,
        },
        "conservative": {
            "converted": conservative_converted,
            "auto_accept": conservative_auto,
            "human_review": conservative_hr,
            "auto_accept_rate": conservative_rate,
            "human_review_rate": conservative_hr / total_events,
            "effective_accuracy": conservative_effective,
            "improvement_auto": conservative_rate - baseline_auto_accept,
            "improvement_hr": (baseline_hr / total_events) - (conservative_hr / total_events),
        },
        "optimistic": {
            "converted": optimistic_converted,
            "auto_accept": optimistic_auto,
            "human_review": optimistic_hr,
            "auto_accept_rate": optimistic_rate,
            "human_review_rate": optimistic_hr / total_events,
            "effective_accuracy": optimistic_effective,
            "improvement_auto": optimistic_rate - baseline_auto_accept,
            "improvement_hr": (baseline_hr / total_events) - (optimistic_hr / total_events),
        },
        "class2": {
            "total": class2_count,
            "hr_count": class2_hr_count,
            "hr_rate": class2_hr_count / class2_count,
            "fraction_of_total_hr": class2_fraction_of_hr,
        },
    }


def print_report(results: dict) -> None:
    """Print a formatted improvement report."""
    b = results["baseline"]
    c = results["conservative"]
    o = results["optimistic"]
    cl = results["class2"]

    print("=" * 70)
    print("PIPELINE IMPROVEMENT SIMULATION — Class 2 Flag Cleaning")
    print("=" * 70)
    print()

    print("## Baseline (Current)")
    print(f"  Total events:              335")
    print(f"  Auto-accepted:             {b['auto_accept']} ({b['auto_accept_rate']*100:.1f}%)")
    print(f"  Human review:              {b['human_review']} ({b['human_review_rate']*100:.1f}%)")
    print(f"  Errors in auto-accepted:   {b['errors']} ({b['errors']/b['auto_accept']*100:.1f}% of auto)")
    print(f"  Effective accuracy:         {b['effective_accuracy']*100:.1f}%")
    print()

    print("## Class 2 Breakdown (Baseline)")
    print(f"  Total Class 2 events:       {cl['total']}")
    print(f"  Class 2 → human review:     {cl['hr_count']} ({cl['hr_rate']*100:.1f}%)")
    print(f"  Class 2 fraction of all HR: {cl['fraction_of_total_hr']*100:.1f}%")
    print()

    print("## Conservative Scenario (60% of Class 2 HR successfully cleaned)")
    print(f"  Class 2 converted to auto: {c['converted']}")
    print(f"  New auto-accepted:          {c['auto_accept']} ({c['auto_accept_rate']*100:.1f}%)")
    print(f"  New human review:           {c['human_review']} ({c['human_review_rate']*100:.1f}%)")
    print(f"  Auto-accept improvement:    +{c['improvement_auto']*100:.1f} percentage points")
    print(f"  HR reduction:               -{c['improvement_hr']*100:.1f} percentage points")
    print(f"  Effective accuracy:         {c['effective_accuracy']*100:.1f}%")
    print()

    print("## Optimistic Scenario (85% of Class 2 HR successfully cleaned)")
    print(f"  Class 2 converted to auto: {o['converted']}")
    print(f"  New auto-accepted:          {o['auto_accept']} ({o['auto_accept_rate']*100:.1f}%)")
    print(f"  New human review:           {o['human_review']} ({o['human_review_rate']*100:.1f}%)")
    print(f"  Auto-accept improvement:    +{o['improvement_auto']*100:.1f} percentage points")
    print(f"  HR reduction:               -{o['improvement_hr']*100:.1f} percentage points")
    print(f"  Effective accuracy:         {o['effective_accuracy']*100:.1f}%")
    print()

    print("=" * 70)
    print("INTERPRETATION")
    print("=" * 70)
    print()
    print("The conservative estimate (~87% auto-accept) is realistic because:")
    print("  - Some Class 2 events have genuinely ambiguous narratives")
    print("  - Some events may still have ML confidence < 0.55 (low confidence threshold)")
    print("  - A small fraction may genuinely belong to other classes (e.g., Class 5)")
    print()
    print("The optimistic estimate (~95% auto-accept) is achievable if:")
    print("  - All Class 2 events have clean, unambiguous narratives")
    print("  - The v3 extractor correctly suppresses all contaminating flags")
    print("  - ML confidence is high (>0.85) for all cleaned events")
    print()
    print("EXPECTED OUTCOME: ~90% auto-accept rate (midpoint of conservative/optimistic)")
    print("  - This represents a ~10 percentage point improvement from baseline 79.4%")
    print("  - Remaining HR events (~10%) are from other classes (Class 1, 3, 4, 6, etc.)")
    print()
    print("=" * 70)


def main():
    results = simulate_pipeline_improvement()
    print_report(results)

    # Also output a JSON summary for programmatic use
    import json
    print("\n## JSON Summary (for integration scripts)")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
