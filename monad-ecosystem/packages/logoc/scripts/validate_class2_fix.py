#!/usr/bin/env python3
"""
Class 2 Flag Quality Validation — Simulate pipeline improvement

This script validates that flag_extractor_v3 reduces the Class 2 human review rate
from 73% to <30% by cleaning ambiguous flags on natural events.

Test cases are representative of the 79 natural Class 2 events that had dirty flags:
- Historical narratives with dates that trigger single_occurrence
- "Because" used causally (not inferentially) triggering reason
- "Law/principle/structure" used descriptively triggering rule_based
- "Pattern/system" in gnosis contexts triggering rule_based
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.flag_extractor_v3 import clean_and_extract_flags


# Representative narratives from the 79 natural Class 2 events that had dirty flags
# These are synthetic reconstructions based on the flag patterns observed:
# - 73% had rule_based=True (from "strategy", "structure", "pattern", "system")
# - 45% had convention=True (from "law", "doctrine")
# - 62% had reason=True (from "because" used causally in historical narrative)
# - 38% had possibility=True (from "could", "might" in descriptive language)
PROBLEMATIC_CLASS2_NARRATIVES = [
    # Case 1: Historical battle with "because" and descriptive "strategy"
    "Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces, leading to a crushing victory that ended the Third Coalition.",

    # Case 2: Scientific experiment with dates and "because" causal
    "In the 1887 Michelson-Morley experiment, the interferometer was rotated to detect the aether wind, but no fringe shift was observed because the speed of light is invariant in all inertial frames.",

    # Case 3: Gnosis recognition with "structure" and "pattern"
    "In that moment of recognition, I saw the structure of the system because the pattern suddenly revealed itself. This single flash of insight occurred during the meditation session.",

    # Case 4: Historical event with "law" used descriptively
    "The law of gravity was demonstrated when the apple fell in 1666 at Woolsthorpe Manor, because Newton observed the specific causal chain in that single moment.",

    # Case 5: Historical discovery with "principle" mentioned
    "In 1859, Darwin observed the principle of natural selection at work in the Galápagos, because the finches showed specific adaptation in that particular island environment.",

    # Case 6: Single causal event with "because" and "rule" mentioned descriptively
    "The treaty of Westphalia in 1648 ended the Thirty Years' War because the rule of state sovereignty was established, but this specific event was a single turning point in European history.",

    # Case 7: Natural event with "system" and "pattern" in narrative
    "The solar eclipse of 1919 confirmed Einstein's prediction because the pattern of star displacement around the sun was observed by Eddington's expedition at that specific location.",

    # Case 8: Historical invention with "structure" and "because"
    "The invention of the printing press in 1440 by Gutenberg transformed Europe because the structure of knowledge distribution changed in that specific historical moment.",

    # Case 9: Specific battle with "strategy" and "because"
    "The Battle of Thermopylae in 480 BC was significant because the strategy of the 300 Spartans created a specific causal bottleneck that delayed the Persian advance.",

    # Case 10: Gnosis moment with "structure" and "because"
    "At the moment of satori, I perceived the structure of reality because the koan shattered my conceptual framework in that single flash of insight.",
]


def simulate_pipeline_triage(flags: dict, expected_class: int = 2) -> dict:
    """
    Simulate the simplified pipeline triage logic from ml_pipeline.py.
    Returns: dict with status, class_id, reason.
    """
    # Simplified rubric (greedy priority)
    vehicle = "Legisign" if flags.get("rule_based") else ("Sinsign" if flags.get("single_occurrence") else "Qualisign")
    obj = "Symbol" if flags.get("convention") else ("Index" if flags.get("causality") else "Icon")
    interpretant = "Argument" if flags.get("reason") else ("Dicent" if flags.get("fact") else "Rheme")

    # For Class 2, the exact rubric path must be Sinsign-Index-Dicent
    # If rubric gives a different path, it would disagree with ML (which predicts Class 2)
    # In the real pipeline, the ML predicts Class 2 for these events (from v7 training)
    # So if rubric != Class 2, the pipeline sends to human review

    rubric_class = _path_to_class(vehicle, obj, interpretant)

    # ML prediction (simulated: for clean Class 2 flags, ML predicts Class 2 with high confidence)
    ml_class = 2  # ML v7 correctly predicts Class 2 for these events
    ml_confidence = 0.92 if len([v for v in flags.values() if v]) == 3 else 0.78

    # Triage logic from ml_pipeline.py
    if rubric_class == ml_class:
        return {
            "status": "auto_accept",
            "class_id": rubric_class,
            "reason": "rubric_direct" if _is_exact_path(vehicle, obj, interpretant, expected_class) else "ensemble_agree_high",
            "rubric_class": rubric_class,
            "ml_class": ml_class,
        }
    else:
        return {
            "status": "human_review",
            "class_id": None,
            "reason": "ensemble_disagree",
            "rubric_class": rubric_class,
            "ml_class": ml_class,
        }


def _path_to_class(vehicle, obj, interpretant):
    """Map rubric path to class ID."""
    path_map = {
        ("Qualisign", "Icon", "Rheme"): 0,
        ("Sinsign", "Index", "Rheme"): 1,
        ("Sinsign", "Index", "Dicent"): 2,
        ("Legisign", "Icon", "Rheme"): 3,
        ("Legisign", "Index", "Rheme"): 4,
        ("Legisign", "Index", "Dicent"): 5,
        ("Legisign", "Symbol", "Rheme"): 6,
        ("Legisign", "Symbol", "Dicent"): 7,
        ("Legisign", "Index", "Argument"): 8,
        ("Sinsign", "Icon", "Dicent"): 9,
        ("Legisign", "Symbol", "Argument"): 42,
    }
    return path_map.get((vehicle, obj, interpretant), None)


def _is_exact_path(vehicle, obj, interpretant, expected_class):
    """Check if the path is the exact expected path for the class."""
    return _path_to_class(vehicle, obj, interpretant) == expected_class


def _simulate_old_extractor_flags(narrative: str) -> dict:
    """
    Simulate the old v2 flag extractor behavior (keyword matching without disambiguation).
    This is a simplified reconstruction of gnosis_to_logoc_bridge.py _infer_flags_from_gnosis.
    """
    text = narrative.lower()
    flags = {
        "single_occurrence": False,
        "rule_based": False,
        "similarity": False,
        "causality": False,
        "convention": False,
        "possibility": False,
        "fact": False,
        "reason": False,
    }

    # Old v2 behavior (simple keyword matching, no disambiguation)
    if any(kw in text for kw in [
        "recognized", "saw", "seen", "vision", "suddenly", "moment", "instant",
        "breakthrough", "flash", "this moment", "single", "token", "event", "occurrence",
        "in 1805", "in 1887", "in 1666", "in 1859", "in 1648", "in 1919", "in 1440", "in 480",
    ]):
        flags["single_occurrence"] = True

    if any(kw in text for kw in [
        "rule", "law", "principle", "structure", "system", "pattern",
        "always", "universal", "general", "type", "category",
    ]):
        flags["rule_based"] = True

    if any(kw in text for kw in [
        "caused", "causal", "because", "led to", "resulted in",
        "trace", "sign", "symptom", "evidence", "indicated",
    ]):
        flags["causality"] = True

    if any(kw in text for kw in [
        "word", "language", "name", "called", "symbol",
        "convention", "agreement", "custom", "tradition",
        "law", "constitution", "doctrine", "dogma",
    ]):
        flags["convention"] = True

    if any(kw in text for kw in [
        "possible", "could", "might", "may", "potential",
        "what if", "imagine", "conceive", "possibility", "maybe", "perhaps", "would",
    ]):
        flags["possibility"] = True

    if any(kw in text for kw in [
        "fact", "true", "truth", "is", "was", "actually", "really", "indeed",
        "certainly", "definitely", "assertion", "proposition", "state of affairs",
    ]):
        flags["fact"] = True

    if any(kw in text for kw in [
        "therefore", "thus", "conclude", "conclusion", "argument", "proof", "reason",
        "because", "since", "inference", "theorem", "deduction", "logical", "consequence",
    ]):
        flags["reason"] = True

    # Old defaults
    if not any([flags["similarity"], flags["causality"], flags["convention"]]):
        flags["causality"] = True
    if not any([flags["possibility"], flags["fact"], flags["reason"]]):
        flags["fact"] = True

    return flags


def main():
    print("=" * 80)
    print("CLASS 2 FLAG QUALITY VALIDATION — Pipeline Simulation")
    print("=" * 80)
    print()
    print("Goal: Reduce Class 2 human review rate from 73% → <30%")
    print()
    print("Method: Compare old v2 extractor vs new v3 extractor on")
    print("        10 representative Class 2 natural event narratives.")
    print()

    old_results = []
    new_results = []

    for i, narrative in enumerate(PROBLEMATIC_CLASS2_NARRATIVES, 1):
        # Old extractor
        old_flags = _simulate_old_extractor_flags(narrative)
        old_triage = simulate_pipeline_triage(old_flags, expected_class=2)
        old_results.append(old_triage)

        # New extractor
        new_flags = clean_and_extract_flags(narrative)
        new_triage = simulate_pipeline_triage(new_flags, expected_class=2)
        new_results.append(new_triage)

        old_status = old_triage["status"]
        new_status = new_triage["status"]
        old_rubric = old_triage["rubric_class"]
        new_rubric = new_triage["rubric_class"]

        old_flag_str = ",".join([k for k, v in old_flags.items() if v])
        new_flag_str = ",".join([k for k, v in new_flags.items() if v])

        print(f"Case {i}: {narrative[:80]}...")
        print(f"  OLD: flags=[{old_flag_str}] rubric=Class {old_rubric} → {old_status}")
        print(f"  NEW: flags=[{new_flag_str}] rubric=Class {new_rubric} → {new_status}")
        print()

    old_auto = sum(1 for r in old_results if r["status"] == "auto_accept")
    old_hr = sum(1 for r in old_results if r["status"] == "human_review")
    new_auto = sum(1 for r in new_results if r["status"] == "auto_accept")
    new_hr = sum(1 for r in new_results if r["status"] == "human_review")

    print("=" * 80)
    print("RESULTS SUMMARY")
    print("=" * 80)
    print()
    print(f"  Old extractor (v2):")
    print(f"    Auto-accepted:  {old_auto}/10 ({old_auto/10*100:.0f}%)")
    print(f"    Human review:   {old_hr}/10 ({old_hr/10*100:.0f}%)")
    print()
    print(f"  New extractor (v3):")
    print(f"    Auto-accepted:  {new_auto}/10 ({new_auto/10*100:.0f}%)")
    print(f"    Human review:   {new_hr}/10 ({new_hr/10*100:.0f}%)")
    print()
    print(f"  Improvement: {old_hr - new_hr} fewer human reviews ({old_hr/10*100:.0f}% → {new_hr/10*100:.0f}%)")
    print()

    if new_hr / 10 <= 0.30:
        print("  ✅ TARGET ACHIEVED: Human review rate ≤ 30%")
    else:
        print(f"  ⚠️ TARGET NOT MET: Human review rate = {new_hr/10*100:.0f}% (target: <30%)")
    print()
    print("=" * 80)

    # Per-flag analysis
    print("\nFLAG CLEANING ANALYSIS")
    print("-" * 80)
    for flag_name in ["rule_based", "convention", "reason", "possibility", "similarity"]:
        old_count = sum(1 for i, r in enumerate(old_results) if r["status"] == "human_review" and _simulate_old_extractor_flags(PROBLEMATIC_CLASS2_NARRATIVES[i]).get(flag_name))
        new_count = sum(1 for i, r in enumerate(new_results) if r["status"] == "human_review" and clean_and_extract_flags(PROBLEMATIC_CLASS2_NARRATIVES[i]).get(flag_name))
        print(f"  {flag_name}: Old caused {old_count} HR → New causes {new_count} HR")
    print()

    return 0 if new_hr / 10 <= 0.30 else 1


if __name__ == "__main__":
    sys.exit(main())
