import json
from pathlib import Path
import statistics

INPUT_DIR = Path(__file__).parent / "preference_pairs_output_qc"
REPORT = Path(__file__).parent / "qc_report.txt"

EXPECTED_COUNTS = {
    "CAT1": 50,
    "CAT2": 40,
    "CAT3": 35,
    "CAT4": 30,
    "CAT5": 30,
    "CAT6": 30,
    "CAT7": 25,
    "CAT8": 10,
}

CRITERIA = ["tripartite", "logic_compress", "source_aligned", "epistemic", "no_rlhf_signal"]


def analyze():
    # prefer per-category files only; skip merged ALL to avoid double-counting
    files = sorted([p for p in INPUT_DIR.glob("preference_pairs_*.jsonl") if "_ALL.jsonl" not in p.name])
    pairs = []
    seen = set()
    for f in files:
        with f.open("r", encoding="utf-8") as inf:
            for line in inf:
                if not line.strip():
                    continue
                obj = json.loads(line)
                pid = obj.get("pair_id") or obj.get("id")
                if pid in seen:
                    continue
                seen.add(pid)
                pairs.append(obj)

    report_lines = []
    report_lines.append(f"Total pairs found: {len(pairs)}\n")

    # Category counts
    counts = {}
    for p in pairs:
        counts[p["category"]] = counts.get(p["category"], 0) + 1
    report_lines.append("Category counts:")
    for c in sorted(counts):
        report_lines.append(f"  {c}: {counts[c]}")
    report_lines.append("")

    # Check expected counts
    report_lines.append("Count mismatches vs expected:")
    for cat, exp in EXPECTED_COUNTS.items():
        got = counts.get(cat, 0)
        if got != exp:
            report_lines.append(f"  {cat}: expected {exp}, got {got}")
    report_lines.append("")

    # Duplicate prompts
    prompts = [p["prompt"] for p in pairs]
    dupes = set([x for x in prompts if prompts.count(x) > 1])
    report_lines.append(f"Duplicate prompts: {len(dupes)}")
    if dupes:
        for d in list(dupes)[:10]:
            report_lines.append(f"  {d}")
    report_lines.append("")

    # QC rule checks
    chosen_too_low = []
    gap_too_small = []
    chosen_fail_criteria = []
    cat8_issues = []

    # score distributions
    dist = {k: [] for k in CRITERIA}
    dist_rej = {k: [] for k in CRITERIA}

    for p in pairs:
        ch = p["chosen"]["scores"]
        rej = p["rejected"]["scores"]
        # distributions
        for k in CRITERIA:
            if k in ch:
                dist[k].append(ch[k])
            if k in rej:
                dist_rej[k].append(rej[k])

        # chosen total
        if ch.get("total", 0) < 0.72 and not p.get("apeiron", False):
            chosen_too_low.append(p["pair_id"]) 

        # gap
        if not p.get("apeiron", False):
            if ch.get("total", 0) - rej.get("total", 0) < 0.15:
                gap_too_small.append(p["pair_id"]) 

        # chosen passes at least 4 of 5 criteria >0.70
        pass_count = sum(1 for k in CRITERIA if ch.get(k, 0) > 0.7)
        if pass_count < 4 and not p.get("apeiron", False):
            chosen_fail_criteria.append((p["pair_id"], pass_count))

        # CAT8 apeiron checks
        if p["category"] == "CAT8":
            if not p.get("apeiron", False):
                cat8_issues.append((p["pair_id"], "missing apeiron flag"))
            else:
                # ensure both scores between 0.55 and 0.71
                for side in (p["chosen"]["scores"], p["rejected"]["scores"]):
                    if not (0.55 <= side.get("total", 0) <= 0.71):
                        cat8_issues.append((p["pair_id"], f"score out of range: {side.get('total')}"))

    report_lines.append(f"Chosen total <0.72 (non-apeiron): {len(chosen_too_low)}")
    if chosen_too_low:
        report_lines.append("  " + ", ".join(chosen_too_low[:20]))
    report_lines.append("")

    report_lines.append(f"Gap <0.15 (non-apeiron): {len(gap_too_small)}")
    if gap_too_small:
        report_lines.append("  " + ", ".join(gap_too_small[:20]))
    report_lines.append("")

    report_lines.append(f"Chosen fails criterion count (<4): {len(chosen_fail_criteria)}")
    if chosen_fail_criteria:
        for pid, pc in chosen_fail_criteria[:20]:
            report_lines.append(f"  {pid}: passes {pc}/5")
    report_lines.append("")

    report_lines.append(f"CAT8 issues: {len(cat8_issues)}")
    if cat8_issues:
        for pid, reason in cat8_issues[:20]:
            report_lines.append(f"  {pid}: {reason}")
    report_lines.append("")

    # score statistics
    report_lines.append("Score distributions (chosen) — mean, stdev, min, max:")
    for k in CRITERIA:
        arr = dist[k]
        if arr:
            report_lines.append(f"  {k}: mean={statistics.mean(arr):.3f}, stdev={statistics.pstdev(arr):.3f}, min={min(arr):.2f}, max={max(arr):.2f}")
        else:
            report_lines.append(f"  {k}: no data")
    report_lines.append("")

    report_lines.append("Score distributions (rejected) — mean, stdev, min, max:")
    for k in CRITERIA:
        arr = dist_rej[k]
        if arr:
            report_lines.append(f"  {k}: mean={statistics.mean(arr):.3f}, stdev={statistics.pstdev(arr):.3f}, min={min(arr):.2f}, max={max(arr):.2f}")
        else:
            report_lines.append(f"  {k}: no data")
    report_lines.append("")

    # write report
    REPORT.write_text("\n".join(report_lines), encoding="utf-8")
    print(REPORT)


if __name__ == "__main__":
    analyze()
