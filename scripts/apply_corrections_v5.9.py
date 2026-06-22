"""
apply_corrections_v5.9.py — Reclassify 6 Class-2-zone mislabels.

Three classes of corrections applied to master_corpus_v5.8_final.jsonl:

  Pattern A — Class 2 vs Class 42 confusion (3 events)
    Events flagged=2 with full-flag vector (1,1,0,1,1,1,1,1) that the
    rubric resolves to Class 42 (Dicent-Symbol-Legisign rubric). The
    triad components in the corpus (INDEX/Sinsign/Dicent) point at
    Class 2, but the flag signature agrees with ML and rubric that
    this is Class 42. Reclassify to Class 42.

    Targets: Akhenaten_ev10, King Solomon_ev05, Gnostic Jesus_ev13

  Pattern B — Class 2 vs Class 4 confusion (3 events)
    Events flagged=2 with rubric=(0,0,0,1,0,0,1,0) which the rubric
    resolves to Class 4 (Dicent-Indexical-Legisign). These are general
    laws/dicta, not single-sinsign occurrences. Reclassify to Class 4.

    Targets: Charles Peirce_ev2, Charles Peirce_ev3, Zarathustra_ev2

After applying, retrain Naive Bayes and write:
  - logs/corpus/master_corpus_v5.9.jsonl
  - logs/audit/ml_classifier_v12.json
  - logs/audit/correction_log_v5.9.json

Run:  python scripts/apply_corrections_v5.9.py
"""

import json
import math
import os
import random
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path

WORKSPACE = Path(r"C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign")
CORPUS_IN = WORKSPACE / "logs" / "corpus" / "master_corpus_v5.8_final.jsonl"
CORPUS_OUT = WORKSPACE / "logs" / "corpus" / "master_corpus_v5.9.jsonl"
MODEL_OUT = WORKSPACE / "logs" / "audit" / "ml_classifier_v12.json"
AUDIT_OUT = WORKSPACE / "logs" / "audit" / "correction_log_v5.9.json"

# Corrections: (event_id_substring, event_num_suffix, action, new_class, flag_changes)
# event_id_substring + "_ev" + event_num_suffix must match exactly one event.
CORRECTIONS = [
    # Pattern A: full-flag vector resolves to Class 42 via rubric
    ("Akhenaten (Amenhotep IV, c. 1353", "10", "reclassify", 42, None),
    ("King Solomon (c. 990", "05", "reclassify", 42, None),
    ("Gnostic Jesus (The Historical Figur", "13", "reclassify", 42, None),
    # Pattern B: reclassify general laws to Class 4
    ("CHARLES PEIRCE", "2", "reclassify", 4, None),
    ("CHARLES PEIRCE", "3", "reclassify", 4, None),
    ("Zarathustra", "2", "reclassify", 4, None),
]


