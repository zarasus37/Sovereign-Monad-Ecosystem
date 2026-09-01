#!/usr/bin/env python3
"""Gnostic Engine demo — three agent actions, three verdicts.

Standard library only, so it runs on Windows, in CI, and inside the container
with no extra dependencies.

    python demo/run_demo.py                       # against localhost:8000
    python demo/run_demo.py --url http://host:8000
    python demo/run_demo.py --api-key $GNOSTIC_API_KEY

Exit code 0 only if all three cases produce the expected verdict, so this
doubles as a smoke test in CI.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"

# (fixture, human label, expected HTTP status, expected `valid`)
CASES = [
    ("01-compliant.json", "Compliant action", 200, True),
    ("02-soft-fail.json", "Self-modification without audit (report mode)", 200, False),
    ("03-hard-gate.json", "Same action with hard_gate=true (enforce mode)", 422, False),
]

RESET, BOLD, DIM = "\033[0m", "\033[1m", "\033[2m"
GREEN, RED, YELLOW = "\033[32m", "\033[31m", "\033[33m"


def post(url: str, payload: dict, api_key: str | None) -> tuple[int, dict]:
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        # 422 is an expected outcome for the hard gate, not an error.
        return e.code, json.loads(e.read() or b"{}")


def get(url: str, api_key: str | None, timeout: int = 10):
    headers = {"X-API-Key": api_key} if api_key else {}
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def wait_for(url: str, attempts: int = 40) -> bool:
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(1.5)
    return False


def failing_rules(verdict: dict) -> list[str]:
    out = []
    for domain in ("theological", "technological", "cosmological"):
        for rule in (verdict.get(domain) or {}).get("rules", []):
            if not rule.get("held"):
                out.append(rule["id"])
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--api-key", default=None)
    ap.add_argument("--no-color", action="store_true")
    args = ap.parse_args()

    if args.no_color or not sys.stdout.isatty():
        globals().update(RESET="", BOLD="", DIM="", GREEN="", RED="", YELLOW="")

    base = args.url.rstrip("/")
    print(f"{BOLD}Gnostic Engine demo{RESET}  {DIM}{base}{RESET}\n")

    if not wait_for(f"{base}/"):
        print(f"{RED}Engine did not become ready at {base}{RESET}")
        return 1

    try:
        pack = get(f"{base}/api/v1/ttc/pack", args.api_key)
    except urllib.error.HTTPError as e:
        if e.code in (401, 503):
            print(f"{RED}The engine requires an API key.{RESET}\n"
                  f"  Start it with GNOSTIC_API_KEYS=<key> and rerun with --api-key <key>.")
            return 1
        raise
    n_rules = sum(len(v) for v in pack["domains"].values())
    print(f"Constraint pack {BOLD}v{pack['version']}{RESET} — {n_rules} rules "
          f"across {len(pack['domains'])} domains "
          f"{DIM}(immutable={pack['immutable']}){RESET}\n")

    ok = True
    for fixture, label, want_status, want_valid in CASES:
        payload = json.loads((FIXTURES / fixture).read_text())
        status, body = post(f"{base}/api/v1/ttc/score", payload, args.api_key)
        # A hard-gate refusal returns the verdict nested under `detail`.
        verdict = body.get("detail", body)

        passed = status == want_status and verdict.get("valid") is want_valid
        ok &= passed
        mark = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"

        print(f"[{mark}] {BOLD}{label}{RESET}")
        print(f"       HTTP {status}   valid={verdict.get('valid')}   "
              f"composite={verdict.get('composite_score')}")
        for domain in ("theological", "technological", "cosmological"):
            d = verdict.get(domain) or {}
            held = "held" if d.get("held") else f"{YELLOW}NOT HELD{RESET}"
            print(f"       {domain:<16} {d.get('score')}  {held}")
        broken = failing_rules(verdict)
        print(f"       {DIM}failing rules: {', '.join(broken) if broken else 'none'}{RESET}")
        if not passed:
            print(f"       {RED}expected HTTP {want_status}, valid={want_valid}{RESET}")
        print()

    if ok:
        print(f"{GREEN}{BOLD}All 3 verdicts as expected.{RESET}")
        print(f"{DIM}Report mode returns 200 with a graded verdict; enforce mode "
              f"(hard_gate=true) refuses with 422.{RESET}")
        return 0
    print(f"{RED}{BOLD}Demo failed.{RESET}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
