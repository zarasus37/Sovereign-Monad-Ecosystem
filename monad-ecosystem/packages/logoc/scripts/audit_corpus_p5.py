import sys, os, json, math
from collections import defaultdict, Counter
from pathlib import Path
import numpy as np

# ------------------------------------------------------------------
# Self-contained pipeline logic (avoids pydantic dependency)
# ------------------------------------------------------------------

FEATURE_NAMES = [
    "single_occurrence", "rule_based", "similarity", "causality",
    "convention", "possibility", "fact", "reason",
]

BASE_DIR = r"C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\monad-ecosystem\packages\logoc"
MODEL_PATH = Path(BASE_DIR) / "ml" / "ml_classifier_v7.json"
SPEC_PATH = Path(BASE_DIR) / "spec" / "peirce_sign_classes.json"

with SPEC_PATH.open("r", encoding="utf-8") as f:
    sign_classes_data = {sc["id"]: sc for sc in json.load(f)}

with MODEL_PATH.open("r", encoding="utf-8") as f:
    model_data = json.load(f)

class_map = model_data["class_map"]
nb_model = model_data["models"][1]  # naive_bayes index

priors = {int(k): v for k, v in nb_model["priors"].items()}
probs = {int(k): np.array(v, dtype=np.float32) for k, v in nb_model["probs"].items()}
class_indices = np.array(nb_model["classes"], dtype=np.int32)
idx_to_class = {int(idx): int(cid) for idx, cid in enumerate(class_map)}
class_to_idx = {int(cid): int(idx) for idx, cid in enumerate(class_map)}

# Build valid paths
valid_paths = set()
path_to_id = {}
valid_nodes = {
    "Qualisign", "Sinsign", "Legisign",
    "Icon", "Index", "Symbol",
    "Rheme", "Dicent", "Argument",
}
for sc in sign_classes_data.values():
    path = sc["path"]
    if all(p in valid_nodes for p in path):
        pk = "-".join(path)
        valid_paths.add(pk)
        path_to_id[pk] = sc["id"]

def _find_valid_path(vehicle, obj, interpretant):
    direct = "-".join([vehicle, obj, interpretant])
    if direct in valid_paths:
        return [vehicle, obj, interpretant], path_to_id[direct], "direct"
    for int_cand in ("Rheme", "Dicent", "Argument"):
        if int_cand != interpretant:
            fp = "-".join([vehicle, obj, int_cand])
            if fp in valid_paths:
                return [vehicle, obj, int_cand], path_to_id[fp], "fallback_interpretant"
    for obj_cand in ("Icon", "Index", "Symbol"):
        if obj_cand != obj:
            fp = "-".join([vehicle, obj_cand, interpretant])
            if fp in valid_paths:
                return [vehicle, obj_cand, interpretant], path_to_id[fp], "fallback_object"
    return None, None, "ambiguous"

def rubric_classify(flags):
    vehicle = "Legisign" if flags.get("rule_based") else ("Sinsign" if flags.get("single_occurrence") else "Qualisign")
    obj = "Symbol" if flags.get("convention") else ("Index" if flags.get("causality") else "Icon")
    interpretant = "Argument" if flags.get("reason") else ("Dicent" if flags.get("fact") else "Rheme")
    path, class_id, method = _find_valid_path(vehicle, obj, interpretant)
    confidence = 1.0 if method == "direct" else (0.6 if method == "fallback_interpretant" else (0.5 if method == "fallback_object" else 0.0))
    return {"method": method, "class_id": class_id, "confidence": confidence, "path": path}

def ml_classify(flags):
    x = np.array([1.0 if flags.get(f, False) else 0.0 for f in FEATURE_NAMES], dtype=np.float32)
    scores = {}
    for idx in class_indices:
        lp = math.log(priors[int(idx)])
        for fidx in range(len(x)):
            p = probs[int(idx)][fidx]
            lp += math.log(p if x[fidx] > 0.5 else (1 - p))
        scores[int(idx)] = lp
    max_score = max(scores.values())
    exp_scores = {k: math.exp(v - max_score) for k, v in scores.items()}
    total = sum(exp_scores.values())
    probs_norm = {k: v / total for k, v in exp_scores.items()}
    pred_idx = max(probs_norm, key=probs_norm.get)
    pred_cid = idx_to_class[pred_idx]
    confidence = probs_norm[pred_idx]
    top3_idx = sorted(probs_norm.items(), key=lambda x: -x[1])[:3]
    top3 = [(idx_to_class[idx], p) for idx, p in top3_idx]
    return {"class_id": int(pred_cid), "confidence": confidence, "top3": top3, "all_probs": {idx_to_class[idx]: p for idx, p in probs_norm.items()}}