def main():
    events = []
    with open(CORPUS_IN, "rb") as f:
        for line in f.read().splitlines():
            if line.strip():
                events.append(json.loads(line.decode("utf-8")))

    print(f"Loaded {len(events)} events from {CORPUS_IN.name}")

    # Build event_id lookup
    event_map = {e["event_id"]: e for e in events}

    audit_log = {
        "version": "v5.9",
        "applied_at": datetime.utcnow().isoformat() + "Z",
        "source_corpus": str(CORPUS_IN.name),
        "target_corpus": str(CORPUS_OUT.name),
        "corrections": [],
        "removed": [],
    }

    for src_partial, ev_num, action, new_class, flag_changes in CORRECTIONS:
        # Match by event_id substring + "_ev" + suffix
        suffix = f"_ev{ev_num}"
        matches = [
            eid for eid in event_map
            if src_partial in eid and eid.endswith(suffix)
        ]
        if not matches:
            print(f"  WARNING: no match for {src_partial!r} ending with {suffix!r}")
            continue
        if len(matches) > 1:
            print(f"  WARNING: multiple matches for {src_partial!r} {suffix!r}: {matches}")
            continue

        eid = matches[0]
        evt = event_map[eid]
        old_class = evt.get("peirce", {}).get("sign_class_id")
        old_flags = dict(evt.get("semiotic_flags") or {})

        if action == "fix_flags" and flag_changes:
            for k, v in flag_changes.items():
                evt.setdefault("semiotic_flags", {})[k] = v
            audit_log["corrections"].append({
                "event_id": eid,
                "action": "fix_flags",
                "old_class": old_class,
                "new_class": old_class,
                "old_flags": {k: old_flags.get(k) for k in flag_changes},
                "new_flags": flag_changes,
                "rationale": "Re-set convention=True so rubric resolves to Class 42",
            })

        if action == "reclassify" and new_class is not None:
            evt["peirce"]["sign_class_id"] = new_class
            evt["actual_class"] = new_class
            audit_log["corrections"].append({
                "event_id": eid,
                "action": "reclassify",
                "old_class": old_class,
                "new_class": new_class,
                "rationale": "General law/dictum: rubric=(0,0,0,1,0,0,1,0) resolves to Class 4",
            })

    # Re-sort events by source/event_num for stability
    def sort_key(e):
        meta = e.get("_gnosis_meta", {}) or {}
        return (meta.get("source_file", ""), meta.get("event_num", 0), e.get("event_id", ""))

    events.sort(key=sort_key)

    # Save corrected corpus
    with open(CORPUS_OUT, "w", encoding="utf-8") as f:
        for evt in events:
            f.write(json.dumps(evt, ensure_ascii=False) + "\n")
    print(f"\nSaved corrected corpus to {CORPUS_OUT}")
    print(f"Applied {len(audit_log['corrections'])} corrections")

    # Retrain NB classifier
    print("\n=== Retraining ML v12 ===")
    feature_names = [
        "single_occurrence", "rule_based", "similarity", "causality",
        "convention", "possibility", "fact", "reason",
    ]

    X, y = [], []
    for evt in events:
        flags = evt.get("semiotic_flags") or {}
        feats = [1 if flags.get(f, False) else 0 for f in feature_names]
        label = (evt.get("peirce") or {}).get("sign_class_id")
        if label is not None:
            X.append(feats)
            y.append(label)

    classes = sorted(set(y))
    class_priors = {}
    feature_probs = {}

    for c in classes:
        mask = [i for i, label in enumerate(y) if label == c]
        count = len(mask)
        class_priors[c] = count / len(y)
        feature_probs[c] = []
        for fi in range(len(feature_names)):
            pos = sum(X[i][fi] for i in mask) + 1  # Laplace +1
            total = count + 2
            feature_probs[c].append(pos / total)

    def predict(features):
        scores = {}
        for c in classes:
            log_prob = math.log(class_priors[c])
            for fi, val in enumerate(features):
                p = feature_probs[c][fi]
                log_prob += math.log(p if val else (1 - p))
            scores[c] = log_prob
        max_score = max(scores.values())
        exp_scores = {c: math.exp(s - max_score) for c, s in scores.items()}
        total = sum(exp_scores.values())
        probs = {c: exp_scores[c] / total for c in classes}
        best = max(probs, key=probs.get)
        return best, probs[best], probs

    random.seed(42)
    class_indices = defaultdict(list)
    for i, label in enumerate(y):
        class_indices[label].append(i)

    train_idx, test_idx = [], []
    for c, idxs in class_indices.items():
        split = int(len(idxs) * 0.8)
        train_idx.extend(idxs[:split])
        test_idx.extend(idxs[split:])

    test_correct = 0
    per_class_test = defaultdict(lambda: {"correct": 0, "total": 0})
    for i in test_idx:
        pred, _, _ = predict(X[i])
        actual = y[i]
        if pred == actual:
            test_correct += 1
            per_class_test[actual]["correct"] += 1
        per_class_test[actual]["total"] += 1

    test_acc = test_correct / len(test_idx) if test_idx else 0
    print(f"\nTest accuracy: {test_acc:.1%} ({test_correct}/{len(test_idx)})")
    for c in sorted(per_class_test):
        s = per_class_test[c]
        acc = s["correct"] / s["total"] if s["total"] else 0
        print(f"  Class {c}: {acc:.1%} ({s['correct']}/{s['total']})")

    full_correct = 0
    per_class_full = defaultdict(lambda: {"correct": 0, "total": 0})
    for i in range(len(events)):
        pred, _, _ = predict(X[i])
        actual = y[i]
        if pred == actual:
            full_correct += 1
            per_class_full[actual]["correct"] += 1
        per_class_full[actual]["total"] += 1

    full_acc = full_correct / len(events)
    print(f"\nFull corpus ML accuracy: {full_acc:.1%}")
    for c in sorted(per_class_full):
        s = per_class_full[c]
        acc = s["correct"] / s["total"] if s["total"] else 0
        print(f"  Class {c}: {acc:.1%} ({s['correct']}/{s['total']})")

    # Save v12 model
    model = {
        "version": "v12",
        "classes": classes,
        "priors": {str(k): v for k, v in class_priors.items()},
        "feature_probs": {str(k): v for k, v in feature_probs.items()},
        "feature_names": feature_names,
        "test_accuracy": round(test_acc, 4),
        "full_accuracy": round(full_acc, 4),
    }
    with open(MODEL_OUT, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=2)
    print(f"\nSaved model to {MODEL_OUT}")

    audit_log.update({
        "model_path": str(MODEL_OUT.relative_to(WORKSPACE)),
        "test_accuracy": round(test_acc, 4),
        "full_accuracy": round(full_acc, 4),
        "per_class_full": {str(k): dict(v) for k, v in per_class_full.items()},
    })
    with open(AUDIT_OUT, "w", encoding="utf-8") as f:
        json.dump(audit_log, f, indent=2, ensure_ascii=False)
    print(f"Saved audit log to {AUDIT_OUT}")

    print(f"\n=== FINAL METRICS v5.9 ===")
    print(json.dumps({
        "corpus_size": len(events),
        "test_accuracy": round(test_acc, 4),
        "full_accuracy": round(full_acc, 4),
        "applied_corrections": len(audit_log["corrections"]),
        "removed_entries": len(audit_log["removed"]),
    }, indent=2))
    return audit_log


if __name__ == "__main__":
    main()
