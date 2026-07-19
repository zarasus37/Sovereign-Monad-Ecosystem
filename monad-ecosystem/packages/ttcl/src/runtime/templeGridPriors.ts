/**
 * TempleGrid LOGOC priors overlay — mutable experimental layer over
 * embedded TempleNode.logoc_fingerprint.
 *
 * Schema: shared/ttcl-specs/temple-grid-logoc-priors.schema.json
 * Fixture: shared/fixtures/layer6/temple-grid-logoc-priors.json
 *
 * Blend: channel_effective = w_f · fingerprint + w_r · runtimePrior
 * Defaults: fingerprint_weight=0.70, runtime_prior_weight=0.30
 */

import type {
  LogocChannelScores,
  LogocPenaltyPriors,
  LogocWeights,
  TempleGrid,
  TempleNode,
  TempleNodeLogocFingerprint,
  TempleId,
} from './templeGrid.js';

/** Local clamp to avoid circular import with templeGridLogoc. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 10000) / 10000;
}

/** Mirror of TEMPLE_GRID_LOGOC_V1 weights/penalties/thresholds (kept local). */
const DEFAULT_PROFILE = {
  profile_id: 'logoc.temple-grid.v1' as const,
  weights: {
    theo: 0.26,
    tech: 0.18,
    cosmo: 0.24,
    coherence: 0.18,
    sovereignty: 0.14,
  },
  penalties: {
    unknownNode: 0.1,
    weakConnectivity: 0.08,
    protocolDrift: 0.1,
    domainImbalance: 0.07,
  },
  thresholds: {
    accept: 0.78,
    review: 0.58,
    reject: 0.57,
  },
};

export type TempleGridLogocProfileLite = {
  profile_id: 'logoc.temple-grid.v1';
  weights: LogocWeights;
  penalties: LogocPenaltyPriors;
  thresholds: { accept: number; review: number; reject: number };
};

// ── Priors document types ────────────────────────────────────────────────────

export interface TempleGridLogocPriorsGlobal {
  weights: LogocWeights;
  penalty_bias: LogocPenaltyPriors;
  thresholds: {
    accept: number;
    review: number;
    reject_below: number;
  };
  blend: {
    fingerprint_weight: number;
    runtime_prior_weight: number;
  };
}

export interface TempleGridNodePrior {
  temple_id: TempleId;
  channels: LogocChannelScores;
  penalty_bias: LogocPenaltyPriors;
  exploration_bias?: number;
  scheduler_bias?: number;
  confidence: number;
  updated_from?: {
    mode: 'manual' | 'training-observation' | 'scheduler-observation' | 'hepar-search';
    run_id?: string;
    timestamp: string;
  };
}

export interface TempleGridLogocScenario {
  scenario_id: string;
  weights_override?: LogocWeights;
  node_overrides?: Array<{
    temple_id: TempleId;
    exploration_bias?: number;
    scheduler_bias?: number;
  }>;
}

export interface TempleGridLogocPriors {
  schema_version: string;
  priors_id: string;
  grid_id: string;
  profile_id: 'logoc.temple-grid.v1';
  global: TempleGridLogocPriorsGlobal;
  node_priors: TempleGridNodePrior[];
  scenarios?: TempleGridLogocScenario[];
}

/** Effective channel + penalty state after fingerprint ⊕ runtime prior blend. */
export interface BlendedLogocExpectation {
  temple_id: TempleId;
  channels: LogocChannelScores;
  penalty_bias: LogocPenaltyPriors;
  weights: LogocWeights;
  baseline_total: number;
  exploration_bias: number;
  scheduler_bias: number;
  fingerprint_confidence: number;
  prior_confidence: number;
  blend: { fingerprint_weight: number; runtime_prior_weight: number };
  source: 'fingerprint-only' | 'fingerprint+prior' | 'prior-only' | 'defaults';
}

// ── Math ─────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: LogocWeights = { ...DEFAULT_PROFILE.weights };

