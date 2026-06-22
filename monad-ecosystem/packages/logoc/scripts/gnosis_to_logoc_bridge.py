#!/usr/bin/env python3
"""
Gnosis Event Extraction → LOGOC v5.2 Bridge

Parses GNOSIS EVENT EXTRACTION files from theo-techno-cosmo/THE COUNCILE/
and converts each EVENT into a LOGOC-Event-v5.2 with Peirce classification.

Usage:
    python scripts/gnosis_to_logoc_bridge.py \
        --input-dir theo-techno-cosmo/THE_COUNCILE \
        --output logs/gnosis_corpus_v5.2.jsonl \
        --report logs/gnosis_bridge_report.md

Design:
- Each EVENT section becomes one LogocEvent
- Narrative = compressed insight + phenomenological description
- Semiotic flags inferred from phenomenological language markers
- Classifier runs triad-by-triad; ambiguous events flagged for review
- Confidence score from gnosis extraction preserved as metadata
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


def _extract_events(text: str, source_file: str) -> List[Dict]:
    """Parse a gnosis extraction file and return list of event dicts."""
    events = []

    # Split on EVENT headers: ## EVENT 01 — Title
    # or variations like ## EVENT 01 — *Title*
    pattern = r'(?:^|\n)##\s+EVENT\s+(\d+)\s*[—\-–]\s*(.+?)(?=\n##\s+EVENT|\n---\s*$|\Z)'
    matches = list(re.finditer(pattern, text, re.DOTALL))

    if not matches:
        # Try alternate format: ## EVENT 01 — Title (without trailing content)
        pattern2 = r'(?:^|\n)##\s+EVENT\s+(\d+)\s*[—\-–]\s*(.+?)(?=\n##|\Z)'
        matches = list(re.finditer(pattern2, text, re.DOTALL))

    if not matches:
        # Try format: ## 1. Title (used by some files like Charles Peirce, Marcus Aurelius)
        pattern3 = r'(?:^|\n)##\s+(\d+)\.\s+(.+?)(?=\n##\s+\d+\.|\n---\s*$|\Z)'
        matches = list(re.finditer(pattern3, text, re.DOTALL))

    if not matches:
        # Try format: ## N. Title with looser boundary
        pattern4 = r'(?:^|\n)##\s+(\d+)\.\s+(.+?)(?=\n##\s+\d+\.|\Z)'
        matches = list(re.finditer(pattern4, text, re.DOTALL))

    for m in matches:
        event_num = m.group(1).strip()
        event_title = m.group(2).strip().strip('*').strip()
        event_body = m.group(0)

        # Extract compressed insight
        compressed = _extract_section(event_body, r'Compressed\s+[Ii]nsight[:*]?\s*\n?\s*\*?\*?(.+?)(?:\n\*\*|$|\n##)')
        if not compressed:
            compressed = _extract_section(event_body, r'Compressed\s+[Ii]nsight[:*]?\s*\n?(.+?)(?:\n\n|$)')

        # Extract confidence
        confidence = _extract_confidence(event_body)

        # Extract "why it qualifies" (the phenomenological description)
        why = _extract_section(event_body, r'Why\s+[Ii]t\s+[Qq]ualifies[:*]?\s*\n?(.+?)(?:###\s+Three|[Tt]hree-[Dd]omain)')

        # Extract passage/trigger
        passage = _extract_section(event_body, r'[Pp]assage\s+or\s+[Tt]rigger[:*]?\s*\n?(.+?)(?:###\s+Why|[Ww]hy\s+[Ii]t\s+[Qq]ualifies)')

        # Build narrative from best available text
        narrative_parts = []
        if compressed:
            narrative_parts.append(compressed)
        if why:
            # Truncate why to ~200 chars for narrative
            why_short = why[:300].strip()
            if len(why) > 300:
                why_short += "..."
            narrative_parts.append(why_short)
        if not narrative_parts and passage:
            narrative_parts.append(passage[:300])
        if not narrative_parts:
            narrative_parts.append(event_title)

        narrative = " ".join(narrative_parts).replace("\n", " ").strip()
        # Clean up multiple spaces
        narrative = re.sub(r'\s+', ' ', narrative)

        # Extract three-domain reading for metadata
        theology = _extract_section(event_body, r'[Tt]heology[:*]?\s*(.+?)(?:\n[-*]\s*[Tt]echnology|\n###|\n---|\Z)')
        technology = _extract_section(event_body, r'[Tt]echnology[:*]?\s*(.+?)(?:\n[-*]\s*[Cc]osmology|\n###|\n---|\Z)')
        cosmology = _extract_section(event_body, r'[Cc]osmology[:*]?\s*(.+?)(?:\n###|\n---|\Z)')

        events.append({
            "source_file": source_file,
            "event_num": event_num,
            "title": event_title,
            "narrative": narrative,
            "compressed_insight": compressed or "",
            "why_qualifies": why or "",
            "passage": passage or "",
            "theology": theology or "",
            "technology": technology or "",
            "cosmology": cosmology or "",
            "confidence": confidence,
        })

    return events


def _extract_section(text: str, pattern: str) -> Optional[str]:
    """Extract a section using regex, returning cleaned text or None."""
    m = re.search(pattern, text, re.DOTALL)
    if not m:
        return None
    result = m.group(1).strip()
    # Remove markdown bold markers
    result = re.sub(r'\*\*\s*', '', result)
    result = re.sub(r'\*\*', '', result)
    return result


def _extract_confidence(text: str) -> Optional[float]:
    """Extract confidence score like 0.88 or 0.91."""
    m = re.search(r'[Cc]onfidence[:*]?\s*(\d+\.\d+)', text)
    if m:
        return float(m.group(1))
    return None


def _infer_flags_from_gnosis_v3(narrative: str, why: str, compressed: str) -> SemioticFlags:
    """
    Infer semiotic flags using domain-aware v3 disambiguation.

    Replaces v2 keyword matching with contextual analysis that distinguishes:
    - Sinsign (specific occurrence) vs Legisign (general type) vs Qualisign (pure quality)
    - Causal 'because' (Index) vs inferential 'because' (Argument)
    - Descriptive 'law'/'structure' vs legislative 'law'/'structure'

    Args:
        narrative: Primary event narrative
        why: "Why it qualifies" phenomenological description
        compressed: Compressed insight

    Returns:
        SemioticFlags with ambiguous flags resolved
    """
    from scripts.flag_extractor_v3 import clean_and_extract_flags
    flags_dict = clean_and_extract_flags(narrative, why, compressed)
    return SemioticFlags(
        single_occurrence=flags_dict.get("single_occurrence", False),
        rule_based=flags_dict.get("rule_based", False),
        similarity=flags_dict.get("similarity", False),
        causality=flags_dict.get("causality", False),
        convention=flags_dict.get("convention", False),
        possibility=flags_dict.get("possibility", False),
        fact=flags_dict.get("fact", False),
        reason=flags_dict.get("reason", False),
    )

def main() -> None:
    parser = argparse.ArgumentParser(description="Bridge gnosis events to LOGOC v5.2")
    parser.add_argument("--input-dir", default="theo-techno-cosmo/THE COUNCILE", help="Directory with gnosis files")
    parser.add_argument("--output", default="logs/gnosis_corpus_v5.2.jsonl", help="Output JSONL")
    parser.add_argument("--report", default="logs/gnosis_bridge_report.md", help="Report markdown")
    parser.add_argument("--golden-output", default="logs/gnosis_golden_sample.jsonl", help="Golden sample")
    parser.add_argument("--golden-size", type=int, default=10, help="Golden sample size")
    parser.add_argument("--flag-extractor", choices=["v2", "v3"], default="v3", help="Flag extractor version")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    classifier = PeirceClassifier()

    all_events = []
    source_stats = {}

    # Find all .txt and .md files
    files = sorted(input_dir.glob("*.txt")) + sorted(input_dir.glob("*.md"))
    # Skip README and desktop.ini
    files = [f for f in files if f.name not in ("README.md", "desktop.ini")]

    print(f"Scanning {len(files)} gnosis files...")
    print(f"Using flag extractor: {args.flag_extractor}")

    for file_path in files:
        text = file_path.read_text(encoding="utf-8")
        source_name = file_path.stem
        extracted = _extract_events(text, source_name)

        source_stats[source_name] = len(extracted)

        for ev in extracted:
            # Infer flags from gnosis content
            if args.flag_extractor == "v3":
                flags = _infer_flags_from_gnosis_v3(ev["narrative"], ev["why_qualifies"], ev["compressed_insight"])
            else:
                flags = _infer_flags_from_gnosis(ev["narrative"], ev["why_qualifies"], ev["compressed_insight"])

            logoc_event = LogocEvent(
                schema_version="LOGOC-Event-v5.2",
                event_id=f"gnosis_{source_name}_ev{ev['event_num']}",
                timestamp="2026-06-19T00:00:00Z",  # Gnosis events are atemporal in origin; use backfill date
                narrative=ev["narrative"],
                semiotic_flags=flags,
            )

            annotated = classifier.annotate(logoc_event)
            result = annotated.model_dump(mode="json")

            # Add gnosis metadata
            result["_gnosis_meta"] = {
                "source_file": ev["source_file"],
                "event_num": ev["event_num"],
                "title": ev["title"],
                "compressed_insight": ev["compressed_insight"],
                "why_qualifies_excerpt": ev["why_qualifies"][:200] if ev["why_qualifies"] else "",
                "confidence": ev["confidence"],
                "theology_excerpt": ev["theology"][:150] if ev["theology"] else "",
                "technology_excerpt": ev["technology"][:150] if ev["technology"] else "",
                "cosmology_excerpt": ev["cosmology"][:150] if ev["cosmology"] else "",
            }

            # Add flag extractor version for auditability
            result["_flag_extractor_version"] = args.flag_extractor

            # Migration source
            if annotated.peirce_migration_pending:
                result["peirce_migration_source"] = "gnosis_bridge_v1_pending"
            else:
                result["peirce_migration_source"] = "gnosis_bridge_v1"

            all_events.append(result)

    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for ev in all_events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    # Golden sample: successful classifications with high confidence
    successful = [e for e in all_events if not e.get("peirce_migration_pending", False)]
    successful.sort(key=lambda e: e.get("_gnosis_meta", {}).get("confidence") or 0.0, reverse=True)

    golden = successful[:args.golden_size]
    golden_path = Path(args.golden_output)
    with golden_path.open("w", encoding="utf-8") as f:
        for ev in golden:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    # Report
    report_lines = []
    report_lines.append("# Gnosis → LOGOC Bridge Report")
    report_lines.append(f"\n**Date:** 2026-06-19")
    report_lines.append(f"**Flag extractor:** {args.flag_extractor}")
    report_lines.append(f"**Files processed:** {len(files)}")
    report_lines.append(f"**Total events extracted:** {len(all_events)}")
    report_lines.append(f"**Successfully classified:** {len(successful)} ({len(successful)/len(all_events)*100:.1f}%)")
    report_lines.append(f"**Pending (ambiguous):** {len(all_events) - len(successful)} ({(len(all_events) - len(successful))/len(all_events)*100:.1f}%)")
    report_lines.append(f"**Golden sample:** {len(golden)} (highest confidence)")
    report_lines.append("")

    report_lines.append("## Source Distribution")
    report_lines.append("")
    for source, count in sorted(source_stats.items(), key=lambda x: -x[1]):
        report_lines.append(f"- `{source}`: {count} events")
    report_lines.append("")

    # Band distribution
    bands = {"INSTINCT": 0, "EXPERIENCE": 0, "FORMAL_THOUGHT": 0}
    for ev in successful:
        peirce = ev.get("peirce")
        if peirce:
            band = peirce.get("pragmatism_band", "UNKNOWN")
            bands[band] = bands.get(band, 0) + 1

    report_lines.append("## Band Distribution (Successfully Classified)")
    report_lines.append("")
    for band, count in bands.items():
        report_lines.append(f"- {band}: {count}")
    report_lines.append("")

    # Class distribution
    class_counts = {}
    for ev in successful:
        peirce = ev.get("peirce")
        if peirce:
            label = peirce.get("sign_class_label", "UNKNOWN")
            class_counts[label] = class_counts.get(label, 0) + 1

    report_lines.append("## Sign Class Distribution (Top 10)")
    report_lines.append("")
    for label, count in sorted(class_counts.items(), key=lambda x: -x[1])[:10]:
        report_lines.append(f"- {label}: {count}")
    report_lines.append("")

    # Golden sample details
    report_lines.append("## Golden Sample (Highest Confidence, Successfully Classified)")
    report_lines.append("")
    for i, ev in enumerate(golden, 1):
        meta = ev.get("_gnosis_meta", {})
        peirce = ev.get("peirce", {})
        report_lines.append(f"### {i}. {meta.get('title', 'Untitled')} ({meta.get('source_file', 'Unknown')})")
        report_lines.append(f"- **Peirce class:** {peirce.get('sign_class_label', 'N/A')} (ID {peirce.get('sign_class_id', 'N/A')})")
        report_lines.append(f"- **Band:** {peirce.get('pragmatism_band', 'N/A')}")
        report_lines.append(f"- **Gnosis confidence:** {meta.get('confidence', 'N/A')}")
        report_lines.append(f"- **Narrative:** {ev.get('narrative', '')[:120]}...")
        report_lines.append("")

    # Pending events
    pending = [e for e in all_events if e.get("peirce_migration_pending", False)]
    if pending:
        report_lines.append(f"## Pending Events ({len(pending)} — Ambiguous)")
        report_lines.append("")
        report_lines.append("These events need human review or flag enrichment.")
        report_lines.append("")
        for i, ev in enumerate(pending[:5], 1):
            meta = ev.get("_gnosis_meta", {})
            report_lines.append(f"### {i}. {meta.get('title', 'Untitled')}")
            report_lines.append(f"- **Narrative:** {ev.get('narrative', '')[:150]}...")
            report_lines.append("")

    report_lines.append("## Files")
    report_lines.append("")
    report_lines.append(f"- Full corpus: `{args.output}`")
    report_lines.append(f"- Golden sample: `{args.golden_output}`")
    report_lines.append("")

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"GNOSIS -> LOGOC BRIDGE COMPLETE")
    print(f"{'='*60}")
    print(f"Files processed:      {len(files)}")
    print(f"Total events:         {len(all_events)}")
    print(f"Successfully classified: {len(successful)} ({len(successful)/len(all_events)*100:.1f}%)")
    print(f"Pending:              {len(pending)} ({len(pending)/len(all_events)*100:.1f}%)")
    print(f"Golden sample:        {len(golden)}")
    print(f"{'='*60}")
    print(f"Output: {output_path}")
    print(f"Report: {report_path}")
    print(f"Golden: {golden_path}")


if __name__ == "__main__":
    main()
