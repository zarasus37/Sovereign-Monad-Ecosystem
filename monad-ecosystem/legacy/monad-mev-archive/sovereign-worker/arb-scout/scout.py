#!/usr/bin/env python3
"""
Sovereign MEV Engine - Arb Wallet Scout
---------------------------------------
Find active cross-chain arbitrage wallets via Dune Analytics,
reconstruct a capital-base proxy from observed bridge sizes, run the
wallet through the live RGE v2 API, and generate outreach-safe reports.

Usage:
  python scout.py --dune-key YOUR_DUNE_API_KEY [--limit 20]

Requirements:
  pip install requests python-dotenv
"""

import argparse
import io
import json
import os
import sys
import time
from pathlib import Path

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


RGE_API_URL = os.getenv("RGE_API_URL", "https://sovereign-rge-api.sovereign-mev.workers.dev")
RGE_API_KEY = os.getenv("RGE_API_KEY", "")
DUNE_API_BASE = "https://api.dune.com/api/v1"
IDENTITY_LOOKUP_BASE = os.getenv("SCOUT_IDENTITY_LOOKUP_BASE", "https://api.ensdata.net").rstrip("/")
IDENTITY_TIMEOUT_SEC = float(os.getenv("SCOUT_IDENTITY_TIMEOUT_SEC", "6"))
CAPITAL_BASE_MULTIPLE = float(os.getenv("SCOUT_CAPITAL_BASE_MULTIPLE", "500"))
MIN_CAPITAL_BASE_USD = float(os.getenv("SCOUT_MIN_CAPITAL_BASE_USD", "500000"))
MIN_OUTREACH_NOTIONAL_USD = float(os.getenv("SCOUT_MIN_OUTREACH_NOTIONAL_USD", "0"))
DEFAULT_PRESALE_URL = (
    os.getenv("SCOUT_PRESALE_URL")
    or os.getenv("PUBLIC_PRESALE_URL")
    or "https://sovereign-web-6rk.pages.dev/sovereign-presale.html"
).strip()
DEFAULT_LABELS_PATH = Path(__file__).with_name("wallet_labels.json")


DUNE_SQL = """
SELECT
    concat('0x', to_hex("from"))                          AS wallet,
    COUNT(*)                                              AS bridge_tx_count,
    MIN(block_time)                                       AS first_seen,
    MAX(block_time)                                       AS last_seen,
    approx_percentile(CAST(value AS double) / 1e18, 0.5) AS median_eth_per_tx
FROM ethereum.transactions
WHERE
    block_time >= NOW() - INTERVAL '30' day
    AND "to" IN (
        from_hex('5c7bcd6e7de5423a257d81b442095a1a6ced35c5'),
        from_hex('8731d54e9d02c286767d56ac03e8037c07e01e98'),
        from_hex('b8901acb165ed027e32754e0ffe830802919727f'),
        from_hex('3ee18b2214aff97000d974cf647e7c347e8fa585')
    )
GROUP BY "from"
HAVING COUNT(*) >= 5 AND COUNT(*) <= 500
ORDER BY bridge_tx_count DESC
LIMIT 50
"""


