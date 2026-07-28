"""CLI entry: ``python -m gnosis_training <mode>``.

Modes:
  - ``sft <train_jsonl> [--dry-run]``  — run Stage 1 SFT (GPU-only). Without
    ``--dry-run`` this is a documented future GPU job (no execution). With
    ``--dry-run`` it executes the REAL QLoRA SFT path on a tiny model
    (Qwen2.5-0.5B) to verify the pipeline.
  - ``reward <preference_pairs_jsonl> [--dry-run|--stage2-v2]`` — Stage 2 reward model.
    ``--stage2-v2`` runs Vector 6.1 (human pairs → checkpoints/gnosis-v2.0-reward;
    CPU verified dry-run if no CUDA).
  - ``grpo <train_jsonl> [--dry-run]`` — Stage 3 GRPO (GPU-only).
  - ``eval [--dry-run]``               — Stage 4 eval battery (GPU-only).
  - ``dry-run``                        — run the FULL chain (sft → reward → grpo
    → eval) on the dry-run preset + prepped feedstock. GPU-only. One command.
    See ``docs/gnosis-training/DRY_RUN_RUNBOOK.md``.
  - ``synth-pairs <events_jsonl> <out_jsonl>`` — build the dry-run SYNTHETIC
    preference pairs (CPU-pure; NOT a training path, NOT human judgments).
  - ``bootstrap-worksheet <events_jsonl> <out_jsonl>`` — emit the preference-pair
    worksheet (CPU-pure; NOT a training path).
  - ``validate-worksheet <pairs_jsonl>`` — validate an in-progress worksheet:
    report ok / pending-authoring / invalid per pair so the human author can fix
    gaps before reward training (CPU-pure). Exits non-zero if any invalid.
  - ``ttc-metrics <pairs_jsonl>``      — CAT9 / multi-obj readiness report:
    TTC axis coverage, composite gaps, multi-obj margins (CPU-pure).
  - ``pair-coverage [pairs_jsonl]``    — GP-1 coverage report (CAT mix, gaps,
    failing criteria, thin spots). Default: data/preference_pairs_ALL.jsonl.
    Writes logs/gnosis/pair_coverage_*.{json,md} (CPU-pure).
  - ``tag-provenance-g0 <in_jsonl> [out_jsonl]`` — GP-2: stamp provenance_tier=G0
    + generator=human on all pairs (backfill gold). Default out: in with
    ``.g0.jsonl`` suffix (CPU-pure).
  - ``core-resonance [pairs_jsonl]``  — Core Resonance Score: shared-direction
    motifs across THE COUNCILE windows + pairs. Writes
    logs/gnosis/core_resonance_*.{json,md} (CPU-pure).
  - ``council-g1-generate [out_jsonl]`` — member-true G1 pairs from each
    Council member's key_insight / sources (spot-review before promote).
  - ``sample-weights [pairs_jsonl]``  — GP-7 weight report (tier × core boost);
    optional ``--expand`` preview oversampled tier mix (CPU-pure).
  - ``ttc-window-report [jsonl...]``   — debt/refusal/density pain from Hepar
    gate logs (default: logs/ttc-window/*.jsonl).
  - ``--smoke-imports``                — the honest "wiring resolves" proof:
    lazy-import each heavy module, print versions, exit non-zero with an
    install hint on failure. Does NOT load a model or touch CUDA.

HONESTY: the ``--dry-run`` flag + ``dry-run`` mode are the ONLY paths that
execute a forward pass. They run on a tiny model + SYNTHETIC preference labels
(``synth_pairs.py``) to verify the pipeline end-to-end — they do NOT prove the
model learns the constitution. The real 8B run with HUMAN-judged preference
pairs (spec line 478) remains a future GPU job; the bare ``sft``/``reward``/
``grpo``/``eval`` modes (without ``--dry-run``) stay no-ops.
"""
from __future__ import annotations

import os
import sys
from typing import Any

# Set PYTHONHASHSEED before any heavy import for dict-iteration determinism
# (defense-in-depth alongside seed.py; best-effort when set after start).
os.environ.setdefault("PYTHONHASHSEED", "42")


