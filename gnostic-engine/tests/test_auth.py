"""Contract tests for the Gnostic Engine HTTP guard.

Covers the three properties that matter: public probes stay open, protected
routes fail closed, and the rate limiter sits *in front of* authentication so
wrong keys cost quota.
"""

import pytest
from fastapi.testclient import TestClient

from api.auth import API_KEY_HEADER_NAME, limiter
from api.gnostic_api import app

client = TestClient(app)

GOOD_KEY = "test-key-alpha-8f2c1d"
OTHER_KEY = "test-key-beta-3e7a90"
PROTECTED_GET = "/api/v1/dove/active"
PROTECTED_POST = "/gnostic/resonance"


@pytest.fixture(autouse=True)
def _clean_limiter():
    """Each test starts with an empty rate-limit window."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def configured(monkeypatch):
    """Two keys configured, generous limit, not test mode."""
    monkeypatch.setenv("GNOSTIC_API_KEYS", f"{GOOD_KEY},{OTHER_KEY}")
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "1000")
    monkeypatch.setenv("GNOSTIC_ENV", "production")


# --------------------------------------------------------------------------
# public surface
# --------------------------------------------------------------------------


@pytest.mark.parametrize("path", ["/", "/api/v1/health", "/openapi.json", "/docs"])
def test_public_paths_need_no_key(configured, path):
    """Liveness and documentation stay reachable without a credential.

    An orchestrator has to be able to probe health, and an integrator has to be
    able to read the schema before they have been issued a key.
    """
    assert client.get(path).status_code == 200


def test_health_is_public_even_though_it_sits_on_a_guarded_router():
    """/api/v1/health is mounted on the guarded live router.

    It is exempt by path, not by mount point, so this asserts the exemption
    actually reaches it rather than being shadowed by the router dependency.
    """
    assert client.get("/api/v1/health").status_code == 200


# --------------------------------------------------------------------------
# authentication
# --------------------------------------------------------------------------


def test_protected_route_without_key_is_401(configured):
    response = client.get(PROTECTED_GET)
    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "UNAUTHENTICATED"


def test_protected_post_without_key_is_401(configured):
    response = client.post(PROTECTED_POST, json={"s1": [1, 0, 0, 0], "s2": [1, 0, 0, 0]})
    assert response.status_code == 401


def test_wrong_key_is_401(configured):
    response = client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: "not-a-real-key"})
    assert response.status_code == 401


def test_correct_key_passes_the_guard(configured):
    response = client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: GOOD_KEY})
    assert response.status_code == 200


def test_every_configured_key_is_accepted(configured):
    """A comma-separated list means real key rotation: issue the new key, let
    both work, retire the old one."""
    for key in (GOOD_KEY, OTHER_KEY):
        assert client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: key}).status_code == 200


def test_error_body_never_echoes_the_presented_key(configured):
    secret = "super-secret-attempt-value"
    response = client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: secret})
    assert secret not in response.text


# --------------------------------------------------------------------------
# fail-closed configuration
# --------------------------------------------------------------------------


def test_no_keys_outside_test_mode_is_503(monkeypatch):
    """Unconfigured means unavailable, never open."""
    monkeypatch.delenv("GNOSTIC_API_KEYS", raising=False)
    monkeypatch.setenv("GNOSTIC_ENV", "production")
    response = client.get(PROTECTED_GET)
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "AUTH_NOT_CONFIGURED"


def test_empty_key_string_counts_as_unconfigured(monkeypatch):
    """`GNOSTIC_API_KEYS=" , "` is a misconfiguration, not two blank keys."""
    monkeypatch.setenv("GNOSTIC_API_KEYS", "  ,  ")
    monkeypatch.setenv("GNOSTIC_ENV", "production")
    assert client.get(PROTECTED_GET).status_code == 503


def test_test_mode_allows_unkeyed_access(monkeypatch):
    """Mirrors the NODE_ENV=test escape hatch used by the TypeScript packages."""
    monkeypatch.delenv("GNOSTIC_API_KEYS", raising=False)
    monkeypatch.setenv("GNOSTIC_ENV", "test")
    assert client.get(PROTECTED_GET).status_code == 200


# --------------------------------------------------------------------------
# rate limiting -- ordering is the point
# --------------------------------------------------------------------------


def test_rate_limit_applies_to_rejected_keys(monkeypatch):
    """Regression test for the ordering bug shipped in sovereign-host.

    There, the limiter was mounted after bearer auth, so every bad token died at
    401 without ever being counted: 150 bad-token requests produced 150x 401 and
    zero 429. Brute force was free. Here the limiter runs first, so a wrong key
    still burns quota and the attacker is throttled.
    """
    monkeypatch.setenv("GNOSTIC_API_KEYS", GOOD_KEY)
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "5")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    codes = [
        client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: f"guess-{i}"}).status_code
        for i in range(8)
    ]

    assert codes[:5] == [401] * 5, f"first 5 attempts should be counted 401s, got {codes}"
    assert codes[5:] == [429] * 3, f"attempts past the limit should be throttled, got {codes}"


def test_rate_limit_applies_to_missing_keys(monkeypatch):
    """Unauthenticated callers are bucketed by address, so an anonymous flood is
    throttled too."""
    monkeypatch.setenv("GNOSTIC_API_KEYS", GOOD_KEY)
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "3")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    codes = [client.get(PROTECTED_GET).status_code for _ in range(5)]
    assert codes == [401, 401, 401, 429, 429], codes


def test_rate_limit_applies_to_valid_keys(monkeypatch):
    monkeypatch.setenv("GNOSTIC_API_KEYS", GOOD_KEY)
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "4")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    codes = [
        client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: GOOD_KEY}).status_code
        for _ in range(6)
    ]
    assert codes[:4] == [200] * 4, codes
    assert codes[4:] == [429] * 2, codes


def test_throttled_response_carries_retry_after(monkeypatch):
    monkeypatch.setenv("GNOSTIC_API_KEYS", GOOD_KEY)
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "1")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: GOOD_KEY})
    throttled = client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: GOOD_KEY})

    assert throttled.status_code == 429
    assert int(throttled.headers["Retry-After"]) >= 1
    assert throttled.json()["detail"]["error"] == "RATE_LIMITED"


def test_distinct_keys_do_not_share_a_bucket(monkeypatch):
    """One noisy caller must not throttle another."""
    monkeypatch.setenv("GNOSTIC_API_KEYS", f"{GOOD_KEY},{OTHER_KEY}")
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "2")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    for _ in range(3):
        client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: GOOD_KEY})

    # OTHER_KEY has spent nothing and should still be served.
    assert client.get(PROTECTED_GET, headers={API_KEY_HEADER_NAME: OTHER_KEY}).status_code == 200


def test_public_paths_are_not_rate_limited(monkeypatch):
    """Health checks fire constantly; throttling them would take the service out
    of its own load balancer."""
    monkeypatch.setenv("GNOSTIC_API_KEYS", GOOD_KEY)
    monkeypatch.setenv("GNOSTIC_RATE_LIMIT_PER_MIN", "2")
    monkeypatch.setenv("GNOSTIC_ENV", "production")

    codes = [client.get("/api/v1/health").status_code for _ in range(10)]
    assert codes == [200] * 10