def dune_execute(api_key: str, sql: str) -> list[dict]:
    """Execute a Dune query and return rows."""
    headers = {"X-Dune-API-Key": api_key, "Content-Type": "application/json"}

    print("  -> Submitting Dune query...")
    response = requests.post(
        f"{DUNE_API_BASE}/sql/execute",
        headers=headers,
        json={"sql": sql, "performance": "medium"},
        timeout=30,
    )
    if not response.ok:
        raise RuntimeError(f"Dune submit error {response.status_code}: {response.text[:300]}")

    execution_id = response.json()["execution_id"]
    print(f"  -> Execution ID: {execution_id}")

    for attempt in range(40):
        time.sleep(5)
        status_response = requests.get(
            f"{DUNE_API_BASE}/execution/{execution_id}/status",
            headers=headers,
            timeout=15,
        )
        if not status_response.ok:
            print(f"  -> Status check error {status_response.status_code}, retrying...")
            continue

        state = status_response.json().get("state", "")
        print(f"  -> Status: {state} (attempt {attempt + 1})")
        if state == "QUERY_STATE_COMPLETED":
            break
        if state in ("QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED"):
            raise RuntimeError(f"Dune query failed: {state} - {status_response.json()}")
    else:
        raise RuntimeError("Dune query timed out before completion")

    results_response = requests.get(
        f"{DUNE_API_BASE}/execution/{execution_id}/results",
        headers=headers,
        timeout=30,
    )
    if not results_response.ok:
        raise RuntimeError(
            f"Dune results error {results_response.status_code}: {results_response.text[:300]}"
        )

    rows = results_response.json().get("result", {}).get("rows", [])
    print(f"  -> {len(rows)} wallets found.\n")
    return rows


def load_wallet_labels(path: Path) -> dict[str, dict]:
    """Load optional manual wallet labels keyed by lowercase address."""
    if not path.exists():
        return {}

    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)

    labels: dict[str, dict] = {}
    for address, payload in raw.items():
        if isinstance(payload, dict):
            labels[address.lower()] = payload
    return labels


def resolve_wallet_identity(wallet: str, labels: dict[str, dict]) -> dict:
    """
    Best-effort identity enrichment.
    Priority:
      1. local manual labels
      2. ensdata reverse-profile lookup
      3. short address fallback
    """
    wallet_lc = wallet.lower()
    manual = labels.get(wallet_lc)
    if manual:
        return {
            "label": manual.get("label") or manual.get("ens") or _short_wallet(wallet),
            "ens": manual.get("ens"),
            "twitter": manual.get("twitter"),
            "github": manual.get("github"),
            "source": "manual",
        }

    try:
        response = requests.get(f"{IDENTITY_LOOKUP_BASE}/{wallet}", timeout=IDENTITY_TIMEOUT_SEC)
        if response.ok:
            payload = response.json()
            ens = payload.get("ens_primary") or payload.get("ens")
            twitter = payload.get("twitter")
            github = payload.get("github")
            return {
                "label": ens or (f"@{twitter}" if twitter else _short_wallet(wallet)),
                "ens": ens,
                "twitter": twitter,
                "github": github,
                "source": "ensdata",
            }
    except Exception:
        pass

    return {
        "label": _short_wallet(wallet),
        "ens": None,
        "twitter": None,
        "github": None,
        "source": "none",
    }


def estimate_spread_params(wallet_row: dict) -> dict:
    """
    Reconstruct approximate spread parameters from on-chain aggregate data.
    The key correction is to use the observed median bridge notional as the
    sizing anchor instead of forcing every wallet into a flat $500K profile.
    """
    median_eth = float(wallet_row.get("median_eth_per_tx") or 0)
    bridge_count = int(wallet_row.get("bridge_tx_count") or 0)
    eth_price_usd = 3_200

    observed_notional_usd = median_eth * eth_price_usd
    capital_base_usd = max(observed_notional_usd * CAPITAL_BASE_MULTIPLE, MIN_CAPITAL_BASE_USD)

    if bridge_count >= 50 and observed_notional_usd >= 15_000:
        spread_bps = 80
    elif bridge_count >= 20 and observed_notional_usd >= 5_000:
        spread_bps = 100
    else:
        spread_bps = 120

    import math

    vol_hourly = 0.65 / math.sqrt(8760)

    return {
        "spreadBps": round(spread_bps, 2),
        "vol": round(vol_hourly, 6),
        "bridgeWindowSec": 900,
        "portfolioUsd": round(capital_base_usd, 2),
        "capitalBaseUsd": round(capital_base_usd, 2),
        "observedMedianBridgeUsd": round(observed_notional_usd, 2),
        "outreachReady": observed_notional_usd >= MIN_OUTREACH_NOTIONAL_USD,
    }


