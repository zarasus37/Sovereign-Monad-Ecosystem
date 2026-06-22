"""
Tests for semiotic_drift.py — Antikythera observability layer.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.semiotic_drift import (
    SemioticDriftLogger,
    SemioticDistributionSnapshot,
    compute_corpus_drift,
    DRIFT_PATTERNS,
)
from peirce.models import LogocEvent, PeirceSignature, SemioticFlags


def _make_event(cid: int, band: str, mode: str, path: list[str], fw: float, sw: float, tw: float) -> LogocEvent:
    return LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id=f"test_{cid}",
        timestamp="2026-06-19T00:00:00Z",
        narrative="test",
        peirce=PeirceSignature(
            mode=mode,
            sign_class_id=cid,
            sign_class_label="-".join(path),
            path=path,
            firstness_weight=fw,
            secondness_weight=sw,
            thirdness_weight=tw,
            pragmatism_band=band,
        ),
    )


def test_snapshot_computes_histograms():
    logger = SemioticDriftLogger()
    events = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
    ]
    snap = logger.compute_snapshot("cycle_1", events)
    assert snap.total_events == 3
    assert snap.accepted_events == 3
    assert snap.class_histogram[42] == 2
    assert snap.class_histogram[0] == 1
    assert snap.band_histogram["FORMAL_THOUGHT"] == 2
    assert snap.band_histogram["EXPERIENCE"] == 1
    assert snap.mode_histogram["SYMBOL"] == 2
    assert snap.mode_histogram["ICON"] == 1
    assert snap.vehicle_histogram["Legisign"] == 2
    assert snap.vehicle_histogram["Qualisign"] == 1
    assert snap.interpretant_histogram["Argument"] == 2
    assert snap.interpretant_histogram["Rheme"] == 1


def test_snapshot_computes_average_weights():
    logger = SemioticDriftLogger()
    events = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
    ]
    snap = logger.compute_snapshot("cycle_1", events)
    assert snap.avg_firstness == 0.15
    assert snap.avg_secondness == 0.35
    assert snap.avg_thirdness == 0.50
    assert snap.avg_pps == 0.85


def test_drift_within_variance_for_identical_distributions():
    logger = SemioticDriftLogger()
    events = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
    ]
    snap1 = logger.compute_snapshot("cycle_1", events)
    snap2 = logger.compute_snapshot("cycle_2", events)
    drift = logger.compute_drift(snap2, snap1)
    assert drift.category == "WITHIN_VARIANCE"
    assert drift.drift_score < 0.1
    assert drift.kl_divergence < 0.01


def test_drift_detects_icon_surge():
    """When corpus shifts from FORMAL_THOUGHT to ICON/EXPERIENCE."""
    logger = SemioticDriftLogger()
    previous = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
    ]
    current = [
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
        _make_event(0, "EXPERIENCE", "ICON", ["Qualisign", "Icon", "Rheme"], 0.60, 0.30, 0.10),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
    ]
    snap1 = logger.compute_snapshot("cycle_1", previous)
    snap2 = logger.compute_snapshot("cycle_2", current)
    drift = logger.compute_drift(snap2, snap1)
    assert "ICON_SURGE" in drift.drift_patterns
    assert drift.drift_score > 0.28
    assert drift.category in ("SYSTEMATIC_DRIFT", "ANOMALOUS_DEVIATION")


def test_drift_detects_formal_thought_decline():
    """When FORMAL_THOUGHT band drops significantly."""
    logger = SemioticDriftLogger()
    previous = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(2, "EXPERIENCE", "INDEX", ["Sinsign", "Index", "Dicent"], 0.20, 0.50, 0.30),
    ]
    current = [
        _make_event(2, "EXPERIENCE", "INDEX", ["Sinsign", "Index", "Dicent"], 0.20, 0.50, 0.30),
        _make_event(2, "EXPERIENCE", "INDEX", ["Sinsign", "Index", "Dicent"], 0.20, 0.50, 0.30),
        _make_event(2, "EXPERIENCE", "INDEX", ["Sinsign", "Index", "Dicent"], 0.20, 0.50, 0.30),
        _make_event(2, "EXPERIENCE", "INDEX", ["Sinsign", "Index", "Dicent"], 0.20, 0.50, 0.30),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
    ]
    snap1 = logger.compute_snapshot("cycle_1", previous)
    snap2 = logger.compute_snapshot("cycle_2", current)
    drift = logger.compute_drift(snap2, snap1)
    assert "FORMAL_THOUGHT_DECLINE" in drift.drift_patterns


def test_drift_with_pending_events():
    """Pending events are counted in total but excluded from distribution."""
    logger = SemioticDriftLogger()
    events = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        LogocEvent(
            schema_version="LOGOC-Event-v5.2",
            event_id="pending_1",
            timestamp="2026-06-19T00:00:00Z",
            narrative="ambiguous",
            peirce_migration_pending=True,
        ),
    ]
    snap = logger.compute_snapshot("cycle_1", events)
    assert snap.total_events == 3
    assert snap.accepted_events == 2
    assert snap.pending_events == 1
    assert snap.band_histogram["FORMAL_THOUGHT"] == 2


def test_corpus_drift_convenience_function():
    previous = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
    ]
    current = [
        _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
    ]
    drift = compute_corpus_drift(previous, current)
    assert drift.category == "WITHIN_VARIANCE"


def test_drift_logger_persists_snapshots():
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = SemioticDriftLogger(log_dir=Path(tmpdir))
        events = [
            _make_event(42, "FORMAL_THOUGHT", "SYMBOL", ["Legisign", "Symbol", "Argument"], 0.15, 0.35, 0.50),
        ]
        logger.log_cycle("cycle_1", events)
        logger.log_cycle("cycle_2", events)

        assert (Path(tmpdir) / "snapshot_cycle_1.json").exists()
        assert (Path(tmpdir) / "snapshot_cycle_2.json").exists()
        assert (Path(tmpdir) / "drift_cycle_1_to_cycle_2.json").exists()

        history = logger.get_drift_history()
        assert len(history) == 1
        assert history[0].cycle_id == "cycle_2"
        assert history[0].previous_cycle_id == "cycle_1"
