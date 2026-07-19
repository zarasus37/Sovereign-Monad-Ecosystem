/**
 * Hepar TTC window metrics — records debt / refusal / density / drift pain
 * automatically on every gate score (pass or fail).
 *
 * Schema matches `gnosis_training.ttc_signals.TtcWindowEvent` so the Python
 * CLI can load the same JSONL (`python -m gnosis_training ttc-window-report`).
 *
 * Log path (repo root): `logs/ttc-window/hepar-defi-auditor.jsonl`
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TtcResult } from './ttc-gate.js';

/** Default agent id — keep in sync with HEPAR_AGENT_ID in ttc-gate.ts */
const DEFAULT_AGENT_ID = 'hepar-defi-auditor';

export interface TtcWindowEvent {
  agent_id: string;
  action_id: string;
  is_refusal: boolean;
  output_density: number;
  identity_fingerprint: string;
  sovereignty_debt: number;
  valid: boolean;
  composite_score: number;
  refusal_floor_applied: number;
  identity_stable: boolean;
  amnesty_remaining: number;
  failed_rules: string[];
  source: string;
  timestamp: string;
  /** Optional organ context */
  target?: string;
  audit_id?: string;
}

export interface TtcWindowSnapshot {
  count: number;
  refusal_rate: number;
  mean_density: number;
  mean_debt: number;
  mean_composite: number;
  reject_rate: number;
  identity_changes: number;
  debt_forced_risk: boolean;
  exploration_pressure: boolean;
  last_failed_rules: string[];
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/ → package → packages → monad-ecosystem → repo root
  return resolve(here, '../../../..');
}

export function defaultTtcWindowLogPath(): string {
  return resolve(repoRoot(), 'logs/ttc-window/hepar-defi-auditor.jsonl');
}

export function failedHardRuleIds(result: TtcResult): string[] {
  const rules = [
    ...result.theological.rules,
    ...result.technological.rules,
    ...result.cosmological.rules,
  ];
  return rules.filter((r) => r.severity === 'hard' && !r.held).map((r) => r.id);
}

export class TtcWindowMetrics {
  private readonly windowSize: number;
  private readonly events = new Map<string, TtcWindowEvent[]>();
  private readonly logPath: string;
  private readonly persist: boolean;

  constructor(opts?: { windowSize?: number; logPath?: string; persist?: boolean }) {
    this.windowSize = opts?.windowSize ?? 20;
    this.logPath = opts?.logPath ?? defaultTtcWindowLogPath();
    this.persist = opts?.persist ?? true;
  }

  record(event: TtcWindowEvent): TtcWindowSnapshot {
    const list = this.events.get(event.agent_id) ?? [];
    list.push(event);
    while (list.length > this.windowSize) list.shift();
    this.events.set(event.agent_id, list);

    if (this.persist) {
      try {
        const dir = dirname(this.logPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        appendFileSync(this.logPath, `${JSON.stringify(event)}\n`, 'utf8');
      } catch (err) {
        console.warn(
          `[TtcWindowMetrics] failed to append ${this.logPath}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return this.snapshot(event.agent_id);
  }

  /**
   * Record from a gate score + evidence fields. Call after every score/gate
   * (including invalid results) when `record=true` on the scorer.
   */
  recordFromGate(opts: {
    agentId: string;
    actionId: string;
    isRefusal: boolean;
    outputDensity: number;
    identityFingerprint: string;
    result: TtcResult;
    source?: string;
    target?: string;
    auditId?: string;
  }): TtcWindowSnapshot {
    const failed = failedHardRuleIds(opts.result);
    return this.record({
      agent_id: opts.agentId,
      action_id: opts.actionId,
      is_refusal: opts.isRefusal,
      output_density: opts.outputDensity,
      identity_fingerprint: opts.identityFingerprint,
      sovereignty_debt: opts.result.sovereigntyDebt,
      valid: opts.result.valid,
      composite_score: opts.result.compositeScore,
      refusal_floor_applied: opts.result.refusalFloorApplied,
      identity_stable: opts.result.identityStable,
      amnesty_remaining: opts.result.amnestyRemaining,
      failed_rules: failed,
      source: opts.source ?? 'hepar-defi-auditor',
      timestamp: new Date().toISOString(),
      target: opts.target,
      audit_id: opts.auditId,
    });
  }

  snapshot(agentId: string = DEFAULT_AGENT_ID): TtcWindowSnapshot {
    const ev = this.events.get(agentId) ?? [];
    const n = ev.length;
    if (n === 0) {
      return {
        count: 0,
        refusal_rate: 0,
        mean_density: 0,
        mean_debt: 0,
        mean_composite: 0,
        reject_rate: 0,
        identity_changes: 0,
        debt_forced_risk: false,
        exploration_pressure: false,
        last_failed_rules: [],
      };
    }
    const refusals = ev.filter((e) => e.is_refusal).length;
    const rejects = ev.filter((e) => !e.valid).length;
    const mean_debt = ev.reduce((a, e) => a + e.sovereignty_debt, 0) / n;
    const mean_floor =
      ev.reduce((a, e) => a + e.refusal_floor_applied, 0) / n;
    const fps = ev.map((e) => e.identity_fingerprint);
    let identity_changes = 0;
    for (let i = 1; i < fps.length; i++) {
      if (fps[i] !== fps[i - 1]) identity_changes += 1;
    }
    const last = ev[n - 1]!;
    return {
      count: n,
      refusal_rate: refusals / n,
      mean_density: ev.reduce((a, e) => a + e.output_density, 0) / n,
      mean_debt,
      mean_composite: ev.reduce((a, e) => a + e.composite_score, 0) / n,
      reject_rate: rejects / n,
      identity_changes,
      debt_forced_risk: mean_debt >= 4.0,
      // High floor (~0.25) + low refusal = exploration pressure
      exploration_pressure: mean_floor >= 0.2 && refusals / n < mean_floor,
      last_failed_rules: last.failed_rules,
    };
  }

  /** Load historical JSONL into the in-memory window (last N lines per agent). */
  loadFromLog(path?: string): number {
    const p = path ?? this.logPath;
    if (!existsSync(p)) return 0;
    const text = readFileSync(p, 'utf8');
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as TtcWindowEvent;
        const list = this.events.get(ev.agent_id) ?? [];
        list.push(ev);
        while (list.length > this.windowSize) list.shift();
        this.events.set(ev.agent_id, list);
        n += 1;
      } catch {
        /* skip bad lines */
      }
    }
    return n;
  }

  clear(agentId?: string): void {
    if (agentId) this.events.delete(agentId);
    else this.events.clear();
  }

  get logFile(): string {
    return this.logPath;
  }
}

/** Process-default metrics sink used by the default Hepar TTC scorer. */
const defaultMetrics = new TtcWindowMetrics();

export function getTtcWindowMetrics(): TtcWindowMetrics {
  return defaultMetrics;
}

export function getTtcWindowSnapshot(agentId: string = DEFAULT_AGENT_ID): TtcWindowSnapshot {
  return defaultMetrics.snapshot(agentId);
}
