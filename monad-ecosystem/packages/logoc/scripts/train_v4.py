import json, os, sys
from pathlib import Path

WORKSPACE = Path("C:/Users/crisc/OneDrive - Southern Careers Institute/My Drive/The_Sovereign")
sys.path.insert(0, str(WORKSPACE / "monad-ecosystem/packages/logoc"))

from peirce.ml_classifier import train_classifier

def load_corpus(path: Path) -> list:
    events = []
    with open(path, "r") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
    return events

corpus_path = WORKSPACE / "logs/corpus/master_corpus_v5.2.jsonl"
output_dir = WORKSPACE / "monad-ecosystem/packages/logoc/ml"

print(f"Loading corpus from {corpus_path}")
events = load_corpus(corpus_path)
print(f"Loaded {len(events)} events")

labeled = [e for e in events if e.get("peirce") and e["peirce"].get("sign_class_id") is not None]
pending = [e for e in events if not e.get("peirce") or e["peirce"].get("sign_class_id") is None]
print(f"  Labeled: {len(labeled)} | Pending: {len(pending)}")

from collections import Counter
class_counts = Counter(e["peirce"]["sign_class_id"] for e in labeled)
print(f"  Classes: {dict(sorted(class_counts.items()))}")

print(f"\nTraining classifier (test_size=0.2, seed=42)...")
classifier, metrics = train_classifier(events, test_size=0.2, random_seed=42)
print(f"  Train: {metrics['n_train']} | Test: {metrics['n_test']} | Classes: {metrics['n_classes']}")

print(f"\nModel Performance:")
print(f"  Logistic Regression: {metrics['logistic_regression']['accuracy']*100:.1f}%")
print(f"  Naive Bayes:         {metrics['naive_bayes']['accuracy']*100:.1f}%")
print(f"  Ensemble Stumps:     {metrics['ensemble_stumps']['accuracy']*100:.1f}%")
print(f"  Combined Ensemble:   {metrics['combined']['accuracy']*100:.1f}%")

print(f"\nPer-class accuracy (combined):")
for cid, acc in sorted(metrics['combined'].get('per_class_accuracy', {}).items()):
    print(f"  Class {cid}: {acc*100:.1f}%")

print(f"\nPer-class accuracy (Naive Bayes):")
for cid, acc in sorted(metrics['naive_bayes']['per_class_accuracy'].items()):
    print(f"  Class {cid}: {acc*100:.1f}%")

print(f"\nPer-class accuracy (Logistic Regression):")
for cid, acc in sorted(metrics['logistic_regression']['per_class_accuracy'].items()):
    print(f"  Class {cid}: {acc*100:.1f}%")

print(f"\nPer-class accuracy (Ensemble Stumps):")
for cid, acc in sorted(metrics['ensemble_stumps']['per_class_accuracy'].items()):
    print(f"  Class {cid}: {acc*100:.1f}%")

output_dir.mkdir(parents=True, exist_ok=True)
model_path = output_dir / "ml_classifier_v4.json"
classifier.save(model_path)
print(f"\nSaved model to {model_path}")

metrics_path = output_dir / "ml_training_metrics_v4.json"
with open(metrics_path, "w") as f:
    json.dump(metrics, f, indent=2)
print(f"Saved metrics to {metrics_path}")