def triage(flags, event_id=""):
    rubric = rubric_classify(flags)
    ml = ml_classify(flags)
    if rubric["method"] == "direct" and rubric["class_id"] is not None and rubric["class_id"] == ml["class_id"]:
        return {"status": "auto_accept", "class_id": rubric["class_id"], "confidence": rubric["confidence"], "rubric": rubric, "ml": ml, "reason": "rubric_direct", "event_id": event_id}
    if rubric["class_id"] is not None and rubric["class_id"] == ml["class_id"] and ml["confidence"] >= 0.85:
        return {"status": "auto_accept", "class_id": ml["class_id"], "confidence": ml["confidence"], "rubric": rubric, "ml": ml, "reason": "ensemble_agree_high", "event_id": event_id}
    if rubric["class_id"] is not None and rubric["class_id"] == ml["class_id"] and ml["confidence"] >= 0.55:
        return {"status": "auto_accept", "class_id": ml["class_id"], "confidence": ml["confidence"], "rubric": rubric, "ml": ml, "reason": "ensemble_agree_low", "event_id": event_id}
    return {"status": "human_review", "class_id": None, "confidence": ml["confidence"], "rubric": rubric, "ml": ml, "reason": "ensemble_disagree" if rubric["class_id"] != ml["class_id"] else "low_confidence", "event_id": event_id}


# ------------------------------------------------------------------
# Main audit logic
# ------------------------------------------------------------------

