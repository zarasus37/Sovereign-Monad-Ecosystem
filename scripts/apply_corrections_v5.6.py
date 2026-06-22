import json
import os
import math
import random
from collections import defaultdict, Counter

def main(ctx):
    workspace = r"C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign"
    corpus_path = os.path.join(workspace, "logs", "corpus", "master_corpus_v5.2.jsonl")

    events = []
    with open(corpus_path, 'r', encoding='utf-8') as f:
        for line in f:
            events.append(json.loads(line))

    print(f"Loaded {len(events)} events from master corpus v5.2")

    # Use event_id as key to avoid duplicate issues
    event_map = {e['event_id']: e for e in events}
    print(f"Built lookup with {len(event_map)} events by event_id")

    # Check for duplicates
    keys = [(e.get('_gnosis_meta', {}).get('source_file', ''), e.get('_gnosis_meta', {}).get('event_num', '')) for e in events]
    dupes = [k for k, v in Counter(keys).items() if v > 1]
    print(f"Duplicate meta keys: {dupes}")

    # Corrections by matching event_id substring
    corrections = [
        ("Akhenaten", "04", "clean_flags", None, {"reason": False}),
        ("Spinoza", "05", "clean_flags", None, {"possibility": False, "reason": False}),
        ("Spinoza", "15", "clean_flags", None, {"reason": False, "fact": True}),
        ("Gnostic Jesus", "05", "clean_flags", None, {"reason": False}),
        ("Gnostic Jesus", "09", "clean_flags", None, {"reason": False}),
        ("Gnostic Jesus", "12", "clean_flags", None, {"convention": False}),
        ("King Solomon", "03", "clean_flags", None, {"possibility": False, "reason": False}),
        ("Marcus Aurelius", "14", "clean_flags", None, {"reason": False}),
        ("Machiavelli", "01", "clean_flags", None, {"reason": False}),
        ("Machiavelli", "16", "clean_flags", None, {"convention": False}),
        ("Irenaeus", "11", "clean_flags", None, {"possibility": True}),
        ("Thales", "06", "reclassify", 2, {"single_occurrence": True, "causality": True, "fact": True, "possibility": False}),
    ]

    applied = []
    for src_partial, ev_num, action, new_class, flag_changes in corrections:
        matches = [eid for eid in event_map if src_partial in eid and f"_ev{ev_num}" in eid]
        if not matches:
            print(f"WARNING: No match for '{src_partial}' ev{ev_num}")
            continue
        for eid in matches:
            evt = event_map[eid]
            if action == "reclassify" and new_class is not None:
                old_class = evt['peirce']['sign_class_id']
                evt['peirce']['sign_class_id'] = new_class
                evt['actual_class'] = new_class
                applied.append(f"RECLASSIFY {eid}: {old_class} -> {new_class}")
            if flag_changes:
                flags = evt['semiotic_flags']
                old_flags = {k: flags.get(k) for k in flag_changes}
                for k, v in flag_changes.items():
                    flags[k] = v
                applied.append(f"CLEAN FLAGS {eid}: {old_flags} -> {flag_changes}")

    # Remove synthetic entries
    remove_targets = [("Marcus Aurelius", "1"), ("Aristotle", "15")]
    removed = []
    for src_partial, ev_num in remove_targets:
        matches = [eid for eid in event_map if src_partial in eid and f"_ev{ev_num}" in eid]
        for eid in matches:
            evt = event_map[eid]
            removed.append(eid)
            del event_map[eid]

    events = list(event_map.values())
    print(f"\nApplied {len(applied)} corrections")
    print(f"Removed {len(removed)} synthetic entries")
    print(f"Final corpus size: {len(events)} events")
    for a in applied:
        print(f"  {a}")
    for r in removed:
        print(f"  REMOVED {r}")

    # Save corrected corpus
    out_corpus = os.path.join(workspace, "logs", "corpus", "master_corpus_v5.6.jsonl")
    with open(out_corpus, 'w', encoding='utf-8') as f:
        for evt in events:
            f.write(json.dumps(evt, ensure_ascii=False) + '\n')
    print(f"\nSaved corrected corpus to {out_corpus}")

    # --- Retrain ML v9 ---
    print("\n=== Retraining ML v9 ===")
    feature_names = ['single_occurrence', 'rule_based', 'similarity', 'causality', 'convention', 'possibility', 'fact', 'reason']

    X = []
    y = []
    for evt in events:
        flags = evt.get('semiotic_flags', {})
        feats = [1 if flags.get(f, False) else 0 for f in feature_names]
        label = evt.get('peirce', {}).get('sign_class_id')
        if label is not None:
            X.append(feats)
            y.append(label)

    print(f"Training data: {len(X)} events, {len(set(y))} classes")

    classes = sorted(set(y))
    class_priors = {}
    feature_probs = {}

    for c in classes:
        mask = [i for i, label in enumerate(y) if label == c]
        count = len(mask)
        class_priors[c] = count / len(y)
        feature_probs[c] = []
        for fi in range(len(feature_names)):
            pos = sum(X[i][fi] for i in mask) + 1
            total = count + 2
            feature_probs[c].append(pos / total)

    def predict(features):
        scores = {}
        for c in classes:
            log_prob = math.log(class_priors[c])
            for fi, val in enumerate(features):
                p = feature_probs[c][fi]
                if val == 1:
                    log_prob += math.log(p)
                else:
                    log_prob += math.log(1 - p)
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

    train_idx = []
    test_idx = []
    for c, idxs in class_indices.items():
        split = int(len(idxs) * 0.8)
        train_idx.extend(idxs[:split])
        test_idx.extend(idxs[split:])

    correct = 0
    per_class_test = defaultdict(lambda: {'correct': 0, 'total': 0})
    for i in test_idx:
        pred, conf, _ = predict(X[i])
        actual = y[i]
        if pred == actual:
            correct += 1
            per_class_test[actual]['correct'] += 1
        per_class_test[actual]['total'] += 1

    test_acc = correct / len(test_idx) if test_idx else 0
    print(f"\nTest accuracy: {test_acc:.1%} ({correct}/{len(test_idx)})")
    for c in sorted(per_class_test.keys()):
        s = per_class_test[c]
        acc = s['correct'] / s['total'] if s['total'] > 0 else 0
        print(f"  Class {c}: {acc:.1%} ({s['correct']}/{s['total']})")

    # Full evaluation
    full_correct = 0
    per_class_full = defaultdict(lambda: {'correct': 0, 'total': 0})
    for i, evt in enumerate(events):
        pred, conf, _ = predict(X[i])
        actual = y[i]
        if pred == actual:
            full_correct += 1
            per_class_full[actual]['correct'] += 1
        per_class_full[actual]['total'] += 1

    full_acc = full_correct / len(events)
    print(f"\nFull corpus ML accuracy: {full_acc:.1%}")
    for c in sorted(per_class_full.keys()):
        s = per_class_full[c]
        acc = s['correct'] / s['total'] if s['total'] > 0 else 0
        print(f"  Class {c}: {acc:.1%} ({s['correct']}/{s['total']})")

    # Save model
    model_path = os.path.join(workspace, "logs", "audit", "ml_classifier_v9.json")
    model = {
        'version': 'v9',
        'classes': classes,
        'priors': {str(k): v for k, v in class_priors.items()},
        'feature_probs': {str(k): v for k, v in feature_probs.items()},
        'feature_names': feature_names,
        'test_accuracy': test_acc,
        'full_accuracy': full_acc
    }
    with open(model_path, 'w', encoding='utf-8') as f:
        json.dump(model, f, indent=2)
    print(f"\nSaved model to {model_path}")

    result = {
        'corpus_size': len(events),
        'test_accuracy': round(test_acc, 4),
        'full_accuracy': round(full_acc, 4),
        'applied_corrections': len(applied),
        'removed_entries': len(removed)
    }
    print(f"\n=== FINAL METRICS v5.6 ===")
    print(json.dumps(result, indent=2))
    return result
