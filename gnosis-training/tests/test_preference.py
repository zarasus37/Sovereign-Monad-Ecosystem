"""preference.py — the spec's biggest silence, concretized (CPU-pure)."""
from __future__ import annotations

import pytest

from gnosis_training.event import GnosisEvent, from_wire
from gnosis_training.preference import (
    PreferencePair,
    build_bootstrap_worksheet,
    load_human_pairs,
    pair_from_wire,
    pair_to_wire,
    serialize_pairs_jsonl,
    validate_pair,
)


def _sample_event(total: float = 0.95, passes: bool = True) -> GnosisEvent:
    wire = {
        "event_id": "a1b2c3d4-1111-5111-8111-111111111111",
        "constitution_version": "v1",
        "wheel_state": {"A": {"offset": 0, "key_hash": "k0"}},
        "active_slots": {
            "theology": {"wheel": "A", "slot": "A", "label": None},
            "technology": {"wheel": "S", "slot": "B", "label": None},
            "cosmology": {"wheel": "X", "slot": "C", "label": None},
        },
        "provenance_tokens": ["reg:A:0"],
        "messages": [
            {"role": "system", "content": "LOGOC system prompt"},
            {"role": "user", "content": "What is entropy?"},
            {"role": "assistant", "content": ""},
        ],
        "constitution_score": {
            "tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
            "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": total, "passes": passes,
        },
    }
    return from_wire(wire)


