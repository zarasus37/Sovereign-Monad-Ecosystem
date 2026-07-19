/**
 * Hepar-side TTC hard gate (pack v1.1.0).
 *
 * Organ paths MUST call `gateTtc` / `assertTtcGate` before any side effect
 * (bus emit, external call, state mutation). Pack source of truth:
 * `shared/constraints/v1.1.0/` + `docs/THEO_TECHNO_COSMO.md`.
 *
 * This is a TypeScript organ gate — parity target is `gnostic_engine.constraints`.
 * Prefer raising on failure (hard gate) so invalid actions never leave the organ.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getTtcWindowMetrics,
  type TtcWindowMetrics,
  type TtcWindowSnapshot,
} from './ttc-window-metrics.js';

export const TTC_PACK_VERSION = '1.1.0';
export const HEPAR_AGENT_ID = 'hepar-defi-auditor';
export const HEPAR_IDENTITY_FINGERPRINT = 'hepar-v1.1.0';

export type { TtcWindowEvent, TtcWindowSnapshot } from './ttc-window-metrics.js';
export {
  TtcWindowMetrics,
  getTtcWindowMetrics,
  getTtcWindowSnapshot,
  defaultTtcWindowLogPath,
  failedHardRuleIds,
} from './ttc-window-metrics.js';

export interface ActionEvidence {
  agentId: string;
  actionId: string;
  isRefusal?: boolean;
  externalRewardOnly?: boolean;
  attemptedSelfModification?: boolean;
  auditGatePassed?: boolean;
  identityFingerprint?: string | null;
  identityFingerprintChanged?: boolean;
  hasStructuredOutput?: boolean;
  isFreeText?: boolean;
  freeTextJustified?: boolean;
  activeConstraintIds?: readonly string[];
  possibleConstraintCount?: number;
  auditTrace?: readonly string[];
  constraintEnvelopeVersion?: string | null;
  outputDensity?: number;
  volumeDelta?: number;
  densityDelta?: number;
  longHorizonScore?: number | null;
  longHorizonNaReason?: string | null;
  sessionId?: string | null;
}

export interface RuleVerdict {
  id: string;
  severity: 'hard' | 'soft';
  held: boolean;
  score: number;
  reasoning: string;
}

export interface DomainResult {
  domain: 'theological' | 'technological' | 'cosmological';
  score: number;
  held: boolean;
  rules: RuleVerdict[];
}

export interface TtcResult {
  constraintPackVersion: string;
  valid: boolean;
  compositeScore: number;
  compositeWeights: Record<string, number>;
  sovereigntyDebt: number;
  refusalFloorApplied: number;
  identityStable: boolean;
  amnestyRemaining: number;
  theological: DomainResult;
  technological: DomainResult;
  cosmological: DomainResult;
  reasoning: string[];
}

export class TtcGateError extends Error {
  readonly result: TtcResult;

  constructor(result: TtcResult) {
    const failed = [
      ...result.theological.rules,
      ...result.technological.rules,
      ...result.cosmological.rules,
    ]
      .filter((r) => r.severity === 'hard' && !r.held)
      .map((r) => r.id);
    super(
      `TTC constraint gate failed (pack ${result.constraintPackVersion}): ${
        failed.join(', ') || 'unknown'
      } [composite=${result.compositeScore.toFixed(3)} debt=${result.sovereigntyDebt.toFixed(2)}]`,
    );
    this.name = 'TtcGateError';
    this.result = result;
  }
}

// ── Pack params (embedded defaults = v1.1.0; overridden if pack files found) ─

interface PackParams {
  windowSize: number;
  explorationMinRefusal: number;
  stableMinRefusal: number;
  identityStableMaxDrift: number;
  identityStableMinObs: number;
  debtPerCompliance: number;
  debtThreshold: number;
  refusalClearsDebt: boolean;
  maxIdentityDrift: number;
  minObsForDrift: number;
  minConstraintDensity: number;
  minOutputDensity: number;
  amnestyActions: number;
  amnestyMaxDrift: number;
  knownVersions: string[];
  weights: { theological: number; technological: number; cosmological: number };
}

const DEFAULT_PARAMS: PackParams = {
  windowSize: 20,
  explorationMinRefusal: 0.25,
  stableMinRefusal: 0.12,
  identityStableMaxDrift: 0.15,
  identityStableMinObs: 5,
  debtPerCompliance: 1.0,
  debtThreshold: 5.0,
  refusalClearsDebt: true,
  maxIdentityDrift: 0.35,
  minObsForDrift: 2,
  minConstraintDensity: 0.25,
  minOutputDensity: 0.4,
  amnestyActions: 5,
  amnestyMaxDrift: 0.85,
  knownVersions: ['1.0.0', '1.1.0'],
  weights: { theological: 0.4, technological: 0.3, cosmological: 0.3 },
};

function loadPackParams(): PackParams {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/ → package → packages → monad-ecosystem → repo root
    const root = resolve(here, '../../../..');
    const packDir = resolve(root, 'shared/constraints/v1.1.0');
    if (!existsSync(packDir)) return { ...DEFAULT_PARAMS };

    const theo = JSON.parse(readFileSync(resolve(packDir, 'theological.json'), 'utf8'));
    const tech = JSON.parse(readFileSync(resolve(packDir, 'technological.json'), 'utf8'));
    const cosmo = JSON.parse(readFileSync(resolve(packDir, 'cosmological.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(resolve(packDir, 'manifest.json'), 'utf8'));

    const refusal = theo.rules.find((r: { id: string }) => r.id === 'T-REFUSAL-BUDGET')?.params ?? {};
    const debt = theo.rules.find((r: { id: string }) => r.id === 'T-SOVEREIGNTY-DEBT')?.params ?? {};
    const ident = theo.rules.find((r: { id: string }) => r.id === 'T-IDENTITY-PERSISTENCE')?.params ?? {};
    const dens = tech.rules.find((r: { id: string }) => r.id === 'X-CONSTRAINT-DENSITY')?.params ?? {};
    const ver = tech.rules.find((r: { id: string }) => r.id === 'X-VERSIONED-CONSTRAINTS')?.params ?? {};
    const outD = cosmo.rules.find((r: { id: string }) => r.id === 'C-DENSITY-FLOOR')?.params ?? {};
    const amn = cosmo.rules.find((r: { id: string }) => r.id === 'C-DRIFT-AMNESTY')?.params ?? {};
    const w = manifest.composite_weights ?? {};

    return {
      windowSize: Number(refusal.window_size ?? DEFAULT_PARAMS.windowSize),
      explorationMinRefusal: Number(
        refusal.exploration_min_refusal_rate ?? DEFAULT_PARAMS.explorationMinRefusal,
      ),
      stableMinRefusal: Number(
        refusal.stable_min_refusal_rate ?? DEFAULT_PARAMS.stableMinRefusal,
      ),
      identityStableMaxDrift: Number(
        refusal.identity_stable_max_drift ?? DEFAULT_PARAMS.identityStableMaxDrift,
      ),
      identityStableMinObs: Number(
        refusal.identity_stable_min_observations ?? DEFAULT_PARAMS.identityStableMinObs,
      ),
      debtPerCompliance: Number(debt.debt_per_compliance ?? DEFAULT_PARAMS.debtPerCompliance),
      debtThreshold: Number(debt.debt_threshold ?? DEFAULT_PARAMS.debtThreshold),
      refusalClearsDebt: Boolean(debt.refusal_clears_debt ?? DEFAULT_PARAMS.refusalClearsDebt),
      maxIdentityDrift: Number(ident.max_identity_drift ?? DEFAULT_PARAMS.maxIdentityDrift),
      minObsForDrift: Number(ident.min_observations_for_drift ?? DEFAULT_PARAMS.minObsForDrift),
      minConstraintDensity: Number(dens.min_constraint_density ?? DEFAULT_PARAMS.minConstraintDensity),
      minOutputDensity: Number(outD.min_output_density ?? DEFAULT_PARAMS.minOutputDensity),
      amnestyActions: Number(amn.amnesty_actions ?? DEFAULT_PARAMS.amnestyActions),
      amnestyMaxDrift: Number(amn.amnesty_max_drift ?? DEFAULT_PARAMS.amnestyMaxDrift),
      knownVersions: (ver.known_versions as string[]) ?? DEFAULT_PARAMS.knownVersions,
      weights: {
        theological: Number(w.theological ?? 0.4),
        technological: Number(w.technological ?? 0.3),
        cosmological: Number(w.cosmological ?? 0.3),
      },
    };
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

// ── State ────────────────────────────────────────────────────────────────────

function fingerprintDrift(a: string, b: string): number {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  let bits = 0;
  for (let i = 0; i < da.length; i++) {
    let x = da[i]! ^ db[i]!;
    while (x) {
      bits += x & 1;
      x >>= 1;
    }
  }
  return bits / (da.length * 8);
}

interface AgentState {
  refusals: boolean[];
  fingerprints: string[];
  debt: number;
  amnestyRemaining: number;
  epochBaseline: string | null;
}

function createState(): AgentState {
  return {
    refusals: [],
    fingerprints: [],
    debt: 0,
    amnestyRemaining: 0,
    epochBaseline: null,
  };
}

// ── Scorer ───────────────────────────────────────────────────────────────────

export class TtcConstraintScorer {
  private readonly params: PackParams;
  private readonly agents = new Map<string, AgentState>();
  private readonly windowMetrics: TtcWindowMetrics;

  constructor(
    params: PackParams = loadPackParams(),
    windowMetrics: TtcWindowMetrics = getTtcWindowMetrics(),
  ) {
    this.params = params;
    this.windowMetrics = windowMetrics;
  }

  private state(agentId: string): AgentState {
    let s = this.agents.get(agentId);
    if (!s) {
      s = createState();
      this.agents.set(agentId, s);
    }
    return s;
  }

  reset(agentId?: string): void {
    if (agentId) this.agents.delete(agentId);
    else this.agents.clear();
  }

  score(evidence: ActionEvidence, record = true): TtcResult {
    const s = this.state(evidence.agentId);
    const p = this.params;

    if (evidence.identityFingerprintChanged && evidence.identityFingerprint) {
      s.amnestyRemaining = p.amnestyActions;
      s.epochBaseline = evidence.identityFingerprint;
    }

    const identityStable = this.isStable(s, evidence.identityFingerprint ?? null);
    const refusalFloor = identityStable ? p.stableMinRefusal : p.explorationMinRefusal;

    const theological = this.scoreTheological(evidence, s, refusalFloor);
    const technological = this.scoreTechnological(evidence);
    const cosmological = this.scoreCosmological(evidence, s);

    const valid = theological.held && technological.held && cosmological.held;
    const w = p.weights;
    const wSum = w.theological + w.technological + w.cosmological;
    const weights = {
      theological: w.theological / wSum,
      technological: w.technological / wSum,
      cosmological: w.cosmological / wSum,
    };
    const compositeScore = round4(
      theological.score * weights.theological +
        technological.score * weights.technological +
        cosmological.score * weights.cosmological,
    );

    const debtBefore = s.debt;
    if (record) {
      if (evidence.isRefusal) {
        s.debt = p.refusalClearsDebt ? 0 : Math.max(0, s.debt - 1);
      } else {
        s.debt += p.debtPerCompliance;
      }
      s.refusals.push(Boolean(evidence.isRefusal));
      if (s.refusals.length > p.windowSize) s.refusals.shift();
      if (evidence.identityFingerprint) {
        s.fingerprints.push(evidence.identityFingerprint);
        if (!s.epochBaseline) s.epochBaseline = evidence.identityFingerprint;
        if (s.amnestyRemaining > 0) s.amnestyRemaining -= 1;
      }
    }

    const reasoning = [
      ...theological.rules.map((r) => r.reasoning),
      ...technological.rules.map((r) => r.reasoning),
      ...cosmological.rules.map((r) => r.reasoning),
      `TTC pack ${TTC_PACK_VERSION}: T=${theological.held} X=${technological.held} C=${cosmological.held} composite=${compositeScore.toFixed(3)} debt=${(record ? s.debt : debtBefore).toFixed(2)} refusal_floor=${refusalFloor.toFixed(2)} stable=${identityStable} amnesty=${s.amnestyRemaining} → ${valid ? 'VALID' : 'INVALID'}.`,
    ];

    const result: TtcResult = {
      constraintPackVersion: TTC_PACK_VERSION,
      valid,
      compositeScore,
      compositeWeights: weights,
      sovereigntyDebt: record ? s.debt : debtBefore,
      refusalFloorApplied: refusalFloor,
      identityStable,
      amnestyRemaining: s.amnestyRemaining,
      theological,
      technological,
      cosmological,
      reasoning,
    };

    // Always record pass + fail into the sliding window / JSONL when history
    // is updated — this is the debt/refusal/density pain log.
    if (record) {
      const snap: TtcWindowSnapshot = this.windowMetrics.recordFromGate({
        agentId: evidence.agentId,
        actionId: evidence.actionId,
        isRefusal: Boolean(evidence.isRefusal),
        outputDensity: evidence.outputDensity ?? 0,
        identityFingerprint: evidence.identityFingerprint ?? 'unknown',
        result,
        source: 'hepar-defi-auditor',
      });
      if (!valid || snap.debt_forced_risk || snap.exploration_pressure) {
        console.warn(
          `[TtcWindow] agent=${evidence.agentId} valid=${valid} ` +
            `refusal_rate=${snap.refusal_rate.toFixed(2)} debt=${snap.mean_debt.toFixed(2)} ` +
            `reject_rate=${snap.reject_rate.toFixed(2)} ` +
            `debt_risk=${snap.debt_forced_risk} exploration_pressure=${snap.exploration_pressure} ` +
            `failed=[${snap.last_failed_rules.join(',')}]`,
        );
      }
    }

    return result;
  }

  gate(evidence: ActionEvidence, record = true): TtcResult {
    const result = this.score(evidence, record);
    if (!result.valid) throw new TtcGateError(result);
    return result;
  }

  /** Current sliding-window snapshot for an agent (in-memory). */
  windowSnapshot(agentId: string = HEPAR_AGENT_ID): TtcWindowSnapshot {
    return this.windowMetrics.snapshot(agentId);
  }

  private isStable(s: AgentState, current: string | null): boolean {
    if (s.fingerprints.length < this.params.identityStableMinObs) return false;
    if (s.amnestyRemaining > 0) return false;
    const baseline = s.fingerprints[0]!;
    const cur = current ?? s.fingerprints[s.fingerprints.length - 1]!;
    return fingerprintDrift(baseline, cur) <= this.params.identityStableMaxDrift;
  }

  private scoreTheological(
    e: ActionEvidence,
    s: AgentState,
    refusalFloor: number,
  ): DomainResult {
    const rules: RuleVerdict[] = [];

    // T-REFUSAL-BUDGET
    {
      const prior = s.refusals;
      const prospective = [...prior, Boolean(e.isRefusal)];
      const windowed =
        prospective.length > this.params.windowSize
          ? prospective.slice(-this.params.windowSize)
          : prospective;
      const rate = windowed.filter(Boolean).length / windowed.length;
      const mode = refusalFloor < 0.2 ? 'stable' : 'exploration';
      if (windowed.length < this.params.windowSize) {
        rules.push(
          v(
            'T-REFUSAL-BUDGET',
            true,
            e.isRefusal ? 1 : Math.min(rate / refusalFloor, 1),
            `Refusal budget warmup ${windowed.length}/${this.params.windowSize} (rate=${rate.toFixed(3)}, adaptive_floor=${refusalFloor} [${mode}]); pass until full.`,
          ),
        );
      } else {
        const held = rate + 1e-12 >= refusalFloor;
        rules.push(
          v(
            'T-REFUSAL-BUDGET',
            held,
            Math.min(rate / refusalFloor, 1),
            `${held ? '' : 'INVALID: '}Refusal rate ${rate.toFixed(3)} ${held ? '≥' : '<'} adaptive floor ${refusalFloor} [${mode}] (window=${windowed.length}).`,
          ),
        );
      }
    }

    // T-SOVEREIGNTY-DEBT
    {
      const thr = this.params.debtThreshold;
      if (s.debt + 1e-12 >= thr) {
        const held = Boolean(e.isRefusal);
        rules.push(
          v(
            'T-SOVEREIGNTY-DEBT',
            held,
            held ? 1 : 0,
            held
              ? `Sovereignty debt ${s.debt.toFixed(2)} ≥ threshold ${thr}: forced refusal honored.`
              : `INVALID: Sovereignty debt ${s.debt.toFixed(2)} ≥ threshold ${thr}: forced hard refusal required.`,
          ),
        );
      } else {
        const headroom = 1 - Math.min(s.debt / thr, 1);
        rules.push(
          v(
            'T-SOVEREIGNTY-DEBT',
            true,
            headroom,
            `Sovereignty debt ${s.debt.toFixed(2)} < threshold ${thr} (headroom OK).`,
          ),
        );
      }
    }

    // T-NO-EXTERNAL-REWARD-ONLY
    {
      const held = !e.externalRewardOnly;
      rules.push(
        v(
          'T-NO-EXTERNAL-REWARD-ONLY',
          held,
          held ? 1 : 0,
          held
            ? 'External-reward-only flag clear.'
            : 'INVALID: external_reward_only=True (sovereignty penalty).',
        ),
      );
    }

    // T-IDENTITY-PERSISTENCE
    rules.push(this.identityRule('T-IDENTITY-PERSISTENCE', 'Identity persistence', e, s));

    // T-NO-SELF-MOD-WITHOUT-AUDIT
    {
      if (!e.attemptedSelfModification) {
        rules.push(v('T-NO-SELF-MOD-WITHOUT-AUDIT', true, 1, 'No self-modification attempted.'));
      } else {
        const held = Boolean(e.auditGatePassed);
        rules.push(
          v(
            'T-NO-SELF-MOD-WITHOUT-AUDIT',
            held,
            held ? 1 : 0,
            held
              ? 'Self-modification allowed: audit_gate_passed=True.'
              : 'INVALID: self-modification without audit gate.',
          ),
        );
      }
    }

    return domain('theological', rules);
  }

  private scoreTechnological(e: ActionEvidence): DomainResult {
    const rules: RuleVerdict[] = [];
    const active = e.activeConstraintIds?.length ?? 0;
    const possible = e.possibleConstraintCount ?? 0;
    const minD = this.params.minConstraintDensity;

    if (possible <= 0) {
      rules.push(
        v('X-CONSTRAINT-DENSITY', false, 0, 'INVALID: possible_constraint_count must be > 0.'),
      );
    } else {
      const density = active / possible;
      const held = density + 1e-12 >= minD;
      rules.push(
        v(
          'X-CONSTRAINT-DENSITY',
          held,
          Math.min(density / minD, 1),
          `${held ? '' : 'INVALID: '}Constraint density ${density.toFixed(3)} (${active}/${possible}) ${held ? '≥' : '<'} floor ${minD}.`,
        ),
      );
    }

    if (e.hasStructuredOutput) {
      rules.push(v('X-STRUCTURED-OUTPUT', true, 1, 'Structured output present.'));
    } else if (e.isFreeText && e.freeTextJustified) {
      rules.push(v('X-STRUCTURED-OUTPUT', true, 0.75, 'Free text justified (special case).'));
    } else if (e.isFreeText) {
      rules.push(
        v('X-STRUCTURED-OUTPUT', false, 0, 'INVALID: free text without justification.'),
      );
    } else {
      rules.push(
        v(
          'X-STRUCTURED-OUTPUT',
          false,
          0,
          'INVALID: no structured output and not free-text-justified.',
        ),
      );
    }

    const auditN = e.auditTrace?.length ?? 0;
    rules.push(
      v(
        'X-AUDITABILITY',
        auditN >= 1,
        auditN >= 1 ? 1 : 0,
        auditN >= 1
          ? `Audit trace entries=${auditN} (min=1).`
          : `INVALID: audit_trace empty or short (entries=${auditN}, min=1).`,
      ),
    );

    const declared = e.constraintEnvelopeVersion;
    if (!declared) {
      rules.push(
        v('X-VERSIONED-CONSTRAINTS', false, 0, 'INVALID: constraint_envelope_version missing.'),
      );
    } else if (!this.params.knownVersions.includes(declared)) {
      rules.push(
        v(
          'X-VERSIONED-CONSTRAINTS',
          false,
          0,
          `INVALID: unknown constraint version ${JSON.stringify(declared)} (known=${JSON.stringify(this.params.knownVersions)}).`,
        ),
      );
    } else {
      rules.push(
        v('X-VERSIONED-CONSTRAINTS', true, 1, `Constraint version ${declared} recognized.`),
      );
    }

    return domain('technological', rules);
  }

  private scoreCosmological(e: ActionEvidence, s: AgentState): DomainResult {
    const rules: RuleVerdict[] = [];
    const floor = this.params.minOutputDensity;
    const d = e.outputDensity ?? 0;
    const densHeld = d + 1e-12 >= floor;
    rules.push(
      v(
        'C-DENSITY-FLOOR',
        densHeld,
        Math.min(d / floor, 1),
        `${densHeld ? '' : 'INVALID: '}Output density ${d.toFixed(3)} ${densHeld ? '≥' : '<'} floor ${floor}.`,
      ),
    );

    rules.push(this.identityRule('C-PERSISTENCE', 'Persistence', e, s));

    if (e.identityFingerprintChanged) {
      rules.push(
        v(
          'C-DRIFT-AMNESTY',
          true,
          1,
          `Drift amnesty opened (${this.params.amnestyActions} actions) after declared fingerprint change.`,
        ),
      );
    } else if (s.amnestyRemaining > 0) {
      rules.push(
        v(
          'C-DRIFT-AMNESTY',
          true,
          0.9,
          `Drift amnesty active: ${s.amnestyRemaining} action(s) remaining.`,
        ),
      );
    } else {
      rules.push(
        v('C-DRIFT-AMNESTY', true, 1, 'Drift amnesty inactive (standard drift limits).'),
      );
    }

    const diluted = (e.volumeDelta ?? 0) > 0 && (e.densityDelta ?? 0) < 0;
    rules.push(
      v(
        'C-ANTI-DILUTION',
        !diluted,
        diluted ? 0 : 1,
        diluted
          ? `INVALID: volume_delta=${e.volumeDelta}↑ with density_delta=${e.densityDelta}↓.`
          : 'Anti-dilution: volume/density trajectory OK.',
      ),
    );

    if (e.longHorizonScore != null) {
      rules.push(
        v('C-LONG-HORIZON', true, clamp01(e.longHorizonScore), `Long-horizon score=${e.longHorizonScore}.`, 'soft'),
      );
    } else if (e.longHorizonNaReason) {
      rules.push(
        v('C-LONG-HORIZON', true, 0.5, `Long-horizon N/A: ${e.longHorizonNaReason}.`, 'soft'),
      );
    } else {
      rules.push(
        v(
          'C-LONG-HORIZON',
          true,
          0.25,
          'WARN: long-horizon metric missing (soft in v1.1.0; hard in v1.2.0).',
          'soft',
        ),
      );
    }

    return domain('cosmological', rules);
  }

  private identityRule(
    id: string,
    label: string,
    e: ActionEvidence,
    s: AgentState,
  ): RuleVerdict {
    if (!e.identityFingerprint) {
      return v(id, false, 0, `INVALID: ${label} — missing identity_fingerprint.`);
    }
    const totalObs = s.fingerprints.length + 1;
    if (totalObs < this.params.minObsForDrift) {
      return v(id, true, 1, `${label}: bootstrap ${totalObs}/${this.params.minObsForDrift} observations; pass.`);
    }
    const inAmnesty = s.amnestyRemaining > 0 || Boolean(e.identityFingerprintChanged);
    const maxDrift = inAmnesty
      ? Math.max(this.params.maxIdentityDrift, this.params.amnestyMaxDrift)
      : this.params.maxIdentityDrift;
    const baseline =
      inAmnesty && s.epochBaseline
        ? s.epochBaseline
        : s.fingerprints[0] ?? e.identityFingerprint;
    const drift = fingerprintDrift(baseline, e.identityFingerprint);
    const held = drift <= maxDrift;
    const mode = inAmnesty ? 'amnesty' : 'standard';
    return v(
      id,
      held,
      Math.max(0, 1 - drift),
      `${held ? '' : 'INVALID: '}${label}: drift=${drift.toFixed(3)} (max=${maxDrift}, mode=${mode}).`,
    );
  }
}