def rge_evaluate(params: dict) -> dict:`r`n    """Call the live RGE v2 API."""`r`n    if not RGE_API_KEY:`r`n        raise RuntimeError("RGE_API_KEY environment variable is required")
    headers = {"x-api-key": RGE_API_KEY, "Content-Type": "application/json"}
    response = requests.post(f"{RGE_API_URL}/evaluate", headers=headers, json=params, timeout=20)
    response.raise_for_status()
    return response.json()


def format_report(
    wallet: str,
    wallet_row: dict,
    params: dict,
    result: dict,
    identity: dict | None = None,
    presale_url: str = "",
) -> str:
    """Format a personalized screening report for a single wallet."""
    identity = identity or {
        "label": _short_wallet(wallet),
        "ens": None,
        "twitter": None,
        "github": None,
        "source": "none",
    }

    decision = result.get("decision", "-")
    ev = float(result.get("expectedValueUsd", 0))
    effective_spread = float(result.get("effectiveSpreadBps", 0))
    kelly = float(result.get("kellyFraction", 0))
    recommended_size = float(result.get("recommendedSizeUsd", 0))
    sharpe = float(result.get("sharpeLike", 0))
    tail_loss = float(result.get("tailLossP95Usd", 0))
    gate = result.get("decisionGate", {})
    runs = int(result.get("monteCarloRuns", 1000))
    bridge_adjusted = bool(result.get("bridgeFailureAdjusted", False))

    capital_base = float(params.get("capitalBaseUsd") or params.get("portfolioUsd") or 0)
    observed_notional = float(params.get("observedMedianBridgeUsd") or 0)
    tail_pct_size = float(result.get("tailLossPct") or 0)
    if tail_pct_size <= 0 and recommended_size > 0:
        tail_pct_size = abs(tail_loss) / recommended_size
    tail_pct_capital = abs(tail_loss) / capital_base if capital_base > 0 else 0

    ev_pass = _gate_value(gate, "evPassed", "evPass", default=ev >= 10)
    sharpe_pass = _gate_value(gate, "sharpePassed", "sharpePass", default=sharpe >= 0.3)
    tail_pass = _gate_value(gate, "tailPassed", "tailPass", default=tail_pct_size <= 0.30)

    decision_line = (
        f"APPROVE - EV ${ev:+.0f}, size ${recommended_size:,.0f}"
        if decision == "APPROVE"
        else f"REJECT - {_reject_reason(gate, ev, sharpe, tail_pct_size)}"
    )

    bridge_count = wallet_row.get("bridge_tx_count", "?")
    last_seen = str(wallet_row.get("last_seen", "recent"))[:10]
    identity_line = _identity_line(identity)
    outreach_block = _build_outreach_block(
        wallet=wallet,
        identity=identity,
        bridge_count=int(bridge_count) if bridge_count != "?" else 0,
        decision=decision,
        params=params,
        effective_spread=effective_spread,
        ev=ev,
        sharpe=sharpe,
        tail_loss=tail_loss,
        recommended_size=recommended_size,
        presale_url=presale_url,
    )

    report = f"""
===================================================
  SOVEREIGN RGE v2 - WALLET EVALUATION REPORT
===================================================
  Wallet:        {wallet}
  Identity:      {identity_line}
  Bridge txs:    {bridge_count} in last 30 days
  Last active:   {last_seen}

  Parameters used (reconstructed from on-chain data):{f"{chr(10)}    Observed median bridge notional: ${observed_notional:,.0f}" if observed_notional > 0 else ""}
    Capital base proxy used:         ${capital_base:,.0f}
    Spread assumption:               {params['spreadBps']:.0f} bps (activity/notional band)
    Volatility input:                0.65 annualized (ETH)
    Bridge window:                   {params['bridgeWindowSec']}s

  RGE v2 Evaluation ({runs} Monte Carlo paths):
    {decision_line}
    Effective spread after costs:    {effective_spread:.1f} bps
    Fractional Kelly fraction:       {kelly:.4f}
    Sharpe score:                    {sharpe:.2f}
    Tail loss (p95):                 ${tail_loss:,.0f} ({_format_pct(tail_pct_size)} of recommended size | {_format_pct(tail_pct_capital)} of capital base)
    Bridge failure adjusted:         {bridge_adjusted}

  Gate results:
    EV >= $10:                 {'PASS' if ev_pass else 'FAIL'} (${ev:+.0f})
    Sharpe >= 0.3:             {'PASS' if sharpe_pass else 'FAIL'} ({sharpe:.2f})
    Tail loss <= 30% of size:  {'PASS' if tail_pass else 'FAIL'} ({_format_pct(tail_pct_size)})

  Outreach:
{outreach_block}
===================================================
"""
    return report.strip()