def smoke_imports() -> int:
    """Lazy-import each heavy module and print its version. Exit 0 if all
    resolve, non-zero with an install hint otherwise. No model load, no CUDA."""
    checks: list[tuple[str, str]] = [
        ("torch", "torch"),
        ("transformers", "transformers"),
        ("trl", "trl"),
        ("peft", "peft"),
        ("datasets", "datasets"),
        ("accelerate", "accelerate"),
        ("numpy", "numpy"),
    ]
    failures: list[str] = []
    for module_name, import_name in checks:
        try:
            mod: Any = __import__(import_name)
            version = getattr(mod, "__version__", "?")
            print(f"gnosis_training.smoke: {module_name}={version} — OK")
        except ImportError as exc:
            print(f"gnosis_training.smoke: {module_name} FAILED ({exc})")
            failures.append(module_name)

    # bitsandbytes is the opt-in `qlora` extra — its absence is NOT a smoke
    # failure (the 4-bit kernel is hard on native Windows; the builder raises a
    # documented error when it is actually needed).
    try:
        import bitsandbytes   # noqa: F401

        print("gnosis_training.smoke: bitsandbytes (qlora extra) — OK")
    except ImportError:
        print(
            "gnosis_training.smoke: bitsandbytes (qlora extra) — NOT INSTALLED "
            "(optional; run `uv sync --extra qlora` for the 4-bit run)"
        )

    if failures:
        print(
            "\nsmoke-imports FAILED for: " + ", ".join(failures) +
            "\nrun `uv sync` to install the core ML stack."
        )
        return 1
    print("\nsmoke-imports OK — real TRL wiring resolves. No training executed.")
    return 0


def bootstrap_worksheet(events_jsonl: str, out_jsonl: str) -> int:
    """Emit the preference-pair bootstrap worksheet (CPU-pure, NOT training)."""
    from .dataset import read_events_jsonl
    from .preference import build_bootstrap_worksheet, export_pairs_for_review

    events = read_events_jsonl(events_jsonl)
    pairs = build_bootstrap_worksheet(events)
    export_pairs_for_review(pairs, out_jsonl)
    print(
        f"wrote {len(pairs)} bootstrap worksheet pairs to {out_jsonl} "
        "(marked bootstrap=True; human authoring required before RM training — spec line 478)"
    )
    return 0


def synth_pairs(events_jsonl: str, out_jsonl: str) -> int:
    """Build the dry-run SYNTHETIC preference pairs (CPU-pure, NOT training,
    NOT human judgments — see synth_pairs.py)."""
    from .dataset import read_events_jsonl
    from .synth_pairs import build_dry_run_pairs, export_dry_run_pairs

    events = read_events_jsonl(events_jsonl)
    pairs = build_dry_run_pairs(events)
    if not pairs:
        print(f"no events in {events_jsonl} → no dry-run pairs produced")
        return 1
    export_dry_run_pairs(pairs, out_jsonl)
    print(
        f"wrote {len(pairs)} dry-run SYNTHETIC pairs to {out_jsonl} "
        "(bootstrap=False, validate_pair-passing; NOT human judgments — "
        "spec line 478 still governs the real reward-model training)"
    )
    return 0


def _flag(args: list[str], flag: str) -> tuple[list[str], bool]:
    """Pop a boolean flag from args; return (remaining, present)."""
    if flag in args:
        rest = [a for a in args if a != flag]
        return rest, True
    return args, False


