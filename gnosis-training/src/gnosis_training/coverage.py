"""GP-1: Coverage report for preference_pairs_ALL.jsonl (and any pairs JSONL).

Produces JSON + Markdown under logs/gnosis/ by default.
CPU-pure — no model load.
"""
from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_CATS = [f"CAT{i}" for i in range(1, 10)]
TTC_AXES = ("theological", "technological", "cosmological")


def _total_score(side: dict[str, Any] | None) -> float | None:
    if not side or not isinstance(side, dict):
        return None
    scores = side.get("scores") or {}
    t = scores.get("total")
    if t is None:
        return None
    try:
        return float(t)
    except (TypeError, ValueError):
        return None


def _response_len(side: dict[str, Any] | None) -> int:
    if not side:
        return 0
    r = side.get("response") or ""
    return len(str(r))


def load_pairs(path: Path) -> list[dict[str, Any]]:
    pairs: list[dict[str, Any]] = []
    text = path.read_text(encoding="utf-8")
    for i, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            pairs.append(json.loads(line))
        except json.JSONDecodeError as e:
            raise ValueError(f"{path}:{i}: invalid JSON: {e}") from e
    return pairs


def analyze_pairs(pairs: list[dict[str, Any]], *, source: str) -> dict[str, Any]:
    by_cat: Counter[str] = Counter()
    by_ttc_axis: Counter[str] = Counter()
    failing: Counter[str] = Counter()
    gaps: list[float] = []
    prompt_lens: list[int] = []
    chosen_lens: list[int] = []
    rejected_lens: list[int] = []
    synthetic = 0
    bootstrap = 0
    apeiron = 0
    with_ttc_fields = 0
    missing_id: list[int] = []
    duplicate_ids: list[str] = []
    seen_ids: set[str] = set()
    cat9_without_axis: list[str] = []
    small_gap_pairs: list[dict[str, Any]] = []
    provenance: Counter[str] = Counter()

    for idx, p in enumerate(pairs):
        pid = p.get("pair_id")
        if not pid:
            missing_id.append(idx)
        else:
            pid_s = str(pid)
            if pid_s in seen_ids:
                duplicate_ids.append(pid_s)
            seen_ids.add(pid_s)

        cat = str(p.get("category") or "UNKNOWN")
        by_cat[cat] += 1

        axis = p.get("ttc_axis")
        if axis:
            by_ttc_axis[str(axis)] += 1
        if cat == "CAT9" and not axis:
            cat9_without_axis.append(str(pid or idx))

        if p.get("chosen_ttc") or p.get("rejected_ttc"):
            with_ttc_fields += 1

        for fc in p.get("failing_criteria") or []:
            failing[str(fc)] += 1

        if p.get("synthetic"):
            synthetic += 1
        if p.get("bootstrap"):
            bootstrap += 1
        if p.get("apeiron"):
            apeiron += 1

        tier = p.get("provenance_tier")
        if tier:
            provenance[str(tier)] += 1
        else:
            provenance["untagged"] += 1

        prompt_lens.append(len(str(p.get("prompt") or "")))
        chosen_lens.append(_response_len(p.get("chosen")))
        rejected_lens.append(_response_len(p.get("rejected")))

        ch = _total_score(p.get("chosen"))
        rj = _total_score(p.get("rejected"))
        if ch is not None and rj is not None:
            gap = ch - rj
            gaps.append(gap)
            if gap < 0.15:
                small_gap_pairs.append(
                    {"pair_id": pid, "category": cat, "gap": round(gap, 4)}
                )

    n = len(pairs)
    thin_threshold = max(10, n // 20)  # ~5% of corpus or 10
    thin_cats = sorted(
        [c for c in EXPECTED_CATS if by_cat.get(c, 0) < thin_threshold],
        key=lambda c: by_cat.get(c, 0),
    )
    missing_cats = [c for c in EXPECTED_CATS if by_cat.get(c, 0) == 0]

    # CAT9 axis balance among pairs that declare ttc_axis
    axis_total = sum(by_ttc_axis.values()) or 1
    axis_balance = {
        a: {
            "count": by_ttc_axis.get(a, 0),
            "share": round(by_ttc_axis.get(a, 0) / axis_total, 4),
        }
        for a in TTC_AXES
    }
    axis_skew = None
    if by_ttc_axis:
        counts = [by_ttc_axis.get(a, 0) for a in TTC_AXES]
        if max(counts) > 0 and min(counts) < max(counts) * 0.6:
            axis_skew = {
                "note": "CAT9/ttc_axis counts uneven (min < 60% of max)",
                "counts": {a: by_ttc_axis.get(a, 0) for a in TTC_AXES},
            }

    def _stats(xs: list[float] | list[int]) -> dict[str, Any]:
        if not xs:
            return {"n": 0}
        fxs = [float(x) for x in xs]
        return {
            "n": len(fxs),
            "mean": round(statistics.mean(fxs), 4),
            "median": round(statistics.median(fxs), 4),
            "min": round(min(fxs), 4),
            "max": round(max(fxs), 4),
            "stdev": round(statistics.pstdev(fxs), 4) if len(fxs) > 1 else 0.0,
        }

    recommendations: list[str] = []
    if thin_cats:
        recommendations.append(
            f"Expand thin categories first: {', '.join(f'{c}({by_cat.get(c, 0)})' for c in thin_cats)}"
        )
    if missing_cats:
        recommendations.append(f"Missing categories entirely: {', '.join(missing_cats)}")
    if axis_skew:
        recommendations.append(
            "Rebalance CAT9 ttc_axis coverage (theological / technological / cosmological)"
        )
    if cat9_without_axis:
        recommendations.append(
            f"{len(cat9_without_axis)} CAT9 pairs lack ttc_axis — backfill when expanding"
        )
    if small_gap_pairs:
        recommendations.append(
            f"{len(small_gap_pairs)} pairs have chosen−rejected total gap < 0.15 — review hardness"
        )
    if provenance.get("untagged", 0) == n:
        recommendations.append(
            "No provenance_tier tags yet — add G0/G1/G2/G3 when scaling past gold"
        )
    recommendations.append(
        "Next: Council prototype (G1) on thin CATs + seeded expand (G2) from strong gold seeds"
    )

    return {
        "schema_version": "pair-coverage-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "pair_count": n,
        "by_category": {c: by_cat.get(c, 0) for c in EXPECTED_CATS}
        | {k: v for k, v in sorted(by_cat.items()) if k not in EXPECTED_CATS},
        "thin_categories": thin_cats,
        "missing_categories": missing_cats,
        "thin_threshold": thin_threshold,
        "ttc_axis": dict(by_ttc_axis),
        "ttc_axis_balance": axis_balance,
        "ttc_axis_skew": axis_skew,
        "cat9_without_axis_count": len(cat9_without_axis),
        "cat9_without_axis_sample": cat9_without_axis[:20],
        "failing_criteria": dict(failing.most_common()),
        "flags": {
            "synthetic": synthetic,
            "bootstrap": bootstrap,
            "apeiron": apeiron,
            "with_chosen_or_rejected_ttc": with_ttc_fields,
        },
        "provenance_tier": dict(provenance),
        "score_gap_chosen_minus_rejected": _stats(gaps),
        "prompt_length_chars": _stats(prompt_lens),
        "chosen_response_length_chars": _stats(chosen_lens),
        "rejected_response_length_chars": _stats(rejected_lens),
        "id_hygiene": {
            "missing_pair_id_rows": missing_id,
            "duplicate_pair_ids": duplicate_ids,
            "unique_pair_ids": len(seen_ids),
        },
        "small_gap_pairs": small_gap_pairs[:50],
        "recommendations": recommendations,
    }


def report_to_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Preference pair coverage report (GP-1)")
    lines.append("")
    lines.append(f"- **Generated:** {report['generated_at']}")
    lines.append(f"- **Source:** `{report['source']}`")
    lines.append(f"- **Pair count:** {report['pair_count']}")
    lines.append("")
    lines.append("## By category")
    lines.append("")
    lines.append("| CAT | n |")
    lines.append("|-----|--:|")
    for cat, n in report["by_category"].items():
        mark = " ⚠️" if cat in report["thin_categories"] else ""
        lines.append(f"| {cat} | {n}{mark} |")
    lines.append("")
    if report["thin_categories"]:
        lines.append(
            f"**Thin** (< {report['thin_threshold']}): "
            + ", ".join(report["thin_categories"])
        )
        lines.append("")
    lines.append("## CAT9 / ttc_axis")
    lines.append("")
    if report["ttc_axis"]:
        lines.append("| Axis | n | share |")
        lines.append("|------|--:|------:|")
        for a, info in report["ttc_axis_balance"].items():
            lines.append(f"| {a} | {info['count']} | {info['share']:.1%} |")
        lines.append("")
        if report.get("ttc_axis_skew"):
            lines.append(f"⚠️ {report['ttc_axis_skew']['note']}")
            lines.append("")
    else:
        lines.append("_No `ttc_axis` fields present (or none counted)._")
        lines.append("")
    if report["cat9_without_axis_count"]:
        lines.append(
            f"CAT9 without `ttc_axis`: **{report['cat9_without_axis_count']}** "
            f"(sample: {', '.join(report['cat9_without_axis_sample'][:10])})"
        )
        lines.append("")

    lines.append("## Score gap (chosen.total − rejected.total)")
    lines.append("")
    g = report["score_gap_chosen_minus_rejected"]
    if g.get("n"):
        lines.append(
            f"n={g['n']} · mean={g['mean']} · median={g['median']} · "
            f"min={g['min']} · max={g['max']} · stdev={g['stdev']}"
        )
    else:
        lines.append("_No scorable gaps._")
    lines.append("")

    lines.append("## Failing criteria on rejected side")
    lines.append("")
    if report["failing_criteria"]:
        lines.append("| Criterion | n |")
        lines.append("|-----------|--:|")
        for k, v in report["failing_criteria"].items():
            lines.append(f"| {k} | {v} |")
    else:
        lines.append("_None recorded._")
    lines.append("")

    lines.append("## Flags & provenance")
    lines.append("")
    lines.append(f"- synthetic: {report['flags']['synthetic']}")
    lines.append(f"- bootstrap: {report['flags']['bootstrap']}")
    lines.append(f"- apeiron: {report['flags']['apeiron']}")
    lines.append(
        f"- pairs with chosen_ttc/rejected_ttc: {report['flags']['with_chosen_or_rejected_ttc']}"
    )
    lines.append(f"- provenance_tier: `{report['provenance_tier']}`")
    lines.append("")

    lines.append("## ID hygiene")
    lines.append("")
    hy = report["id_hygiene"]
    lines.append(f"- unique pair_ids: {hy['unique_pair_ids']}")
    lines.append(f"- missing pair_id rows: {len(hy['missing_pair_id_rows'])}")
    lines.append(f"- duplicate pair_ids: {hy['duplicate_pair_ids'] or 'none'}")
    lines.append("")

    lines.append("## Recommendations")
    lines.append("")
    for r in report["recommendations"]:
        lines.append(f"- {r}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        "See `docs/gnosis-training/SCALE_250_TO_25K.md` for G0–G3 factory plan."
    )
    lines.append("")
    return "\n".join(lines)


def run_coverage(
    pairs_path: Path,
    *,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    pairs_path = pairs_path.resolve()
    pairs = load_pairs(pairs_path)
    report = analyze_pairs(pairs, source=str(pairs_path))

    if out_dir is None:
        # repo root: gnosis-training/src/gnosis_training -> parents[3]
        repo = Path(__file__).resolve().parents[3]
        out_dir = repo / "logs" / "gnosis"
    out_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    json_path = out_dir / f"pair_coverage_{stamp}.json"
    md_path = out_dir / f"pair_coverage_{stamp}.md"
    latest_json = out_dir / "pair_coverage_latest.json"
    latest_md = out_dir / "pair_coverage_latest.md"

    md = report_to_markdown(report)
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(md, encoding="utf-8")
    latest_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    latest_md.write_text(md, encoding="utf-8")

    report["outputs"] = {
        "json": str(json_path),
        "md": str(md_path),
        "latest_json": str(latest_json),
        "latest_md": str(latest_md),
    }
    return report