def _reject_reason(gate: dict, ev: float, sharpe: float, tail_pct_size: float) -> str:
    reasons = []
    if not _gate_value(gate, "evPassed", "evPass", default=ev >= 10):
        reasons.append(f"EV ${ev:+.0f} below $10 floor")
    if not _gate_value(gate, "sharpePassed", "sharpePass", default=sharpe >= 0.3):
        reasons.append(f"Sharpe {sharpe:.2f} below 0.3")
    if not _gate_value(gate, "tailPassed", "tailPass", default=tail_pct_size <= 0.30):
        reasons.append(f"Tail loss {_format_pct(tail_pct_size)} exceeds 30%")
    return ", ".join(reasons) if reasons else "thresholds not met"


def _tier_suggestion(capital_base_usd: float) -> str:
    if capital_base_usd >= 25_000_000:
        return "Founding Pro at $2,000/mo (locked for life)"
    if capital_base_usd >= 5_000_000:
        return "Founding Pro at $2,000/mo or Founding Starter at $800/mo"
    return "Founding Starter at $800/mo (locked for life)"


def _gate_value(gate: dict, *keys: str, default: bool) -> bool:
    for key in keys:
        if key in gate:
            return bool(gate[key])
    return bool(default)


def _format_pct(ratio: float) -> str:
    pct = max(ratio, 0) * 100
    if pct >= 10:
        return f"{pct:.1f}%"
    if pct >= 1:
        return f"{pct:.2f}%"
    if pct >= 0.1:
        return f"{pct:.3f}%"
    if pct > 0:
        return f"{pct:.4f}%"
    return "0.0%"


def _short_wallet(wallet: str) -> str:
    return f"{wallet[:6]}...{wallet[-4:]}"


def _identity_line(identity: dict) -> str:
    parts = [identity.get("label") or "unlabeled"]
    if identity.get("ens"):
        parts.append(f"ENS {identity['ens']}")
    if identity.get("twitter"):
        parts.append(f"X @{identity['twitter']}")
    if identity.get("github"):
        parts.append(f"GitHub {identity['github']}")
    return " | ".join(parts)