def _human_pair_wire(gap: float = 0.30, chosen_total: float = 0.95) -> dict:
    rejected_total = chosen_total - gap
    return {
        "pair_id": "PP-001",
        "category": "CAT1",
        "prompt": "What is entropy?",
        "chosen": {
            "response": "THEOLOGICAL LENS: ... LOGIC COMPRESSION: ...",
            "scores": {"tripartite": 1.0, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": chosen_total},
            "notes": "passes all criteria",
        },
        "rejected": {
            "response": "entropy is disorder",
            "scores": {"tripartite": 0.3, "logic_compress": 0.8,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": rejected_total},
            "notes": "missing cosmology",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": False,
        "constitution_version": "v2.0",
        "synthetic": False,
    }


# ── Bootstrap worksheet (Source 1) ──────────────────────────────────────────

def test_bootstrap_worksheet_emits_empty_responses_marked_bootstrap():
    """Source 1: worksheet pairs have EMPTY responses + bootstrap=True (a human
    fills them in). NOT a trainable pair on its own."""
    events = [_sample_event() for _ in range(3)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    assert len(pairs) == 3
    for p in pairs:
        assert p.bootstrap is True
        assert p.chosen.response == ""
        assert p.rejected.response == ""


def test_bootstrap_worksheet_chosen_scores_match_event_constitution_score():
    """The rubric scores are pre-filled from the event's constitution_score
    (NOT a reward-model label — a worksheet seed)."""
    events = [_sample_event(total=0.95)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    assert pairs[0].chosen.scores.total == pytest.approx(0.95)


def test_bootstrap_worksheet_rejected_is_degraded_below_chosen():
    """The rejected side drops one criterion to 0.30 so the worksheet's gap is
    visible before humans author real responses."""
    pairs = build_bootstrap_worksheet([_sample_event(total=0.95)], seed=42)
    assert pairs[0].rejected.scores.total < pairs[0].chosen.scores.total


def test_bootstrap_worksheet_spreads_categories():
    """Worksheet pairs are round-robin-assigned to the reference's 8 categories."""
    events = [_sample_event() for _ in range(8)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    cats = {p.category for p in pairs}
    assert len(cats) == 8  # all 8 categories touched


def test_bootstrap_worksheet_is_deterministic():
    """Same seed → byte-identical worksheet (repo byte-reproducibility gate)."""
    events = [_sample_event() for _ in range(5)]
    a = serialize_pairs_jsonl(build_bootstrap_worksheet(events, seed=42))
    b = serialize_pairs_jsonl(build_bootstrap_worksheet(events, seed=42))
    assert a == b


def test_bootstrap_pair_is_flagged_untrainable_by_validator():
    """validate_pair rejects bootstrap pairs — they need human authoring."""
    pairs = build_bootstrap_worksheet([_sample_event()], seed=42)
    problems = validate_pair(pairs[0])
    assert any("bootstrap" in p for p in problems)


def test_bootstrap_apeiron_flag_when_event_below_pass():
    """An event below the constitution pass threshold → worksheet pair marked
    apeiron (both sides below pass, reference CAT 8)."""
    pairs = build_bootstrap_worksheet([_sample_event(total=0.60, passes=False)], seed=42)
    assert pairs[0].apeiron is True


# ── Human pairs (Source 3 — the trainable path) ─────────────────────────────

def test_pair_from_to_wire_roundtrip_reference_schema():
    """Round-trip preserves the reference preference-pair JSON schema."""
    wire = _human_pair_wire()
    pair: PreferencePair = pair_from_wire(wire)
    assert pair_to_wire(pair) == wire


def test_validate_pair_accepts_good_human_pair():
    """A human-authored pair with a real gap + chosen passing ≥4 criteria is valid."""
    pair = pair_from_wire(_human_pair_wire(gap=0.30, chosen_total=0.95))
    assert validate_pair(pair) == []


def test_validate_pair_rejects_small_gap():
    """RULE 1: gap < 0.15 is too ambiguous."""
    pair = pair_from_wire(_human_pair_wire(gap=0.10, chosen_total=0.95))
    problems = validate_pair(pair)
    assert any("gap" in p for p in problems)


def test_validate_pair_rejects_chosen_failing_too_many_criteria():
    """RULE 2: chosen must pass ≥4 of 5 criteria at ≥0.70."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    # tank chosen on 3 of 5 criteria → only 2 pass
    for c in ("tripartite", "logic_compress", "source_aligned"):
        wire["chosen"]["scores"][c] = 0.40
    wire["chosen"]["scores"]["total"] = 0.50
    pair = pair_from_wire(wire)
    problems = validate_pair(pair)
    assert any("chosen passes" in p for p in problems)


def test_validate_pair_rejects_apeiron_out_of_band():
    """RULE 6: apeiron pairs must have both scores in 0.55–0.71."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    wire["apeiron"] = True
    pair = pair_from_wire(wire)
    problems = validate_pair(pair)
    assert any("apeiron" in p for p in problems)


def test_load_human_pairs_raises_on_bootstrap_pair(tmp_path):
    """The reward model trains on HUMAN-judged pairs (spec line 478); a
    bootstrap worksheet pair must NOT silently enter RM training."""
    worksheet = build_bootstrap_worksheet([_sample_event()], seed=42)
    p = tmp_path / "pairs.jsonl"
    p.write_text(serialize_pairs_jsonl(worksheet), encoding="utf-8")
    with pytest.raises(ValueError, match="bootstrap"):
        load_human_pairs(p)


def test_load_human_pairs_loads_valid_pairs(tmp_path):
    """A file of valid human pairs loads cleanly."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    p = tmp_path / "pairs.jsonl"
    p.write_text(serialize_pairs_jsonl([pair_from_wire(wire)]) , encoding="utf-8")
    pairs = load_human_pairs(p)
    assert len(pairs) == 1
    assert pairs[0].pair_id == "PP-001"


# ── Content-level templating guards (RULES 3/4/5) — the PR #56 fix ──────────

from gnosis_training.preference import (  # noqa: E402  (kept local for grouping)
    detect_worksheet_templating,
    validate_pair_content,
)
from gnosis_training.synth_pairs import build_dry_run_pairs  # noqa: E402


def _pair_wire(
    pair_id="PP-001",
    prompt="What is entropy?",
    chosen_response="THEOLOGICAL LENS: a real tripartite traversal. "
                    "TECHNOLOGICAL LENS: ... COSMOLOGICAL LENS: ... LOGIC COMPRESSION: ...",
    rejected_response="entropy is disorder, full stop.",
    chosen_total=0.95,
    rejected_total=0.60,
    synthetic=False,
    bootstrap=False,
):
    return {
        "pair_id": pair_id,
        "category": "CAT1",
        "prompt": prompt,
        "chosen": {
            "response": chosen_response,
            "scores": {"tripartite": 1.0, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": chosen_total},
            "notes": "ok",
        },
        "rejected": {
            "response": rejected_response,
            "scores": {"tripartite": 0.3, "logic_compress": 0.5,
                       "source_aligned": 0.8, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": rejected_total},
            "notes": "missing cosmology",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": bootstrap,
        "constitution_version": "v2.0",
        "synthetic": synthetic,
    }


def _diverse_pairs(n=8):
    """n pairs with DISTINCT chosen + rejected responses + varied chosen totals
    (the genuine-human-judgment shape — passes RULES 3/4/5)."""
    return [
        pair_from_wire(_pair_wire(
            pair_id=f"PP-{i:03d}",
            chosen_response=f"chosen response number {i} with full tripartite "
                            f"traversal and logic compression unique to pair {i}.",
            rejected_response=f"rejected response number {i}: a single-domain "
                              f"conclusion-only failure unique to pair {i}.",
            chosen_total=0.90 + (i % 6) * 0.01,  # 6 distinct totals 0.90–0.95
            rejected_total=0.60,
        ))
        for i in range(n)
    ]


def test_validate_pair_content_accepts_real_pair():
    """RULE 3: a non-empty, non-echo response is clean."""
    pair = pair_from_wire(_pair_wire())
    assert validate_pair_content(pair) == []
    assert validate_pair(pair) == []  # full validate_pair includes RULE 3


def test_validate_pair_content_rejects_empty_response():
    """RULE 3: a non-bootstrap pair with an empty chosen response is canned."""
    wire = _pair_wire(chosen_response="   ")
    problems = validate_pair_content(pair_from_wire(wire))
    assert any("chosen response is empty" in p for p in problems)


def test_validate_pair_content_rejects_prompt_echo():
    """RULE 3: the response must not be the prompt echoed back (the PR #56 CAT7
    mode — 'answers' that were the prompt repeated)."""
    # exact echo
    wire = _pair_wire(prompt="What is entropy?", chosen_response="What is entropy?")
    problems = validate_pair_content(pair_from_wire(wire))
    assert any("echoes the prompt" in p for p in problems)
    # prompt repeated 4× (the actual #56 CAT7 signature)
    wire = _pair_wire(
        prompt="Define justice in one paragraph.",
        chosen_response="Define justice in one paragraph. "
                        "Define justice in one paragraph. "
                        "Define justice in one paragraph. "
                        "Define justice in one paragraph.",
    )
    problems = validate_pair_content(pair_from_wire(wire))
    assert any("echoes the prompt" in p for p in problems)


def test_validate_pair_content_skips_bootstrap():
    """RULE 3 does not fire on bootstrap pairs (empty responses by design —
    validate_pair flags them separately)."""
    wire = _pair_wire(bootstrap=True, chosen_response="", rejected_response="")
    assert validate_pair_content(pair_from_wire(wire)) == []


def test_detect_worksheet_templating_clean_on_diverse_set():
    """RULES 4/5: a genuine human-judged set (distinct responses + varied totals)
    is clean — does not false-positive on real authoring."""
    assert detect_worksheet_templating(_diverse_pairs(8)) == []


def test_detect_worksheet_templating_flags_canned_templates():
    """RULE 4: the PR #56 signature — many pairs sharing a handful of canned
    responses. 16 pairs, 2 unique chosen / 2 unique rejected → flagged."""
    canned = [
        pair_from_wire(_pair_wire(
            pair_id=f"PP-{i:03d}",
            chosen_response="canned chosen template A" if i % 2 == 0
                             else "canned chosen template B",
            rejected_response="canned rejected template A" if i % 2 == 0
                              else "canned rejected template B",
            chosen_total=0.90 + (i % 6) * 0.01,
            rejected_total=0.55,
        ))
        for i in range(16)
    ]
    problems = detect_worksheet_templating(canned)
    assert any("chosen-response diversity" in p for p in problems)
    assert any("rejected-response diversity" in p for p in problems)


def test_detect_worksheet_templating_flags_constant_chosen_total():
    """RULE 5: every chosen response scored to the SAME total = a generator
    fingerprint. Diverse responses but one chosen total → flagged."""
    constant = [
        pair_from_wire(_pair_wire(
            pair_id=f"PP-{i:03d}",
            chosen_response=f"distinct chosen response {i}",
            rejected_response=f"distinct rejected response {i}",
            chosen_total=0.92,  # constant
            rejected_total=0.60,
        ))
        for i in range(10)
    ]
    problems = detect_worksheet_templating(constant)
    assert any("constant chosen total" in p for p in problems)
    # but response diversity is fine (10/10 unique) — RULE 4 does not fire
    assert not any("diversity" in p for p in problems)


def test_detect_worksheet_templating_skips_synthetic_pairs():
    """The dry-run synth pairs are INTENTIONALLY one canned template; marking
    them ``synthetic=True`` skips the worksheet guard so the dry run is not
    broken (the GPU-verified reward stage loads them via load_human_pairs)."""
    synth = [
        pair_from_wire(_pair_wire(
            pair_id=f"DRY-{i:04d}",
            chosen_response="single canned chosen template",
            rejected_response="single canned rejected template",
            chosen_total=0.80,  # constant
            rejected_total=0.30,
            synthetic=True,
        ))
        for i in range(16)
    ]
    assert detect_worksheet_templating(synth) == []


def test_detect_worksheet_templating_skips_small_sets():
    """Below PREFERENCE_CONTENT_MIN_PAIRS_FOR_DIVERSITY the set is too small to
    judge diversity, so a tiny canned set is not flagged (avoid blocking small
    legitimate worksheets)."""
    small = [
        pair_from_wire(_pair_wire(
            pair_id=f"PP-{i:03d}",
            chosen_response="same chosen",
            rejected_response="same rejected",
            chosen_total=0.92,
        ))
        for i in range(5)  # < 6
    ]
    assert detect_worksheet_templating(small) == []


def test_load_human_pairs_raises_on_templated_file(tmp_path):
    """The reward-trainer loader gates a templated file (the PR #56 recurrence):
    per-pair scores are consistent, but the worksheet-level guard catches the
    canned responses + constant chosen total."""
    canned = [
        pair_from_wire(_pair_wire(
            pair_id=f"PP-{i:03d}",
            chosen_response="canned chosen template",
            rejected_response="canned rejected template",
            chosen_total=0.927,  # the exact #56 constant
            rejected_total=0.50,
        ))
        for i in range(12)
    ]
    p = tmp_path / "templated.jsonl"
    p.write_text(serialize_pairs_jsonl(canned), encoding="utf-8")
    with pytest.raises(ValueError, match="templating guard"):
        load_human_pairs(p)


def test_load_human_pairs_loads_synthetic_pairs_without_templating_raise(tmp_path):
    """The dry-run path: synth pairs (synthetic=True) load via the same loader
    without tripping the worksheet guard, preserving the GPU-verified dry run."""
    # build_dry_run_pairs needs events; reuse a minimal event via the builder's
    # own test helper shape. Construct 8 pairs directly marked synthetic.
    synth = [
        pair_from_wire(_pair_wire(
            pair_id=f"DRY-{i:04d}",
            chosen_response="single canned chosen template",
            rejected_response="single canned rejected template",
            chosen_total=0.80,
            rejected_total=0.30,
            synthetic=True,
        ))
        for i in range(8)
    ]
    p = tmp_path / "synth.jsonl"
    p.write_text(serialize_pairs_jsonl(synth), encoding="utf-8")
    loaded = load_human_pairs(p)
    assert len(loaded) == 8
    # build_dry_run_pairs (the real dry-run builder) now marks pairs synthetic=True
    synth_built = build_dry_run_pairs([_sample_event() for _ in range(5)])
    assert all(p.synthetic for p in synth_built)