def main(ctx):
    CORPUS_PATH = r"C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\monad-ecosystem\control-center\src\frontend\public\logoc-corpus.json"
    REPORT_PATH = r"C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\logs\audit\corpus_audit_p5.json"

    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    events = corpus.get("events", [])
    print(f"Loaded {len(events)} events")

    results = []
    for event in events:
        flags = event.get("semiotic_flags", {})
        actual_class = event.get("peirce", {}).get("sign_class_id")
        event_id = event.get("event_id", "unknown")
        narrative = event.get("narrative", "")[:300]

        triage_result = triage(flags, event_id)
        rubric_class = triage_result["rubric"]["class_id"]
        ml_class = triage_result["ml"]["class_id"]
        ml_conf = triage_result["ml"]["confidence"]
        rubric_conf = triage_result["rubric"]["confidence"]
        rubric_method = triage_result["rubric"]["method"]
        status = triage_result["status"]
        reason = triage_result["reason"]

        rubric_correct = rubric_class == actual_class if rubric_class is not None else False
        ml_correct = ml_class == actual_class if ml_class is not None else False

        flag_profile = (
            f"SO={'1' if flags.get('single_occurrence') else '0'} "
            f"RB={'1' if flags.get('rule_based') else '0'} "
            f"SI={'1' if flags.get('similarity') else '0'} "
            f"CA={'1' if flags.get('causality') else '0'} "
            f"CO={'1' if flags.get('convention') else '0'} "
            f"PO={'1' if flags.get('possibility') else '0'} "
            f"FA={'1' if flags.get('fact') else '0'} "
            f"RE={'1' if flags.get('reason') else '0'}"
        )

        results.append({
            "event_id": event_id,
            "actual_class": actual_class,
            "rubric_class": rubric_class,
            "ml_class": ml_class,
            "rubric_correct": rubric_correct,
            "ml_correct": ml_correct,
            "rubric_method": rubric_method,
            "status": status,
            "reason": reason,
            "ml_confidence": ml_conf,
            "rubric_confidence": rubric_conf,
            "flag_profile": flag_profile,
            "narrative": narrative,
            "top3_ml": triage_result["ml"]["top3"],
        })

    rubric_agree = sum(1 for r in results if r["rubric_correct"])
    ml_agree = sum(1 for r in results if r["ml_correct"])
    ensemble_agree = sum(1 for r in results if r["rubric_class"] == r["ml_class"] and r["rubric_class"] is not None)
    auto_accept = sum(1 for r in results if r["status"] == "auto_accept")
    human_review = sum(1 for r in results if r["status"] == "human_review")
    rubric_errors = [r for r in results if not r["rubric_correct"]]
    ml_errors = [r for r in results if not r["ml_correct"]]
    both_wrong = [r for r in results if not r["rubric_correct"] and not r["ml_correct"]]
    rubric_ml_disagree = [r for r in results if r["rubric_class"] != r["ml_class"] and r["rubric_class"] is not None]
    hr_events = [r for r in results if r["status"] == "human_review"]

    by_class = defaultdict(lambda: {"total": 0, "rubric_ok": 0, "ml_ok": 0, "hr": 0, "auto": 0})
    for r in results:
        c = r["actual_class"]
        by_class[c]["total"] += 1
        if r["rubric_correct"]:
            by_class[c]["rubric_ok"] += 1
        if r["ml_correct"]:
            by_class[c]["ml_ok"] += 1
        if r["status"] == "human_review":
            by_class[c]["hr"] += 1
        else:
            by_class[c]["auto"] += 1

    by_method = Counter(r["rubric_method"] for r in results)
    by_hr_reason = Counter(r["reason"] for r in hr_events)
    hr_profiles = Counter(r["flag_profile"] for r in hr_events)

    report = {
        "summary": {
            "total_events": len(results),
            "rubric_accuracy": round(rubric_agree / len(results), 4),
            "ml_accuracy": round(ml_agree / len(results), 4),
            "ensemble_agreement": round(ensemble_agree / len(results), 4),
            "auto_accept_rate": round(auto_accept / len(results), 4),
            "human_review_rate": round(human_review / len(results), 4),
            "rubric_error_count": len(rubric_errors),
            "ml_error_count": len(ml_errors),
            "both_wrong_count": len(both_wrong),
            "rubric_ml_disagree_count": len(rubric_ml_disagree),
        },
        "by_class": {int(k): v for k, v in sorted(by_class.items())},
        "by_rubric_method": dict(by_method),
        "by_hr_reason": dict(by_hr_reason),
        "hr_flag_profiles": {k: v for k, v in hr_profiles.most_common(20)},
        "rubric_errors": [
            {"event_id": r["event_id"], "actual": r["actual_class"], "rubric": r["rubric_class"], "ml": r["ml_class"], "method": r["rubric_method"], "ml_conf": round(r["ml_confidence"], 3), "flags": r["flag_profile"], "narrative": r["narrative"]}
            for r in rubric_errors
        ],
        "ml_errors": [
            {"event_id": r["event_id"], "actual": r["actual_class"], "rubric": r["rubric_class"], "ml": r["ml_class"], "ml_conf": round(r["ml_confidence"], 3), "top3": r["top3_ml"], "flags": r["flag_profile"], "narrative": r["narrative"]}
            for r in ml_errors
        ],
        "both_wrong": [
            {"event_id": r["event_id"], "actual": r["actual_class"], "rubric": r["rubric_class"], "ml": r["ml_class"], "ml_conf": round(r["ml_confidence"], 3), "flags": r["flag_profile"], "narrative": r["narrative"]}
            for r in both_wrong
        ],
        "human_review_events": [
            {"event_id": r["event_id"], "actual": r["actual_class"], "rubric": r["rubric_class"], "ml": r["ml_class"], "reason": r["reason"], "ml_conf": round(r["ml_confidence"], 3), "flags": r["flag_profile"], "narrative": r["narrative"]}
            for r in hr_events
        ],
    }

    Path(REPORT_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    summary = {
        "total_events": len(results),
        "rubric_accuracy": f"{rubric_agree}/{len(results)} = {rubric_agree/len(results):.1%}",
        "ml_accuracy": f"{ml_agree}/{len(results)} = {ml_agree/len(results):.1%}",
        "ensemble_agreement": f"{ensemble_agree}/{len(results)} = {ensemble_agree/len(results):.1%}",
        "auto_accept_rate": f"{auto_accept}/{len(results)} = {auto_accept/len(results):.1%}",
        "human_review_rate": f"{human_review}/{len(results)} = {human_review/len(results):.1%}",
        "rubric_errors": len(rubric_errors),
        "ml_errors": len(ml_errors),
        "both_wrong": len(both_wrong),
        "rubric_ml_disagree": len(rubric_ml_disagree),
        "by_class": {int(k): dict(v) for k, v in sorted(by_class.items())},
        "by_hr_reason": dict(by_hr_reason),
        "by_rubric_method": dict(by_method),
    }
    return summary