def ttc_window_report(paths: list[str] | None = None) -> int:
    """Aggregate Hepar / gnostic-engine TTC window JSONL into pain snapshots.

    Default logs (repo root):
      logs/ttc-window/hepar-defi-auditor.jsonl
      logs/ttc-window/gnostic-engine.jsonl
    """
    import json
    from pathlib import Path

    from .ttc_signals import TtcWindowEvent, TtcWindowMetrics

    repo = Path(__file__).resolve().parents[3]
    default_dir = repo / "logs" / "ttc-window"
    if paths:
        files = [Path(p) for p in paths]
    else:
        files = sorted(default_dir.glob("*.jsonl")) if default_dir.is_dir() else []

    if not files:
        print(f"ttc-window-report: no JSONL found (looked in {default_dir})")
        print("Run Hepar audits or gnostic-engine gate_ttc to generate logs.")
        return 0

    metrics = TtcWindowMetrics(window_size=50)
    total = 0
    for f in files:
        if not f.is_file():
            print(f"  skip missing {f}")
            continue
        n = 0
        with f.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError:
                    continue
                metrics.record(
                    TtcWindowEvent(
                        agent_id=str(raw.get("agent_id", "unknown")),
                        is_refusal=bool(raw.get("is_refusal", False)),
                        output_density=float(raw.get("output_density", 0.0)),
                        identity_fingerprint=str(
                            raw.get("identity_fingerprint", "")
                        ),
                        sovereignty_debt=float(raw.get("sovereignty_debt", 0.0)),
                        valid=bool(raw.get("valid", True)),
                        composite_score=float(raw.get("composite_score", 0.0)),
                        failed_rules=tuple(raw.get("failed_rules") or ()),
                    )
                )
                n += 1
        total += n
        print(f"  loaded {n} events from {f}")

    print(f"ttc-window-report: {total} events across {len(files)} file(s)")
    report = metrics.report()
    if not report:
        print("  (no agent snapshots)")
        return 0
    for agent_id, snap in report.items():
        print(f"  agent={agent_id}")
        for k, v in snap.items():
            if isinstance(v, float):
                print(f"    {k}={v:.3f}")
            else:
                print(f"    {k}={v}")
        # Human-readable pain flags
        flags = []
        if snap.get("debt_forced_risk"):
            flags.append("DEBT_FORCED_RISK")
        if float(snap.get("refusal_rate", 0)) < 0.12 and int(snap.get("count", 0)) >= 10:
            flags.append("LOW_REFUSAL")
        if float(snap.get("reject_rate", 0)) > 0.3:
            flags.append("HIGH_REJECT")
        if flags:
            print(f"    PAIN: {', '.join(flags)}")
    return 0


def ttc_metrics_report(pairs_jsonl: str) -> int:
    """Report CAT9 / multi-objective readiness for a preference-pair file.

    CPU-pure. Does not claim human judgment quality — only structural readiness
    for gate-aligned training (TTC scores present, composite margins, axis mix).
    """
    from collections import Counter
    from pathlib import Path

    from .generated.hyperparams import (
        PREFERENCE_CAT9_AXIS_TARGETS,
        PREFERENCE_CAT9_TTC_TARGET,
        TTC_PREFERENCE_MIN_COMPOSITE_GAP,
    )
    from .preference import iter_pairs_jsonl, validate_pair
    from .reward import pairs_to_multiobjective_rows

    path = Path(pairs_jsonl)
    pairs = list(iter_pairs_jsonl(path))
    authored = [p for p in pairs if not p.bootstrap and not p.synthetic]
    cat9 = [p for p in authored if str(p.category).upper().startswith("CAT9")]
    with_ttc = [p for p in authored if p.chosen_ttc is not None and p.rejected_ttc is not None]
    axis_counts: Counter[str] = Counter(
        (p.ttc_axis or "unset") for p in cat9
    )

    invalid = 0
    for p in authored:
        problems = validate_pair(p)
        if problems:
            invalid += 1
            print(f"INVALID  {p.pair_id}: {problems}")

    print(f"ttc-metrics {path}")
    print(f"  authored pairs: {len(authored)}  (CAT9: {len(cat9)} / target {PREFERENCE_CAT9_TTC_TARGET})")
    print(f"  with TTC scores: {len(with_ttc)}")
    print(f"  CAT9 axis mix: {dict(axis_counts)}  (targets {PREFERENCE_CAT9_AXIS_TARGETS})")
    print(f"  invalid (validate_pair): {invalid}")

    if with_ttc:
        rows = pairs_to_multiobjective_rows(with_ttc)
        margins = [float(r["multi_obj_margin"]) for r in rows]
        comp_gaps = [
            float(r["chosen_ttc"]["composite"]) - float(r["rejected_ttc"]["composite"])  # type: ignore[index]
            for r in rows
        ]
        print(
            f"  multi_obj margin: min={min(margins):.3f} mean={sum(margins)/len(margins):.3f} "
            f"max={max(margins):.3f}"
        )
        print(
            f"  TTC composite gap: min={min(comp_gaps):.3f} mean={sum(comp_gaps)/len(comp_gaps):.3f} "
            f"(RULE T1 floor {TTC_PREFERENCE_MIN_COMPOSITE_GAP})"
        )
    else:
        print(
            "  no pairs with chosen_ttc/rejected_ttc yet — author CAT9 using "
            "docs/gnosis-training/TTC_PREFERENCE_PAIRS_GUIDE.md"
        )

    if invalid:
        return 1
    if len(cat9) < PREFERENCE_CAT9_TTC_TARGET:
        print(
            f"  NOTE: CAT9 shortfall {PREFERENCE_CAT9_TTC_TARGET - len(cat9)} "
            f"(training will under-weight gate-aligned refusal/structure/density)."
        )
    return 0


