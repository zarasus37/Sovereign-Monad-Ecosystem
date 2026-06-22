#!/usr/bin/env python3
"""
Train ML Peirce classifier on LOGOC corpus v5.2.
Usage: python scripts/train_ml_classifier.py [--corpus PATH] [--output DIR]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Add package to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.ml_classifier import MLPeirceClassifier, train_classifier
from peirce.classifier import PeirceClassifier


def load_corpus(path: Path) -> list:
    """Load JSONL corpus."""
    events = []
    with open(path, "r") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
    return events


def main():
    parser = argparse.ArgumentParser(description="Train ML Peirce classifier")
    parser.add_argument("--corpus", type=Path, default=Path("logs/corpus/master_corpus_v5.2.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("monad-ecosystem/packages/logoc/ml"))
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    # Resolve paths relative to workspace root
    workspace = Path(__file__).parent.parent.parent.parent
    corpus_path = workspace / args.corpus
    output_dir = workspace / args.output

    print(f"Loading corpus from {corpus_path}")
    events = load_corpus(corpus_path)
    print(f"Loaded {len(events)} events")

    # Count labeled vs pending
    labeled = [e for e in events if e.get("peirce") and e["peirce"].get("sign_class_id") is not None]
    pending = [e for e in events if not e.get("peirce") or e["peirce"].get("sign_class_id") is None]
    print(f"  Labeled: {len(labeled)} | Pending: {len(pending)}")

    # Train ML classifier
    print(f"\nTraining classifier (test_size={args.test_size}, seed={args.seed})...")
    classifier, metrics = train_classifier(events, test_size=args.test_size, random_seed=args.seed)
    print(f"  Train: {metrics['n_train']} | Test: {metrics['n_test']} | Classes: {metrics['n_classes']}")

    print(f"\nModel Performance:")
    print(f"  Logistic Regression: {metrics['logistic_regression']['accuracy']*100:.1f}%")
    print(f"  Ensemble Stumps:     {metrics['ensemble_stumps']['accuracy']*100:.1f}%")
    print(f"  Combined Ensemble:   {metrics['combined']['accuracy']*100:.1f}%")

    print(f"\nPer-class accuracy (combined):")
    for cid, acc in sorted(metrics['ensemble_stumps']['per_class_accuracy'].items()):
        print(f"  Class {cid}: {acc*100:.1f}%")

    # Predict on pending events
    if pending:
        print(f"\nPredicting {len(pending)} pending events...")
        high_conf = 0
        ambiguous = 0
        predictions = []
        for event in pending:
            result = classifier.predict(event)
            if result is None:
                ambiguous += 1
                predictions.append({
                    "event_id": event["event_id"],
                    "predicted": None,
                    "confidence": None,
                    "status": "ambiguous",
                })
            else:
                high_conf += 1
                predictions.append({
                    "event_id": event["event_id"],
                    "predicted": result["sign_class_id"],
                    "confidence": result["confidence"],
                    "status": "predicted",
                })

        print(f"  High confidence: {high_conf} | Ambiguous: {ambiguous}")
        print(f"  Ambiguity rate: {ambiguous/len(pending)*100:.1f}% (target: <10%)")

    # Save artifacts
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "ml_classifier_v2.json"
    classifier.save(model_path)
    print(f"\nSaved model to {model_path}")

    metrics_path = output_dir / "ml_training_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

    if pending:
        preds_path = output_dir / "pending_predictions.json"
        with open(preds_path, "w") as f:
            json.dump(predictions, f, indent=2)
        print(f"Saved predictions to {preds_path}")

    # Compare with rubric baseline
    print(f"\n=== Rubric Baseline Comparison ===")
    rubric = PeirceClassifier()
    rubric_success = 0
    rubric_ambiguous = 0
    for event in events:
        try:
            rubric.classify_path(event)
            rubric_success += 1
        except Exception:
            rubric_ambiguous += 1

    total = len(events)
    print(f"  Rubric:    {rubric_success}/{total} = {rubric_success/total*100:.1f}% success, {rubric_ambiguous/total*100:.1f}% ambiguous")
    # ML covers all events - it always predicts, but confidence threshold may reject
    ml_success = len(labeled) + high_conf if pending else len(labeled)
    ml_ambiguous = ambiguous if pending else 0
    print(f"  ML v2:     {ml_success}/{total} = {ml_success/total*100:.1f}% success, {ml_ambiguous/total*100:.1f}% ambiguous")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
