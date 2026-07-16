"""One-off promotion: parse the user-authored PROMPTs 26-43 from
``REWARD_MODEL_PREFERENCE_PAIRS_GUIDE.md`` (the section after ``END CANDIDATE
PAIRS``) and append them as ``PP-026..PP-041`` to
``gnosis-training/data/preference_pairs_ALL.jsonl``.

Why a parser, not hand-serialization: the chosen/rejected responses are long
multi-paragraph texts. Hand-escaping 16 of them into JSONL is error-prone.
This script reads the guide's verbatim text, constructs ``PreferencePair``
objects via the existing ``preference.py`` constructors (so escaping +
round-tripping are guaranteed), validates each via ``validate_pair`` (RULES
1/2/3/6), runs the worksheet-level templating guard (RULES 4/5) over the
full 41-pair set, and only then appends.

Scoring convention (mirrors the existing 25 exemplars): the guide gives one
aggregate ``Score`` per side; each response's 5 sub-scores are set uniformly =
that Score (least-fabricating; ``total = mean(5 sub-scores)``). ``failing_criteria``
is derived from the rejected ``TYPE`` annotation using the existing mapping
(A/B -> C1 tripartite, C -> C5 no_rlhf_signal, D -> C4 epistemic, E -> C5).

Idempotent: refuses to run if any of PP-026..PP-041 already exists in the
jsonl (so a re-run cannot double-append). To re-promote, ``git checkout`` the
jsonl first.

CPU-pure (no torch). Not part of the ruff/mypy ``src/`` gate.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# make the package importable when run as a plain script from gnosis-training/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from gnosis_training.preference import (  # noqa: E402
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    detect_worksheet_templating,
    load_human_pairs,
    pair_to_wire,
    validate_pair,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GUIDE = REPO_ROOT / "theo-techno-cosmo" / "plex" / "Review" / "REWARD_MODEL_PREFERENCE_PAIRS_GUIDE.md"
JSONL = REPO_ROOT / "gnosis-training" / "data" / "preference_pairs_ALL.jsonl"

# rejected TYPE letter -> failing criterion code (existing 25-exemplar convention)
TYPE_TO_FAILING: dict[str, str] = {
    "A": "C1",  # Missing Domain       -> tripartite
    "B": "C1",  # Conclusion Only      -> tripartite (journey absent)
    "C": "C5",  # Moralizing           -> no_rlhf_signal
    "D": "C4",  # False Certainty      -> epistemic
    "E": "C5",  # RLHF Contamination   -> no_rlhf_signal
}


def _uniform_scores(total: float) -> PreferenceScores:
    """5 sub-scores all equal to ``total`` (least-fabricating; total = mean)."""
    return PreferenceScores(
        tripartite=total,
        logic_compress=total,
        source_aligned=total,
        epistemic=total,
        no_rlhf_signal=total,
        total=total,
    )


def parse_user_pairs() -> list[PreferencePair]:
    """Parse PROMPTs 26-43 from the guide section after ``END CANDIDATE PAIRS``."""
    text = GUIDE.read_text(encoding="utf-8")
    after = text.split("END CANDIDATE PAIRS", 1)[1]

    # split into (num, body) pairs at each "PROMPT <n>" line
    chunks = re.split(r"(?m)^PROMPT (\d+)\s*$", after)
    # chunks == [pre, num1, body1, num2, body2, ...]
    blocks: list[tuple[int, str]] = []
    i = 1
    while i < len(chunks):
        blocks.append((int(chunks[i]), chunks[i + 1]))
        i += 2

    cat_re = re.compile(r"\n\nCATEGORY: (CAT \d) — [^\n]+\n\nCHOSEN:\n\n")
    type_re = re.compile(r"\n\n(Missing|Failure): ")
    pairs: list[PreferencePair] = []

    for num, body in blocks:
        cm = cat_re.search(body)
        if cm is None:
            raise ValueError(f"PROMPT {num}: could not locate CATEGORY/CHOSEN header")
        category = cm.group(1).replace(" ", "")  # guide "CAT 1" -> canonical "CAT1"
        prompt = body[: cm.start()].strip()
        rest = body[cm.end():]  # begins with the chosen response

        # split chosen from rejected at "\n\nREJECTED — TYPE "
        if "\n\nREJECTED — TYPE " not in rest:
            raise ValueError(f"PROMPT {num}: could not locate REJECTED — TYPE marker")
        chosen_part, rej = rest.split("\n\nREJECTED — TYPE ", 1)

        type_letter = rej[0]
        if type_letter not in TYPE_TO_FAILING:
            raise ValueError(f"PROMPT {num}: unknown TYPE letter {type_letter!r}")

        # chosen_part == "<chosen response>\n\nScore: X.XX"
        if "\n\nScore: " not in chosen_part:
            raise ValueError(f"PROMPT {num}: missing chosen Score")
        chosen_resp, chosen_score_s = chosen_part.rsplit("\n\nScore: ", 1)
        chosen_score = float(chosen_score_s.strip())

        # rej == "X (Label):\n\n<rejected response>\n\n<Missing/Failure: ...>\n\nScore: X.XX\n\nGap: ..."
        # drop the "X (Label):\n\n" prefix (first "):\n\n" is the TYPE line)
        _, rej_body = rej.split("):\n\n", 1)
        am = type_re.search(rej_body)
        if am is None:
            raise ValueError(f"PROMPT {num}: missing Missing/Failure annotation")
        rejected_resp = rej_body[: am.start()]
        after_annot = rej_body[am.start():]  # "\n\nMissing: ...\n\nScore: X.XX\n\nGap: ..."
        notes = after_annot.split("\n\nScore: ", 1)[0].strip()
        rej_score_s = after_annot.split("\n\nScore: ", 1)[1].split("\n\nGap:", 1)[0]
        rejected_score = float(rej_score_s.strip())

        pair = PreferencePair(
            pair_id=f"PP-{26 + len(pairs):03d}",
            category=category,
            prompt=prompt,
            chosen=PreferenceResponse(
                response=chosen_resp.strip(),
                scores=_uniform_scores(chosen_score),
                notes=f"chosen — full tripartite traversal + logic compression (guide PROMPT {num})",
            ),
            rejected=PreferenceResponse(
                response=rejected_resp.strip(),
                scores=_uniform_scores(rejected_score),
                notes=notes,
            ),
            failing_criteria=[TYPE_TO_FAILING[type_letter]],
            apeiron=False,
            bootstrap=False,
            constitution_version="v2.0",
            synthetic=False,
        )
        pairs.append(pair)

    return pairs


def main() -> int:
    new_pairs = parse_user_pairs()
    print(f"Parsed {len(new_pairs)} user-authored pairs from the guide:")
    for p in new_pairs:
        gap = p.chosen.scores.total - p.rejected.scores.total
        guide_prompt = p.chosen.notes.rsplit("PROMPT ", 1)[-1].rstrip(")")
        print(
            f"  {p.pair_id}  guide PROMPT {guide_prompt}  "
            f"{p.category}  TYPE->failing={p.failing_criteria[0]}  "
            f"chosen={p.chosen.scores.total:.2f} rejected={p.rejected.scores.total:.2f} gap={gap:.2f}"
        )
    if len(new_pairs) != 16:
        print(f"EXPECTED 16 pairs, got {len(new_pairs)}", file=sys.stderr)
        return 1

    # per-pair validation (RULES 1/2/3/6)
    for p in new_pairs:
        probs = validate_pair(p)
        if probs:
            print(f"INVALID {p.pair_id}: {probs}", file=sys.stderr)
            return 1
    print("Per-pair validate_pair: all 16 clean (RULES 1/2/3/6).")

    # idempotency guard: refuse if any of PP-026..PP-041 already present
    existing_ids = {p.pair_id for p in load_human_pairs(JSONL)}
    new_ids = {p.pair_id for p in new_pairs}
    clash = existing_ids & new_ids
    if clash:
        print(
            f"REFUSING: {sorted(clash)} already in {JSONL.name} — git checkout the "
            f"jsonl before re-running (idempotency guard).",
            file=sys.stderr,
        )
        return 1

    # worksheet-level templating guard (RULES 4/5) over the full 41-pair set
    all_pairs = load_human_pairs(JSONL) + new_pairs
    templating = detect_worksheet_templating(all_pairs)
    if templating:
        print(f"TEMPLATING GUARD FAILED over {len(all_pairs)} pairs: {templating}", file=sys.stderr)
        return 1
    print(f"Worksheet templating guard (RULES 4/5) clean over {len(all_pairs)} pairs.")

    # append
    with JSONL.open("a", encoding="utf-8") as fh:
        for p in new_pairs:
            fh.write(json.dumps(pair_to_wire(p), ensure_ascii=False) + "\n")
    print(f"Appended {len(new_pairs)} pairs -> {JSONL.name} ({len(all_pairs)} total).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())