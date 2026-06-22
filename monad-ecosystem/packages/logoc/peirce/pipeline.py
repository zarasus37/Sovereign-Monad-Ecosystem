"""
LOGOC Production ML Pipeline — PeirceClassifier + Naive Bayes ensemble triage.

Moves the core LogocMLPipeline from scripts/ml_pipeline.py into the peirce package
so it can be imported by classifier.py for real-time production ingestion.

Triage flow:
1. Extract semiotic flags from event
2. Rubric classifier attempts direct classification
3. If rubric direct AND ML agrees → auto_accept
4. If rubric fallback but ML agrees with high confidence → auto_accept
5. If rubric fallback and ML agrees with moderate confidence → auto_accept
6. Otherwise → human_review

Usage:
    from peirce.pipeline import LogocMLPipeline
    pipeline = LogocMLPipeline()  # uses default model paths
    result = pipeline.triage(flags_dict, event_id="ev001")
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ------------------------------------------------------------------
# Optional numpy — pipeline degrades gracefully if unavailable
# ------------------------------------------------------------------
try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:  # pragma: no cover
    np = None  # type: ignore
    _HAS_NUMPY = False

FEATURE_NAMES = [
    "single_occurrence", "rule_based", "similarity", "causality",
    "convention", "possibility", "fact", "reason",
]

_DEFAULT_MODEL_PATH = Path(__file__).parent.parent / "ml" / "ml_classifier_v7.json"
_DEFAULT_SPEC_PATH = Path(__file__).parent.parent / "spec" / "peirce_sign_classes.json"


class LogocMLPipeline:
    """
    Production ML triage pipeline for LOGOC events.
    Combines rubric classification with Naive Bayes ensemble confidence.

    Args:
        model_path: Path to serialized NB model JSON (e.g. ml_classifier_v7.json)
        spec_path: Path to Peirce sign classes JSON (e.g. peirce_sign_classes.json)
    """

    def __init__(
        self,
        model_path: Optional[Path] = None,
        spec_path: Optional[Path] = None,
    ):
        if not _HAS_NUMPY:
            raise ImportError(
                "NumPy is required for the ML pipeline. "
                "Install with: pip install numpy"
            )

        self.model_path = model_path or _DEFAULT_MODEL_PATH
        self.spec_path = spec_path or _DEFAULT_SPEC_PATH

        if not self.model_path.exists():
            raise FileNotFoundError(f"ML model not found: {self.model_path}")
        if not self.spec_path.exists():
            raise FileNotFoundError(f"Spec file not found: {self.spec_path}")

        with self.spec_path.open("r", encoding="utf-8") as f:
            self.sign_classes = {sc["id"]: sc for sc in json.load(f)}

        with self.model_path.open("r", encoding="utf-8") as f:
            self.model_data = json.load(f)

        self.class_map = self.model_data["class_map"]
        self.feature_names = self.model_data.get("feature_names", FEATURE_NAMES)
        self._load_nb_model()
        self._build_valid_paths()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_nb_model(self) -> None:
        """Load Naive Bayes parameters from serialized model."""
        # model_data["models"] is a list: [logistic_regression, naive_bayes, ensemble_stumps]
        nb_model = self.model_data["models"][1]  # naive_bayes index
        self.priors: Dict[int, float] = {int(k): v for k, v in nb_model["priors"].items()}
        self.probs: Dict[int, "np.ndarray"] = {
            int(k): np.array(v, dtype=np.float32)
            for k, v in nb_model["probs"].items()
        }
        # nb_model["classes"] stores contiguous indices (0..N), not raw class IDs.
        self.class_indices = np.array(nb_model["classes"], dtype=np.int32)
        self.classes = np.array(self.model_data["class_map"], dtype=np.int32)
        self.idx_to_class = {
            int(idx): int(cid)
            for idx, cid in enumerate(self.model_data["class_map"])
        }
        self.class_to_idx = {
            int(cid): int(idx)
            for idx, cid in enumerate(self.model_data["class_map"])
        }

    def _build_valid_paths(self) -> None:
        """Index valid Peirce paths for fast rubric fallback matching."""
        self.valid_paths: set = set()
        self.path_to_id: Dict[str, int] = {}
        valid_nodes = {
            "Qualisign", "Sinsign", "Legisign",
            "Icon", "Index", "Symbol",
            "Rheme", "Dicent", "Argument",
        }
        for sc in self.sign_classes.values():
            path = sc["path"]
            if all(p in valid_nodes for p in path):
                path_key = "-".join(path)
                self.valid_paths.add(path_key)
                self.path_to_id[path_key] = sc["id"]

    # ------------------------------------------------------------------
    # Rubric helper (mirrors classifier.py greedy logic)
    # ------------------------------------------------------------------

    def _find_valid_path(
        self, vehicle: str, obj: str, interpretant: str
    ) -> Tuple[Optional[List[str]], Optional[int], str]:
        """Find valid path with fallbacks, matching rubric priority."""
        direct = "-".join([vehicle, obj, interpretant])
        if direct in self.valid_paths:
            return [vehicle, obj, interpretant], self.path_to_id[direct], "direct"

        # Fallback: try different interpretant
        for int_cand in ("Rheme", "Dicent", "Argument"):
            if int_cand != interpretant:
                fp = "-".join([vehicle, obj, int_cand])
                if fp in self.valid_paths:
                    return [vehicle, obj, int_cand], self.path_to_id[fp], "fallback_interpretant"

        # Fallback: try different object
        for obj_cand in ("Icon", "Index", "Symbol"):
            if obj_cand != obj:
                fp = "-".join([vehicle, obj_cand, interpretant])
                if fp in self.valid_paths:
                    return [vehicle, obj_cand, interpretant], self.path_to_id[fp], "fallback_object"

        return None, None, "ambiguous"

    def rubric_classify(self, flags: Dict[str, bool]) -> Dict:
        """
        Greedy rubric classification (mirrors PeirceClassifier logic).
        Returns dict with method, class_id, confidence, path.
        """
        vehicle = (
            "Legisign" if flags.get("rule_based")
            else ("Sinsign" if flags.get("single_occurrence") else "Qualisign")
        )
        obj = (
            "Symbol" if flags.get("convention")
            else ("Index" if flags.get("causality") else "Icon")
        )
        interpretant = (
            "Argument" if flags.get("reason")
            else ("Dicent" if flags.get("fact") else "Rheme")
        )

        path, class_id, method = self._find_valid_path(vehicle, obj, interpretant)

        confidence = (
            1.0 if method == "direct"
            else (0.6 if method == "fallback_interpretant"
                  else (0.5 if method == "fallback_object" else 0.0))
        )

        return {
            "method": method,
            "class_id": class_id,
            "confidence": confidence,
            "path": path,
        }

    # ------------------------------------------------------------------
    # Naive Bayes classification
    # ------------------------------------------------------------------

    def ml_classify(self, flags: Dict[str, bool]) -> Dict:
        """
        Naive Bayes posterior over raw class IDs.
        Returns dict with class_id, confidence, top3, all_probs.
        """
        x = np.array(
            [1.0 if flags.get(f, False) else 0.0 for f in self.feature_names],
            dtype=np.float32,
        )

        scores: Dict[int, float] = {}
        for idx in self.class_indices:
            lp = math.log(self.priors[int(idx)])
            for fidx in range(len(x)):
                p = self.probs[int(idx)][fidx]
                lp += math.log(p if x[fidx] > 0.5 else (1 - p))
            scores[int(idx)] = lp

        max_score = max(scores.values())
        exp_scores = {k: math.exp(v - max_score) for k, v in scores.items()}
        total = sum(exp_scores.values())
        probs_norm = {k: v / total for k, v in exp_scores.items()}

        pred_idx = max(probs_norm, key=probs_norm.get)
        pred_cid = self.idx_to_class[pred_idx]
        confidence = probs_norm[pred_idx]

        top3_idx = sorted(probs_norm.items(), key=lambda x: -x[1])[:3]
        top3 = [(self.idx_to_class[idx], p) for idx, p in top3_idx]

        return {
            "class_id": int(pred_cid),
            "confidence": confidence,
            "top3": top3,
            "all_probs": {self.idx_to_class[idx]: p for idx, p in probs_norm.items()},
        }

    # ------------------------------------------------------------------
    # Triage
    # ------------------------------------------------------------------

    def triage(self, flags: Dict[str, bool], event_id: str = "") -> Dict:
        """
        Full production triage.

        Returns dict with:
            status: "auto_accept" | "human_review"
            class_id: predicted class (or None)
            confidence: combined confidence
            rubric: rubric classification result
            ml: ML classification result
            reason: why this decision was made
            event_id: passed through
        """
        rubric = self.rubric_classify(flags)
        ml = self.ml_classify(flags)

        # Case 1: Rubric direct AND ML agrees → highest confidence path
        if (
            rubric["method"] == "direct"
            and rubric["class_id"] is not None
            and rubric["class_id"] == ml["class_id"]
        ):
            return {
                "status": "auto_accept",
                "class_id": rubric["class_id"],
                "confidence": rubric["confidence"],
                "rubric": rubric,
                "ml": ml,
                "reason": "rubric_direct",
                "event_id": event_id,
            }

        # Case 2: Rubric fallback but ML agrees with high confidence
        if (
            rubric["class_id"] is not None
            and rubric["class_id"] == ml["class_id"]
            and ml["confidence"] >= 0.85
        ):
            return {
                "status": "auto_accept",
                "class_id": ml["class_id"],
                "confidence": ml["confidence"],
                "rubric": rubric,
                "ml": ml,
                "reason": "ensemble_agree_high",
                "event_id": event_id,
            }

        # Case 3: Rubric fallback and ML agrees with moderate confidence
        if (
            rubric["class_id"] is not None
            and rubric["class_id"] == ml["class_id"]
            and ml["confidence"] >= 0.55
        ):
            return {
                "status": "auto_accept",
                "class_id": ml["class_id"],
                "confidence": ml["confidence"],
                "rubric": rubric,
                "ml": ml,
                "reason": "ensemble_agree_low",
                "event_id": event_id,
            }

        # Case 4: Disagreement or low confidence → human review
        return {
            "status": "human_review",
            "class_id": None,
            "confidence": ml["confidence"],
            "rubric": rubric,
            "ml": ml,
            "reason": (
                "ensemble_disagree"
                if rubric["class_id"] != ml["class_id"]
                else "low_confidence"
            ),
            "event_id": event_id,
        }

    def process_event(self, event: Dict) -> Dict:
        """Process a plain event dict (e.g. from JSONL) through the pipeline."""
        flags = event.get("semiotic_flags", {})
        return self.triage(flags, event.get("event_id", ""))