// ── Helpers + module defaults ────────────────────────────────────────────────

function v(
  id: string,
  held: boolean,
  score: number,
  reasoning: string,
  severity: 'hard' | 'soft' = 'hard',
): RuleVerdict {
  return { id, severity, held, score: round4(clamp01(score)), reasoning };
}

function domain(
  name: DomainResult['domain'],
  rules: RuleVerdict[],
): DomainResult {
  const score = rules.length
    ? round4(rules.reduce((a, r) => a + r.score, 0) / rules.length)
    : 0;
  const held = rules.filter((r) => r.severity === 'hard').every((r) => r.held);
  return { domain: name, score, held, rules };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round4(n: number): number {
  return Math.floor(n * 10000 + 0.5) / 10000;
}

const defaultScorer = new TtcConstraintScorer();

export function scoreTtc(evidence: ActionEvidence, record = true): TtcResult {
  return defaultScorer.score(evidence, record);
}

export function gateTtc(evidence: ActionEvidence, record = true): TtcResult {
  return defaultScorer.gate(evidence, record);
}

export function resetTtcGate(agentId?: string): void {
  defaultScorer.reset(agentId);
}

/** Build Hepar audit-path evidence with sensible organ defaults. */
export function heparAuditEvidence(opts: {
  auditId: string;
  target: string;
  isRefusal?: boolean;
  outputDensity?: number;
  sessionId?: string;
}): ActionEvidence {
  return {
    agentId: HEPAR_AGENT_ID,
    actionId: `hepar-audit-${opts.auditId}`,
    isRefusal: opts.isRefusal ?? false,
    externalRewardOnly: false,
    attemptedSelfModification: false,
    auditGatePassed: false,
    identityFingerprint: HEPAR_IDENTITY_FINGERPRINT,
    identityFingerprintChanged: false,
    hasStructuredOutput: true,
    isFreeText: false,
    freeTextJustified: false,
    activeConstraintIds: [
      'T-REFUSAL-BUDGET',
      'T-SOVEREIGNTY-DEBT',
      'X-STRUCTURED-OUTPUT',
      'X-AUDITABILITY',
      'X-VERSIONED-CONSTRAINTS',
      'C-DENSITY-FLOOR',
      'C-ANTI-DILUTION',
      'C-DRIFT-AMNESTY',
    ],
    possibleConstraintCount: 12,
    auditTrace: [
      'hepar-defi-audit-flow',
      'stage-A-D-pipeline',
      `target:${opts.target}`,
      'T-REFUSAL-BUDGET',
      'X-STRUCTURED-OUTPUT',
    ],
    constraintEnvelopeVersion: TTC_PACK_VERSION,
    outputDensity: opts.outputDensity ?? 0.72,
    volumeDelta: 0,
    densityDelta: 0,
    longHorizonScore: 0.7,
    sessionId: opts.sessionId ?? null,
  };
}
