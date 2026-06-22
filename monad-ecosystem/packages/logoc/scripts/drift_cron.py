#!/usr/bin/env python3
"""
drift_cron.py — Standalone semiotic drift detection for LOGOC corpus.

Runs periodically to:
1. Load current corpus from master_corpus_v5.2.jsonl
2. Compute distribution snapshot
3. Compare against previous snapshot (if exists)
4. Log drift observation if drift score > threshold
5. Write alerts to drift log directory

Usage: python drift_cron.py [--force]
"""

import json
import math
import time
import sys
from pathlib import Path
from collections import Counter
from datetime import datetime

# ── Configuration ──────────────────────────────────────────────────────────────

WORKSPACE = Path("C:/Users/crisc/OneDrive - Southern Careers Institute/My Drive/The_Sovereign")
CORPUS_PATH = WORKSPACE / "logs/corpus/master_corpus_v5.2.jsonl"
DRIFT_DIR = WORKSPACE / "logs/semiotic_drift"
SNAPSHOT_DIR = DRIFT_DIR / "snapshots"
ALERT_THRESHOLD = 0.28  # SYSTEMATIC_DRIFT
ANOMALY_THRESHOLD = 0.72  # ANOMALOUS_DEVIATION
MIN_EVENTS = 10

SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


# ── Snapshot computation ──────────────────────────────────────────────────────

def compute_snapshot(events, cycle_id):
    """Compute distribution snapshot from list of event dicts."""
    accepted = [e for e in events if e.get("peirce") and e["peirce"].get("sign_class_id") is not None]
    pending = [e for e in events if not e.get("peirce") or e["peirce"].get("sign_class_id") is None]
    
    class_hist = Counter()
    band_hist = Counter()
    mode_hist = Counter()
    vehicle_hist = Counter()
    object_hist = Counter()
    interpretant_hist = Counter()
    
    firstness_sum = 0.0
    secondness_sum = 0.0
    thirdness_sum = 0.0
    
    for e in accepted:
        p = e["peirce"]
        cid = p["sign_class_id"]
        class_hist[cid] += 1
        band_hist[p["pragmatism_band"]] += 1
        mode_hist[p["mode"]] += 1
        path = p["path"]
        if len(path) >= 3:
            vehicle_hist[path[0]] += 1
            object_hist[path[1]] += 1
            interpretant_hist[path[2]] += 1
        firstness_sum += p.get("firstness_weight", 0.33)
        secondness_sum += p.get("secondness_weight", 0.33)
        thirdness_sum += p.get("thirdness_weight", 0.33)
    
    n = len(accepted)
    return {
        "cycle_id": cycle_id,
        "timestamp": time.time(),
        "datetime_utc": datetime.utcnow().isoformat() + "Z",
        "total_events": len(events),
        "accepted_events": len(accepted),
        "pending_events": len(pending),
        "class_histogram": dict(class_hist),
        "band_histogram": dict(band_hist),
        "mode_histogram": dict(mode_hist),
        "vehicle_histogram": dict(vehicle_hist),
        "object_histogram": dict(object_hist),
        "interpretant_histogram": dict(interpretant_hist),
        "avg_firstness": round(firstness_sum / n, 4) if n > 0 else 0.0,
        "avg_secondness": round(secondness_sum / n, 4) if n > 0 else 0.0,
        "avg_thirdness": round(thirdness_sum / n, 4) if n > 0 else 0.0,
        "avg_pps": round(1.0 - (firstness_sum / n if n > 0 else 0.0), 4),
    }


def load_snapshot(cycle_id):
    path = SNAPSHOT_DIR / f"snapshot_{cycle_id}.json"
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return None


def save_snapshot(snapshot):
    path = SNAPSHOT_DIR / f"snapshot_{snapshot['cycle_id']}.json"
    with open(path, "w") as f:
        json.dump(snapshot, f, indent=2)


# ── Drift computation ───────────────────────────────────────────────────────────

def normalize_histogram(hist, total):
    if total == 0:
        return {}
    return {str(k): v / total for k, v in hist.items()}


