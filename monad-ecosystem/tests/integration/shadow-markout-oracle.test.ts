/**
 * Shadow Markout oracle integration.
 *
 * Closes docs/ISSUES/python-oracle-port.md — the oracle behind the TS gate was
 * a heuristic stub ("sells > $10k = adverse selection", "+0.2% expected
 * profit" on every pass). This file proves the ported oracle actually governs
 * the funding decision, in four layers:
 *
 *   1. Gate logic      — the sync pre-trade verdict function, batch-run through
 *                        a Python shim (no third-party deps needed).
 *   2. Hardened harness — the ported post-fill analyzer: retention, adverse
 *                        selection, capacity ceiling, and the impure-sample
 *                        guard that replaced silent 0.95/0.90 fallbacks.
 *   3. HTTP round-trip  — a real uvicorn process serving shadow_markout_api.py,
 *                        driven by the real shadowMarkoutGate.ts. This is the
 *                        layer that would have caught the snake_case/camelCase
 *                        bug: the stub returned `expected_slippage` while the TS
 *                        gate read `expectedSlippage`, so slippage and profit
 *                        arrived undefined on every live trade.
 *   4. Engine decision  — executeGuardedLiveTrade consumes real oracle verdicts
 *                        and lands on the right terminal status.
 *
 * All Python is spawned via `python` from PATH, matching the _parity.ts
 * convention. No Docker, no network beyond loopback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateShadowMarkout,
  shouldProceedTrade,
  explainVerdict,
} from '@sovereign/loop/shadowMarkoutGate';
import { executeGuardedLiveTrade } from '@sovereign/loop/executionEngine';
import type {
  CapitalMandate,
  ShadowMarkoutRequest,
  ShadowVerdict,
  TradePayload,
} from '@sovereign/types';

// ── paths ────────────────────────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const PY_DIR = join(REPO_ROOT, 'monad-ecosystem/packages/loop/python');
const SHIM = join(HERE, '_shadow_markout_shim.py');

const ENGINE = '0x1111111111111111111111111111111111111111';
const POOL = '0x2222222222222222222222222222222222222222';

function runShim(mode: string, input: unknown): any {
  const res = spawnSync('python', [SHIM, mode], {
    input: JSON.stringify(input),
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    timeout: 60_000,
  });
  if (res.error) throw new Error(`shim spawn failed (${mode}): ${res.error.message}`);
  if (res.status !== 0) {
    throw new Error(`shim exited ${res.status} (${mode})\n--- stderr ---\n${res.stderr}\n--- end ---`);
  }
  // Python logging goes to stderr; stdout is pure JSON.
  return JSON.parse(res.stdout.trim());
}

function tempDir(tag: string): string {
  return mkdtempSync(join(tmpdir(), `sovereign-shadow-${tag}-`));
}

/** Pyth payload. price/conf share one `expo`, so conf/price is scale-free. */
function pyth(nowSec: number, over: Record<string, number> = {}) {
  return {
    price: 3500,
    conf: 0.35,
    expo: -8,
    publishTime: Math.floor(nowSec),
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Gate logic
// ═══════════════════════════════════════════════════════════════════════════
describe('Shadow Markout gate logic (port from shadow_markout_hardened.py)', () => {
  const now = 1_800_000_000; // fixed clock so verdicts are reproducible
  const out = runShim('gate', {
    now,
    cases: [
      { name: 'clean_pass', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5) },
      { name: 'stale_price', amount_in_usd: 1_000, pyth_price_update: pyth(now - 3_600) },
      { name: 'future_publish_time', amount_in_usd: 1_000, pyth_price_update: pyth(now + 600) },
      { name: 'wide_conf_band', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5, { conf: 350 }) },
      { name: 'over_capacity', amount_in_usd: 90_000, pyth_price_update: pyth(now - 5) },
      { name: 'edge_consumed', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5), expected_edge_bps: 5 },
      { name: 'edge_healthy', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5), expected_edge_bps: 200 },
      { name: 'retention_below_gate', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5), expected_edge_bps: 30 },
    ],
  });

  const byName = new Map(out.results.map((r: any) => [r.name, r]));

  it('every case produced a verdict rather than an error', () => {
    for (const r of out.results) {
      expect(r.error, `case ${r.name} raised: ${r.error}`).toBeUndefined();
      expect(r.verdict).toMatch(
        /^(PASS|FAIL_ADVERSE_SELECTION|FAIL_STALE_PRICE|FAIL_CAPACITY_EXCEEDED)$/,
      );
    }
  });

  it('a fresh, tight-band, in-capacity trade passes', () => {
    const r = byName.get('clean_pass');
    expect(r.verdict).toBe('PASS');
    expect(r.expected_slippage).toBeGreaterThan(0);
    expect(r.expected_slippage).toBeLessThan(0.01);
  });

  it('a stale Pyth observation fails as FAIL_STALE_PRICE', () => {
    const r = byName.get('stale_price');
    expect(r.verdict).toBe('FAIL_STALE_PRICE');
    expect(r.reason).toBe('price_stale');
    // Fail closed: a blocked trade is reported as total loss, not a discount.
    expect(r.expected_slippage).toBe(1);
    expect(r.shadow_profit_usd).toBe(-1_000);
  });

  it('a publishTime in the future is rejected as a spoofed feed, not accepted as fresh', () => {
    // The pre-port stub computed age = now - publishTime and only checked the
    // upper bound, so a future timestamp read as "very fresh" and passed.
    const r = byName.get('future_publish_time');
    expect(r.verdict).toBe('FAIL_STALE_PRICE');
    expect(r.reason).toBe('publish_time_in_future');
  });

  it('a confidence band too wide to bound impact is rejected', () => {
    const r = byName.get('wide_conf_band');
    expect(r.verdict).toBe('FAIL_STALE_PRICE');
    expect(r.reason).toBe('confidence_band_too_wide');
  });

  it('notional above the capacity ceiling fails as FAIL_CAPACITY_EXCEEDED', () => {
    const r = byName.get('over_capacity');
    expect(r.verdict).toBe('FAIL_CAPACITY_EXCEEDED');
    expect(r.reason).toBe('notional_above_capacity_ceiling');
    expect(r.metrics.capacity_ceiling_usd).toBe(50_000);
  });

  it('an edge smaller than expected slippage fails as adverse selection', () => {
    const r = byName.get('edge_consumed');
    expect(r.verdict).toBe('FAIL_ADVERSE_SELECTION');
    expect(r.reason).toBe('edge_consumed_by_slippage');
    expect(r.shadow_profit_usd).toBeLessThan(0);
  });

  it('an edge large enough to retain ≥ gate_threshold passes and reports profit', () => {
    const r = byName.get('edge_healthy');
    expect(r.verdict).toBe('PASS');
    expect(r.metrics.retention).toBeGreaterThanOrEqual(0.8);
    expect(r.shadow_profit_usd).toBeGreaterThan(0);
  });

  it('a profitable-but-thin edge below the retention gate still fails', () => {
    // Net edge is positive here, but retention (6/30 = 20%) is far under the
    // 80% gate. The stub had no such distinction — it passed anything under
    // $50k.
    const r = byName.get('retention_below_gate');
    expect(r.verdict).toBe('FAIL_ADVERSE_SELECTION');
    expect(r.reason).toBe('retention_below_gate');
    expect(r.metrics.retention).toBeLessThan(0.8);
  });

  it('the stub\'s fabricated +0.2% profit is gone when no edge is declared', () => {
    // The stub returned amount * 0.002 on every pass. The oracle has no alpha
    // model and must not manufacture a yield number.
    const r = byName.get('clean_pass');
    expect(r.shadow_profit_usd).toBe(0);
    expect(r.metrics.profit_asserted).toBe(false);
  });

  it('audit ids are deterministic for identical inputs', () => {
    const again = runShim('gate', {
      now,
      cases: [{ name: 'clean_pass', amount_in_usd: 1_000, pyth_price_update: pyth(now - 5) }],
    });
    expect(again.results[0].audit_id).toBe(byName.get('clean_pass').audit_id);
    expect(again.config_fingerprint).toBe(out.config_fingerprint);
  });

  it('different inputs produce different audit ids', () => {
    const other = runShim('gate', {
      now,
      cases: [{ name: 'clean_pass', amount_in_usd: 2_000, pyth_price_update: pyth(now - 5) }],
    });
    expect(other.results[0].audit_id).not.toBe(byName.get('clean_pass').audit_id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Hardened post-fill harness
// ═══════════════════════════════════════════════════════════════════════════
describe('Shadow Markout hardened analyzer (ported post-fill harness)', () => {
  const dir = tempDir('hardened');
  const plans = [
    { id: 'good-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 1 },
    { id: 'good-2', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 2 },
    { id: 'thin-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 1 },
  ];
  const out = runShim('hardened', { plans, output_dir: dir, gate_threshold: 0.8 });

  it('is pinned to the exact 2026-06 snapshot sha256 it was ported from', () => {
    expect(out.source_sha256).toBe(
      '95391b2b05e8d34ed546bb998af264d4f270b2b626868566c22c2b1058d9d6de',
    );
  });

  it('computes retention per trade and flags the thinned fill as adverse', () => {
    expect(out.trade_price_sources['good-1']).toBe('rpc');
    expect(out.trade_price_sources['thin-1']).toBe('rpc');
    expect(out.adverse_ids).toContain('thin-1');
    expect(out.adverse_ids).not.toContain('good-1');
    expect(out.retention_by_slot['1']).toBeCloseTo(75, 5); // mean(100%, 50%)
  });

  it('aggregates retention as a ratio, not a dollar sum', () => {
    // Two clean fills (100% retention) and one thinned fill (50%) over equal
    // predicted PnL → aggregate retention 2.5/3 = 83.33%, which clears the
    // 80% gate. Summing dollars instead of ratios would have hidden the thin
    // fill entirely.
    const summary = out.summary;
    expect(summary.total_trades).toBe(3);
    expect(summary.total_predicted_pnl).toBeCloseTo(3.0, 9);
    expect(summary.total_actual_pnl_t15).toBeCloseTo(2.5, 9);
    expect(summary.alpha_retention_t15).toBeCloseTo(83.333333, 5);
    expect(summary.gate_passed).toBe(true);
  });

  it('fails the aggregate gate when enough fills are thinned', () => {
    const below = runShim('hardened', {
      plans: [
        { id: 'good-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 1 },
        { id: 'thin-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 2 },
        { id: 'thin-2', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000, slot_coordinate: 3 },
      ],
      output_dir: tempDir('hardened-below'),
      gate_threshold: 0.8,
    });
    expect(below.summary.alpha_retention_t15).toBeCloseTo(66.666667, 5);
    expect(below.summary.gate_passed).toBe(false);
    expect(below.summary.conclusion).toContain('Do not grant live capital authority');
  });

  it('derives a capacity ceiling from the observed impact rate', () => {
    // Observed slippage bps = [0, 0, 5000] at notionals [1000, 1000, 1000].
    // avg slip = 1666.67bps, avg notional = $1000 → impact = 1.6667 bps/USD.
    // Gate tolerance = (1 - 0.8) * 10000 = 2000bps → 2000 / 1.6667 = $1200.
    expect(out.summary.capacity_ceiling_usd).toBeCloseTo(1200, 5);
  });

  it('signs the summary so the audit trail can verify it', () => {
    expect(out.summary.report_signature).toMatch(/^[0-9a-f]{16}$/);
  });

  it('a run with no realized price is reported as an impure sample, not a pass', () => {
    // The snapshot silently multiplied predicted PnL by 0.95/0.90 when the RPC
    // was unavailable — the exact synthetic multiplier the file was written to
    // eliminate. The port makes that visible instead.
    const degraded = runShim('fallback', {
      plans: [{ id: 'd-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000 }],
      output_dir: tempDir('nofetch'),
    });
    expect(degraded.summary.gate_pure).toBe(false);
    expect(degraded.summary.fallback_trade_count).toBe(1);
    expect(degraded.summary.fallback_rate).toBe(100);
    expect(degraded.summary.conclusion).toContain('IMPURE SAMPLE');
    // The trade itself still passes the retention gate — on synthetic numbers.
    // That is precisely why gate_pure has to exist.
    expect(degraded.summary.gate_passed).toBe(true);
    expect(degraded.trade_price_sources['d-1']).toBe('fallback');
  });

  it('constructing without a price_fetcher is flagged as unwired', () => {
    const degraded = runShim('fallback', {
      plans: [{ id: 'd-1', predicted_pnl: 1.0, entry_price: 1.0, notional_usd: 1_000 }],
      output_dir: tempDir('nofetch2'),
    });
    expect(degraded.using_default_fetcher_when_unwired).toBe(true);
  });

  it('a fully RPC-backed run is marked pure', () => {
    expect(out.summary.gate_pure).toBe(true);
    expect(out.summary.fallback_trade_count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. HTTP round-trip against a real uvicorn process
// ═══════════════════════════════════════════════════════════════════════════
describe('Shadow Markout HTTP round-trip (real uvicorn ↔ real TS gate)', () => {
  const PORT = 8765;
  const BASE = `http://127.0.0.1:${PORT}`;
  let proc: ChildProcess | undefined;
  let realFetch: typeof globalThis.fetch;
  /** Captured so we can assert the TS side sent the shape the API expects. */
  let lastRequestBody: any = null;

  beforeAll(async () => {
    proc = spawn(
      'python',
      ['-m', 'uvicorn', 'shadow_markout_api:app', '--host', '127.0.0.1', '--port', String(PORT), '--log-level', 'warning'],
      { cwd: PY_DIR, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: 'ignore' },
    );

    // Poll /health until the server is listening.
    const deadline = Date.now() + 45_000;
    let up = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) { up = true; break; }
      } catch { /* not listening yet */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!up) throw new Error('uvicorn did not become healthy on :8765');

    // shadow-gate.ts captures SHADOW_API_URL at import time, so redirect the
    // global fetch rather than the env var. Everything else about the call —
    // body shape, headers, response parsing — is the real code path.
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/api/v1/shadow/evaluate')) {
        lastRequestBody = init?.body ? JSON.parse(init.body) : null;
        return realFetch(`${BASE}/api/v1/shadow/evaluate`, init);
      }
      return realFetch(input, init);
    }) as typeof globalThis.fetch;
  }, 60_000);

  afterAll(() => {
    if (globalThis.fetch) globalThis.fetch = realFetch;
    proc?.kill();
  });

  const req = (over: Partial<ShadowMarkoutRequest> = {}): ShadowMarkoutRequest => ({
    poolAddress: POOL,
    amountInUsd: 1_000,
    isBuy: true,
    pythPriceUpdate: { price: 3500, conf: 0.35, expo: -8, publishTime: Math.floor(Date.now() / 1000) },
    ...over,
  });

  it('the TS gate posts snake_case exactly as shadow_markout_api.py expects', async () => {
    await evaluateShadowMarkout(req());
    expect(lastRequestBody).not.toBeNull();
    expect(lastRequestBody.pool_address).toBe(POOL);
    expect(lastRequestBody.amount_in_usd).toBe(1_000);
    expect(lastRequestBody.is_buy).toBe(true);
    expect(lastRequestBody.pyth_price_update.publishTime).toBeGreaterThan(0);
  });

  it('the response is camelCase so the TS gate reads real numbers, not undefined', async () => {
    // This is the regression the pre-port stub carried: it serialized
    // expected_slippage / shadow_profit_usd / audit_id while the gate read
    // expectedSlippage / shadowProfitUsd / auditId. `verdict` matched by luck,
    // so gating worked while every reported number was undefined.
    const res = await evaluateShadowMarkout(req());
    expect(typeof res.expectedSlippage).toBe('number');
    expect(Number.isFinite(res.expectedSlippage)).toBe(true);
    expect(typeof res.shadowProfitUsd).toBe('number');
    expect(Number.isFinite(res.shadowProfitUsd)).toBe(true);
    expect(res.auditId).toMatch(/^shadow-[0-9a-f]{20}$/);
  });

  it('a live clean trade reaches the TS gate as PASS and is proceedable', async () => {
    const res = await evaluateShadowMarkout(req());
    expect(res.verdict).toBe('PASS');
    expect(shouldProceedTrade(res)).toBe(true);
  });

  it('a live stale-price trade reaches the TS gate as a blocking verdict', async () => {
    const res = await evaluateShadowMarkout(
      req({
        pythPriceUpdate: {
          price: 3500, conf: 0.35, expo: -8,
          publishTime: Math.floor(Date.now() / 1000) - 3_600,
        },
      }),
    );
    expect(res.verdict).toBe('FAIL_STALE_PRICE');
    expect(shouldProceedTrade(res)).toBe(false);
    expect(explainVerdict(res.verdict as ShadowVerdict)).toMatch(/stale/i);
  });

  it('a live over-capacity trade is blocked', async () => {
    const res = await evaluateShadowMarkout(req({ amountInUsd: 90_000 }));
    expect(res.verdict).toBe('FAIL_CAPACITY_EXCEEDED');
    expect(shouldProceedTrade(res)).toBe(false);
  });

  it('exposes the pinned provenance and active thresholds', async () => {
    const cfg = (await (await realFetch(`${BASE}/api/v1/shadow/config`)).json()) as any;
    expect(cfg.hardened_source_sha256).toBe(
      '95391b2b05e8d34ed546bb998af264d4f270b2b626868566c22c2b1058d9d6de',
    );
    expect(cfg.thresholds.max_notional_usd).toBe(50_000);
    expect(cfg.thresholds.gate_threshold).toBe(0.8);
  });

  it('claims no profit when the caller declares no edge', async () => {
    const res = await evaluateShadowMarkout(req());
    expect(res.verdict).toBe('PASS');
    expect(res.shadowProfitUsd).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. The verdict actually governs the funding decision
// ═══════════════════════════════════════════════════════════════════════════
describe('executeGuardedLiveTrade obeys oracle verdicts', () => {
  /**
   * A structurally valid, unexpired mandate.
   *
   * Built by hand rather than signed: `ethers` is a dependency of @sovereign/loop
   * but is not hoisted to the repo root, and the other integration tests import
   * only root-resolvable modules. `skipMandateSignature` keeps this test focused
   * on the shadow verdict — mandate signing has its own coverage in
   * loop/src/sovereignLoop.test.ts.
   */
  function mandateFor(usd: number): CapitalMandate {
    return {
      mandateId: 'mandate-shadow-integration',
      principalWallet: '0x4444444444444444444444444444444444444444',
      engineOperator: ENGINE,
      amountAllocated: usd * 1e6,
      expiration: Math.floor(Date.now() / 1000) + 3_600,
      signature: '0x',
      chainId: 101010,
    };
  }

  async function runWithVerdict(verdict: ShadowVerdict) {
    const payload: TradePayload = {
      poolAddress: POOL,
      amountUsd: 1_000,
      isBuy: true,
      assetPair: 'ETH/USDC',
      status: 'PENDING',
      auditTrace: [],
    };
    const result = await executeGuardedLiveTrade(
      payload,
      mandateFor(15_000),
      {},
      {
        skipMandateSignature: true,
        evaluateShadow: async () => ({
          verdict,
          expectedSlippage: 0.01,
          shadowProfitUsd: 0,
          auditId: 'shadow-integration-1',
        }),
        executeTradeFn: async () => ({ hash: '0xabc', status: 1 as const }),
        broadcast: () => {},
      },
    );
    return { result, payload };
  }

  it('a PASS verdict proceeds to execution', async () => {
    const { result, payload } = await runWithVerdict('PASS');
    expect(result.success).toBe(true);
    expect(result.status).not.toBe('SHADOW_FAIL_ABORTED');
    expect(payload.txHash).toBeTruthy();
  });

  it('a stale-price verdict aborts with SHADOW_FAIL_ABORTED and names the reason', async () => {
    const { result } = await runWithVerdict('FAIL_STALE_PRICE');
    expect(result.success).toBe(false);
    expect(result.status).toBe('SHADOW_FAIL_ABORTED');
    expect(result.error).toBe('SHADOW_VERDICT_FAIL_STALE_PRICE');
    expect(result.auditTrace.some((t) => t.includes('shadow:gate:FAIL_STALE_PRICE'))).toBe(true);
  });

  it('an adverse-selection verdict aborts before any yield is routed', async () => {
    const { result } = await runWithVerdict('FAIL_ADVERSE_SELECTION');
    expect(result.status).toBe('SHADOW_FAIL_ABORTED');
    expect(result.distribution).toBeUndefined();
  });

  it('an engine-unavailable verdict aborts (fail-closed on oracle outage)', async () => {
    const { result } = await runWithVerdict('ERROR_SERVICE_UNAVAILABLE');
    expect(result.success).toBe(false);
    expect(result.status).toBe('SHADOW_FAIL_ABORTED');
  });

  it('the oracle verdict and audit id land in the on-record audit trace', async () => {
    const { result } = await runWithVerdict('PASS');
    expect(
      result.auditTrace.some(
        (t) => t.includes('shadow:gate:PASS') && t.includes('audit:shadow-integration-1'),
      ),
    ).toBe(true);
  });
});