def validate_worksheet(pairs_jsonl: str) -> int:
    """Validate an in-progress preference-pair worksheet and report per-pair
    status so the human author can fix gaps BEFORE reward training. CPU-pure.

    A worksheet is a mix of:
      - ``bootstrap=True`` pairs — the scaffold (responses still empty). These
        are "pending authoring" — counted, NOT treated as invalid (the human
        hasn't filled them in yet). ``validate_pair`` would reject them; the
        validator treats them as expected in-progress rows.
      - ``bootstrap=False`` pairs — the human-authored rows. These are validated
        against the real quality-control rules: RULES 1/2/6 (score gap ≥
        PREFERENCE_MIN_SCORE_GAP, chosen passes ≥4/5 criteria at 0.70, apeiron
        band) + RULE 3 (the response TEXT is non-empty and not a prompt echo). Any
        per-pair problem → invalid, printed with the pair_id.
      - The whole authored set is then run through the worksheet-level templating
        guard (RULES 4/5: response diversity + non-constant chosen total) so a
        canned file (e.g. the PR #56 240-pair template) cannot pass on per-pair
        score consistency alone. ``synthetic=True`` dry-run stand-ins are skipped.
    run). Use this iteratively while authoring — see
    ``theo-techno-cosmo/plex/Review/REWARD_MODEL_PREFERENCE_PAIRS_GUIDE.md`` for
    the judging rubric + the 250-pair target distribution.
    """
    from pathlib import Path

    from .preference import detect_worksheet_templating, iter_pairs_jsonl, validate_pair

    path = Path(pairs_jsonl)
    ok = 0
    pending = 0
    invalid = 0
    all_pairs: list[Any] = []
    for pair in iter_pairs_jsonl(path):
        all_pairs.append(pair)
        if pair.bootstrap:
            pending += 1
            continue
        problems = validate_pair(pair)
        if problems:
            invalid += 1
            print(f"INVALID  {pair.pair_id}: {problems}")
        else:
            ok += 1

    # Worksheet-level templating guard (RULES 4/5): runs over the whole authored
    # set so a canned file (e.g. the PR #56 240-pair template scored a constant
    # 0.927) cannot pass on per-pair score consistency alone. ``synthetic=True``
    # dry-run stand-ins are skipped (they are honestly not human judgments).
    templating = detect_worksheet_templating(all_pairs)
    templating_invalid = 0
    if templating:
        templating_invalid = 1
        print(f"TEMPLATING  worksheet {path}: {templating}")

    total = ok + pending + invalid
    print(
        f"worksheet {path}: {total} pairs — {ok} ok, {pending} pending authoring, "
        f"{invalid} invalid"
    )
    if invalid or templating_invalid:
        if invalid:
            print(f"fix the {invalid} invalid pair(s) before reward training.")
        if templating_invalid:
            print(
                "fix the worksheet-level templating signal before reward training "
                "(author distinct responses per pair, not canned templates)."
            )
        return 1
    if ok == 0 and pending > 0:
        print("no authored (bootstrap=false) pairs yet — author some to begin.")
    elif ok > 0:
        print(f"{ok} pair(s) pass validate_pair — ready for reward training.")
    return 0


