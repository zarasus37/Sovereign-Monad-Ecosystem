#!/usr/bin/env python3
"""
ML Pipeline Integration Module for LOGOC — CLI runner and simulation.

The core LogocMLPipeline class has been moved to peirce/pipeline.py for
production import by classifier.py. This script provides:
  - CLI simulation of the pipeline on a corpus JSONL
  - Statistics and per-class breakdown

Usage:
    python scripts/ml_pipeline.py

Or import the pipeline directly:
    from peirce.pipeline import LogocMLPipeline
"""
import json
from pathlib import Path
from collections import Counter

from peirce.pipeline import LogocMLPipeline


def run_pipeline_simulation(
    corpus_path: str,
    model_path: str,
    spec_path: str,
) -> dict:
    """Run full pipeline simulation on corpus and return statistics."""
    pipeline = LogocMLPipeline(
        model_path=Path(model_path),
        spec_path=Path(spec_path),
    )

    events = []
    with open(corpus_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))

    stats = Counter()
    per_class_stats = {
        int(cid): {"auto_accept": 0, "human_review": 0, "errors": 0}
        for cid in pipeline.sign_classes.keys()
        if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit())
    }

    for e in events:
        result = pipeline.process_event(e)
        true_cid = e["peirce"]["sign_class_id"]

        stats[result["status"]] += 1
        stats[result["reason"]] += 1

        if result["status"] == "auto_accept":
            per_class_stats[true_cid]["auto_accept"] += 1
            if result["class_id"] != true_cid:
                per_class_stats[true_cid]["errors"] += 1
                stats["errors"] += 1
        else:
            per_class_stats[true_cid]["human_review"] += 1

    return {
        "stats": dict(stats),
        "per_class": {int(k): v for k, v in per_class_stats.items()},
        "total": len(events),
    }


if __name__ == "__main__":
    WORKSPACE = Path("C:/Users/crisc/OneDrive - Southern Careers Institute/My Drive/The_Sovereign")

    corpus_path = WORKSPACE / "logs/corpus/master_corpus_v5.2.jsonl"
    model_path = WORKSPACE / "monad-ecosystem/packages/logoc/ml/ml_classifier_v7.json"
    spec_path = WORKSPACE / "monad-ecosystem/packages/logoc/spec/peirce_sign_classes.json"

    results = run_pipeline_simulation(
        str(corpus_path), str(model_path), str(spec_path)
    )

    print("=== ML PIPELINE TRIAGE RESULTS ===\n")
    for k, v in sorted(results["stats"].items(), key=lambda x: -x[1]):
        print(f"  {k}: {v} ({v / results['total'] * 100:.1f}%)")

    print(f"\n=== Per-Class Breakdown ===")
    for cid in sorted(results["per_class"].keys()):
        d = results["per_class"][cid]
        total = d["auto_accept"] + d["human_review"]
        err_rate = d["errors"] / d["auto_accept"] * 100 if d["auto_accept"] > 0 else 0
        print(
            f"  Class {cid}: Auto={d['auto_accept']}, HR={d['human_review']}, "
            f"Errors={d['errors']} ({err_rate:.1f}% of auto)"
        )

    print(f"\n=== Summary ===")
    auto = results["stats"].get("auto_accept", 0)
    hr = results["stats"].get("human_review", 0)
    err = results["stats"].get("errors", 0)
    print(f"Total: {results['total']}")
    print(f"Auto-accepted: {auto} ({auto / results['total'] * 100:.1f}%)")
    print(f"Human review: {hr} ({hr / results['total'] * 100:.1f}%)")
    print(f"Errors in auto-accepted: {err} ({err / auto * 100:.1f}% of auto)")
    print(f"Effective accuracy: {(auto - err + hr) / results['total'] * 100:.1f}%")
