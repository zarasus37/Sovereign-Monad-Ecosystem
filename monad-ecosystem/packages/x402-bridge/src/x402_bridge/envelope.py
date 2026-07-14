"""x402-bridge failure/retry envelope — the sovereign agent's constraint envelope.

This module defines the documented, env-bounded operational envelope every x402
RPC call must operate within. It mirrors the bounded-exponential-backoff pattern
established for the TypeScript sovereign-bus KafkaBridge
(``monad-ecosystem/packages/sovereign-bus/src/kafka-bridge.ts``:
``KafkaBridgeConfig`` + ``forwardWithRetries``): per-send retry attempts, initial
backoff that doubles each attempt, a max backoff cap, and a dead-letter outcome on
exhaustion.

Honesty posture
----------------
- **Real envelope, no fake guarantees.** ``request_with_retry`` retries on the
  transient failures the x402 path is actually susceptible to — HTTP 429, 503,
  ``httpx.TimeoutException`` and connect errors — and *does not* retry on the
  non-transient ones (401/402/403 are handed to the caller's auth hook; other
  4xx/5xx are terminal). On exhaustion it returns ``None`` with the attempt count
  so the caller can record a dead-letter entry in the cost ledger.
- **No wall-clock in the pure path.** ``RetryEnvelope`` is a frozen dataclass;
  env reads happen only in ``RetryEnvelope.from_env()``. The envelope itself is
  deterministic given its inputs.
- **``User-Agent`` is set on the RPC path.** ``envelope_headers()`` is the single
  source of truth for x402 RPC headers and always injects ``X402_USER_AGENT``.
  This closes the LEGACY_COMPONENTS §6 gap: the bridge's own Cloudflare-1010
  guidance required a UA, but ``quicknode.py`` never sent one on the RPC path.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: User-Agent sent on every x402 RPC request. Mirrors the value already used by
#: ``live_smoke.py``'s preflight balance checks (``live_smoke.py:162,194``) so the
#: bridge speaks with one identity end-to-end.
X402_USER_AGENT = "x402-bridge/1.0"

#: HTTP statuses that mean "transient — retry with backoff."
_RETRYABLE_STATUSES = frozenset({429, 503})

#: HTTP statuses that mean "auth/identity — hand to the caller's auth hook."
_AUTH_STATUSES = frozenset({401, 402, 403})


# ---------------------------------------------------------------------------
# RetryEnvelope — the constraint envelope (frozen, env-loaded via from_env)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RetryEnvelope:
    """Documented, env-bounded operational envelope for x402 RPC calls.

    This is the *constraint envelope* of the sovereign agent (CHARTER §3): every
    paid request operates within these bounds. The env knobs are the agent's
    *control surfaces* — explicit, narrow, and justified by safety (they bound
    spend rate and blast radius), not convenience.
    """

    #: Per-request retry attempts (transient failures only). Default 3,
    #: env ``X402_MAX_RETRIES``. Mirrors sovereign-bus ``KAFKA_MAX_RETRIES``.
    max_retries: int = 3
    #: Initial backoff in milliseconds; doubles each attempt. Default 100,
    #: env ``X402_INITIAL_BACKOFF_MS``. Mirrors ``KAFKA_INITIAL_BACKOFF_MS``.
    initial_backoff_ms: int = 100
    #: Maximum backoff in milliseconds. Default 5000, env ``X402_MAX_BACKOFF_MS``.
    #: Mirrors ``KAFKA_MAX_BACKOFF_MS``.
    max_backoff_ms: int = 5000
    #: Per-request timeout in seconds. Default 30.0, env ``X402_TIMEOUT``.
    timeout_s: float = 30.0
    #: Maximum concurrent in-flight requests (drives httpx ``Limits``). Default 20,
    #: env ``X402_MAX_CONCURRENT``. Replaces the previously hard-coded httpx 20/40.
    max_concurrent: int = 20
    #: User-Agent header value. Constant ``X402_USER_AGENT``.
    user_agent: str = X402_USER_AGENT

    @classmethod
    def from_env(cls) -> "RetryEnvelope":
        """Build an envelope from the ``X402_*`` env knobs (with defaults)."""
        return cls(
            max_retries=int(os.getenv("X402_MAX_RETRIES", "3")),
            initial_backoff_ms=int(os.getenv("X402_INITIAL_BACKOFF_MS", "100")),
            max_backoff_ms=int(os.getenv("X402_MAX_BACKOFF_MS", "5000")),
            timeout_s=float(os.getenv("X402_TIMEOUT", "30.0")),
            max_concurrent=int(os.getenv("X402_MAX_CONCURRENT", "20")),
            user_agent=X402_USER_AGENT,
        )

    def backoff_ms(self, attempt: int) -> int:
        """Exponential backoff for ``attempt`` (0-indexed), capped at max."""
        return min(self.initial_backoff_ms * (2 ** attempt), self.max_backoff_ms)


# ---------------------------------------------------------------------------
# Header builder — the single source of truth for RPC headers (UA fix)
# ---------------------------------------------------------------------------

def envelope_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Build the x402 RPC header set, always including the ``User-Agent``.

    ``extra`` overrides/extends (e.g. ``{"Authorization": "Bearer ..."}``).
    ``Content-Type`` defaults to ``application/json``; an explicit entry in
    ``extra`` wins.
    """
    headers: Dict[str, str] = {
        "User-Agent": X402_USER_AGENT,
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


# ---------------------------------------------------------------------------
# request_with_retry — the bounded retry loop (mirrors forwardWithRetries)
# ---------------------------------------------------------------------------

#: Auth-hook signature: called on 401/402/403. Returns True to retry the request
#: (e.g. after a JWT refresh), False to give up. ``attempt`` is 0-indexed.
AuthHook = Callable[[Any, int], Awaitable[bool]]

#: Terminal-failure reasons returned by ``request_with_retry``. ``None`` means
#: success. Used by the cost ledger to record the right ``status``/``dlq_reason``.
REASON_EXHAUSTED = "exhausted"
REASON_AUTH_FAILED = "auth_failed"
REASON_TERMINAL_HTTP = "terminal_http"
REASON_ERROR = "error"


async def request_with_retry(
    client: Any,
    url: str,
    *,
    headers: Dict[str, str],
    json_payload: Dict[str, Any],
    envelope: RetryEnvelope,
    on_auth_status: Optional[AuthHook] = None,
) -> Tuple[Optional[Any], int, Optional[str]]:
    """POST ``json_payload`` to ``url`` with bounded exponential retry.

    Returns ``(response, attempts, reason)``:
      - success → ``(resp, attempts, None)``
      - transient exhaustion → ``(None, attempts, "exhausted")``
      - auth not recoverable → ``(None, attempts, "auth_failed")``
      - terminal HTTP status → ``(None, attempts, "terminal_http")``
      - non-transient exception → ``(None, attempts, "error")``

    ``attempts`` is the 1-indexed number of requests actually issued (for
    ledger accounting).

    Retry policy:
      - 429 / 503 / ``httpx.TimeoutException`` / connect error → backoff + retry.
      - 401 / 402 / 403 → call ``on_auth_status(resp, attempt)``; retry if it
        returns True (no backoff — auth refresh is not a backoff), give up if
        False. If no hook is supplied, auth statuses are terminal.
      - 2xx → return the response.
      - other 4xx / 5xx → terminal (return ``terminal_http``); not retried.
    """
    httpx = _get_httpx()
    attempts = 0
    last_was_transient = False

    for attempt in range(envelope.max_retries + 1):
        attempts += 1
        try:
            resp = await client.post(url, headers=headers, json=json_payload)
        except httpx.TimeoutException:
            logger.warning(
                "x402 request timed out (attempt %d/%d).", attempt + 1,
                envelope.max_retries + 1,
            )
            last_was_transient = True
        except httpx.TransportError as e:
            logger.warning(
                "x402 transport error (attempt %d/%d): %s", attempt + 1,
                envelope.max_retries + 1, e,
            )
            last_was_transient = True
        except Exception as e:  # noqa: BLE001 — terminal, logged once
            logger.warning("x402 request error (attempt %d/%d): %s",
                           attempt + 1, envelope.max_retries + 1, e)
            return None, attempts, REASON_ERROR
        else:
            status = resp.status_code
            if 200 <= status < 300:
                return resp, attempts, None
            if status in _AUTH_STATUSES:
                if on_auth_status is not None:
                    refreshed = await on_auth_status(resp, attempt)
                    if refreshed:
                        last_was_transient = False
                        continue
                logger.warning("x402 auth/status %d not recoverable (attempt %d/%d).",
                               status, attempt + 1, envelope.max_retries + 1)
                return None, attempts, REASON_AUTH_FAILED
            if status in _RETRYABLE_STATUSES:
                logger.warning(
                    "x402 transient HTTP %d (attempt %d/%d) — retrying.",
                    status, attempt + 1, envelope.max_retries + 1,
                )
                last_was_transient = True
            else:
                logger.warning(
                    "x402 terminal HTTP %d (attempt %d/%d) — not retried.",
                    status, attempt + 1, envelope.max_retries + 1,
                )
                return None, attempts, REASON_TERMINAL_HTTP

        # transient path: backoff then continue (unless this was the last attempt)
        if attempt < envelope.max_retries:
            delay = envelope.backoff_ms(attempt) / 1000.0
            await asyncio.sleep(delay)

    if last_was_transient:
        logger.warning(
            "x402 retries exhausted after %d attempt(s) — recording dead-letter.",
            attempts,
        )
        return None, attempts, REASON_EXHAUSTED
    return None, attempts, REASON_ERROR


# ---------------------------------------------------------------------------
# Lazy httpx (mirror quicknode._get_httpx so this module loads without httpx)
# ---------------------------------------------------------------------------

_httpx: Optional[Any] = None


def _get_httpx():
    global _httpx
    if _httpx is None:
        import httpx
        _httpx = httpx
    return _httpx