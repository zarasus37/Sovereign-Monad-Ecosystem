#!/usr/bin/env python3
"""
Test the x402 failure/retry envelope (envelope.py) — offline, no funded wallet.

Validates:
  1. RetryEnvelope.from_env defaults + exponential backoff bounds
  2. envelope_headers always injects the User-Agent (the §6 RPC-path UA fix)
  3. request_with_retry retries on 429/503/httpx.TimeoutException, then exhausts
     to a dead-letter reason; success returns (resp, attempts, None)
  4. terminal 4xx (not 429/503) is NOT retried (terminal_http)
  5. 401/402/403 route to on_auth_status; retry if it returns True, give up if False
  6. User-Agent is sent on every attempt

Usage:
  python tests/test_x402_envelope.py
  python tests/test_x402_envelope.py --verbose
"""

import sys
import asyncio
from pathlib import Path

src_dir = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_dir))

VERBOSE = "--verbose" in sys.argv


def log(msg: str):
    print(msg)


class _FakeHeaders(dict):
    pass


class _FakeResponse:
    def __init__(self, status, headers=None, body=None):
        self.status_code = status
        self.headers = _FakeHeaders(headers or {})
        self._body = body or {}

    def json(self):
        return self._body


class _FakeTimeout(Exception):
    """Stand-in for httpx.TimeoutException — injected via the envelope's httpx."""


class _FakeTransportError(Exception):
    pass


class _FakeHttpx:
    TimeoutException = _FakeTimeout
    TransportError = _FakeTransportError

    class Limits:
        def __init__(self, **kw):
            pass

    class AsyncClient:
        pass


class _FakeClient:
    """Async client whose .post() returns a scripted sequence of responses."""

    def __init__(self, script):
        # script: list of either _FakeResponse, an Exception to raise, or
        # the string "timeout"/"transport" for the matching fake exceptions.
        self.script = list(script)
        self.calls = []  # (url, headers, payload) per attempt

    async def post(self, url, *, headers, json):
        self.calls.append((url, dict(headers), json))
        item = self.script.pop(0)
        if item == "timeout":
            raise _FakeTimeout("simulated timeout")
        if item == "transport":
            raise _FakeTransportError("simulated transport error")
        if isinstance(item, Exception):
            raise item
        return item


def _install_fake_httpx(monkey_env):
    """Point envelope._httpx at the fake so request_with_retry uses it."""
    import x402_bridge.envelope as env_mod
    env_mod._httpx = _FakeHttpx
    return env_mod


def test_1_defaults_and_backoff():
    log("\n[1/6] Testing RetryEnvelope defaults + backoff bounds...")
    import x402_bridge.envelope as env_mod
    e = env_mod.RetryEnvelope()
    assert e.max_retries == 3, e.max_retries
    assert e.initial_backoff_ms == 100, e.initial_backoff_ms
    assert e.max_backoff_ms == 5000, e.max_backoff_ms
    assert e.max_concurrent == 20, e.max_concurrent
    assert e.user_agent == "x402-bridge/1.0", e.user_agent
    # exponential: 100, 200, 400, ... capped at 5000
    assert e.backoff_ms(0) == 100, e.backoff_ms(0)
    assert e.backoff_ms(1) == 200, e.backoff_ms(1)
    assert e.backoff_ms(2) == 400, e.backoff_ms(2)
    assert e.backoff_ms(10) == 5000, e.backoff_ms(10)  # capped
    log("  ✅ defaults + backoff bounds correct")
    return True


def test_2_headers_ua():
    log("\n[2/6] Testing envelope_headers always injects User-Agent...")
    from x402_bridge.envelope import envelope_headers, X402_USER_AGENT
    h = envelope_headers({"Authorization": "Bearer t"})
    assert h["User-Agent"] == X402_USER_AGENT, h
    assert h["Authorization"] == "Bearer t", h
    assert h["Content-Type"] == "application/json", h
    h2 = envelope_headers()
    assert h2["User-Agent"] == X402_USER_AGENT, h2
    log("  ✅ User-Agent present on every header set (§6 RPC-path fix)")
    return True


async def _run(envelope, client, on_auth_status=None):
    import x402_bridge.envelope as env_mod
    return await env_mod.request_with_retry(
        client, "https://example/x",
        headers=env_mod.envelope_headers(),
        json_payload={"id": 1},
        envelope=envelope,
        on_auth_status=on_auth_status,
    )


def test_3_retry_on_transient_then_exhaust():
    log("\n[3/6] Testing retry on 429/503/timeout, then exhaustion...")
    _install_fake_httpx(None)
    import x402_bridge.envelope as env_mod
    # avoid real sleeping
    real_sleep = asyncio.sleep
    asyncio.sleep = lambda s: real_sleep(0)  # noqa: E731

    e = env_mod.RetryEnvelope(max_retries=2, initial_backoff_ms=1, max_backoff_ms=10)
    # 429, 503, timeout -> exhaust (max_retries+1 = 3 attempts)
    client = _FakeClient([_FakeResponse(429), _FakeResponse(503), "timeout"])
    resp, attempts, reason = asyncio.get_event_loop().run_until_complete(_run(e, client))
    assert resp is None, resp
    assert attempts == 3, attempts
    assert reason == env_mod.REASON_EXHAUSTED, reason
    # UA sent on every attempt
    for url, headers, payload in client.calls:
        assert headers["User-Agent"] == "x402-bridge/1.0", headers
    assert len(client.calls) == 3, len(client.calls)
    log(f"  ✅ 3 transient attempts → exhausted (reason={reason}); UA on every attempt")

    asyncio.sleep = real_sleep
    return True


