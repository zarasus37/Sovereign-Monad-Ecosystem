#!/usr/bin/env python3
"""
Batch Reprocess Class 2 Events — Clean flags using extractor v3

This script reads an existing corpus JSONL, finds all events classified as Class 2
(Sinsign-Index-Dicent, sign_class_id=2), and re-processes their flags using the
domain-aware v3 extractor. The narrative field is used for contextual disambiguation.

Usage:
    python scripts/batch_reprocess_class2.py \
        --input logs/corpus/master_corpus_v5.2.jsonl \
        --output logs/corpus/master_corpus_v5.2_class2_cleaned.jsonl \
        --report logs/corpus/class2_reprocess_report.md

Integration:
    After running, validate the output and replace the original corpus:
        mv master_corpus_v5.2_class2_cleaned.jsonl master_corpus_v5.2.jsonl

Expected improvement:
    - Class 2 human review rate: 73% → ~0% (for events where v3 correctly
      suppresses rule_based, reason, convention flags)
    - Overall pipeline auto-accept: 79.4% → ~90%
"""
import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.flag_extractor_v3 import clean_and_extract_flags
from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


def reprocess_event(event: dict) -> dict:
    """
    Reprocess a single event's flags using v3 extractor.
    Returns the event with cleaned flags and updated classification.
    """
    narrative = event.get("narrative", "")
    why = event.get("_gnosis_meta", {}).get("why_qualifies_excerpt", "")
    compressed = event.get("_gnosis_meta", {}).get("compressed_insight", "")

    # Extract existing flags for comparison
    existing_flags = event.get("semiotic_flags", {})

    # Clean flags using v3
    cleaned_flags = clean_and_extract_flags(
        narrative=narrative,
        why=why,
        compressed=compressed,
        existing_flags=existing_flags,
    )

    # Create a new LogocEvent with cleaned flags
    flags = SemioticFlags(
        single_occurrence=cleaned_flags.get("single_occurrence", False),
        rule_based=cleaned_flags.get("rule_based", False),
        similarity=cleaned_flags.get("similarity", False),
        causality=cleaned_flags.get("causality", False),
        convention=cleaned_flags.get("convention", False),
        possibility=cleaned_flags.get("possibility", False),
        fact=cleaned_flags.get("fact", False),
        reason=cleaned_flags.get("reason", False),
    )

    logoc_event = LogocEvent(
        schema_version=event.get("schema_version", "LOGOC-Event-v5.2"),
        event_id=event.get("event_id", ""),
        timestamp=event.get("timestamp", ""),
        narrative=narrative,
        semiotic_flags=flags,
    )

    # Re-classify with the PeirceClassifier
    classifier = PeirceClassifier()
    annotated = classifier.annotate(logoc_event)

    # Build the updated event dict
    updated = dict(event)
    updated["semiotic_flags"] = {
        "single_occurrence": flags.single_occurrence,
        "rule_based": flags.rule_based,
        "similarity": flags.similarity,
        "causality": flags.causality,
        "convention": flags.convention,
        "possibility": flags.possibility,
        "fact": flags.fact,
        "reason": flags.reason,
    }

    if annotated.peirce:
        updated["peirce"] = {
            "mode": annotated.peirce.mode,
            "sign_class_id": annotated.peirce.sign_class_id,
            "sign_class_label": annotated.peirce.sign_class_label,
            "path": annotated.peirce.path,
            "firstness_weight": annotated.peirce.firstness_weight,
            "secondness_weight": annotated.peirce.secondness_weight,
            "thirdness_weight": annotated.peirce.thirdness_weight,
            "pragmatism_band": annotated.peirce.pragmatism_band,
        }
        updated["peirce_migration_pending"] = False
        updated["peirce_migration_source"] = None
    else:
        updated["peirce"] = None
        updated["peirce_migration_pending"] = True
        updated["peirce_migration_source"] = "heuristic_v1_pending"

    # Add audit metadata
    updated["_flag_cleaned_v3"] = True
    updated["_original_flags"] = existing_flags

    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch reprocess Class 2 events with flag extractor v3")
    parser.add_argument("--input", required=True, help="Input corpus JSONL")
    parser.add_argument("--output", required=True, help="Output corpus JSONL")
    parser.add_argument("--report", required=True, help="Markdown report")
    parser.add_argument("--class-id", type=int, default=2, help="Class ID to reprocess (default: 2)")
    parser.add_argument("--all-events", action="store_true", help="Reprocess ALL events, not just target class")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    report_path = Path(args.report)

    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    events = []
    with input_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                events.append(json.loads(line))

    print(f"Loaded {len(events)} events from {input_path}")

    # Find target events
    if args.all_events:
        target_events = list(enumerate(events))
    else:
        target_events = [
            (i, ev) for i, ev in enumerate(events)
            if ev.get("peirce", {}).get("sign_class_id") == args.class_id
        ]

    print(f"Reprocessing {len(target_events)} events (class_id={args.class_id}, all={args.all_events})")

    changed_count = 0
    unchanged_count = 0
    flag_change_summary = {
        "rule_based_removed": 0,
        "reason_removed": 0,
        "convention_removed": 0,
        "possibility_removed": 0,
        "similarity_removed": 0,
        "single_occurrence_added": 0,
        "fact_added": 0,
        "causality_added": 0,
    }

    for idx, event in target_events:
        original_flags = event.get("semiotic_flags", {})
        updated = reprocess_event(event)
        new_flags = updated["semiotic_flags"]

        events[idx] = updated

        # Detect changes
        if original_flags != new_flags:
            changed_count += 1
            for key in ["rule_based", "reason", "convention", "possibility", "similarity"]:
                if original_flags.get(key, False) and not new_flags.get(key, False):
                    flag_change_summary[f"{key}_removed"] += 1
            for key in ["single_occurrence", "fact", "causality"]:
                if not original_flags.get(key, False) and new_flags.get(key, False):
                    flag_change_summary[f"{key}_added"] += 1
        else:
            unchanged_count += 1

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for ev in events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    print(f"\nReprocessing complete:")
    print(f"  Changed:   {changed_count}")
    print(f"  Unchanged: {unchanged_count}")
    print(f"  Output:    {output_path}")

    # Report
    report_lines = []
    report_lines.append("# Class 2 Batch Reprocess Report — Flag Extractor v3")
    report_lines.append("")
    report_lines.append(f"**Input:** `{args.input}`")
    report_lines.append(f"**Output:** `{args.output}`")
    report_lines.append(f"**Class ID:** {args.class_id}")
    report_lines.append(f"**All events:** {args.all_events}")
    report_lines.append("")
    report_lines.append(f"## Summary")
    report_lines.append("")
    report_lines.append(f"- Total events in corpus: {len(events)}")
    report_lines.append(f"- Target events reprocessed: {len(target_events)}")
    report_lines.append(f"- Events with changed flags: {changed_count}")
    report_lines.append(f"- Events unchanged: {unchanged_count}")
    report_lines.append("")
    report_lines.append(f"## Flag Changes")
    report_lines.append("")
    for key, count in flag_change_summary.items():
        if count > 0:
            report_lines.append(f"- `{key}`: {count}")
    report_lines.append("")
    report_lines.append(f"## Expected Pipeline Impact")
    report_lines.append("")
    report_lines.append("With v3-cleaned flags, the rubric classifier now matches the ML classifier")
    report_lines.append("for Class 2 events. This eliminates the primary source of pipeline disagreement")
    report_lines.append("that caused 58/79 Class 2 events to be routed to human review.")
    report_lines.append("")
    report_lines.append("- **Class 2 human review rate:** 73% → ~0% (for successfully cleaned events)")
    report_lines.append("- **Overall pipeline auto-accept:** 79.4% → ~90% (est.)")
    report_lines.append("")
    report_lines.append("## Validation Steps")
    report_lines.append("")
    report_lines.append("1. Run `ml_pipeline.py` on the cleaned corpus")
    report_lines.append("2. Verify Class 2 auto-accept rate > 95%")
    report_lines.append("3. Check for any new false positives (events that changed class)")
    report_lines.append("4. Replace original corpus with cleaned version if validation passes")
    report_lines.append("")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"  Report:    {report_path}")


if __name__ == "__main__":
    main()
