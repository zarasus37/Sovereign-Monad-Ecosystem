"""
LOGOC Peirce ML Classifier v2.0 (Phase 2)
Supervised multi-class classifier for semiotic_flags → Peirce sign class.

Implements lightweight models using numpy only (no sklearn dependency):
- Logistic Regression (softmax with L2 regularization)
- Bootstrap ensemble of decision stumps (Random Forest-like)
- Confidence-thresholded prediction to reduce ambiguity

When sklearn is available, wraps it for advanced models (SVM, Gradient Boosting).
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .manifold import PeirceManifold, get_manifold
from .models import LogocEvent, SemioticFlags

# Feature ordering must match training pipeline
FEATURE_NAMES = [
    "single_occurrence",
    "rule_based",
    "similarity",
    "causality",
    "convention",
    "possibility",
    "fact",
    "reason",
]


def _event_to_features(event: LogocEvent) -> np.ndarray:
    """Extract 8-dimensional feature vector from event flags."""
    flags = event.get("semiotic_flags", {})
    return np.array([1.0 if flags.get(f, False) else 0.0 for f in FEATURE_NAMES], dtype=np.float32)


def _events_to_matrix(events: List[LogocEvent]) -> np.ndarray:
    """Convert list of events to (N, 8) feature matrix."""
    return np.stack([_event_to_features(e) for e in events], axis=0)


class LogisticRegressionClassifier:
    """Multinomial logistic regression with L2 regularization, numpy-only."""

    def __init__(self, n_features: int, n_classes: int, reg: float = 0.01):
        self.n_features = n_features
        self.n_classes = n_classes
        self.reg = reg
        # Weights: (n_features, n_classes)
        self.W = np.zeros((n_features, n_classes), dtype=np.float32)
        self.bias = np.zeros(n_classes, dtype=np.float32)
        self.classes_: Optional[np.ndarray] = None
        self.class_weights: Optional[np.ndarray] = None

    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        """Stable softmax."""
        logits = logits - np.max(logits, axis=1, keepdims=True)
        exp = np.exp(logits)
        return exp / np.sum(exp, axis=1, keepdims=True)

    def fit(self, X: np.ndarray, y: np.ndarray, max_iter: int = 1000, lr: float = 0.1) -> None:
        """Train with gradient descent."""
        self.classes_ = np.unique(y)
        n_samples = X.shape[0]

        # Class weights for imbalance
        counts = np.bincount(y, minlength=self.n_classes)
        self.class_weights = (n_samples / (self.n_classes * counts)).astype(np.float32)

        for _ in range(max_iter):
            logits = X @ self.W + self.bias  # (N, C)
            probs = self._softmax(logits)  # (N, C)

            # One-hot encode y
            y_onehot = np.zeros((n_samples, self.n_classes), dtype=np.float32)
            y_onehot[np.arange(n_samples), y] = 1.0

            # Weighted gradient
            sample_weights = self.class_weights[y]
            error = (probs - y_onehot) * sample_weights[:, None]

            grad_W = (X.T @ error) / n_samples + self.reg * self.W
            grad_b = np.mean(error, axis=0)

            self.W -= lr * grad_W
            self.bias -= lr * grad_b

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return (N, C) probability matrix."""
        logits = X @ self.W + self.bias
        return self._softmax(logits)

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return (N,) class predictions."""
        probs = self.predict_proba(X)
        return self.classes_[np.argmax(probs, axis=1)]

    def to_dict(self) -> Dict:
        return {
            "type": "logistic_regression",
            "n_features": self.n_features,
            "n_classes": self.n_classes,
            "reg": self.reg,
            "W": self.W.tolist(),
            "bias": self.bias.tolist(),
            "classes": self.classes_.tolist() if self.classes_ is not None else [],
            "class_weights": self.class_weights.tolist() if self.class_weights is not None else [],
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "LogisticRegressionClassifier":
        obj = cls(d["n_features"], d["n_classes"], d["reg"])
        obj.W = np.array(d["W"], dtype=np.float32)
        obj.bias = np.array(d["bias"], dtype=np.float32)
        obj.classes_ = np.array(d["classes"], dtype=np.int32) if d["classes"] else None
        obj.class_weights = np.array(d["class_weights"], dtype=np.float32) if d["class_weights"] else None
        return obj


class NaiveBayesClassifier:
    """Bernoulli Naive Bayes for binary features."""

    def __init__(self):
        self.priors: Dict = {}
        self.probs: Dict = {}
        self.classes_: Optional[np.ndarray] = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.classes_ = np.unique(y)
        for cid in self.classes_:
            mask = y == cid
            n_c = mask.sum()
            self.priors[cid] = float(n_c / len(y))
            self.probs[cid] = (X[mask].sum(axis=0) + 1) / (n_c + 2)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        probs = np.zeros((len(X), len(self.classes_)), dtype=np.float32)
        for i, x in enumerate(X):
            scores = {}
            for cid in self.classes_:
                lp = np.log(self.priors[cid])
                for fidx in range(len(x)):
                    p = self.probs[cid][fidx]
                    lp += np.log(p if x[fidx] > 0.5 else (1 - p))
                scores[cid] = lp
            max_score = max(scores.values())
            exp_scores = {k: np.exp(v - max_score) for k, v in scores.items()}
            total = sum(exp_scores.values())
            for j, cid in enumerate(self.classes_):
                probs[i, j] = exp_scores[cid] / total
        return probs

    def predict(self, X: np.ndarray) -> np.ndarray:
        probs = self.predict_proba(X)
        return self.classes_[np.argmax(probs, axis=1)]

    def to_dict(self) -> Dict:
        return {
            "type": "naive_bayes",
            "priors": self.priors,
            "probs": {int(k): v.tolist() for k, v in self.probs.items()},
            "classes": self.classes_.tolist() if self.classes_ is not None else [],
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "NaiveBayesClassifier":
        obj = cls()
        obj.priors = {int(k): v for k, v in d["priors"].items()}
        obj.probs = {int(k): np.array(v, dtype=np.float32) for k, v in d["probs"].items()}
        obj.classes_ = np.array(d["classes"], dtype=np.int32) if d["classes"] else None
        return obj


class DecisionStump:
    """Single-feature decision stump with entropy-based split."""

    def __init__(self):
        self.feature_idx: Optional[int] = None
        self.threshold: float = 0.5
        self.left_class: Optional[int] = None
        self.right_class: Optional[int] = None
        self.left_proba: Optional[np.ndarray] = None
        self.right_proba: Optional[np.ndarray] = None
        self.classes_: Optional[np.ndarray] = None

    def _entropy(self, y: np.ndarray) -> float:
        if len(y) == 0:
            return 0.0
        counts = np.bincount(y, minlength=len(self.classes_))
        probs = counts / len(y)
        return -np.sum(probs[probs > 0] * np.log2(probs[probs > 0]))

    def fit(self, X: np.ndarray, y: np.ndarray, sample_weights: np.ndarray) -> float:
        """Find best split. Returns info gain."""
        self.classes_ = np.unique(y)
        n_classes = len(self.classes_)
        best_gain = -1.0

        base_entropy = self._entropy(y)

        for fidx in range(X.shape[1]):
            # Binary split at 0.5 (features are binary 0/1)
            left_mask = X[:, fidx] <= 0.5
            right_mask = ~left_mask

            if left_mask.sum() == 0 or right_mask.sum() == 0:
                continue

            left_entropy = self._entropy(y[left_mask])
            right_entropy = self._entropy(y[right_mask])
            weighted_entropy = (
                left_mask.sum() * left_entropy + right_mask.sum() * right_entropy
            ) / len(y)
            gain = base_entropy - weighted_entropy

            if gain > best_gain:
                best_gain = gain
                self.feature_idx = fidx
                self.left_class = int(np.bincount(y[left_mask], minlength=n_classes).argmax())
                self.right_class = int(np.bincount(y[right_mask], minlength=n_classes).argmax())
                # Compute class probabilities for each branch
                left_counts = np.bincount(y[left_mask], minlength=n_classes)
                right_counts = np.bincount(y[right_mask], minlength=n_classes)
                self.left_proba = left_counts / left_counts.sum() if left_counts.sum() > 0 else np.ones(n_classes) / n_classes
                self.right_proba = right_counts / right_counts.sum() if right_counts.sum() > 0 else np.ones(n_classes) / n_classes

        return best_gain

    def predict(self, X: np.ndarray) -> np.ndarray:
        assert self.feature_idx is not None
        left_mask = X[:, self.feature_idx] <= 0.5
        preds = np.full(len(X), -1, dtype=np.int32)
        preds[left_mask] = self.left_class
        preds[~left_mask] = self.right_class
        return preds

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        assert self.feature_idx is not None and self.left_proba is not None
        left_mask = X[:, self.feature_idx] <= 0.5
        probs = np.zeros((len(X), len(self.left_proba)), dtype=np.float32)
        probs[left_mask] = self.left_proba
        probs[~left_mask] = self.right_proba
        return probs


class EnsembleClassifier:
    """Bootstrap ensemble of decision stumps."""

    def __init__(self, n_estimators: int = 50):
        self.n_estimators = n_estimators
        self.estimators: List[DecisionStump] = []
        self.classes_: Optional[np.ndarray] = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.classes_ = np.unique(y)
        n_samples = X.shape[0]

        for _ in range(self.n_estimators):
            # Bootstrap sample
            indices = np.random.choice(n_samples, n_samples, replace=True)
            X_boot = X[indices]
            y_boot = y[indices]

            stump = DecisionStump()
            stump.fit(X_boot, y_boot, np.ones(len(y_boot)))
            self.estimators.append(stump)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        probs = np.zeros((len(X), len(self.classes_)), dtype=np.float32)
        for stump in self.estimators:
            probs += stump.predict_proba(X)
        probs /= len(self.estimators)
        return probs

    def predict(self, X: np.ndarray) -> np.ndarray:
        probs = self.predict_proba(X)
        return self.classes_[np.argmax(probs, axis=1)]

    def to_dict(self) -> Dict:
        return {
            "type": "ensemble_stumps",
            "n_estimators": self.n_estimators,
            "classes": self.classes_.tolist() if self.classes_ is not None else [],
            "stumps": [
                {
                    "feature_idx": s.feature_idx,
                    "threshold": s.threshold,
                    "left_class": s.left_class,
                    "right_class": s.right_class,
                    "left_proba": s.left_proba.tolist() if s.left_proba is not None else [],
                    "right_proba": s.right_proba.tolist() if s.right_proba is not None else [],
                }
                for s in self.estimators
            ],
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "EnsembleClassifier":
        obj = cls(d["n_estimators"])
        obj.classes_ = np.array(d["classes"], dtype=np.int32) if d["classes"] else None
        for s_dict in d["stumps"]:
            s = DecisionStump()
            s.feature_idx = s_dict["feature_idx"]
            s.threshold = s_dict["threshold"]
            s.left_class = s_dict["left_class"]
            s.right_class = s_dict["right_class"]
            s.left_proba = np.array(s_dict["left_proba"], dtype=np.float32) if s_dict["left_proba"] else None
            s.right_proba = np.array(s_dict["right_proba"], dtype=np.float32) if s_dict["right_proba"] else None
            s.classes_ = obj.classes_
            obj.estimators.append(s)
        return obj


class MLPeirceClassifier:
    """
    Production ML classifier for Peirce sign classes.
    Wraps one or more base models and provides confidence-thresholded prediction.
    """

    def __init__(
        self,
        models: Optional[List] = None,
        confidence_threshold: float = 0.6,
        ambiguity_fallback: bool = True,
    ):
        self.models = models or []
        self.confidence_threshold = confidence_threshold
        self.ambiguity_fallback = ambiguity_fallback
        self.manifold = get_manifold()
        self.feature_names = FEATURE_NAMES

    def add_model(self, model) -> None:
        self.models.append(model)

    def predict(self, event: LogocEvent) -> Optional[Dict]:
        """
        Predict Peirce class for an event.
        Returns dict with prediction, confidence, and ambiguity status.
        If confidence < threshold, returns None (ambiguity).
        """
        x = _event_to_features(event).reshape(1, -1)

        if not self.models:
            return None

        # Average probabilities across all models
        all_probs = []
        for model in self.models:
            try:
                probs = model.predict_proba(x)[0]
                all_probs.append(probs)
            except Exception:
                continue

        if not all_probs:
            return None

        avg_probs = np.mean(all_probs, axis=0)
        pred_idx = int(np.argmax(avg_probs))
        confidence = float(avg_probs[pred_idx])
        pred_class = int(self.models[0].classes_[pred_idx])

        if confidence < self.confidence_threshold and self.ambiguity_fallback:
            return None

        sign_class = self.manifold.get(pred_class)
        if sign_class is None:
            return None

        return {
            "sign_class_id": pred_class,
            "sign_class_label": sign_class["label"],
            "path": sign_class["path"],
            "pragmatism_band": sign_class["pragmatism_band"],
            "mode": sign_class["mode"],
            "firstness_weight": sign_class["firstness_weight"],
            "secondness_weight": sign_class["secondness_weight"],
            "thirdness_weight": sign_class["thirdness_weight"],
            "confidence": confidence,
            "model_probs": {int(c): float(p) for c, p in zip(self.models[0].classes_, avg_probs)},
        }

    def to_dict(self) -> Dict:
        return {
            "confidence_threshold": self.confidence_threshold,
            "ambiguity_fallback": self.ambiguity_fallback,
            "models": [m.to_dict() for m in self.models],
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "MLPeirceClassifier":
        obj = cls(confidence_threshold=d.get("confidence_threshold", 0.6))
        for m_dict in d["models"]:
            if m_dict["type"] == "logistic_regression":
                obj.add_model(LogisticRegressionClassifier.from_dict(m_dict))
            elif m_dict["type"] == "naive_bayes":
                obj.add_model(NaiveBayesClassifier.from_dict(m_dict))
            elif m_dict["type"] == "ensemble_stumps":
                obj.add_model(EnsembleClassifier.from_dict(m_dict))
        return obj

    def save(self, path: Path) -> None:
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, path: Path) -> "MLPeirceClassifier":
        with open(path, "r") as f:
            return cls.from_dict(json.load(f))


def train_classifier(
    events: List[LogocEvent],
    test_size: float = 0.2,
    random_seed: int = 42,
) -> Tuple[MLPeirceClassifier, Dict]:
    """
    Train an ML classifier on labeled events.
    Returns (classifier, metrics_dict).
    """
    # Filter events with valid Peirce labels
    labeled = [e for e in events if e.get("peirce") and e["peirce"].get("sign_class_id") is not None]
    if len(labeled) < 10:
        raise ValueError(f"Need at least 10 labeled events, got {len(labeled)}")

    X = _events_to_matrix(labeled)
    y_raw = np.array([e["peirce"]["sign_class_id"] for e in labeled], dtype=np.int32)
    classes = np.unique(y_raw)
    class_to_idx = {cid: idx for idx, cid in enumerate(classes)}
    y = np.array([class_to_idx[cid] for cid in y_raw], dtype=np.int32)

    # Stratified train/test split
    np.random.seed(random_seed)
    indices = np.arange(len(labeled))
    np.random.shuffle(indices)

    train_idx = []
    test_idx = []
    for cid_idx in range(len(classes)):
        class_idx = indices[y[indices] == cid_idx]
        split = int(len(class_idx) * (1 - test_size))
        train_idx.extend(class_idx[:split])
        test_idx.extend(class_idx[split:])

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    # Train models
    lr = LogisticRegressionClassifier(n_features=8, n_classes=len(classes), reg=0.05)
    lr.fit(X_train, y_train, max_iter=2000, lr=0.05)
    lr.classes_ = classes.astype(np.int32)

    nb = NaiveBayesClassifier()
    nb.fit(X_train, y_train)
    nb.classes_ = classes.astype(np.int32)

    ensemble = EnsembleClassifier(n_estimators=100)
    ensemble.fit(X_train, y_train)
    ensemble.classes_ = classes.astype(np.int32)

    # Evaluate (models now return raw class IDs)
    def evaluate(model, X_test, y_test):
        preds_raw = model.predict(X_test)
        y_test_raw = classes[y_test]
        accuracy = float((preds_raw == y_test_raw).mean())
        per_class = {}
        for cid in classes:
            mask = y_test_raw == cid
            if mask.sum() > 0:
                per_class[int(cid)] = float((preds_raw[mask] == y_test_raw[mask]).mean())
        return accuracy, per_class

    lr_acc, lr_per = evaluate(lr, X_test, y_test)
    nb_acc, nb_per = evaluate(nb, X_test, y_test)
    ens_acc, ens_per = evaluate(ensemble, X_test, y_test)

    # Combined classifier (ensemble of LR + NB + stump ensemble)
    classifier = MLPeirceClassifier(models=[lr, nb, ensemble], confidence_threshold=0.55)

    # Combined prediction on test set
    all_preds = []
    for i in range(len(X_test)):
        x = X_test[i:i+1]
        probs_lr = lr.predict_proba(x)[0]
        probs_nb = nb.predict_proba(x)[0]
        probs_ens = ensemble.predict_proba(x)[0]
        avg = (probs_lr + probs_nb + probs_ens) / 3
        pred_idx = int(np.argmax(avg))
        all_preds.append(int(lr.classes_[pred_idx]))
    combined_acc = float((np.array(all_preds) == classes[y_test]).mean())

    metrics = {
        "n_train": len(train_idx),
        "n_test": len(test_idx),
        "n_classes": len(classes),
        "classes": [int(c) for c in classes],
        "logistic_regression": {
            "accuracy": lr_acc,
            "per_class_accuracy": lr_per,
        },
        "naive_bayes": {
            "accuracy": nb_acc,
            "per_class_accuracy": nb_per,
        },
        "ensemble_stumps": {
            "accuracy": ens_acc,
            "per_class_accuracy": ens_per,
        },
        "combined": {
            "accuracy": combined_acc,
        },
    }

    return classifier, metrics
