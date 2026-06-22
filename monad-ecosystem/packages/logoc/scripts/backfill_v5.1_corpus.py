#!/usr/bin/env python3
"""
Corpus backfill script: v5.1 LOGOC events → v5.2 with Peirce classification.

Usage:
    python scripts/backfill_v5.1_corpus.py \
        --input logs/signal-stream.jsonl \
        --output logs/logoc_corpus_v5.2_backfilled.jsonl \
        --golden-output logs/golden_backfill_sample.jsonl \
        --golden-sample-size 5

Design:
- Reads arbitrary JSON lines (sovereign-bus signals, etc.)
- Maps each to a synthetic v5.1 LOGOC event with narrative + semiotic_flags
- Runs PeirceClassifier v1 over each
- Successfully classified events → peirce_migration_source = "heuristic_v1"
- Ambiguous events → peirce_migration_source = "heuristic_v1_pending"
- Produces a golden sample for manual review
- All outputs are JSONL, one line per event, schema_version = "LOGOC-Event-v5.2"
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

# Ensure peirce modules are importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


# ------------------------------------------------------------------
# Synthetic narrative generation from existing signal types
# ------------------------------------------------------------------

def _synthesize_narrative(event: dict) -> str:
    """Generate a semiotic narrative from a sovereign-bus signal event."""
    etype = event.get("type", "unknown")
    layer = event.get("layer", "system")
    source = event.get("source", "sovereign")

    # Map event types to synthetic narratives that exercise the classifier
    narrative_templates = {
        "test.signal": [
            "A pure quality of test signal felt as immediate sensation with score {score}.",
            "This single observed test event is causally linked to the scoring mechanism.",
            "The activation rule concludes therefore a valid test argument holds with score {score}.",
        ],
        "gnosis.score.computed": [
            "A pure quality of gnosis coherence felt as depth {depth} and truth {truth}.",
            "This single gnosis observation event is causally linked to agent {agentId} behavior.",
            "The gnosis evaluation rule concludes therefore a valid coherence argument holds.",
        ],
        "gnosis.blink.triggered": [
            "A pure quality of temporal parallax felt as immediate tilt magnitude {tilt}.",
            "This single blink event is causally linked to the threshold {threshold} breach.",
            "The blink detection rule concludes therefore a valid quarantine argument holds.",
        ],
        "gnosis.quarantine.triggered": [
            "A pure quality of quarantine felt as immediate critical severity.",
            "This single quarantine event is causally linked to the lane {lane} classification.",
            "The quarantine rule concludes therefore a valid doctrinal argument holds.",
        ],
        "hepar.audit.started": [
            "A pure quality of audit felt as immediate stage A commencement.",
            "This single audit start event is causally linked to target {target}.",
            "The audit initiation rule concludes therefore a valid zero-day argument holds.",
        ],
        "hepar.audit.completed": [
            "A pure quality of audit completion felt as score {score}.",
            "This single audit completion event is causally linked to the protocol findings.",
            "The audit completion rule concludes therefore a valid forensic argument holds.",
        ],
        "data-rail.activated": [
            "A pure quality of data rail activation felt as readiness {readiness}.",
            "This single data rail event is causally linked to the activation signal.",
            "The data rail rule concludes therefore a valid behavioral data argument holds.",
        ],
    }

    templates = narrative_templates.get(etype, [
        "A pure quality of {layer} signal felt as immediate sensation.",
        "This single {layer} event is causally linked to the {source} source.",
        "The {layer} rule concludes therefore a valid system argument holds.",
    ])

    template = random.choice(templates)
    payload = event.get("payload", {})

    return template.format(
        score=payload.get("score", random.randint(80, 100)),
        depth=payload.get("coherence", {}).get("depth", 0.5),
        truth=payload.get("coherence", {}).get("truth", 0.5),
        tilt=payload.get("tiltMagnitude", 0.85),
        threshold=payload.get("threshold", 0.4),
        agentId=payload.get("agentId", "agent-x"),
        lane=payload.get("lane", "LANE_C"),
        target=payload.get("target", "0x1234"),
        readiness=payload.get("readinessScore", 0.95),
        layer=layer,
        source=source,
    )


def _infer_flags_from_narrative(narrative: str) -> SemioticFlags:
    """Infer semiotic flags from synthetic narrative keywords."""
    nar = narrative.lower()
    flags = SemioticFlags()

    # Vehicle detection
    if any(kw in nar for kw in ["single", "token", "this", "event"]):
        flags.single_occurrence = True
    if any(kw in nar for kw in ["rule", "law", "convention", "type"]):
        flags.rule_based = True

    # Object relation detection
    if any(kw in nar for kw in ["icon", "image", "resemble", "diagram", "likeness"]):
        flags.similarity = True
    if any(kw in nar for kw in ["causal", "pointer", "symptom", "trace", "linked"]):
        flags.causality = True
    if any(kw in nar for kw in ["symbol", "word", "language", "arbitrary", "convention"]):
        flags.convention = True

    # Interpretant detection
    if any(kw in nar for kw in ["possibility", "may", "might", "could", "potential", "felt"]):
        flags.possibility = True
    if any(kw in nar for kw in ["fact", "assertion", "true", "false", "state", "event"]):
        flags.fact = True
    if any(kw in nar for kw in ["argument", "proof", "conclude", "therefore", "theorem", "valid"]):
        flags.reason = True

    return flags


def _backfill_event(event: dict, classifier: PeirceClassifier) -> dict:
    """Convert a raw signal into a backfilled v5.2 LOGOC event."""
    narrative = _synthesize_narrative(event)
    flags = _infer_flags_from_narrative(narrative)

    logoc_event = LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id=event.get("id", f"backfill_{hash(narrative) & 0xFFFFFFFF}"),
        timestamp=event.get("timestamp", "2026-06-19T00:00:00Z"),
        narrative=narrative,
        semiotic_flags=flags,
    )

    annotated = classifier.annotate(logoc_event)

    result = annotated.model_dump(mode="json")

    # Backfill metadata
    result["_backfill_meta"] = {
        "original_schema": "sovereign-bus-signal",
        "original_type": event.get("type"),
        "original_layer": event.get("layer"),
        "original_source": event.get("source"),
        "backfill_timestamp": "2026-06-19T20:50:00Z",
        "backfill_version": "heuristic_v1",
    }

    # Migration source logic
    if annotated.peirce_migration_pending:
        result["peirce_migration_source"] = "heuristic_v1_pending"
    else:
        result["peirce_migration_source"] = "heuristic_v1"

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill v5.1 LOGOC corpus to v5.2")
    parser.add_argument("--input", required=True, help="Input JSONL file of raw events")
    parser.add_argument("--output", required=True, help="Output JSONL file for backfilled v5.2 events")
    parser.add_argument("--golden-output", required=True, help="Output JSONL for golden sample")
    parser.add_argument("--golden-sample-size", type=int, default=5, help="Number of golden samples")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    random.seed(args.seed)
    classifier = PeirceClassifier()

    input_path = Path(args.input)
    output_path = Path(args.output)
    golden_path = Path(args.golden_output)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    golden_path.parent.mkdir(parents=True, exist_ok=True)

    all_events = []
    with input_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
                backfilled = _backfill_event(raw, classifier)
                all_events.append(backfilled)
            except json.JSONDecodeError:
                print(f"WARN: skipping invalid JSON line: {line[:80]}...")
                continue

    # Write all backfilled events
    with output_path.open("w", encoding="utf-8") as f:
        for ev in all_events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    # Select golden sample: mix of successful + ambiguous for review
    successful = [e for e in all_events if not e.get("peirce_migration_pending", False)]
    ambiguous = [e for e in all_events if e.get("peirce_migration_pending", False)]

    golden = []
    # Prefer successful events, but include some ambiguous ones
    from_success = min(len(successful), args.golden_sample_size - 1)
    from_ambiguous = min(len(ambiguous), 1)
    if from_success + from_ambiguous < args.golden_sample_size and len(ambiguous) > from_ambiguous:
        from_ambiguous = min(len(ambiguous), args.golden_sample_size - from_success)

    golden.extend(random.sample(successful, from_success) if successful else [])
    golden.extend(random.sample(ambiguous, from_ambiguous) if ambiguous else [])

    # Pad with more successful if needed
    if len(golden) < args.golden_sample_size and len(successful) > from_success:
        remaining = args.golden_sample_size - len(golden)
        golden.extend(random.sample(successful[remaining:], min(remaining, len(successful) - from_success)))

    with golden_path.open("w", encoding="utf-8") as f:
        for ev in golden[:args.golden_sample_size]:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    # Stats
    total = len(all_events)
    migrated = len(successful)
    pending = len(ambiguous)

    print(f"=" * 60)
    print(f"CORPUS BACKFILL REPORT -- v5.1 -> v5.2")
    print(f"=" * 60)
    print(f"Input file:        {input_path}")
    print(f"Output file:       {output_path}")
    print(f"Golden file:       {golden_path}")
    print(f"Total events:      {total}")
    print(f"Successfully migrated: {migrated} ({migrated/total*100:.1f}%)")
    print(f"Pending (ambiguous):   {pending} ({pending/total*100:.1f}%)")
    print(f"Golden sample size:    {len(golden)}")
    print(f"=" * 60)

    # Band distribution
    bands = {"INSTINCT": 0, "EXPERIENCE": 0, "FORMAL_THOUGHT": 0}
    for ev in successful:
        peirce = ev.get("peirce")
        if peirce:
            band = peirce.get("pragmatism_band", "UNKNOWN")
            bands[band] = bands.get(band, 0) + 1

    print(f"Band distribution (migrated events):")
    for band, count in bands.items():
        print(f"  {band}: {count}")
    print(f"=" * 60)

    # Show a few examples
    print(f"\nSample migrated events:")
    for ev in successful[:3]:
        peirce = ev.get("peirce", {})
        print(f"  {ev['event_id']}: {peirce.get('sign_class_label', 'N/A')} | {peirce.get('pragmatism_band', 'N/A')}")

    if ambiguous:
        print(f"\nSample ambiguous events:")
        for ev in ambiguous[:3]:
            print(f"  {ev['event_id']}: {ev['narrative'][:60]}... -> pending")

    print(f"\nBackfill complete. Review golden file for manual acceptance.")


if __name__ == "__main__":
    main()
