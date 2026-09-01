"""API-key authentication and rate limiting for the Gnostic Engine HTTP surface.

Design notes, because the ordering here is load-bearing:

1. **Rate limiting runs BEFORE key validation.** A limiter mounted after
   authentication does nothing against brute force: every wrong key dies at 401
   without ever touching the limiter, so an attacker gets unlimited free
   attempts. This is not hypothetical -- the sovereign-host package shipped
   exactly that bug, and 150 bad-token requests produced 150x 401 and zero 429.
   Unauthenticated requests are therefore bucketed by client address, and
   authenticated ones by key, so a wrong key still costs the caller quota.

2. **Absence of configuration is denial, never a fallback.** If no keys are
   configured the service refuses every request with 503 rather than running
   open. The only exception is ``GNOSTIC_ENV=test``, which mirrors the
   ``NODE_ENV=test`` escape hatch the TypeScript packages already use.

3. **Keys are compared with ``hmac.compare_digest``**, not ``==``, so
   comparison time does not leak a prefix.

4. **Keys are never logged or echoed.** Errors carry no key material, and the
   caller identity attached to the request is a short digest, not the secret.

Configuration
-------------
``GNOSTIC_API_KEYS``
    Comma-separated list of accepted keys. Required outside test mode.
``GNOSTIC_RATE_LIMIT_PER_MIN``
    Requests per minute per caller. Default 120.
``GNOSTIC_ENV``
    ``test`` disables the requirement for configured keys.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status
from fastapi.security import APIKeyHeader

API_KEY_HEADER_NAME = "X-API-Key"

# auto_error=False so a missing header reaches our handler and is rate limited,
# rather than being short-circuited by FastAPI into an unmetered 403.
api_key_scheme = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)

#: Paths that never require a key.
#:
#: ``/`` and ``/api/v1/health`` are liveness surfaces: an orchestrator must be
#: able to probe them without holding a credential. Both return only status and
#: version, no engine state.
#:
#: The OpenAPI/doc routes stay public deliberately. They describe the shape of
#: the API, which is what an integrator needs before they have a key, and they
#: expose no data. Move them behind the guard if the surface itself is meant to
#: be private.
PUBLIC_PATHS = frozenset(
    {
        "/",
        "/api/v1/health",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
        "/openapi.json",
    }
)

DEFAULT_RATE_LIMIT_PER_MIN = 120
_WINDOW_SECONDS = 60.0


def _configured_keys() -> frozenset[str]:
    raw = os.environ.get("GNOSTIC_API_KEYS", "")
    return frozenset(k.strip() for k in raw.split(",") if k.strip())


def _test_mode() -> bool:
    return os.environ.get("GNOSTIC_ENV", "").strip().lower() == "test"


def _rate_limit_per_min() -> int:
    raw = os.environ.get("GNOSTIC_RATE_LIMIT_PER_MIN", "").strip()
    if not raw:
        return DEFAULT_RATE_LIMIT_PER_MIN
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_RATE_LIMIT_PER_MIN
    return value if value > 0 else DEFAULT_RATE_LIMIT_PER_MIN


def key_fingerprint(key: str) -> str:
    """Short, stable, non-reversible identifier for a key.

    Used for the caller identity on the request and for rate-limit bucketing so
    the secret itself never appears in a bucket name, a log line or a trace.
    """
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]


class SlidingWindowLimiter:
    """Fixed-capacity sliding window, one deque of timestamps per caller.

    In-process and therefore per-container. That is the honest scope: it
    throttles abuse against a single instance. Running several replicas behind a
    load balancer needs a shared store, which is a deliberate non-goal here --
    adding Redis to ship auth would be the wrong trade.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, bucket: str, limit: int, now: float | None = None) -> tuple[bool, int]:
        """Record a hit. Returns ``(allowed, retry_after_seconds)``."""
        now = time.monotonic() if now is None else now
        cutoff = now - _WINDOW_SECONDS
        with self._lock:
            hits = self._hits[bucket]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = max(1, int(hits[0] + _WINDOW_SECONDS - now) + 1)
                return False, retry_after
            hits.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def _client_bucket(request: Request) -> str:
    client = request.client
    return f"ip:{client.host}" if client and client.host else "ip:unknown"


async def guard(request: Request) -> str:
    """Rate limit, then authenticate. Returns the caller's key fingerprint.

    Order is deliberate: see the module docstring.
    """
    path = request.url.path
    if path in PUBLIC_PATHS:
        return "public"

    keys = _configured_keys()
    if not keys:
        if _test_mode():
            return "test"
        # Fail closed. A service with no configured credential must not serve.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "AUTH_NOT_CONFIGURED",
                "message": (
                    "GNOSTIC_API_KEYS is not set. The engine refuses to serve "
                    "authenticated routes without a configured key."
                ),
            },
        )

    presented = request.headers.get(API_KEY_HEADER_NAME)

    # Validate before bucketing, but do not act on the result yet. compare_digest
    # against every configured key with no early exit, so the number of
    # comparisons does not depend on which key was presented.
    valid = False
    if presented:
        for candidate in keys:
            if hmac.compare_digest(presented, candidate):
                valid = True

    # --- rate limit, still ahead of the 401 ---------------------------------
    #
    # Buckets: a *recognised* caller gets their own quota, keyed by fingerprint,
    # so one noisy tenant cannot throttle another. Everything unrecognised --
    # missing key, wrong key, or a key rotated on every request -- collapses into
    # one bucket per client address.
    #
    # That collapse is the entire point. Bucketing unrecognised requests by the
    # presented value would hand an attacker a fresh quota for every guess,
    # which is how the first draft of this function was written and what
    # test_rate_limit_applies_to_rejected_keys caught: 8 rotating bad keys
    # produced 8x 401 and zero 429.
    bucket = f"key:{key_fingerprint(presented)}" if valid else _client_bucket(request)
    allowed, retry_after = limiter.check(bucket, _rate_limit_per_min())
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "RATE_LIMITED", "retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )

    if not presented:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "UNAUTHENTICATED", "message": f"Missing {API_KEY_HEADER_NAME} header."},
            headers={"WWW-Authenticate": API_KEY_HEADER_NAME},
        )

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "UNAUTHENTICATED", "message": "Invalid API key."},
            headers={"WWW-Authenticate": API_KEY_HEADER_NAME},
        )

    fingerprint = key_fingerprint(presented)
    request.state.caller = fingerprint
    return fingerprint