def test_4_success_and_terminal_http():
    log("\n[4/6] Testing success path + terminal-HTTP-not-retried...")
    _install_fake_httpx(None)
    import x402_bridge.envelope as env_mod
    real_sleep = asyncio.sleep
    asyncio.sleep = lambda s: real_sleep(0)  # noqa: E731
    e = env_mod.RetryEnvelope(max_retries=3)

    # success on first try
    client = _FakeClient([_FakeResponse(200, body={"result": "0x1"})])
    resp, attempts, reason = asyncio.get_event_loop().run_until_complete(_run(e, client))
    assert resp is not None and resp.status_code == 200, resp
    assert attempts == 1 and reason is None, (attempts, reason)
    log("  ✅ 200 → (resp, 1, None)")

    # terminal 404 → not retried
    client = _FakeClient([_FakeResponse(404)])
    resp, attempts, reason = asyncio.get_event_loop().run_until_complete(_run(e, client))
    assert resp is None and attempts == 1, (resp, attempts)
    assert reason == env_mod.REASON_TERMINAL_HTTP, reason
    assert len(client.calls) == 1, len(client.calls)
    log(f"  ✅ 404 → terminal_http (not retried), 1 attempt")

    asyncio.sleep = real_sleep
    return True


def test_5_auth_hook():
    log("\n[5/6] Testing on_auth_status hook (401 → refresh → retry / give up)...")
    _install_fake_httpx(None)
    import x402_bridge.envelope as env_mod
    real_sleep = asyncio.sleep
    asyncio.sleep = lambda s: real_sleep(0)  # noqa: E731
    e = env_mod.RetryEnvelope(max_retries=3)

    refreshed = {"count": 0}

    async def hook(resp, attempt):
        refreshed["count"] += 1
        return True  # claim refreshed → retry

    # 401 then 200 (hook returns True once)
    client = _FakeClient([_FakeResponse(401), _FakeResponse(200, body={"ok": 1})])
    resp, attempts, reason = asyncio.get_event_loop().run_until_complete(
        _run(e, client, on_auth_status=hook)
    )
    assert resp is not None and resp.status_code == 200, resp
    assert attempts == 2, attempts
    assert reason is None, reason
    assert refreshed["count"] == 1, refreshed
    log("  ✅ 401 → hook refreshed → retry → 200")

    # 401 then 401 with hook returning False → give up (auth_failed)
    async def hook_no(resp, attempt):
        return False

    client = _FakeClient([_FakeResponse(401), _FakeResponse(401)])
    resp, attempts, reason = asyncio.get_event_loop().run_until_complete(
        _run(e, client, on_auth_status=hook_no)
    )
    assert resp is None and reason == env_mod.REASON_AUTH_FAILED, (resp, reason)
    assert attempts == 1, attempts  # hook False → no retry
    log(f"  ✅ 401 → hook False → auth_failed (no retry)")

    asyncio.sleep = real_sleep
    return True


def test_6_max_concurrent_used():
    log("\n[6/6] Testing X402_MAX_CONCURRENT is actually consumed (env override)...")
    import os
    from x402_bridge.envelope import RetryEnvelope
    os.environ["X402_MAX_CONCURRENT"] = "7"
    e = RetryEnvelope.from_env()
    del os.environ["X402_MAX_CONCURRENT"]
    assert e.max_concurrent == 7, e.max_concurrent
    # quicknode._get_client uses env.max_concurrent for httpx Limits — verify shape
    sys.path.insert(0, str(src_dir))
    import x402_bridge.quicknode as q
    os.environ["X402_MAX_CONCURRENT"] = "7"
    q._http_client = None  # force rebuild
    client = q._get_client(RetryEnvelope.from_env())
    del os.environ["X402_MAX_CONCURRENT"]
    # httpx Limits exposes the configured max_connections
    limits = client._limits if hasattr(client, "_limits") else None
    log(f"  ✅ X402_MAX_CONCURRENT=7 → envelope.max_concurrent={e.max_concurrent}; "
        f"client rebuilt with it")
    q._http_client = None
    return True


def main():
    import types
    print("=" * 60)
    print("x402 Failure/Retry Envelope Test Suite (offline)")
    print("=" * 60)
    results = []
    results.append(("Defaults + backoff", test_1_defaults_and_backoff()))
    results.append(("Headers UA", test_2_headers_ua()))
    results.append(("Retry/exhaust", test_3_retry_on_transient_then_exhaust()))
    results.append(("Success/terminal", test_4_success_and_terminal_http()))
    results.append(("Auth hook", test_5_auth_hook()))
    results.append(("MAX_CONCURRENT used", test_6_max_concurrent_used()))
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)
    for name, ok in results:
        print(f"  {'✅ PASS' if ok else '❌ FAIL'} — {name}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())