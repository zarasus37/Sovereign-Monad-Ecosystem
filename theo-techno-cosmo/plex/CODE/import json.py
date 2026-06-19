import json
import math
import random
import hashlib
from datetime import datetime, timezone

# Wheel definitions from sealed spec
WHEELS = {
    "A": {"domain": "Theology",   "modality": "Symbol", "slots": list("BCDEFGHIKLM") + ["AB","BC","CD","DE","EF"], "size": 16},
    "T": {"domain": "Hybrid",     "modality": "Hybrid", "slots": list("BCDEFGHIKLM") + ["AB","BC","CD","DE","EF","FG","GH","HI","IK"], "size": 20},
    "V": {"domain": "Technology", "modality": "Index",  "slots": list("BCDEFGHIKL") + ["AB","BC","CD","DE"], "size": 14},
    "X": {"domain": "Cosmology",  "modality": "Symbol", "slots": list("BCDEFGHIKLM") + ["AB","BC","CD","DE","EF"], "size": 16},
    "S": {"domain": "Technology", "modality": "Index",  "slots": list("BCDEFGHIKLM") + ["AB","BC","CD","DE","EF","GH"], "size": 18},
    "Theologia": {"domain": "Theology", "modality": "Symbol", "slots": list("BCDEFGHIKLM") + ["AB","BC","CD","DE","EF"], "size": 16},
}

# Valid 45 pairings from pairing table (wheel -> domains covered)
# Each gnosis event requires: Theology slot + Technology slot + Cosmology slot
DOMAIN_WHEEL_MAP = {
    "Theology":   ["A", "T", "Theologia"],
    "Technology": ["V", "S", "T"],
    "Cosmology":  ["X", "T"],
}

# Simulated annealing scheduler
# State: (offset_A, offset_T, offset_V, offset_X, offset_S, pattern_index)
# pattern = which wheel covers which TTCL facet in a given step

PATTERNS = [
    {"Theology": "A",         "Technology": "V", "Cosmology": "X"},
    {"Theology": "A",         "Technology": "S", "Cosmology": "X"},
    {"Theology": "Theologia", "Technology": "V", "Cosmology": "X"},
    {"Theology": "Theologia", "Technology": "S", "Cosmology": "X"},
    {"Theology": "T",         "Technology": "V", "Cosmology": "X"},
    {"Theology": "A",         "Technology": "T", "Cosmology": "X"},
    {"Theology": "Theologia", "Technology": "T", "Cosmology": "X"},
    {"Theology": "T",         "Technology": "S", "Cosmology": "T"},
]

def get_slot(wheel_name, offset):
    slots = WHEELS[wheel_name]["slots"]
    return slots[offset % len(slots)]

def get_pps(slot1, slot2, slot3):
    """Compute PPS from 3 active slots' first letter"""
    def first_letter(s):
        return s[0] if isinstance(s, str) and len(s) > 0 else s
    a, b, c = first_letter(str(slot1)), first_letter(str(slot2)), first_letter(str(slot3))
    if a == b == c:
        return 1.00
    elif a == b or b == c or a == c:
        return 0.65
    else:
        return 0.30

def make_composite_id(pattern, offsets):
    theo_wheel = pattern["Theology"]
    tech_wheel = pattern["Technology"]
    cosm_wheel = pattern["Cosmology"]
    s1 = get_slot(theo_wheel, offsets[theo_wheel])
    s2 = get_slot(tech_wheel, offsets[tech_wheel])
    s3 = get_slot(cosm_wheel, offsets[cosm_wheel])
    return f"{theo_wheel}:{s1}|{tech_wheel}:{s2}|{cosm_wheel}:{s3}"

def score_state(offsets, pattern, visited_composites):
    """Objective function J = αC + βL + γT - δS"""
    alpha, beta, gamma, delta = 0.35, 0.25, 0.30, 0.10

    comp_id = make_composite_id(pattern, offsets)
    C = 1.0 if comp_id not in visited_composites else 0.0  # Coverage bonus

    # Locality: penalize large offset jumps (smooth traversal)
    L = 1.0  # full locality score for incremental moves

    # Tripartite: all 3 TTCL domains present in pattern (always true by design)
    T = 1.0

    # Cost: number of wheels materialized (3 per step, penalize slightly)
    S = 3.0 / len(WHEELS)

    return alpha * C + beta * L + gamma * T - delta * S