def compute_drift(current, previous):
    """Compute drift observation between two snapshots."""
    obs = {
        "cycle_id": current["cycle_id"],
        "previous_cycle_id": previous["cycle_id"],
        "timestamp": time.time(),
        "datetime_utc": datetime.utcnow().isoformat() + "Z",
        "kl_divergence": 0.0,
        "chi_squared": 0.0,
        "max_class_delta": 0.0,
        "max_class_delta_id": None,
        "band_deltas": {},
        "drift_patterns": [],
        "drift_score": 0.0,
        "category": "WITHIN_VARIANCE",
    }
    
    curr_total = current["accepted_events"]
    prev_total = previous["accepted_events"]
    
    if curr_total < MIN_EVENTS or prev_total < MIN_EVENTS:
        return obs
    
    prev_dist = normalize_histogram(previous["class_histogram"], prev_total)
    curr_dist = normalize_histogram(current["class_histogram"], curr_total)
    
    # KL divergence
    kl = 0.0
    for cid, p in prev_dist.items():
        q = curr_dist.get(cid, 1e-10)
        if p > 0:
            kl += p * math.log(p / q)
    obs["kl_divergence"] = round(kl, 6)
    
    # Chi-squared
    chi2 = 0.0
    for cid in set(prev_dist.keys()) | set(curr_dist.keys()):
        p = prev_dist.get(cid, 0.0)
        q = curr_dist.get(cid, 0.0)
        if p > 0:
            chi2 += (q - p) ** 2 / p
    obs["chi_squared"] = round(chi2, 6)
    
    # Max class delta
    max_delta = 0.0
    max_delta_id = None
    for cid in set(prev_dist.keys()) | set(curr_dist.keys()):
        p = prev_dist.get(cid, 0.0)
        q = curr_dist.get(cid, 0.0)
        delta = abs(q - p)
        if delta > max_delta:
            max_delta = delta
            max_delta_id = cid
    obs["max_class_delta"] = round(max_delta, 4)
    obs["max_class_delta_id"] = max_delta_id
    
    # Band deltas
    prev_bands = normalize_histogram(previous["band_histogram"], prev_total)
    curr_bands = normalize_histogram(current["band_histogram"], curr_total)
    for band in set(prev_bands.keys()) | set(curr_bands.keys()):
        p = prev_bands.get(band, 0.0)
        q = curr_bands.get(band, 0.0)
        obs["band_deltas"][band] = round(q - p, 4)
    
    # Pattern detection
    patterns = []
    
    # ICON_SURGE
    prev_icon = previous["mode_histogram"].get("ICON", 0) / prev_total
    curr_icon = current["mode_histogram"].get("ICON", 0) / curr_total
    if curr_icon > prev_icon + 0.15 and curr_icon > 0.3:
        patterns.append("ICON_SURGE")
    
    # FORMAL_THOUGHT_DECLINE
    prev_formal = previous["band_histogram"].get("FORMAL_THOUGHT", 0) / prev_total
    curr_formal = current["band_histogram"].get("FORMAL_THOUGHT", 0) / curr_total
    if prev_formal - curr_formal > 0.15 and curr_formal < 0.4:
        patterns.append("FORMAL_THOUGHT_DECLINE")
    
    # INDEX_ATROPHY
    prev_index = previous["mode_histogram"].get("INDEX", 0) / prev_total
    curr_index = current["mode_histogram"].get("INDEX", 0) / curr_total
    if prev_index - curr_index > 0.15 and curr_index < 0.2:
        patterns.append("INDEX_ATROPHY")
    
    # FIRSTNESS_SURGE
    if current["avg_firstness"] > previous["avg_firstness"] + 0.15 and current["avg_firstness"] > 0.45:
        patterns.append("FIRSTNESS_SURGE")
    
    # THIRDNESS_COLLAPSE
    if previous["avg_thirdness"] - current["avg_thirdness"] > 0.15 and current["avg_thirdness"] < 0.25:
        patterns.append("THIRDNESS_COLLAPSE")
    
    obs["drift_patterns"] = patterns
    
    # Composite drift score
    score = 0.0
    score += min(kl * 2.0, 0.3)
    score += min(chi2 * 0.5, 0.3)
    score += max_delta * 0.3
    score += len(patterns) * 0.1
    obs["drift_score"] = round(min(score, 1.0), 4)
    
    # Category
    if obs["drift_score"] >= ANOMALY_THRESHOLD:
        obs["category"] = "ANOMALOUS_DEVIATION"
    elif obs["drift_score"] >= ALERT_THRESHOLD:
        obs["category"] = "SYSTEMATIC_DRIFT"
    else:
        obs["category"] = "WITHIN_VARIANCE"
    
    return obs


def save_drift(obs):
    prev_id = obs["previous_cycle_id"]
    curr_id = obs["cycle_id"]
    path = DRIFT_DIR / f"drift_{prev_id}_to_{curr_id}.json"
    with open(path, "w") as f:
        json.dump(obs, f, indent=2)


def main(force=False):
    # Load corpus
    events = []
    with open(CORPUS_PATH, "r") as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
    
    if not events:
        print("No events in corpus.")
        return 1
    
    # Find previous snapshot BEFORE saving current one
    snapshot_files = sorted(SNAPSHOT_DIR.glob("snapshot_*.json"))
    previous = None
    if len(snapshot_files) >= 1:
        with open(snapshot_files[-1], "r") as f:
            previous = json.load(f)
    
    cycle_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    current = compute_snapshot(events, cycle_id)
    save_snapshot(current)
    
    print(f"Snapshot: {cycle_id}")
    print(f"  Total: {current['total_events']}, Accepted: {current['accepted_events']}, Pending: {current['pending_events']}")
    print(f"  Firstness: {current['avg_firstness']}, Secondness: {current['avg_secondness']}, Thirdness: {current['avg_thirdness']}")
    
    if previous:
        obs = compute_drift(current, previous)
        save_drift(obs)
        
        print(f"\nDrift: {obs['previous_cycle_id']} → {obs['cycle_id']}")
        print(f"  Score: {obs['drift_score']}, Category: {obs['category']}")
        print(f"  KL: {obs['kl_divergence']}, Chi2: {obs['chi_squared']}")
        print(f"  Max delta: {obs['max_class_delta']} (Class {obs['max_class_delta_id']})")
        print(f"  Patterns: {obs['drift_patterns']}")
        print(f"  Band deltas: {obs['band_deltas']}")
        
        if obs["category"] in ("SYSTEMATIC_DRIFT", "ANOMALOUS_DEVIATION"):
            print(f"\n⚠️  ALERT: Semiotic drift detected!")
            return 2  # Non-zero exit for cron alerting
    else:
        print("\nNo previous snapshot for comparison.")
    
    return 0


if __name__ == "__main__":
    force = "--force" in sys.argv
    sys.exit(main(force))
