"""Append-only TTC window log (debt / refusal / density / drift pain).

JSONL schema matches Hepar TS ``ttc-window-metrics.ts`` and
``gnosis_training.ttc_signals.TtcWindowEvent`` so one CLI can report both
organ and relay paths:

  logs/ttc-window/hepar-defi-auditor.jsonl   — organ (TypeScript)
  logs/ttc-window/gnostic-engine.jsonl       — API / scorer (Python)

Wired from ``TTCConstraintScorer.score`` when ``record=True``.
"""
from __future__ import annotations

import json
from collections import defaultdict, deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Deque, Dict, List, Optional, Sequence

from .types import TTCResult


def _repo_root() -> Path:
    # .../gnostic-engine/src/gnostic_engine/constraints/window_log.py → root
    return Path(__file__).resolve().parents[4]


def default_log_path(source: str = "gnostic-engine") -> Path:
    return _repo_root() / "logs" / "ttc-window" / f"{source}.jsonl"


@dataclass
class TtcWindowEvent:
    agent_id: str
    action_id: str
    is_refusal: bool
    output_density: float
    identity_fingerprint: str
    sovereignty_debt: float
    valid: bool
    composite_score: float
    refusal_floor_applied: float = 0.0
    identity_stable: bool = False
    amnesty_remaining: int = 0
    failed_rules: List[str] = field(default_factory=list)
    source: str = "gnostic-engine"
    timestamp: str = ""
    target: Optional[str] = None
    audit_id: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if not d.get("timestamp"):
            d["timestamp"] = datetime.now(timezone.utc).isoformat()
        # Drop Nones for cleaner JSONL
        return {k: v for k, v in d.items() if v is not None}


def failed_hard_rule_ids(result: TTCResult) -> List[str]:
    failed: List[str] = []
    for domain in (result.theological, result.technological, result.cosmological):
        for r in domain.rules:
            if r.severity == "hard" and not r.held:
                failed.append(r.id)
    return failed


@dataclass
class TtcWindowSnapshot:
    count: int
    refusal_rate: float
    mean_density: float
    mean_debt: float
    mean_composite: float
    reject_rate: float
    identity_changes: int
    debt_forced_risk: bool
    exploration_pressure: bool
    last_failed_rules: List[str]

    def to_dict(self) -> dict:
        return asdict(self)


class TtcWindowMetrics:
    """In-memory sliding window + optional JSONL persistence."""

    def __init__(
        self,
        window_size: int = 20,
        log_path: Optional[Path] = None,
        *,
        persist: bool = True,
        source: str = "gnostic-engine",
    ) -> None:
        self.window_size = window_size
        self.source = source
        self.log_path = log_path or default_log_path(source)
        self.persist = persist
        self._events: Dict[str, Deque[TtcWindowEvent]] = defaultdict(
            lambda: deque(maxlen=self.window_size)
        )

    def record(self, event: TtcWindowEvent) -> TtcWindowSnapshot:
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc).isoformat()
        if not event.source:
            event.source = self.source
        self._events[event.agent_id].append(event)
        if self.persist:
            try:
                self.log_path.parent.mkdir(parents=True, exist_ok=True)
                with self.log_path.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(event.to_dict(), ensure_ascii=False) + "\n")
            except OSError as exc:
                # Never break the gate because logging failed
                print(f"[TtcWindowMetrics] append failed {self.log_path}: {exc}")
        return self.snapshot(event.agent_id)

    def record_from_result(
        self,
        *,
        agent_id: str,
        action_id: str,
        is_refusal: bool,
        output_density: float,
        identity_fingerprint: str,
        result: TTCResult,
        target: Optional[str] = None,
        audit_id: Optional[str] = None,
    ) -> TtcWindowSnapshot:
        return self.record(
            TtcWindowEvent(
                agent_id=agent_id,
                action_id=action_id,
                is_refusal=is_refusal,
                output_density=output_density,
                identity_fingerprint=identity_fingerprint or "unknown",
                sovereignty_debt=result.sovereignty_debt,
                valid=result.valid,
                composite_score=result.composite_score,
                refusal_floor_applied=result.refusal_floor_applied,
                identity_stable=result.identity_stable,
                amnesty_remaining=result.amnesty_remaining,
                failed_rules=failed_hard_rule_ids(result),
                source=self.source,
                target=target,
                audit_id=audit_id,
            )
        )

    def snapshot(self, agent_id: str) -> TtcWindowSnapshot:
        ev = list(self._events.get(agent_id, ()))
        n = len(ev)
        if n == 0:
            return TtcWindowSnapshot(
                count=0,
                refusal_rate=0.0,
                mean_density=0.0,
                mean_debt=0.0,
                mean_composite=0.0,
                reject_rate=0.0,
                identity_changes=0,
                debt_forced_risk=False,
                exploration_pressure=False,
                last_failed_rules=[],
            )
        refusals = sum(1 for e in ev if e.is_refusal)
        rejects = sum(1 for e in ev if not e.valid)
        mean_debt = sum(e.sovereignty_debt for e in ev) / n
        mean_floor = sum(e.refusal_floor_applied for e in ev) / n
        fps = [e.identity_fingerprint for e in ev]
        changes = sum(1 for a, b in zip(fps, fps[1:]) if a != b)
        refusal_rate = refusals / n
        return TtcWindowSnapshot(
            count=n,
            refusal_rate=refusal_rate,
            mean_density=sum(e.output_density for e in ev) / n,
            mean_debt=mean_debt,
            mean_composite=sum(e.composite_score for e in ev) / n,
            reject_rate=rejects / n,
            identity_changes=changes,
            debt_forced_risk=mean_debt >= 4.0,
            exploration_pressure=mean_floor >= 0.2 and refusal_rate < mean_floor,
            last_failed_rules=list(ev[-1].failed_rules),
        )

    def load_jsonl(self, path: Optional[Path] = None) -> int:
        p = path or self.log_path
        if not p.is_file():
            return 0
        n = 0
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ev = TtcWindowEvent(
                    agent_id=str(raw.get("agent_id", "")),
                    action_id=str(raw.get("action_id", "")),
                    is_refusal=bool(raw.get("is_refusal", False)),
                    output_density=float(raw.get("output_density", 0.0)),
                    identity_fingerprint=str(raw.get("identity_fingerprint", "")),
                    sovereignty_debt=float(raw.get("sovereignty_debt", 0.0)),
                    valid=bool(raw.get("valid", True)),
                    composite_score=float(raw.get("composite_score", 0.0)),
                    refusal_floor_applied=float(raw.get("refusal_floor_applied", 0.0)),
                    identity_stable=bool(raw.get("identity_stable", False)),
                    amnesty_remaining=int(raw.get("amnesty_remaining", 0)),
                    failed_rules=list(raw.get("failed_rules") or []),
                    source=str(raw.get("source", self.source)),
                    timestamp=str(raw.get("timestamp", "")),
                    target=raw.get("target"),
                    audit_id=raw.get("audit_id"),
                )
                self._events[ev.agent_id].append(ev)
                n += 1
        return n

    def clear(self, agent_id: Optional[str] = None) -> None:
        if agent_id is None:
            self._events.clear()
        else:
            self._events.pop(agent_id, None)


_default_metrics: Optional[TtcWindowMetrics] = None


def get_window_metrics() -> TtcWindowMetrics:
    global _default_metrics
    if _default_metrics is None:
        _default_metrics = TtcWindowMetrics()
    return _default_metrics


def reset_window_metrics() -> None:
    global _default_metrics
    _default_metrics = None