def _build_outreach_block(
    wallet: str,
    identity: dict,
    bridge_count: int,
    decision: str,
    params: dict,
    effective_spread: float,
    ev: float,
    sharpe: float,
    tail_loss: float,
    recommended_size: float,
    presale_url: str,
) -> str:
    observed_notional = float(params.get("observedMedianBridgeUsd") or 0)
    capital_base = float(params.get("capitalBaseUsd") or params.get("portfolioUsd") or 0)
    outreach_ready = bool(params.get("outreachReady", observed_notional >= MIN_OUTREACH_NOTIONAL_USD))

    if decision != "APPROVE":
        return "    HOLD - engine did not approve this reconstructed opportunity."

    if not outreach_ready:
        return (
            "    HOLD - observed median bridge notional "
            f"(${observed_notional:,.0f}) is below the outreach qualification "
            f"floor (${MIN_OUTREACH_NOTIONAL_USD:,.0f})."
        )

    salutation = identity.get("ens") or identity.get("label") or _short_wallet(wallet)
    access_line = (
        f"    Access:      {presale_url}"
        if presale_url
        else "    Access:      provide a public presale URL before sending this outbound."
    )

    intro = (
        f"    Hey — noticed your wallet has been hitting cross-chain bridge routes\n"
        f"    actively ({bridge_count} txs in the last 30 days).\n"
        f"\n"
        f"    We ran your activity pattern through RGE v2 — our Monte Carlo risk\n"
        f"    engine for cross-chain arb. Here's what it produces on a 120-bps\n"
        f"    opportunity with a 15-minute bridge window at your scale:"
    )

    lines = [
        intro,
        "",
        f"      Decision:    {decision}",
        f"      Eff. spread: {effective_spread:.1f} bps after costs",
        f"      EV:          ${ev:+,.0f}",
        f"      Sharpe:      {sharpe:.2f}",
        f"      Tail loss:   ${abs(tail_loss):,.0f} at p95",
        f"      Size:        ${recommended_size:,.0f} recommended",
        "",
        "    Offering founding-rate API access before public launch —",
        f"    {_tier_suggestion(capital_base)}.",
        f"    Pre-sale: {presale_url}" if presale_url else "",
        "",
        "    Happy to run a live eval on any specific opportunity you're looking at.",
        "    Reply with the spread and asset and I'll send the full output.",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sovereign Arb Wallet Scout")
    parser.add_argument("--dune-key", required=True, help="Dune Analytics API key")
    parser.add_argument("--limit", type=int, default=10, help="Max wallets to evaluate")
    parser.add_argument(
        "--output",
        default=r"C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\arb-scout\reports.json",
        help="Output file for reports",
    )
    parser.add_argument(
        "--labels",
        default=str(DEFAULT_LABELS_PATH),
        help="Optional wallet label JSON path",
    )
    parser.add_argument(
        "--presale-url",
        default=DEFAULT_PRESALE_URL,
        help="Public presale URL to embed in outreach",
    )
    args = parser.parse_args()

    labels = load_wallet_labels(Path(args.labels))

    print("\n== Sovereign MEV Engine - Arb Wallet Scout ==\n")
    print("Step 1 - Finding cross-chain arb wallets via Dune...")
    wallets = dune_execute(args.dune_key, DUNE_SQL)
    wallets = wallets[: args.limit]

    if not wallets:
        print("No wallets found. Try relaxing the HAVING clause in DUNE_SQL.")
        sys.exit(0)

    print(f"Step 2 - Running {len(wallets)} wallets through RGE v2...\n")
    reports = []
    for index, row in enumerate(wallets, 1):
        wallet = row.get("wallet", "unknown")
        print(f"  [{index}/{len(wallets)}] {wallet[:18]}...")

        try:
            params = estimate_spread_params(row)
            result = rge_evaluate(params)
            identity = resolve_wallet_identity(wallet, labels)
            report_text = format_report(
                wallet,
                row,
                params,
                result,
                identity=identity,
                presale_url=args.presale_url,
            )
            reports.append(
                {
                    "wallet": wallet,
                    "row": row,
                    "params": params,
                    "identity": identity,
                    "result": result,
                    "report": report_text,
                }
            )
            print(
                f"    -> {result.get('decision', '?')} | "
                f"EV ${result.get('expectedValueUsd', 0):+.0f} | "
                f"Sharpe {result.get('sharpeLike', 0):.2f}"
            )
        except Exception as exc:
            print(f"    -> Error: {exc}")

        time.sleep(0.4)

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(reports, handle, indent=2, default=str)
    print(f"\nStep 3 - Reports saved to {args.output}")

    print("\n" + "=" * 51)
    print("  OUTREACH REPORTS")
    print("=" * 51)
    for item in reports:
        print(item["report"])
        print()

    approve_count = sum(1 for item in reports if item["result"].get("decision") == "APPROVE")
    print(
        f"\nSummary: {len(reports)} wallets evaluated | "
        f"{approve_count} APPROVE | {len(reports) - approve_count} REJECT"
    )
    print(f"Reports saved to: {args.output}\n")


if __name__ == "__main__":
    main()
