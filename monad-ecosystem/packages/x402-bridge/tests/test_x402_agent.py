#!/usr/bin/env python3
"""
Test the x402 sovereign-agent consumer (agent.py) — offline, no funded wallet.

Validates the CHARTER §3 sovereign-agent properties + LEGACY_COMPONENTS §6
sovereign-agent-consumer deliverable:
  1. X402AgentConfig.from_env loads identity/address/envelope/kill-switch from env
  2. managed_resource() exposes the settlement ADDRESS only (never a key)
  3. constraint_envelope() returns the RetryEnvelope
  4. control_surfaces() lists every env knob with default/scope/justification
  5. kill switch halts spend + records a ledger entry (status="kill_switch")
  6. fetch() delegates to quicknode.fetch with the agent's envelope/ledger/agent_id
     (verified by injecting a fake quicknode.fetch and asserting the kwargs)

Usage:
  python tests/test_x402_agent.py
  python tests/test_x402_agent.py --verbose
"""

import sys
import os
import asyncio
import tempfile
from pathlib import Path

src_dir = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_dir))


def log(msg: str):
    print(msg)


def test_1_config_from_env():
    log("\n[1/6] Testing X402AgentConfig.from_env...")
    os.environ["X402_AGENT_ID"] = "test-agent"
    os.environ["X402_EVM_SETTLEMENT_ADDRESS"] = "0xSETTLEMENT"
    os.environ["X402_AGENT_KILL_SWITCH"] = "false"
    from x402_bridge.agent import X402AgentConfig
    cfg = X402AgentConfig.from_env()
    for k in ("X402_AGENT_ID", "X402_EVM_SETTLEMENT_ADDRESS", "X402_AGENT_KILL_SWITCH"):
        del os.environ[k]
    assert cfg.agent_id == "test-agent", cfg.agent_id
    assert cfg.settlement_address == "0xSETTLEMENT", cfg.settlement_address
    assert cfg.kill_switch is False, cfg.kill_switch
    assert cfg.envelope.max_concurrent == 20, cfg.envelope
    log("  ✅ agent_id + settlement_address + envelope + kill_switch loaded from env")
    return True


def test_2_managed_resource_address_only():
    log("\n[2/6] Testing managed_resource exposes address only (never a key)...")
    from x402_bridge.agent import X402Agent, X402AgentConfig
    os.environ["X402_EVM_SETTLEMENT_ADDRESS"] = "0xSETTLEMENT"
    cfg = X402AgentConfig.from_env()
    del os.environ["X402_EVM_SETTLEMENT_ADDRESS"]
    ag = X402Agent(cfg)
    res = ag.managed_resource()
    assert res == {"settlement_address": "0xSETTLEMENT", "configured": True}, res
    # The agent config + managed_resource surface must never carry a private key
    import dataclasses
    field_names = {f.name for f in dataclasses.fields(cfg)}
    assert "private_key" not in field_names and "evm_private_key" not in field_names, field_names
    assert "private_key" not in res.keys(), res
    log("  ✅ managed_resource returns address; no private-key field in config")
    return True


def json_keys(d):
    return set(d.keys())


def test_3_constraint_envelope():
    log("\n[3/6] Testing constraint_envelope returns the RetryEnvelope...")
    from x402_bridge.agent import X402Agent, X402AgentConfig
    from x402_bridge.envelope import RetryEnvelope
    cfg = X402AgentConfig.from_env()
    ag = X402Agent(cfg)
    env = ag.constraint_envelope()
    assert isinstance(env, RetryEnvelope), type(env)
    assert env.max_retries == 3 and env.user_agent == "x402-bridge/1.0", env
    log(f"  ✅ constraint_envelope = RetryEnvelope(max_retries={env.max_retries})")
    return True


def test_4_control_surfaces_documented():
    log("\n[4/6] Testing control_surfaces lists every knob (default/scope/justification)...")
    from x402_bridge.agent import X402Agent, X402AgentConfig
    cs = X402Agent.control_surfaces()
    env_names = {c["env"] for c in cs}
    expected = {
        "X402_AGENT_KILL_SWITCH", "X402_MAX_CONCURRENT", "X402_MAX_RETRIES",
        "X402_INITIAL_BACKOFF_MS", "X402_MAX_BACKOFF_MS", "X402_TIMEOUT",
        "X402_AGENT_ID", "X402_EVM_SETTLEMENT_ADDRESS", "X402_LEDGER_PATH",
    }
    assert expected.issubset(env_names), (expected - env_names)
    for c in cs:
        assert c["default"] and c["scope"] and c["justification"], c
    log(f"  ✅ {len(cs)} control surfaces, all with default/scope/justification "
        f"(incl. kill switch)")
    return True


