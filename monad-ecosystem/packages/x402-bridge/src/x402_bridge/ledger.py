"""x402-bridge drawdown ledger — the sovereign agent's cost-bearing flow.

This module closes the LEGACY_COMPONENTS §6 cost-accounting gap. Before this
module the only credit capture in the package was a single best-effort
``X-Credits-Remaining`` header read in the Node helper (``auth_sdk.cjs:101``),
surfaced once to stdout and discarded. This module is a real, append-only,
per-call cost metering ledger: one ``LedgerEntry`` per paid RPC call, persisted
as JSONL.

Honesty posture
----------------
- **Real ledger, real I/O.** ``DrawdownLedger.append`` writes one JSON line per
  paid call to ``X402_LEDGER_PATH`` (default ``.x402_ledger.jsonl`` next to the
  gitignored ``.env``) and flushes immediately. No in-memory-only stub.
- **Deterministic identity.** ``LedgerEntry.id`` is a deterministic uuid5 of
  ``timestamp + endpoint + attempts`` — no ``random()``, no wall-clock inside the
  id derivation. The ``timestamp`` field itself is a *parameter* (the live call
  site stamps it); the dataclass never calls ``datetime.now()``.
- **Emission contract, not fake transport.** ``LedgerEntry.to_signal_event()``
  builds a dict shaped to mirror the ``@sovereign/types`` ``SignalEvent`` envelope
  (``signal.ts:115``) and the ``RevenueEvent`` outflow shape (``revenue.ts:44``).
  Actual sovereign-bus *transport* is deferred — there is no Python→Kafka bus
  client today, and faking one would be a fake stub. The contract is here so a
  future Python bus client can publish these without a schema change to this
  module. No ``@sovereign/types`` TypeScript change is made in this PR for a
  non-transporting emission.
- **Provenance wired.** The optional ``trace`` block mirrors ``EventTrace``
  (``signal.ts:89-107``) — ``intentionId``/``constraintEnvelopeId``/
  ``narrativePurposeId`` — so the ledger is ready for CHARTER §4 intention
  auditability when the bus transport lands.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Deterministic uuid5 namespace for LedgerEntry ids (fixed, so ids are stable
#: across processes for the same (timestamp, endpoint, attempts) tuple).
_X402_LEDGER_NS = uuid.uuid5(uuid.NAMESPACE_URL, "sovereign.x402-bridge.ledger")

#: Default ledger path (relative to CWD at append time). The file is gitignored
#: (see repo root ``.gitignore`` — ``.x402_ledger.jsonl``).
DEFAULT_LEDGER_PATH = os.getenv(
    "X402_LEDGER_PATH", ".x402_ledger.jsonl"
)


# ---------------------------------------------------------------------------
# EventTrace mirror — provenance block for future bus emission
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LedgerTrace:
    """Provenance block mirroring ``@sovereign/types`` ``EventTrace``.

    All fields optional — wired for the future sovereign-bus emission, not
    required for the local ledger to function.
    """

    intention_id: Optional[str] = None
    source: Optional[str] = None
    parent_event_id: Optional[str] = None
    constraint_envelope_id: Optional[str] = None
    narrative_purpose_id: Optional[str] = None


# ---------------------------------------------------------------------------
# LedgerEntry — one per paid x402 RPC call
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LedgerEntry:
    """A single per-call cost metering record.

    Fields mirror the outflow side of ``@sovereign/types`` ``RevenueEvent``
    (``revenue.ts:44``) — that type models inflow/distribution; this is the
    operational-cost (outflow / credit drawdown) counterpart.
    """

    #: ISO8601 timestamp — **passed in** by the caller, never derived here.
    timestamp: str
    #: The sovereign agent that incurred the cost (env ``X402_AGENT_ID``).
    agent_id: str
    #: x402 target network, e.g. ``monad-mainnet``.
    endpoint: str
    #: ``credit-drawdown`` | ``pay-per-request``.
    payment_model: str
    #: Number of HTTP attempts actually issued (1-indexed; from the envelope).
    attempts: int
    #: ``paid`` | ``exhausted`` | ``auth_failed`` | ``timeout`` | ``kill_switch``.
    status: str
    #: Credit balance before this call, if the server returned it.
    credits_before: Optional[int] = None
    #: Credit balance after this call, if the server returned it.
    credits_after: Optional[int] = None
    #: USDC notional cost of the call (``max_amount_required / 1e6``), if known.
    usd_notional: Optional[Decimal] = None
    #: Pay-per-request on-chain settlement tx hash, if applicable.
    tx_hash: Optional[str] = None
    #: Pay-per-request settlement block number, if applicable.
    block_number: Optional[int] = None
    #: Dead-letter reason (``max-retries-exhausted`` on envelope exhaustion).
    dlq_reason: Optional[str] = None
    #: Provenance block mirroring ``EventTrace`` (optional, for future bus).
    trace: Optional[LedgerTrace] = None

    def __post_init__(self) -> None:
        # Deterministic id derived from the stable tuple. Stays out of the
        # dataclass field list so asdict() doesn't double-emit it. Set as a
        # plain instance attribute (NOT a property — a read-only property would
        # make object.__setattr__ raise AttributeError via the descriptor). The
        # frozen dataclass already enforces read-only-ness after construction.
        object.__setattr__(self, "id", self._derive_id())

    def _derive_id(self) -> str:
        key = f"{self.timestamp}|{self.endpoint}|{self.attempts}|{self.payment_model}"
        return str(uuid.uuid5(_X402_LEDGER_NS, key))

    @property
    def credits_spent(self) -> Optional[int]:
        """Net credits consumed by this call, if both balances are known."""
        if self.credits_before is not None and self.credits_after is not None:
            return self.credits_before - self.credits_after
        return None

    def as_dict(self) -> Dict[str, Any]:
        """Plain dict for JSONL persistence + bus payload."""
        d: Dict[str, Any] = {
            "id": self.id,
            "timestamp": self.timestamp,
            "agent_id": self.agent_id,
            "endpoint": self.endpoint,
            "payment_model": self.payment_model,
            "attempts": self.attempts,
            "status": self.status,
            "credits_before": self.credits_before,
            "credits_after": self.credits_after,
            "credits_spent": self.credits_spent,
            "usd_notional": (
                str(self.usd_notional) if self.usd_notional is not None else None
            ),
            "tx_hash": self.tx_hash,
            "block_number": self.block_number,
            "dlq_reason": self.dlq_reason,
        }
        if self.trace is not None:
            d["trace"] = asdict(self.trace)
        return d

    def to_signal_event(self) -> Dict[str, Any]:
        """Build a dict shaped to mirror ``@sovereign/types`` ``SignalEvent``.

        This is the **emission contract only** — it does not publish to the
        sovereign-bus. ``layer="system"`` and ``type="cost.drawdown"`` are the
        intended (but not yet TypeScript-declared) values; the dict is the
        hand-off shape a future Python bus client will forward unchanged.
        """
        return {
            "id": self.id,
            "correlationId": None,
            "timestamp": self.timestamp,
            "layer": "system",
            "source": self.agent_id,
            "type": "cost.drawdown",
            "payload": self.as_dict(),
            "hash": None,
            "severity": "info" if self.status == "paid" else "warning",
            "trace": asdict(self.trace) if self.trace is not None else None,
        }


# ---------------------------------------------------------------------------
# DrawdownLedger — append-only JSONL store
# ---------------------------------------------------------------------------

class DrawdownLedger:
    """Append-only JSONL cost ledger.

    The ledger file is created on first ``append`` if it does not exist. Each
    entry is written as one JSON line and flushed immediately so a crash mid-run
    never loses already-incurred cost records.
    """

    def __init__(self, path: str = DEFAULT_LEDGER_PATH) -> None:
        self.path = Path(path)

    def append(self, entry: LedgerEntry) -> str:
        """Append one entry; return the entry id."""
        line = json.dumps(entry.as_dict(), default=_json_default)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
            fh.flush()
        return entry.id

    def read_all(self) -> List[Dict[str, Any]]:
        """Read every ledger entry as a list of dicts (empty if no file)."""
        if not self.path.exists():
            return []
        out: List[Dict[str, Any]] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
        return out

    def sum_credits_spent(self) -> int:
        """Sum the ``credits_spent`` across all entries that report it."""
        total = 0
        for row in self.read_all():
            spent = row.get("credits_spent")
            if isinstance(spent, int):
                total += spent
        return total

    def tail(self, n: int = 10) -> List[Dict[str, Any]]:
        """Return the last ``n`` ledger entries (most-recent last)."""
        rows = self.read_all()
        return rows[-n:]


def _json_default(obj: Any) -> Any:
    """json.dumps default for non-standard types (Decimal, dataclass)."""
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, LedgerTrace):
        return asdict(obj)
    raise TypeError(f"not JSON serializable: {type(obj).__name__}")


__all__ = [
    "DEFAULT_LEDGER_PATH",
    "LedgerEntry",
    "LedgerTrace",
    "DrawdownLedger",
]