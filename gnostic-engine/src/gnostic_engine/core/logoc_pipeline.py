# logoc_pipeline.py — Production Logoc ML Pipeline (P6 Final)
# Production-ready semiotic classification pipeline for gnosis events
# Supports: rubric classification, ML classification (custom NB v11), ensemble triage

import json
import math
import os
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
from enum import Enum


class TriageStatus(Enum):
    AUTO_ACCEPT = "auto_accept"
    HUMAN_REVIEW = "human_review"
    AMBIGUOUS = "ambiguous"


@dataclass
class TriageResult:
    status: TriageStatus
    rubric_class: Optional[int]
    ml_class: int
    ml_confidence: float
    reason: str


class LogocMLPipeline:
    """
    Production pipeline for semiotic classification of gnosis events.
    
    Components:
    1. Rubric classifier (deterministic, rule-based on 8 binary flags)
    2. ML classifier (Naive Bayes v11, trained on 334 events)
    3. Triage ensemble (agreement → auto-accept, disagreement → human review)
    """
    
    FEATURE_NAMES = [
        'single_occurrence', 'rule_based', 'similarity', 'causality',
        'convention', 'possibility', 'fact', 'reason'
    ]
    
    # Clean rubric classification paths (exact match only)
    RUBRIC_PATHS = {
        (1, 0, 0, 0, 0, 1, 0, 0): 1,   # Rheme-Indexical-Sinsign
        (1, 0, 0, 1, 0, 0, 1, 0): 2,   # Dicent-Indexical-Sinsign
        (0, 0, 1, 0, 0, 1, 0, 0): 0,   # Rheme-Iconic-Qualisign
        (0, 1, 1, 0, 0, 1, 0, 0): 3,   # Rheme-Iconic-Legisign
        (0, 0, 0, 1, 0, 0, 1, 0): 4,   # Dicent-Indexical-Legisign
        (0, 1, 0, 1, 0, 0, 1, 0): 5,   # Dicent-Indexical-Legisign (general law)
        (0, 0, 0, 0, 1, 0, 1, 0): 6,   # Dicent-Symbol-Legisign
        (0, 1, 0, 0, 1, 0, 1, 0): 7,   # Dicent-Symbol-Legisign (general law)
        (0, 1, 0, 1, 0, 0, 0, 1): 8,   # Argument-Indexical-Legisign
        (1, 0, 1, 0, 0, 0, 1, 0): 9,   # Dicent-Iconic-Sinsign
    }
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = self._load_model(model_path)
        self.classes = self.model['classes']
        self.priors = {int(k): v for k, v in self.model['priors'].items()}
        self.feature_probs = {int(k): v for k, v in self.model['feature_probs'].items()}
    
    @classmethod
    def _load_model(cls, model_path: Optional[str]) -> dict:
        if model_path and os.path.exists(model_path):
            with open(model_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        # Fallback: compute from corpus if available
        raise FileNotFoundError(f"Model not found at {model_path}")
    
    def extract_features(self, flags: Dict[str, bool]) -> List[int]:
        """Extract 8-bit feature vector from semiotic flags."""
        return [1 if flags.get(f, False) else 0 for f in self.FEATURE_NAMES]
    
    def rubric_classify(self, flags: Dict[str, bool]) -> Optional[int]:
        """Deterministic rubric classification. Returns None if ambiguous."""
        features = tuple(self.extract_features(flags))
        return self.RUBRIC_PATHS.get(features)
    
    def ml_classify(self, features: List[int]) -> Tuple[int, float, Dict[int, float]]:
        """Naive Bayes classification. Returns (best_class, confidence, all_probs)."""
        scores = {}
        for c in self.classes:
            log_prob = math.log(self.priors[c])
            for fi, val in enumerate(features):
                p = self.feature_probs[c][fi]
                if val == 1:
                    log_prob += math.log(p)
                else:
                    log_prob += math.log(1 - p)
            scores[c] = log_prob
        
        # Normalize to probabilities
        max_score = max(scores.values())
        exp_scores = {c: math.exp(s - max_score) for c, s in scores.items()}
        total = sum(exp_scores.values())
        probs = {c: exp_scores[c] / total for c in self.classes}
        
        best_class = max(probs, key=probs.get)
        confidence = probs[best_class]
        return best_class, confidence, probs
    
    def triage(self, event: Dict[str, Any]) -> TriageResult:
        """
        Ensemble triage: rubric + ML → auto-accept or human review.
        
        Logic:
        - If rubric_class == ml_class AND confidence >= 0.7 → AUTO_ACCEPT
        - If rubric_class is None AND ml_confidence >= 0.8 → AUTO_ACCEPT (ML override)
        - If rubric_class != ml_class → HUMAN_REVIEW (ensemble disagreement)
        - If ml_confidence < 0.5 → HUMAN_REVIEW (low confidence)
        """
        flags = event.get('semiotic_flags', {})
        features = self.extract_features(flags)
        
        rubric_class = self.rubric_classify(flags)
        ml_class, ml_conf, _ = self.ml_classify(features)
        
        # Triage logic
        if rubric_class is not None and rubric_class == ml_class and ml_conf >= 0.7:
            return TriageResult(
                status=TriageStatus.AUTO_ACCEPT,
                rubric_class=rubric_class,
                ml_class=ml_class,
                ml_confidence=ml_conf,
                reason="rubric_ml_agree_high_conf"
            )
        
        if rubric_class is None and ml_conf >= 0.8:
            return TriageResult(
                status=TriageStatus.AUTO_ACCEPT,
                rubric_class=None,
                ml_class=ml_class,
                ml_confidence=ml_conf,
                reason="ml_override_ambiguous_rubric"
            )
        
        if rubric_class is None:
            return TriageResult(
                status=TriageStatus.AMBIGUOUS,
                rubric_class=None,
                ml_class=ml_class,
                ml_confidence=ml_conf,
                reason="ambiguous_flags_low_conf"
            )
        
        return TriageResult(
            status=TriageStatus.HUMAN_REVIEW,
            rubric_class=rubric_class,
            ml_class=ml_class,
            ml_confidence=ml_conf,
            reason="ensemble_disagree"
        )
    
    def classify(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Full classification with explanation."""
        result = self.triage(event)
        return {
            'status': result.status.value,
            'rubric_class': result.rubric_class,
            'ml_class': result.ml_class,
            'ml_confidence': round(result.ml_confidence, 4),
            'reason': result.reason,
            'flags': event.get('semiotic_flags', {}),
            'actual_class': event.get('peirce', {}).get('sign_class_id')
        }
    
    @classmethod
    def train_from_corpus(cls, events: List[Dict[str, Any]]) -> dict:
        """Train a new Naive Bayes model from a corpus of events."""
        feature_names = cls.FEATURE_NAMES
        X = []
        y = []
        for evt in events:
            flags = evt.get('semiotic_flags', {})
            feats = [1 if flags.get(f, False) else 0 for f in feature_names]
            label = evt.get('peirce', {}).get('sign_class_id')
            if label is not None:
                X.append(feats)
                y.append(label)
        
        classes = sorted(set(y))
        class_priors = {}
        feature_probs = {}
        
        for c in classes:
            mask = [i for i, label in enumerate(y) if label == c]
            count = len(mask)
            class_priors[c] = count / len(y)
            feature_probs[c] = []
            for fi in range(len(feature_names)):
                pos = sum(X[i][fi] for i in mask) + 1  # Laplace +1
                total = count + 2
                feature_probs[c].append(pos / total)
        
        return {
            'version': 'trained',
            'classes': classes,
            'priors': {str(k): v for k, v in class_priors.items()},
            'feature_probs': {str(k): v for k, v in feature_probs.items()},
            'feature_names': feature_names
        }
    
    @classmethod
    def save_model(cls, model: dict, path: str):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(model, f, indent=2)
    
    @classmethod
    def load_pipeline(cls, model_path: str) -> 'LogocMLPipeline':
        return cls(model_path)


# --- Production model loader convenience ---

def get_default_model_path() -> str:
    """Return the default model path relative to project root."""
    # Try to find the project root
    cwd = os.getcwd()
    candidate = os.path.join(cwd, 'logs', 'audit', 'ml_classifier_v11_final.json')
    if os.path.exists(candidate):
        return candidate
    # Fallback: search up the tree
    for _ in range(5):
        cwd = os.path.dirname(cwd)
        if not cwd:
            break
        candidate = os.path.join(cwd, 'logs', 'audit', 'ml_classifier_v11_final.json')
        if os.path.exists(candidate):
            return candidate
    return 'logs/audit/ml_classifier_v11_final.json'


def load_pipeline(model_path: Optional[str] = None) -> LogocMLPipeline:
    """Load the production pipeline with the latest model."""
    if model_path is None:
        model_path = get_default_model_path()
    return LogocMLPipeline(model_path)