def test_5_kill_switch_halts_spend():
    log("\n[5/6] Testing kill switch halts spend + records a ledger entry...")
    from x402_bridge.agent import X402Agent, X402AgentConfig
    with tempfile.TemporaryDirectory() as d:
        os.environ["X402_AGENT_KILL_SWITCH"] = "true"
        os.environ["X402_LEDGER_PATH"] = os.path.join(d, "ks.jsonl")
        os.environ["X402_AGENT_ID"] = "ks-agent"
        cfg = X402AgentConfig.from_env()
        for k in ("X402_AGENT_KILL_SWITCH", "X402_LEDGER_PATH", "X402_AGENT_ID"):
            del os.environ[k]
        ag = X402Agent(cfg)
        assert cfg.kill_switch is True, cfg
        result = asyncio.get_event_loop().run_until_complete(
            ag.fetch({"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []})
        )
        assert result is None, result
        rows = ag.ledger.read_all()
        assert len(rows) == 1, rows
        assert rows[0]["status"] == "kill_switch", rows[0]
        assert rows[0]["dlq_reason"] == "agent-kill-switch-engaged", rows[0]
        assert rows[0]["agent_id"] == "ks-agent", rows[0]
        log("  ✅ kill switch → fetch returns None; ledger records status=kill_switch")
    return True


def test_6_fetch_delegates_with_agent_kwargs():
    log("\n[6/6] Testing fetch() delegates to quicknode.fetch with envelope/ledger/agent_id...")
    import x402_bridge.agent as agent_mod
    import x402_bridge.quicknode as q
    from x402_bridge.agent import X402Agent, X402AgentConfig
    from x402_bridge.envelope import RetryEnvelope
    from x402_bridge.ledger import DrawdownLedger

    captured = {}

    async def fake_fetch(payload, *, envelope=None, ledger=None, agent_id=None):
        captured["payload"] = payload
        captured["envelope"] = envelope
        captured["ledger"] = ledger
        captured["agent_id"] = agent_id
        return {"result": "0xdeadbeef"}

    # Patch the name quicknode.fetch that agent.fetch imports locally.
    orig = q.fetch
    q.fetch = fake_fetch
    try:
        os.environ["X402_AGENT_ID"] = "deleg-agent"
        with tempfile.TemporaryDirectory() as d:
            os.environ["X402_LEDGER_PATH"] = os.path.join(d, "ag.jsonl")
            cfg = X402AgentConfig.from_env()
            del os.environ["X402_AGENT_ID"]
            del os.environ["X402_LEDGER_PATH"]
            ag = X402Agent(cfg)
            payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}
            result = asyncio.get_event_loop().run_until_complete(ag.fetch(payload))
            assert result == {"result": "0xdeadbeef"}, result
            assert captured["payload"] == payload, captured
            assert captured["agent_id"] == "deleg-agent", captured
            assert isinstance(captured["envelope"], RetryEnvelope), captured
            assert isinstance(captured["ledger"], DrawdownLedger), captured
            # The agent's OWN ledger/envelope were injected (not the module defaults)
            assert captured["ledger"] is ag.ledger, captured
            assert captured["envelope"] is ag.envelope, captured
            log("  ✅ fetch delegates to quicknode.fetch with the agent's envelope/ledger/agent_id")
    finally:
        q.fetch = orig
    return True


def main():
    print("=" * 60)
    print("x402 Sovereign-Agent Consumer Test Suite (offline)")
    print("=" * 60)
    results = []
    results.append(("config from env", test_1_config_from_env()))
    results.append(("managed resource", test_2_managed_resource_address_only()))
    results.append(("constraint envelope", test_3_constraint_envelope()))
    results.append(("control surfaces", test_4_control_surfaces_documented()))
    results.append(("kill switch", test_5_kill_switch_halts_spend()))
    results.append(("fetch delegation", test_6_fetch_delegates_with_agent_kwargs()))
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