export function sumWeights(w: LogocWeights): number {
  return w.theo + w.tech + w.cosmo + w.coherence + w.sovereignty;
}

export function baselineFromChannels(
  channels: LogocChannelScores,
  weights: LogocWeights = DEFAULT_WEIGHTS,
  penaltySum: number = 0,
): number {
  const L =
    weights.theo * channels.theo +
    weights.tech * channels.tech +
    weights.cosmo * channels.cosmo +
    weights.coherence * channels.coherence +
    weights.sovereignty * channels.sovereignty -
    penaltySum;
  return clamp01(L);
}

export function blendChannelScores(
  fingerprint: LogocChannelScores,
  runtime: LogocChannelScores,
  wf: number,
  wr: number,
): LogocChannelScores {
  const sum = wf + wr;
  const a = sum > 0 ? wf / sum : 0.7;
  const b = sum > 0 ? wr / sum : 0.3;
  return {
    theo: clamp01(a * fingerprint.theo + b * runtime.theo),
    tech: clamp01(a * fingerprint.tech + b * runtime.tech),
    cosmo: clamp01(a * fingerprint.cosmo + b * runtime.cosmo),
    coherence: clamp01(a * fingerprint.coherence + b * runtime.coherence),
    sovereignty: clamp01(a * fingerprint.sovereignty + b * runtime.sovereignty),
  };
}

export function blendPenaltyPriors(
  fingerprint: LogocPenaltyPriors,
  runtime: LogocPenaltyPriors,
  wf: number,
  wr: number,
): LogocPenaltyPriors {
  const sum = wf + wr;
  const a = sum > 0 ? wf / sum : 0.7;
  const b = sum > 0 ? wr / sum : 0.3;
  return {
    unknownNode: clamp01(a * fingerprint.unknownNode + b * runtime.unknownNode),
    weakConnectivity: clamp01(
      a * fingerprint.weakConnectivity + b * runtime.weakConnectivity,
    ),
    protocolDrift: clamp01(a * fingerprint.protocolDrift + b * runtime.protocolDrift),
    domainImbalance: clamp01(
      a * fingerprint.domainImbalance + b * runtime.domainImbalance,
    ),
  };
}

export function sumPenalties(p: LogocPenaltyPriors): number {
  return (
    p.unknownNode + p.weakConnectivity + p.protocolDrift + p.domainImbalance
  );
}

/** Lookup sparse node prior by temple_id. */
export function findNodePrior(
  priors: TempleGridLogocPriors,
  templeId: TempleId,
): TempleGridNodePrior | undefined {
  return priors.node_priors.find((n) => n.temple_id === templeId);
}

/**
 * Merge embedded fingerprint with runtime priors (sparse).
 * Absent prior → fingerprint (+ global defaults).
 * Absent fingerprint → prior or profile defaults.
 */
