"""Layer 7.8 cross-runtime parity shim.

A thin stdin/stdout JSON dispatcher that runs the Python reference
implementations (heuristic classifier, ``score_sign``, ``produce_logoc_tier``,
``_round4``) so the TypeScript vitest parity tests can spawn it via
``spawnSync`` and assert the two runtimes agree.

It imports ONLY the pure-Python classification + constitution + logoc_tier
modules (no fastapi, no numpy — the ``_manifold_proxy`` bypasses the heavy
``logoc/peirce/__init__.py`` ML imports). The Gnostic Engine ``src`` tree is
put on ``sys.path`` from this file's location so the shim runs under either
``uv run --project gnostic-engine python`` (pinned interpreter, preferred) or
a plain ``python`` 3.11+ interpreter.

Usage:
    python _parity_shim.py <mode>        # reads one JSON object from stdin

Modes (stdin → stdout, both JSON):
    classifier  {narrative, semiotic_flags}        → {class_id, ambiguous}
    scorer      {Sign spec}                        → {total, pass}
    tier        {class_id}                         → {tier, weight, density}
                                                    (unknown class → {tier:null, error:"UNKNOWN_CLASS"})
    round4      {value}                            → {rounded}
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# ── sys.path bootstrap ───────────────────────────────────────────────────────
# This file: gnostic-engine/tests/_parity_shim.py → src is one level up + src.
_HERE = Path(__file__).resolve().parent
_SRC = _HERE.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


# ── Helpers ─────────────────────────────────────────────────────────────────
def _read_stdin_json() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _write_stdout_json(obj: dict) -> None:
    # Flush so spawnSync receives the full payload; ensure UTF-8 on cp1252
    # Windows consoles (the shim emits only ASCII keys/values, but be safe).
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


# ── Modes ───────────────────────────────────────────────────────────────────
def _mode_classifier(spec: dict) -> dict:
    from gnostic_engine.classification import (
        AmbiguousClassificationError,
        HeuristicClassifier,
        ClassifierInput,
        SemioticFlags,
    )

    known = {
        "single_occurrence",
        "rule_based",
        "similarity",
        "causality",
        "convention",
        "possibility",
        "fact",
        "reason",
    }
    raw_flags = spec.get("semiotic_flags") or {}
    flags = SemioticFlags(**{k: bool(v) for k, v in raw_flags.items() if k in known})
    event = ClassifierInput(narrative=spec.get("narrative"), semiotic_flags=flags)
    try:
        cid = HeuristicClassifier().classify(event)
        return {"class_id": cid, "ambiguous": False}
    except (AmbiguousClassificationError, ValueError, KeyError):
        # Mirrors the TS classifier: an unresolved triad OR a path not on the
        # manifold both surface as "no classification" for parity purposes.
        return {"class_id": None, "ambiguous": True}


def _mode_scorer(spec: dict) -> dict:
    from gnostic_engine.constitution import (
        EventTrace,
        PeirceSignature,
        Sign,
        score_sign,
    )

    p = spec["peirce"]
    peirce = PeirceSignature(
        mode=p["mode"],
        sign_class_id=p["sign_class_id"],
        sign_class_label=p["sign_class_label"],
        path=list(p["path"]),
        firstness_weight=p["firstness_weight"],
        secondness_weight=p["secondness_weight"],
        thirdness_weight=p["thirdness_weight"],
        pragmatism_band=p["pragmatism_band"],
    )
    t = spec.get("trace")
    trace = (
        EventTrace(intention_id=t["intention_id"], source=t.get("source"))
        if t
        else None
    )
    sign = Sign(
        modality=spec["modality"],
        domain=spec["domain"],
        pps=spec["pps"],
        peirce=peirce,
        trace=trace,
        domains=spec.get("domains"),
        no_rlhf=spec.get("no_rlhf"),
    )
    result = score_sign(sign)
    return {"total": result.total, "pass": result.pass_}


def _mode_tier(spec: dict) -> dict:
    from gnostic_engine.logoc_tier import produce_logoc_tier, neighbor_density

    class_id = spec["class_id"]
    try:
        tier, weight = produce_logoc_tier(class_id)
    except KeyError:
        # Unknown class id (manifold.get raises KeyError) — the TS producer
        # throws Error; both sides surface "no tier" for parity.
        return {"tier": None, "weight": None, "density": None, "error": "UNKNOWN_CLASS"}
    return {"tier": tier, "weight": weight, "density": neighbor_density(class_id)}


def _mode_round4(spec: dict) -> dict:
    from gnostic_engine.constitution.scorer import _round4

    return {"rounded": _round4(spec["value"])}


_MODES = {
    "classifier": _mode_classifier,
    "scorer": _mode_scorer,
    "tier": _mode_tier,
    "round4": _mode_round4,
}


# ── Batch variants (one spawn per test, not per case) ────────────────────────
# The TS parity tests send the whole corpus in one stdin payload and receive a
# parallel results array, so a vitest run spawns Python ~once per surface
# instead of once per case (66 tiers / 13 signs / 12 classifiers would
# otherwise each pay uv-startup cost).

def _mode_classifier_all(spec: dict) -> dict:
    return {"results": [_mode_classifier(c) for c in spec["cases"]]}


def _mode_scorer_all(spec: dict) -> dict:
    return {"results": [_mode_scorer(c) for c in spec["cases"]]}


def _mode_tier_all(spec: dict) -> dict:
    return {"results": [_mode_tier({"class_id": cid}) for cid in spec["class_ids"]]}


_BATCH_MODES = {
    "classifier_all": _mode_classifier_all,
    "scorer_all": _mode_scorer_all,
    "tier_all": _mode_tier_all,
}


def main() -> int:
    modes = {**_MODES, **_BATCH_MODES}
    if len(sys.argv) < 2 or sys.argv[1] not in modes:
        _write_stdout_json({"error": f"unknown mode; expected one of {list(modes)}"})
        return 2
    spec = _read_stdin_json()
    try:
        out = modes[sys.argv[1]](spec)
    except Exception as exc:  # surface any unexpected failure to the TS test
        out = {"error": f"{type(exc).__name__}: {exc}"}
    _write_stdout_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())