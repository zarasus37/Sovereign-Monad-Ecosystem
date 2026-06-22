"""
Tests for peirce.ml_classifier — Phase 2 ML pipeline.
"""
import json
import numpy as np
import pytest

from peirce.ml_classifier import (
    LogisticRegressionClassifier,
    EnsembleClassifier,
    DecisionStump,
    MLPeirceClassifier,
    train_classifier,
    FEATURE_NAMES,
    _event_to_features,
    _events_to_matrix,
)
from peirce.manifold import get_manifold


class TestFeatureExtraction:
    def test_event_to_features_all_false(self):
        event = {"semiotic_flags": {f: False for f in FEATURE_NAMES}}
        feat = _event_to_features(event)
        assert feat.shape == (8,)
        assert np.all(feat == 0)

    def test_event_to_features_all_true(self):
        event = {"semiotic_flags": {f: True for f in FEATURE_NAMES}}
        feat = _event_to_features(event)
        assert feat.shape == (8,)
        assert np.all(feat == 1)

    def test_events_to_matrix(self):
        events = [
            {"semiotic_flags": {f: i % 2 == 0 for i, f in enumerate(FEATURE_NAMES)}},
            {"semiotic_flags": {f: i % 2 == 1 for i, f in enumerate(FEATURE_NAMES)}},
        ]
        mat = _events_to_matrix(events)
        assert mat.shape == (2, 8)
        assert mat.dtype == np.float32


class TestLogisticRegression:
    def test_basic_fit_predict(self):
        np.random.seed(42)
        # Synthetic data: 3 classes, 8 features
        X = np.random.rand(100, 8).astype(np.float32)
        y = np.random.randint(0, 3, size=100).astype(np.int32)

        model = LogisticRegressionClassifier(n_features=8, n_classes=3, reg=0.01)
        model.fit(X, y, max_iter=500, lr=0.1)

        preds = model.predict(X)
        assert len(preds) == 100
        assert all(p in [0, 1, 2] for p in preds)

        acc = (preds == y).mean()
        assert acc > 0.3  # Better than random (0.33)

    def test_predict_proba_shape(self):
        X = np.random.rand(10, 8).astype(np.float32)
        y = np.array([0, 0, 1, 1, 2, 2, 0, 1, 2, 0], dtype=np.int32)

        model = LogisticRegressionClassifier(n_features=8, n_classes=3, reg=0.01)
        model.fit(X, y, max_iter=100, lr=0.1)

        probs = model.predict_proba(X)
        assert probs.shape == (10, 3)
        assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-5)
        assert np.all(probs >= 0)

    def test_serialization_roundtrip(self):
        X = np.random.rand(20, 8).astype(np.float32)
        y = np.array([0, 1] * 10, dtype=np.int32)

        model = LogisticRegressionClassifier(n_features=8, n_classes=2, reg=0.01)
        model.fit(X, y, max_iter=100, lr=0.1)

        d = model.to_dict()
        model2 = LogisticRegressionClassifier.from_dict(d)

        np.testing.assert_array_almost_equal(model.W, model2.W)
        np.testing.assert_array_almost_equal(model.bias, model2.bias)
        np.testing.assert_array_equal(model.classes_, model2.classes_)


class TestDecisionStump:
    def test_fit_predict(self):
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=np.float32)
        y = np.array([0, 0, 1, 1], dtype=np.int32)

        stump = DecisionStump()
        gain = stump.fit(X, y, np.ones(len(y)))
        assert gain > 0

        preds = stump.predict(X)
        assert preds.shape == (4,)

    def test_predict_proba(self):
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=np.float32)
        y = np.array([0, 0, 1, 1], dtype=np.int32)

        stump = DecisionStump()
        stump.fit(X, y, np.ones(len(y)))

        probs = stump.predict_proba(X)
        assert probs.shape == (4, 2)
        assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-5)