export function blendNodeExpectation(
  node: TempleNode,
  priors?: TempleGridLogocPriors | null,
  scenarioId?: string,
): BlendedLogocExpectation {
  const fp = node.logoc_fingerprint ?? null;
  const prior = priors ? findNodePrior(priors, node.temple_id) : undefined;
  const global = priors?.global;
  const wf = global?.blend.fingerprint_weight ?? 0.7;
  const wr = global?.blend.runtime_prior_weight ?? 0.3;

  const defaultChannels: LogocChannelScores = {
    theo: 0.5,
    tech: 0.5,
    cosmo: 0.5,
    coherence: 0.5,
    sovereignty: 0.5,
  };
  const defaultPenalties: LogocPenaltyPriors = { ...DEFAULT_PROFILE.penalties };

  let channels: LogocChannelScores;
  let penalty_bias: LogocPenaltyPriors;
  let source: BlendedLogocExpectation['source'];
  let fingerprint_confidence = 0;
  let prior_confidence = 0;

  if (fp && prior) {
    channels = blendChannelScores(fp.channels, prior.channels, wf, wr);
    penalty_bias = blendPenaltyPriors(fp.penalty_priors, prior.penalty_bias, wf, wr);
    source = 'fingerprint+prior';
    fingerprint_confidence = fp.confidence;
    prior_confidence = prior.confidence;
  } else if (fp) {
    channels = { ...fp.channels };
    penalty_bias = { ...fp.penalty_priors };
    source = 'fingerprint-only';
    fingerprint_confidence = fp.confidence;
  } else if (prior) {
    channels = { ...prior.channels };
    penalty_bias = { ...prior.penalty_bias };
    source = 'prior-only';
    prior_confidence = prior.confidence;
  } else {
    channels = defaultChannels;
    penalty_bias = defaultPenalties;
    source = 'defaults';
  }

  const weights =
    global?.weights ??
    fp?.weights ??
    DEFAULT_WEIGHTS;

  // Scenario overrides only affect biases / weights, not channel blend math here
  let exploration_bias = prior?.exploration_bias ?? 0;
  let scheduler_bias = prior?.scheduler_bias ?? 0;
  let effectiveWeights = weights;
  if (priors?.scenarios && scenarioId) {
    const sc = priors.scenarios.find((s) => s.scenario_id === scenarioId);
    if (sc?.weights_override) effectiveWeights = sc.weights_override;
    const no = sc?.node_overrides?.find((n) => n.temple_id === node.temple_id);
    if (no?.exploration_bias != null) exploration_bias = no.exploration_bias;
    if (no?.scheduler_bias != null) scheduler_bias = no.scheduler_bias;
  }

  const baseline_total = baselineFromChannels(
    channels,
    effectiveWeights,
    sumPenalties(penalty_bias),
  );

  return {
    temple_id: node.temple_id,
    channels,
    penalty_bias,
    weights: effectiveWeights,
    baseline_total,
    exploration_bias,
    scheduler_bias,
    fingerprint_confidence,
    prior_confidence,
    blend: { fingerprint_weight: wf, runtime_prior_weight: wr },
    source,
  };
}

/**
 * Build a TempleGridLogocProfile from priors global (or defaults).
 */
export function profileFromPriors(
  priors?: TempleGridLogocPriors | null,
  scenarioId?: string,
): TempleGridLogocProfileLite {
  const w = priors?.global.weights ?? DEFAULT_WEIGHTS;
  const p = priors?.global.penalty_bias ?? DEFAULT_PROFILE.penalties;
  const t = priors?.global.thresholds;
  let weights = w;
  if (priors?.scenarios && scenarioId) {
    const sc = priors.scenarios.find((s) => s.scenario_id === scenarioId);
    if (sc?.weights_override) weights = sc.weights_override;
  }
  return {
    profile_id: 'logoc.temple-grid.v1',
    weights,
    penalties: p,
    thresholds: {
      accept: t?.accept ?? DEFAULT_PROFILE.thresholds.accept,
      review: t?.review ?? DEFAULT_PROFILE.thresholds.review,
      reject: t?.reject_below ?? DEFAULT_PROFILE.thresholds.reject,
    },
  };
}

/** Validate fingerprint baseline_total is within epsilon of formula. */
export function fingerprintBaselineError(
  fp: TempleNodeLogocFingerprint,
  eps: number = 0.02,
): number {
  const expected = baselineFromChannels(
    fp.channels,
    fp.weights,
    sumPenalties(fp.penalty_priors),
  );
  return Math.abs(expected - fp.baseline_total);
}

export function isFingerprintAuditable(
  fp: TempleNodeLogocFingerprint,
  eps: number = 0.02,
): boolean {
  return fingerprintBaselineError(fp, eps) <= eps;
}

/** Count nodes with fingerprints on a grid. */
export function fingerprintCoverage(grid: TempleGrid): {
  total: number;
  withFingerprint: number;
  ratio: number;
} {
  const total = grid.nodes.length;
  const withFingerprint = grid.nodes.filter((n) => n.logoc_fingerprint != null).length;
  return {
    total,
    withFingerprint,
    ratio: total > 0 ? withFingerprint / total : 0,
  };
}