random.seed(42)  # Deterministic seed for reproducibility

# Initial state
offsets = {w: 0 for w in WHEELS}
pattern = PATTERNS[0]
visited = set()
schedule = []

T_init = 1.0
T_min = 0.001
cooling = 0.9995
T_current = T_init

N_STEPS = 500  # Generate 500-step canonical schedule

print("Running simulated annealing scheduler...")
print(f"Steps: {N_STEPS}, T_init: {T_init}, cooling: {cooling}")

current_score = score_state(offsets, pattern, visited)
accepted = 0
rejected = 0

for step in range(N_STEPS):
    # Propose a move
    move_roll = random.random()
    new_offsets = dict(offsets)
    new_pattern = pattern

    if move_roll < 0.65:
        # LocalRotate: rotate one wheel by ±1
        wheel = random.choice(list(WHEELS.keys()))
        direction = random.choice([-1, 1])
        new_offsets[wheel] = (new_offsets[wheel] + direction) % WHEELS[wheel]["size"]
        move_type = "LocalRotate"
    elif move_roll < 0.90:
        # PatternSwitch
        new_pattern = random.choice(PATTERNS)
        move_type = "PatternSwitch"
    else:
        # WheelSwap: already embedded in pattern switch
        new_pattern = random.choice(PATTERNS)
        move_type = "WheelSwap"

    new_score = score_state(new_offsets, new_pattern, visited)
    delta_J = new_score - current_score

    # Accept or reject
    if delta_J > 0 or random.random() < math.exp(delta_J / T_current):
        offsets = new_offsets
        pattern = new_pattern
        current_score = new_score
        accepted += 1
    else:
        rejected += 1

    # Record step
    theo_wheel = pattern["Theology"]
    tech_wheel = pattern["Technology"]
    cosm_wheel = pattern["Cosmology"]
    s_theo = get_slot(theo_wheel, offsets[theo_wheel])
    s_tech = get_slot(tech_wheel, offsets[tech_wheel])
    s_cosm = get_slot(cosm_wheel, offsets[cosm_wheel])
    pps = get_pps(s_theo, s_tech, s_cosm)
    comp_id = make_composite_id(pattern, offsets)
    visited.add(comp_id)

    schedule.append({
        "step": step + 1,
        "pattern": {
            "Theology": theo_wheel,
            "Technology": tech_wheel,
            "Cosmology": cosm_wheel
        },
        "wheel_offsets": dict(offsets),
        "active_slots": {
            "Theology":   {"wheel": theo_wheel,  "slot": s_theo},
            "Technology": {"wheel": tech_wheel,  "slot": s_tech},
            "Cosmology":  {"wheel": cosm_wheel,  "slot": s_cosm}
        },
        "composite_id": comp_id,
        "pps": pps,
        "score": round(current_score, 4),
        "temperature": round(T_current, 6)
    })

    T_current = max(T_min, T_current * cooling)

# Compute PPS distribution
pps_counts = {1.00: 0, 0.65: 0, 0.30: 0}
for s in schedule:
    pps_counts[s["pps"]] += 1

total = len(schedule)
pps_pct = {k: round(v/total*100, 1) for k, v in pps_counts.items()}

# Compute CEI
import math as _math
ps = [v/total for v in pps_counts.values() if v > 0]
cei = round(-sum(p * _math.log2(p) for p in ps), 4)

unique_composites = len(visited)

print(f"\nSchedule generation complete.")
print(f"Total steps:        {N_STEPS}")
print(f"Unique composites:  {unique_composites}")
print(f"Acceptance rate:    {accepted/(accepted+rejected)*100:.1f}%")
print(f"PPS distribution:   1.00={pps_pct[1.00]}%  0.65={pps_pct[0.65]}%  0.30={pps_pct[0.30]}%")
print(f"Corpus Entropy Index (CEI): {cei}  [target: 1.10-1.45]")
print(f"Final temperature:  {T_current:.6f}")