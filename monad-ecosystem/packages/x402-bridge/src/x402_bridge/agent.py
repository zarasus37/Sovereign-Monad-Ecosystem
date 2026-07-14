"""x402-bridge sovereign agent — the consumer that ties the bridge to a
constraint envelope (CHARTER §3).

Before this module the x402-bridge package was an *orphan*: no package outside
``x402-bridge`` imported it — only its own ``price_fetcher.py`` consumed it, so
no sovereign agent's constraint envelope was tied to the bridge
(``docs/LEGACY_COMPONENTS.md`` §6). ``X402Agent`` is that sovereign-agent
consumer. It wraps the bridge so that the three §6 deliverables compose into one
coherent sovereign-agent shape:

  - **Managed resource (§3 "hold and manage its own resources"):** the x402
    settlement wallet *address* (``X402_EVM_SETTLEMENT_ADDRESS``) — never the
    private key, which stays in the gitignored ``.env``.
  - **Cost-bearing flow (§3 "bear responsibility for operational costs via its
    own flows"):** every paid RPC call appends a ``LedgerEntry`` to the agent's
    ``DrawdownLedger``. Cost is self-accounted, not hidden.
  - **Constraint envelope (§3 "continue operating within its constraint
    envelope"):** the ``RetryEnvelope`` (bounded retry, concurrency, timeout)
    bounds every paid request.
  - **Control surfaces (§3 "explicit, narrow, justified"):** the env knobs —
    ``X402_AGENT_KILL_SWITCH`` (narrow: halts spend without a code change),
    ``X402_MAX_CONCURRENT``/``X402_MAX_RETRIES``/``X402_INITIAL_BACKOFF_MS``/
    ``X402_MAX_BACKOFF_MS``/``X402_TIMEOUT`` — are documented via
    ``control_surfaces()`` with default, scope, and justification.

Honesty posture
----------------
- **This is the real consumer.** ``X402Agent.fetch`` is the importable
  sovereign-agent surface that consumes ``quicknode.fetch``; the bridge stops
  being an orphan. The interface (``fetch``/``managed_resource``/
  ``constraint_envelope``/``control_surfaces``) is designed to migrate into
  ``organ-runtime`` when that package graduates (today a stub).
- **No fake autonomy.** The agent is *self-contained* but not claimed to be
  fully autonomous: it depends on Node.js + the ``@quicknode/x402`` SDK for the
  working auth flow (``_refresh_jwt``), which is an explicit constraint-envelope
  dependency documented here. CHARTER §3's "continue operating if the creator
  is inactive" is satisfied to the extent the wallet is funded and the SDK is
  installed — both are documented preconditions, not hand-waved.
- **Kill switch is narrow.** ``X402_AGENT_KILL_SWITCH`` only halts *spend*
  (paid RPC); it does not disable read-only config inspection.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from x402_bridge.envelope import RetryEnvelope, X402_USER_AGENT
from x402_bridge.ledger import DrawdownLedger, LedgerEntry


# ---------------------------------------------------------------------------
# Control-surface manifest — the CHARTER §3 "explicit/narrow/justified" artifact
# ---------------------------------------------------------------------------

#: Each entry: env var, default, scope, justification. Surfaced via
#: ``X402Agent.control_surfaces()`` so the control surface is self-documenting.
_CONTROL_SURFACES: List[Dict[str, str]] = [
    {
        "env": "X402_AGENT_KILL_SWITCH",
        "default": "false (unset)",
        "scope": "halts all paid RPC spend when truthy",
        "justification": "safety: pause spend without a code change or redeploy",
    },
    {
        "env": "X402_MAX_CONCURRENT",
        "default": "20",
        "scope": "max in-flight x402 RPC requests (httpx connection cap)",
        "justification": "bounds spend rate and connection blast radius",
    },
    {
        "env": "X402_MAX_RETRIES",
        "default": "3",
        "scope": "retry attempts on transient (429/503/timeout) failures",
        "justification": "bounds amplification of a single paid call into many",
    },
    {
        "env": "X402_INITIAL_BACKOFF_MS",
        "default": "100",
        "scope": "first retry backoff (doubles each attempt)",
        "justification": "gives the transient failure room to clear",
    },
    {
        "env": "X402_MAX_BACKOFF_MS",
        "default": "5000",
        "scope": "backoff cap",
        "justification": "prevents unbounded stall on a flaky endpoint",
    },
    {
        "env": "X402_TIMEOUT",
        "default": "30.0",
        "scope": "per-request timeout in seconds",
        "justification": "bounds how long a single paid call can hang",
    },
    {
        "env": "X402_AGENT_ID",
        "default": "x402-bridge-agent",
        "scope": "identity stamped on every ledger entry",
        "justification": "cost attribution to a specific sovereign agent",
    },
    {
        "env": "X402_EVM_SETTLEMENT_ADDRESS",
        "default": "(unset)",
        "scope": "the wallet ADDRESS the agent manages (never the private key)",
        "justification": "on-chain identity of the managed resource",
    },
    {
        "env": "X402_LEDGER_PATH",
        "default": ".x402_ledger.jsonl",
        "scope": "append-only JSONL cost ledger location (gitignored)",
        "justification": "durable, auditable per-call cost accounting",
    },
]


# ---------------------------------------------------------------------------
# X402AgentConfig
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class X402AgentConfig:
    """Configuration for an ``X402Agent`` — built from env via ``from_env``.

    The settlement **address** is the managed resource; the private key is
    deliberately NOT a field here (it stays in the gitignored ``.env`` and is
    read only by ``quicknode`` at the signing boundary).
    """

    agent_id: str
    settlement_address: str
    envelope: RetryEnvelope
    ledger_path: str
    kill_switch: bool

    @classmethod
    def from_env(cls, envelope: Optional[RetryEnvelope] = None) -> "X402AgentConfig":
        return cls(
            agent_id=os.getenv("X402_AGENT_ID", "x402-bridge-agent"),
            settlement_address=os.getenv("X402_EVM_SETTLEMENT_ADDRESS", ""),
            envelope=envelope or RetryEnvelope.from_env(),
            ledger_path=os.getenv("X402_LEDGER_PATH", ".x402_ledger.jsonl"),
            kill_switch=os.getenv("X402_AGENT_KILL_SWITCH", "").lower()
            in ("1", "true", "yes"),
        )


# ---------------------------------------------------------------------------
# X402Agent — the sovereign-agent consumer
# ---------------------------------------------------------------------------

class X402Agent:
    """Sovereign-agent wrapper around the x402 bridge.

    This is the importable consumer that ties the bridge to a constraint
    envelope (closing the LEGACY_COMPONENTS §6 orphan gap). A future organ
    runtime (``@sovereign/organ-runtime``, today a stub) can instantiate or
    migrate this surface; the interface is deliberately organ-shaped.
    """

    def __init__(self, config: X402AgentConfig) -> None:
        self.config = config
        self.envelope: RetryEnvelope = config.envelope
        self.ledger: DrawdownLedger = DrawdownLedger(config.ledger_path)

    # -- managed resource --------------------------------------------------

    def managed_resource(self) -> Dict[str, Any]:
        """Return the on-chain identity of the managed resource (address only)."""
        return {
            "settlement_address": self.config.settlement_address,
            "configured": bool(self.config.settlement_address),
        }

    # -- constraint envelope ------------------------------------------------

    def constraint_envelope(self) -> RetryEnvelope:
        """Return the documented operational envelope bounding every paid call."""
        return self.envelope

    # -- control surfaces (CHARTER §3 explicit/narrow/justified) -----------

    @staticmethod
    def control_surfaces() -> List[Dict[str, str]]:
        """Return the env-knob manifest: name, default, scope, justification."""
        return [dict(cs) for cs in _CONTROL_SURFACES]

    # -- the paid-RPC capability (the consumer surface) --------------------

    async def fetch(self, jsonrpc_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make a paid x402 JSON-RPC request as this sovereign agent.

        Respects the kill switch (halts spend), operates within the constraint
        envelope, and records one cost-ledger entry per call.
        """
        if self.config.kill_switch:
            # Narrow: halts spend only. Records the refused call for auditability.
            from x402_bridge.quicknode import _record_ledger, _now_iso
            entry = LedgerEntry(
                timestamp=_now_iso(),
                agent_id=self.config.agent_id,
                endpoint=os.getenv("X402_TARGET_NETWORK", "monad-mainnet"),
                payment_model="kill_switch",
                attempts=0,
                status="kill_switch",
                dlq_reason="agent-kill-switch-engaged",
            )
            self.ledger.append(entry)
            return None

        # Local import to avoid a circular import at module load (quicknode
        # imports envelope/ledger; agent imports quicknode lazily here).
        from x402_bridge.quicknode import fetch as _x402_fetch
        return await _x402_fetch(
            jsonrpc_payload,
            envelope=self.envelope,
            ledger=self.ledger,
            agent_id=self.config.agent_id,
        )

    async def fetch_mid_price(self, token_pair: str) -> Optional[Dict[str, Any]]:
        """Fetch a Pyth mid-price as this agent.

        Delegates to ``price_fetcher.fetch_mid_price`` (the bridge's x402-first,
        provider-pool-fallback path), which runs the x402 leg through the
        remediated envelope + ledger at the module level. The kill switch still
        applies: if engaged, returns None without spending.
        """
        if self.config.kill_switch:
            return None
        from x402_bridge.price_fetcher import fetch_mid_price as _pf_fetch_mid_price
        return await _pf_fetch_mid_price(token_pair)


__all__ = ["X402Agent", "X402AgentConfig", "X402_USER_AGENT"]