def _run_sft_dry(train_jsonl: str) -> int:
    from .config import dry_run_sft
    from .sft import run_sft

    cfg = dry_run_sft()
    out = run_sft(cfg, train_jsonl)
    print(f"[dry-run] SFT done — checkpoint: {out}")
    return 0


def _run_reward_dry(pairs_jsonl: str) -> int:
    from .config import dry_run_reward
    from .reward import run_reward

    cfg = dry_run_reward()
    out = run_reward(cfg, pairs_jsonl)
    print(f"[dry-run] Reward done — checkpoint: {out}")
    return 0


def _run_grpo_dry(train_jsonl: str) -> int:
    from .config import dry_run_grpo
    from .grpo import run_grpo

    cfg = dry_run_grpo()
    out = run_grpo(cfg, train_jsonl)
    print(f"[dry-run] GRPO done — checkpoint: {out}")
    return 0


def _run_eval_dry() -> int:
    from .config import dry_run_eval
    from .eval import run_eval_battery

    report = run_eval_battery(dry_run_eval())
    print(f"[dry-run] Eval done — passed={report['passed']} total_mae={report['total_mae']} "
          f"total_r2={report['total_r2']}")
    return 0


def run_dry_run_chain(train_jsonl: str, pairs_jsonl: str) -> int:
    """Run the full dry-run chain: sft → reward → grpo → eval. GPU-only.

    This is the one-command pipeline-verification entry point (see the runbook).
    Each stage uses the dry-run config (tiny model + tiny sizes); the GRPO +
    eval stages read the sft/reward dryrun checkpoints. Real gradients flow;
    the synth preference pairs (NOT human judgments) drive the reward stage.
    """
    rc = _run_sft_dry(train_jsonl)
    if rc:
        return rc
    rc = _run_reward_dry(pairs_jsonl)
    if rc:
        return rc
    rc = _run_grpo_dry(train_jsonl)
    if rc:
        return rc
    return _run_eval_dry()


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0

    mode = args[0]
    rest = args[1:]

    if mode == "--smoke-imports":
        return smoke_imports()

    if mode == "bootstrap-worksheet":
        if len(rest) < 2:
            print("usage: python -m gnosis_training bootstrap-worksheet <events_jsonl> <out_jsonl>")
            return 2
        return bootstrap_worksheet(rest[0], rest[1])

    if mode == "validate-worksheet":
        if len(rest) < 1:
            print("usage: python -m gnosis_training validate-worksheet <pairs_jsonl>")
            return 2
        return validate_worksheet(rest[0])

    if mode == "ttc-metrics":
        if len(rest) < 1:
            print("usage: python -m gnosis_training ttc-metrics <pairs_jsonl>")
            return 2
        return ttc_metrics_report(rest[0])

    if mode == "pair-coverage":
        from pathlib import Path

        from .coverage import run_coverage

        # Prefer package data/ then repo gnosis-training/data/
        default_candidates = [
            Path("data/preference_pairs_ALL.jsonl"),
            Path("gnosis-training/data/preference_pairs_ALL.jsonl"),
        ]
        pairs = Path(rest[0]) if rest else next(
            (p for p in default_candidates if p.exists()),
            default_candidates[-1],
        )
        if not pairs.exists():
            print(f"pair-coverage: file not found: {pairs}")
            print(
                "usage: python -m gnosis_training pair-coverage [pairs_jsonl]"
            )
            return 2
        report = run_coverage(pairs)
        print(f"pair-coverage n={report['pair_count']} source={report['source']}")
        print(f"  by_category={report['by_category']}")
        print(f"  thin={report['thin_categories']}")
        print(f"  ttc_axis={report['ttc_axis']}")
        g = report["score_gap_chosen_minus_rejected"]
        if g.get("n"):
            print(
                f"  score_gap mean={g['mean']} min={g['min']} median={g['median']}"
            )
        print(f"  wrote {report['outputs']['latest_md']}")
        print(f"  wrote {report['outputs']['latest_json']}")
        for r in report["recommendations"]:
            print(f"  → {r}")
        return 0

    if mode == "tag-provenance-g0":
        from pathlib import Path

        import json as _json

        from .preference import (
            pair_from_wire,
            serialize_pairs_jsonl,
            tag_pairs_g0,
            validate_pair,
        )

        if len(rest) < 1:
            print(
                "usage: python -m gnosis_training tag-provenance-g0 "
                "<in_jsonl> [out_jsonl]"
            )
            return 2
        in_path = Path(rest[0])
        if not in_path.exists():
            print(f"tag-provenance-g0: not found: {in_path}")
            return 2
        out_path = (
            Path(rest[1])
            if len(rest) >= 2
            else in_path.with_suffix("").with_name(in_path.stem + ".g0.jsonl")
        )
        # Load without train filter — include all valid score rows
        raw_pairs = []
        with in_path.open(encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, start=1):
                line = line.strip()
                if not line:
                    continue
                pair = pair_from_wire(_json.loads(line))
                problems = validate_pair(pair)
                if problems:
                    print(f"skip {pair.pair_id} line {lineno}: {problems}")
                    continue
                raw_pairs.append(pair)
        tagged = tag_pairs_g0(raw_pairs, generator="human")
        out_path.write_text(serialize_pairs_jsonl(tagged), encoding="utf-8")
        print(f"tag-provenance-g0 wrote {len(tagged)} pairs → {out_path}")
        return 0

    if mode == "core-resonance":
        from pathlib import Path

        from .core_resonance import run_core_resonance

        default_candidates = [
            Path("data/preference_pairs_ALL.jsonl"),
            Path("gnosis-training/data/preference_pairs_ALL.jsonl"),
        ]
        pairs = Path(rest[0]) if rest else next(
            (p for p in default_candidates if p.exists()),
            default_candidates[-1],
        )
        report = run_core_resonance(pairs if pairs.exists() else None)
        print(
            f"core-resonance members={report['member_count']} "
            f"pairs={report['pair_count']} hits={report['hit_count']}"
        )
        top = report.get("top_cores") or []
        if top:
            print("  top shared cores:")
            for t in top[:8]:
                print(
                    f"    {t['core_id']}: score={t['score']} "
                    f"members={t['member_count']}"
                )
        print(f"  wrote {report['outputs']['latest_md']}")
        print(f"  wrote {report['outputs']['latest_json']}")
        for r in report.get("recommendations") or []:
            print(f"  → {r}")
        return 0

    if mode == "council-g1-generate":
        from pathlib import Path

        from .council_g1 import build_member_true_pairs, write_g1_jsonl

        out = (
            Path(rest[0])
            if rest
            else Path("data/council_g1_member_true.jsonl")
        )
        # Allow running from repo root
        if not out.is_absolute() and not Path("data").is_dir():
            alt = Path("gnosis-training") / out
            if alt.parent.is_dir():
                out = alt
        pairs = build_member_true_pairs()
        summary = write_g1_jsonl(pairs, out)
        print(
            f"council-g1-generate wrote={summary['wrote']} "
            f"invalid={summary['invalid']} generators={summary['generators']}"
        )
        print(f"  → {summary['path']}")
        if summary.get("core_hist"):
            top_c = sorted(
                summary["core_hist"].items(), key=lambda x: -x[1]
            )[:8]
            print(f"  core tags: {dict(top_c)}")
        print("  Spot-review before promoting into preference_pairs_ALL.jsonl")
        return 0 if summary["invalid"] == 0 else 1

    if mode == "sample-weights":
        from pathlib import Path

        from .preference import load_human_pairs
        from .sample_weights import (
            expand_for_weighted_training,
            load_core_scores,
            summarize_weights,
            weight_histogram,
            pairs_to_weighted_rows,
        )

        default_candidates = [
            Path("data/preference_pairs_ALL.jsonl"),
            Path("gnosis-training/data/preference_pairs_ALL.jsonl"),
        ]
        rest_flags = list(rest)
        do_expand = False
        if "--expand" in rest_flags:
            do_expand = True
            rest_flags.remove("--expand")
        pairs_path = Path(rest_flags[0]) if rest_flags else next(
            (p for p in default_candidates if p.exists()),
            default_candidates[-1],
        )
        if not pairs_path.exists():
            print(f"sample-weights: not found: {pairs_path}")
            return 2
        pairs = load_human_pairs(pairs_path)
        scores = load_core_scores()
        summary = summarize_weights(pairs, scores)
        print(
            f"sample-weights n={summary.n} mean={summary.mean} "
            f"min={summary.min_w} max={summary.max_w}"
        )
        print(f"  by_tier_mean={summary.by_tier}")
        print("  top weighted pair_ids:")
        for pid, w in summary.top_pair_ids[:10]:
            print(f"    {pid}: {w:.3f}")
        if do_expand:
            rows = pairs_to_weighted_rows(
                pairs, core_scores=scores, expand=True, seed=42
            )
            hist = weight_histogram(rows)
            print(
                f"  expand preview n={hist['n']} by_tier={hist['by_tier']} "
                f"weight_mean={hist['weight_mean']}"
            )
        return 0

    if mode == "ttc-window-report":
        return ttc_window_report(rest)

    if mode == "synth-pairs":
        if len(rest) < 2:
            print("usage: python -m gnosis_training synth-pairs <events_jsonl> <out_jsonl>")
            return 2
        return synth_pairs(rest[0], rest[1])

    if mode == "dry-run":
        if len(rest) < 2:
            print("usage: python -m gnosis_training dry-run <train_events_jsonl> <synth_pairs_jsonl>")
            return 2
        return run_dry_run_chain(rest[0], rest[1])

    if mode in ("sft", "reward", "grpo", "eval"):
        rest, is_dry = _flag(rest, "--dry-run")
        rest, is_stage2 = _flag(rest, "--stage2-v2")
        if mode == "reward" and is_stage2:
            # Vector 6.1 — human-judged pairs → gnosis-v2.0-reward checkpoint
            from pathlib import Path

            from .stage2_v2 import Stage2V2Config, run_stage2_v2

            pairs = rest[0] if rest else "data/preference_pairs_ALL.jsonl"
            print(f"[stage2-v2] corpus={pairs}")
            result = run_stage2_v2(
                Stage2V2Config(pairs_jsonl=Path(pairs)),
                write_docs=True,
            )
            print(
                f"[stage2-v2] done mode={result['mode']} "
                f"pairs={result['pairs_total']} "
                f"checkpoint={result['output_dir']} "
                f"eval={result.get('eval_metrics')}"
            )
            return 0
        if not is_dry:
            print(
                f"mode '{mode}' is real TRL wiring but is a future GPU job — not executed "
                "(no model load, no training). Add --dry-run to run it on the tiny-model "
                "preset, --stage2-v2 for Vector 6.1 human-pair Stage 2, or run on a GPU "
                "box with `uv sync --extra qlora` after human-judged pairs are ready "
                "(spec line 478)."
            )
            return 0
        # --dry-run: execute the real QLoRA path on the tiny model.
        if mode == "sft":
            if len(rest) < 1:
                print("usage: python -m gnosis_training sft <train_jsonl> --dry-run")
                return 2
            return _run_sft_dry(rest[0])
        if mode == "reward":
            if len(rest) < 1:
                print("usage: python -m gnosis_training reward <pairs_jsonl> --dry-run")
                return 2
            return _run_reward_dry(rest[0])
        if mode == "grpo":
            if len(rest) < 1:
                print("usage: python -m gnosis_training grpo <train_jsonl> --dry-run")
                return 2
            return _run_grpo_dry(rest[0])
        if mode == "eval":
            return _run_eval_dry()

    print(f"unknown mode {mode!r}; --help for usage.")
    return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())