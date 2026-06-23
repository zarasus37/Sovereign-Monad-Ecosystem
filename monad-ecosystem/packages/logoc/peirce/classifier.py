"""
LOGOC Peirce Classifier v1.1 + Production Pipeline v2.5.0
Deterministically traverses peirce_rules.yml to assign a sign class to a LogocEvent.
New in v1.1: disambiguation by strong narrative indicators when multiple flags
are set in the same triad.
New in v2.5.0: ProductionPeirceClassifier integrates rubric + ML ensemble triage
for real-time auto-accept / human-review routing.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Literal, Optional

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore

from .manifold import PeirceManifold, get_manifold
from .models import LogocEvent, PeirceSignature, SemioticFlags

_RULES_PATH = Path(__file__).parent.parent / "spec" / "peirce_rules.yml"

# Feature space: the only event fields the classifier may consult
FEATURE_SPACE = [
    "narrative",
    "semiotic_flags.single_occurrence",
    "semiotic_flags.rule_based",
    "semiotic_flags.similarity",
    "semiotic_flags.causality",
    "semiotic_flags.convention",
    "semiotic_flags.possibility",
    "semiotic_flags.fact",
    "semiotic_flags.reason",
]


class AmbiguousClassificationError(Exception):
    """Raised when no single rubric branch dominates."""
    pass


class PeirceClassifier:
    """
    Rule-driven, triad-by-triad Peirce classifier.
    Traverses the rubric in three independent decisions:
      1. Sign Vehicle   → QUALISIGN | SINSIGN | LEGISIGN
      2. Object Relation → ICON | INDEX | SYMBOL
      3. Interpretant   → RHEME | DICENT | ARGUMENT
    The resulting path is resolved to a class ID via the manifold.
    Ambiguous events are marked `peirce_migration_pending`.
    """

    def __init__(
        self,
        manifold: Optional[PeirceManifold] = None,
        rules_path: Path = _RULES_PATH,
    ):
        if yaml is None:
            raise ImportError(
                "PyYAML is required for the rubric classifier. "
                "Install with: pip install pyyaml"
            )
        self.manifold = manifold or get_manifold()
        self.rules = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
        self._init_rubric_cache()

    def _init_rubric_cache(self):
        """Pre-parse rubric sections for fast lookup."""
        self._triad_sections = {
            "vehicle": self.rules["root"],
            "object": self.rules["icon_index_symbol"],
            "interpretant": self.rules["rheme_dicent_argument"],
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def classify(self, event: LogocEvent) -> int:
        """
        Return the sign_class_id for the event.
        Raises AmbiguousClassificationError if no unique branch resolves.
        """
        path = self.classify_path(event)
        cls = self.manifold.lookup_by_path(path)
        return cls.id

    def classify_path(self, event: LogocEvent) -> List[str]:
        """
        Return the full triadic path as a list of decisions, e.g.:
            ["Legisign", "Symbol", "Argument"]
        Validates against the manifold — if the computed path does not exist,
        tries fallback permutations using the default priority order for each
        triad until a valid path is found. Raises AmbiguousClassificationError
        if no valid path exists in the manifold.
        """
        vehicle = self._decide_triad(event, "vehicle")
        object_rel = self._decide_triad(event, "object")
        interpretant = self._decide_triad(event, "interpretant")
        path = [vehicle, object_rel, interpretant]

        # Fast path: valid path exists
        if self.manifold.has_path(path):
            return path

        # Fallback: try permutations by varying each triad independently
        # according to the default priority order from the rubric
        vehicle_opts = self._triad_sections["vehicle"].get("default_priority", [vehicle])
        object_opts = self._triad_sections["object"].get("default_priority", [object_rel])
        interpretant_opts = self._triad_sections["interpretant"].get("default_priority", [interpretant])

        for v in vehicle_opts:
            for o in object_opts:
                for i in interpretant_opts:
                    candidate = [v, o, i]
                    if self.manifold.has_path(candidate):
                        return candidate

        raise AmbiguousClassificationError(
            f"No valid path in manifold for resolved triads. "
            f"Computed: {path}, tried {len(vehicle_opts) * len(object_opts) * len(interpretant_opts)} permutations."
        )

    def annotate(self, event: LogocEvent) -> LogocEvent:
        """
        Populate the event.peirce block in-place.
        If classification is ambiguous, marks peirce_migration_pending = True.
        """
        try:
            path = self.classify_path(event)
            cls = self.manifold.lookup_by_path(path)
            event.peirce = PeirceSignature(
                mode=_infer_coarse_mode(path),
                sign_class_id=cls.id,
                sign_class_label=cls.label,
                path=cls.path,
                firstness_weight=cls.firstness_weight,
                secondness_weight=cls.secondness_weight,
                thirdness_weight=cls.thirdness_weight,
                pragmatism_band=cls.pragmatism_band,
            )
            event.peirce_migration_pending = False
            event.peirce_migration_source = None
        except (AmbiguousClassificationError, ValueError):
            event.peirce = None
            event.peirce_migration_pending = True
            event.peirce_migration_source = "heuristic_v1_pending"
        return event

    # ------------------------------------------------------------------
    # Triad-by-triad private decisions (v1.1 with disambiguation)
    # ------------------------------------------------------------------

    def _decide_triad(self, event: LogocEvent, triad_name: str) -> str:
        """Generic triad decision with disambiguation support."""
        section = self._triad_sections[triad_name]
        options = section["options"]
        default_priority = section.get("default_priority", list(options.keys()))
        flags = event.semiotic_flags or SemioticFlags()
        narrative = (event.narrative or "").lower()

        # Step 1: Collect which options have matching feature flags
        flag_matches: Dict[str, bool] = {}
        for option_name, option_def in options.items():
            for condition in option_def.get("conditions", []):
                if condition.get("type") == "feature_flag":
                    field = condition["field"]
                    value = condition["value"]
                    flag_key = field.replace("semiotic_flags.", "")
                    flag_val = getattr(flags, flag_key, False)
                    if flag_val == value:
                        flag_matches[option_name] = True
                        break

        # Step 2: If exactly one flag matches, return it immediately
        if len(flag_matches) == 1:
            return list(flag_matches.keys())[0].title()

        # Step 3: If multiple flags match, use strong indicator disambiguation
        if len(flag_matches) > 1:
            scores: Dict[str, float] = {}
            for option_name in flag_matches:
                option_def = options[option_name]
                strong_indicators = option_def.get("strong_indicators", [])
                weight = option_def.get("disambiguation_weight", 1.0)
                match_count = sum(
                    1 for ind in strong_indicators if ind.lower() in narrative
                )
                # Also count regular heuristic keywords
                for condition in option_def.get("conditions", []):
                    if condition.get("type") == "heuristic":
                        keywords = condition.get("keywords", [])
                        match_count += sum(
                            1 for kw in keywords if kw.lower() in narrative
                        )
                scores[option_name] = match_count * weight

            if scores:
                best = max(scores, key=scores.get)
                if scores[best] > 0:
                    return best.title()
                # If all scores are 0, fall through to default priority

        # Step 4: If no flags match, try heuristic-only resolution
        heuristic_scores: Dict[str, float] = {}
        for option_name, option_def in options.items():
            weight = option_def.get("disambiguation_weight", 1.0)
            match_count = 0
            for condition in option_def.get("conditions", []):
                if condition.get("type") == "heuristic":
                    keywords = condition.get("keywords", [])
                    match_count += sum(
                        1 for kw in keywords if kw.lower() in narrative
                    )
            strong_indicators = option_def.get("strong_indicators", [])
            match_count += sum(
                1 for ind in strong_indicators if ind.lower() in narrative
            )
            if match_count > 0:
                heuristic_scores[option_name] = match_count * weight

        if heuristic_scores:
            return max(heuristic_scores, key=heuristic_scores.get).title()

        # Step 5: Final fallback — only if at least one signal was detected
        # (flag or heuristic) in at least one triad. If the event is completely
        # blank (no flags, no heuristic matches), raise ambiguity.
        # Check if this triad had any signal at all.
        has_any_signal = len(flag_matches) > 0 or len(heuristic_scores) > 0
        if has_any_signal:
            for option_name in default_priority:
                if option_name in options:
                    return option_name.title()

        # No signal detected — raise ambiguity for completely blank events
        raise AmbiguousClassificationError(
            f"Cannot determine {triad_name} from event: no flags or heuristic matches."
        )

    # Legacy private methods (kept for backward compat)
    def _decide_vehicle(self, event: LogocEvent) -> str:
        return self._decide_triad(event, "vehicle")

    def _decide_object_relation(self, event: LogocEvent) -> str:
        return self._decide_triad(event, "object")

    def _decide_interpretant(self, event: LogocEvent) -> str:
        return self._decide_triad(event, "interpretant")


def _infer_coarse_mode(path: List[str]) -> Literal["ICON", "INDEX", "SYMBOL"]:
    for node in path:
        if node == "Symbol":
            return "SYMBOL"
        if node == "Index":
            return "INDEX"
        if node == "Icon":
            return "ICON"
    return "ICON"


# ------------------------------------------------------------------------------
# Production Pipeline Classifier (v2.5.0)
# Integrates rubric + ML ensemble triage for real-time ingestion
# ------------------------------------------------------------------------------

class ProductionPeirceClassifier:
    """
    Production classifier combining rubric PeirceClassifier with ML ensemble triage.

    Usage:
        classifier = ProductionPeirceClassifier()  # loads default ML model
        event = classifier.annotate(event)         # P4 flag clean → rubric → ML triage → auto/human
    """

    def __init__(
        self,
        rubric_classifier: Optional[PeirceClassifier] = None,
        model_path: Optional[Path] = None,
        spec_path: Optional[Path] = None,
        use_p4: bool = True,
    ):
        self.rubric = rubric_classifier or PeirceClassifier()
        self.pipeline = self._load_pipeline(model_path, spec_path)
        self.use_p4 = use_p4
        self._p4_cleaner = None
        if use_p4:
            self._p4_cleaner = self._load_p4_cleaner()

    def _load_pipeline(self, model_path, spec_path):
        """Load ML pipeline if numpy and model files are available."""
        try:
            from .pipeline import LogocMLPipeline
            return LogocMLPipeline(model_path=model_path, spec_path=spec_path)
        except (ImportError, FileNotFoundError):
            # numpy missing or model files absent → rubric-only fallback
            return None

    def _load_p4_cleaner(self):
        """Load P4 flag-cleaning helper if flag_extractor_v3 is available."""
        try:
            from scripts.flag_extractor_v3 import clean_and_extract_flags
            return clean_and_extract_flags
        except Exception:
            # If flag_extractor_v3 cannot be imported (path, deps, etc.), fall back gracefully
            return None

    def classify(self, event: LogocEvent) -> int:
        """Fast rubric-only classification (no ML overhead)."""
        return self.rubric.classify(event)

    def _apply_p4_cleaning(self, event: LogocEvent) -> LogocEvent:
        """Run P4 narrative-purpose detection and update event.semiotic_flags."""
        if self._p4_cleaner is None:
            event.pipeline_p4_cleaned = False
            return event

        flags = event.semiotic_flags or SemioticFlags()
        flags_dict = {k: getattr(flags, k, False) for k in [
            "single_occurrence", "rule_based", "similarity", "causality",
            "convention", "possibility", "fact", "reason",
        ]}

        cleaned = self._p4_cleaner(
            narrative=event.narrative or "",
            existing_flags=flags_dict,
        )

        event.semiotic_flags = SemioticFlags(**cleaned)
        event.pipeline_p4_cleaned = True
        return event

    def annotate(self, event: LogocEvent) -> LogocEvent:
        """
        Production annotation with full ML triage.

        Flow:
          1. P4 narrative-purpose flag cleaning (if enabled and available)
          2. Run ML pipeline triage on cleaned flags
          3. If auto_accept → populate peirce, clear migration_pending
          4. If human_review → peirce=None, migration_pending=True
          5. Store pipeline metadata on event for observability
        """
        if self.pipeline is None:
            # Fallback to rubric-only when ML is unavailable
            # Still apply P4 cleaning so rubric sees corrected flags
            if self.use_p4 and self._p4_cleaner is not None:
                event = self._apply_p4_cleaning(event)
            return self.rubric.annotate(event)

        # Step 1: P4 narrative-purpose flag cleaning
        if self.use_p4:
            event = self._apply_p4_cleaning(event)

        # Step 2: Extract cleaned flags for pipeline
        flags = event.semiotic_flags or SemioticFlags()
        flags_dict = {k: getattr(flags, k, False) for k in [
            "single_occurrence", "rule_based", "similarity", "causality",
            "convention", "possibility", "fact", "reason",
        ]}

        # Step 3: Run ML triage
        triage = self.pipeline.triage(flags_dict, event_id=event.event_id)

        # Step 4: Apply triage result
        if triage["status"] == "auto_accept":
            class_id = triage["class_id"]
            try:
                cls = self.rubric.manifold.get(class_id)
                event.peirce = PeirceSignature(
                    mode=_infer_coarse_mode(cls.path),
                    sign_class_id=cls.id,
                    sign_class_label=cls.label,
                    path=cls.path,
                    firstness_weight=cls.firstness_weight,
                    secondness_weight=cls.secondness_weight,
                    thirdness_weight=cls.thirdness_weight,
                    pragmatism_band=cls.pragmatism_band,
                )
                event.peirce_migration_pending = False
                event.peirce_migration_source = None
            except (KeyError, ValueError):
                # Should never happen for valid class_id, but defensively fall back
                event.peirce = None
                event.peirce_migration_pending = True
                event.peirce_migration_source = "pipeline_invalid_class_id"
        else:
            # human_review — preserve rubric result if available for downstream
            event.peirce = None
            event.peirce_migration_pending = True
            event.peirce_migration_source = "pipeline_human_review"

        # Step 5: Store pipeline metadata on event
        event.pipeline_triage_status = triage["status"]
        event.pipeline_triage_reason = triage["reason"]
        event.pipeline_ml_confidence = triage["ml"]["confidence"]
        event.pipeline_rubric_method = triage["rubric"]["method"]
        event.pipeline_rubric_class_id = triage["rubric"]["class_id"]
        event.pipeline_ml_class_id = triage["ml"]["class_id"]

        return event

    def triage(self, event: LogocEvent) -> dict:
        """
        Return the raw triage dict without mutating the event.
        Useful for testing, observability, and batch processing.
        """
        if self.pipeline is None:
            return {"status": "unavailable", "reason": "ml_pipeline_not_loaded"}

        flags = event.semiotic_flags or SemioticFlags()
        flags_dict = {k: getattr(flags, k, False) for k in [
            "single_occurrence", "rule_based", "similarity", "causality",
            "convention", "possibility", "fact", "reason",
        ]}
        return self.pipeline.triage(flags_dict, event_id=event.event_id)