class TestEnsembleClassifier:
    def test_fit_predict(self):
        np.random.seed(42)
        X = np.random.rand(50, 8).astype(np.float32)
        y = np.random.randint(0, 3, size=50).astype(np.int32)

        model = EnsembleClassifier(n_estimators=20)
        model.fit(X, y)

        preds = model.predict(X)
        assert len(preds) == 50

        probs = model.predict_proba(X)
        assert probs.shape == (50, 3)
        assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-5)

    def test_serialization_roundtrip(self):
        np.random.seed(42)
        X = np.random.rand(30, 8).astype(np.float32)
        y = np.random.randint(0, 2, size=30).astype(np.int32)

        model = EnsembleClassifier(n_estimators=10)
        model.fit(X, y)

        d = model.to_dict()
        model2 = EnsembleClassifier.from_dict(d)

        np.testing.assert_array_equal(model.classes_, model2.classes_)
        assert len(model2.estimators) == len(model.estimators)


class TestMLPeirceClassifier:
    def test_predict_with_no_models(self):
        clf = MLPeirceClassifier(models=[], confidence_threshold=0.5)
        event = {"semiotic_flags": {f: True for f in FEATURE_NAMES}}
        result = clf.predict(event)
        assert result is None

    def test_predict_with_trained_model(self):
        np.random.seed(42)
        X = np.random.rand(50, 8).astype(np.float32)
        y = np.random.randint(0, 3, size=50).astype(np.int32)

        lr = LogisticRegressionClassifier(n_features=8, n_classes=3, reg=0.01)
        lr.fit(X, y, max_iter=500, lr=0.1)
        lr.classes_ = np.array([0, 1, 2], dtype=np.int32)

        clf = MLPeirceClassifier(models=[lr], confidence_threshold=0.0)
        event = {"semiotic_flags": {f: True for f in FEATURE_NAMES}}
        result = clf.predict(event)
        assert result is not None
        assert "sign_class_id" in result
        assert "confidence" in result
        assert result["confidence"] > 0

    def test_serialization(self, tmp_path):
        np.random.seed(42)
        X = np.random.rand(30, 8).astype(np.float32)
        y = np.random.randint(0, 2, size=30).astype(np.int32)

        lr = LogisticRegressionClassifier(n_features=8, n_classes=2, reg=0.01)
        lr.fit(X, y, max_iter=200, lr=0.1)
        lr.classes_ = np.array([0, 1], dtype=np.int32)

        clf = MLPeirceClassifier(models=[lr], confidence_threshold=0.5)
        path = tmp_path / "ml_clf.json"
        clf.save(path)

        clf2 = MLPeirceClassifier.load(path)
        assert clf2.confidence_threshold == clf.confidence_threshold
        assert len(clf2.models) == 1


class TestTrainClassifier:
    def test_train_on_synthetic_data(self):
        """End-to-end training on synthetic events."""
        np.random.seed(42)
        events = []
        for i in range(100):
            flags = {f: bool(np.random.randint(0, 2)) for f in FEATURE_NAMES}
            events.append({
                "event_id": f"ev_{i}",
                "semiotic_flags": flags,
                "peirce": {
                    "sign_class_id": int(np.random.choice([2, 5, 7])),
                }
            })

        classifier, metrics = train_classifier(events, test_size=0.2, random_seed=42)
        assert isinstance(classifier, MLPeirceClassifier)
        assert "logistic_regression" in metrics
        assert "ensemble_stumps" in metrics
        assert "combined" in metrics
        assert metrics["n_train"] > 0
        assert metrics["n_test"] > 0
        assert metrics["combined"]["accuracy"] > 0.2  # Better than random (0.33)

    def test_insufficient_data_raises(self):
        events = []
        for i in range(5):
            events.append({
                "event_id": f"ev_{i}",
                "semiotic_flags": {f: True for f in FEATURE_NAMES},
                "peirce": {"sign_class_id": 2},
            })
        with pytest.raises(ValueError, match="at least 10"):
            train_classifier(events)
