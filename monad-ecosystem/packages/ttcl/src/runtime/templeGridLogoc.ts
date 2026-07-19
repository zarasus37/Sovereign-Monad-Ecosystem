/**
 * TempleGrid LOGOC profile — three-channel scorer (theo / tech / cosmo)
 * fused with coherence + sovereignty, minus structural penalties.
 *
 * Profile ID: logoc.temple-grid.v1
 * Activated when gridSign / wheelGridSign / materializeSignWithGrid resolves a temple.
 *
 * L = w_t·T + w_x·X + w_c·C + w_h·H + w_s·S − P
 *
 * Uses TempleNode theo_slots / tech_slots / cosmo_slots as first-class evidence
 * (not passive metadata). Compatible with existing scoreSign constitution path.
 */

import type { Domain, Sign, Modality } from '../types.js';
import type { TempleNode, TempleGrid, WheelId, WheelSlotId } from './templeGrid.js';
import { resolveTemple } from './templeGrid.js';
import {
  blendNodeExpectation,
  type TempleGridLogocPriors,
} from './templeGridPriors.js';

// ── Profile ──────────────────────────────────────────────────────────────────

export type TempleGridLogocProfileId = 'logoc.temple-grid.v1';

export interface TempleGridLogocProfile {
  profile_id: TempleGridLogocProfileId;
  weights: {
    theo: number;
    tech: number;
    cosmo: number;
    coherence: number;
    sovereignty: number;
  };
  penalties: {
    unknownNode: number;
    weakConnectivity: number;
    protocolDrift: number;
    domainImbalance: number;
  };
  thresholds: {
    accept: number;
    review: number;
    reject: number;
  };
}

/** Default weights: sacred topology slightly above protocol. */
export const TEMPLE_GRID_LOGOC_V1: TempleGridLogocProfile = {
  profile_id: 'logoc.temple-grid.v1',
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

export type TempleGridLogocVerdict = 'accept' | 'review' | 'reject';

export interface TempleGridLogocPenalties {
  unknownNode: number;
  weakConnectivity: number;
  protocolDrift: number;
  domainImbalance: number;
}

export interface TempleGridLogocBreakdown {
  profile_id: TempleGridLogocProfileId;
  total: number;
  theo_score: number;
  tech_score: number;
  cosmo_score: number;
  coherence_score: number;
  sovereignty_score: number;
  penalties: TempleGridLogocPenalties;
  penalty_sum: number;
  verdict: TempleGridLogocVerdict;
}

/**
 * Optional evidence attached at score time. When signs are grid-derived,
 * callers should set `derived: true` and fill identity/protocol from the node
 * (or call scoreTempleGridNode which builds evidence automatically).
 */
export interface TempleGridSignEvidence {
  temple_id?: string;
  deity_id?: string;
  protocol_version?: string;
  packet_form?: string;
  naming_canonical?: string;
  naming_variants?: string[];
  interop_tags?: string[];
  functions?: string[];
  hymn_signature?: string;
  role_in_grid?: string;
  energy_profile?: string | null;
  ttc_domain?: string;
  /** Provenance: materialized from TempleGrid path */
  source?: string;
  derived?: boolean;
  unsigned_payload?: boolean;
  kill_switch_tripped?: boolean;
  /** Explicit uncertainty for unknown/fragmentary nodes (hymns 28, 39) */
  uncertainty_tagged?: boolean;
}

export interface TempleGridScoreContext {
  wheelId?: WheelId;
  slotId?: WheelSlotId;
  eventType?: string;
  neighboringNodes?: TempleNode[];
  /** Explicit evidence; defaults derived from node when scoring via grid path */
  evidence?: TempleGridSignEvidence;
  /** When true, fill evidence from node slots (grid materialization path) */
  derivedFromGrid?: boolean;
  /**
   * Optional runtime priors overlay. When set with a fingerprint, channels
   * blend fingerprint ⊕ prior before optional baseline anchoring of the live score.
   */
  priors?: TempleGridLogocPriors | null;
  scenarioId?: string;
  /**
   * When true (default if fingerprint present), soft-anchor live channel scores
   * toward blended fingerprint expectation: live' = 0.65·live + 0.35·expected.
   */
  useFingerprintBaseline?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 10000) / 10000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map((x) => x.toLowerCase()));
  let hit = 0;
  for (const x of a) if (setB.has(x.toLowerCase())) hit += 1;
  return hit / Math.max(a.length, 1);
}

function buildEvidenceFromNode(
  node: TempleNode,
  partial?: TempleGridSignEvidence,
): TempleGridSignEvidence {
  return {
    temple_id: node.temple_id,
    deity_id: node.deity.deity_id,
    protocol_version: node.tech_slots.protocol_version,
    packet_form: node.tech_slots.packet_form,
    naming_canonical: node.tech_slots.naming_profile.canonical_name,
    naming_variants: node.tech_slots.naming_profile.variants,
    interop_tags: node.tech_slots.interoperability_tags,
    functions: node.theo_slots.function,
    hymn_signature: node.theo_slots.hymn_signature,
    role_in_grid: node.cosmo_slots.role_in_grid,
    energy_profile: node.cosmo_slots.energy_profile ?? null,
    ttc_domain: 'THEO_TECHNO_COSMO',
    source: 'temple-grid',
    derived: true,
    ...partial,
  };
}

// ── Channel scorers ──────────────────────────────────────────────────────────

/** Theology: sacred role / identity / function alignment. */
export function scoreTheo(
  node: TempleNode,
  sign: Sign<Modality, Domain>,
  evidence: TempleGridSignEvidence,
): number {
  let score = 0;

  // Identity integrity
  if (evidence.temple_id === node.temple_id) score += 0.3;
  if (evidence.deity_id === node.deity.deity_id) score += 0.25;

  // Function alignment (declared theo_slots.function vs evidence functions)
  const funcs = evidence.functions ?? [];
  if (funcs.length === 0 && node.theo_slots.function.length === 0) {
    score += 0.15; // empty-on-empty partial credit
  } else if (overlapRatio(funcs, node.theo_slots.function) >= 0.5) {
    score += 0.25;
  } else if (overlapRatio(funcs, node.theo_slots.function) > 0) {
    score += 0.12;
  }

  // Hymn signature lexical touch
  const sigToks = tokens(node.theo_slots.hymn_signature);
  const evSig = evidence.hymn_signature ? tokens(evidence.hymn_signature) : sigToks;
  if (overlapRatio(evSig, sigToks) >= 0.3) score += 0.1;

  // Relation fidelity — soft: domains include THEOLOGY when major
  if (sign.domains?.includes('THEOLOGY') || sign.domain === 'THEOLOGY') {
    score += 0.1;
  }

  if (node.status === 'unknown' && !evidence.uncertainty_tagged) {
    score *= 0.75;
  }

  return clamp01(score);
}

/** Technology: semantic-protocol envelope compliance. */
export function scoreTech(
  node: TempleNode,
  _sign: Sign<Modality, Domain>,
  evidence: TempleGridSignEvidence,
): number {
  let score = 0;

  if (evidence.protocol_version === node.tech_slots.protocol_version) score += 0.3;

  const canon = node.tech_slots.naming_profile.canonical_name;
  const variants = node.tech_slots.naming_profile.variants ?? [];
  if (
    evidence.naming_canonical === canon ||
    (evidence.naming_canonical && variants.includes(evidence.naming_canonical))
  ) {
    score += 0.25;
  } else if (evidence.derived && evidence.naming_canonical == null) {
    // grid path without explicit name still inherits node envelope
    score += 0.2;
  }

  if (
    evidence.packet_form === node.tech_slots.packet_form ||
    (evidence.derived && evidence.packet_form == null)
  ) {
    score += 0.25;
  }

  const tags = evidence.interop_tags ?? [];
  const nodeTags = node.tech_slots.interoperability_tags;
  if (tags.length === 0 && evidence.derived) {
    score += 0.15;
  } else if (overlapRatio(tags, nodeTags) >= 0.4) {
    score += 0.2;
  } else if (overlapRatio(tags, nodeTags) > 0) {
    score += 0.1;
  }

  return clamp01(score);
}

/** Cosmology: grid topology / role / connectivity. */
export function scoreCosmo(
  node: TempleNode,
  sign: Sign<Modality, Domain>,
  evidence: TempleGridSignEvidence,
  ctx: TempleGridScoreContext,
): number {
  let score = 0;

  // Wheel/slot lineage present when provided
  if (ctx.wheelId && ctx.slotId) {
    score += 0.3;
  } else if (ctx.wheelId || ctx.slotId) {
    score += 0.15;
  } else if (evidence.derived) {
    score += 0.15; // grid-derived without explicit slot still on underlying-grid
  }

  // Role consistency
  if (
    evidence.role_in_grid === node.cosmo_slots.role_in_grid ||
    (evidence.derived && evidence.role_in_grid == null)
  ) {
    score += 0.25;
  }

  // Connectivity awareness
  const degree = node.cosmo_slots.connectivity.degree;
  const edges = node.cosmo_slots.connectivity.edges;
  if (degree === edges.length) {
    score += 0.15; // internal consistency
  }
  if (degree >= 1) {
    score += 0.15;
  } else if (node.status === 'active' && node.cosmo_slots.role_in_grid === 'satellite') {
    score += 0.1; // satellites may be leaf nodes
  }
  if (ctx.neighboringNodes && ctx.neighboringNodes.length > 0) {
    const neighborIds = new Set(ctx.neighboringNodes.map((n) => n.temple_id));
    const edgeHits = edges.filter((e) => neighborIds.has(e.target_temple)).length;
    if (edgeHits > 0) score += 0.1;
  }

  // Energy profile
  if (
    evidence.energy_profile === node.cosmo_slots.energy_profile ||
    (node.cosmo_slots.energy_profile == null && evidence.energy_profile == null) ||
    (evidence.derived && evidence.energy_profile === undefined)
  ) {
    score += 0.1;
  }

  // Cosmology domain presence on sign
  if (sign.domains?.includes('COSMOLOGY') || sign.domain === 'COSMOLOGY') {
    score += 0.05;
  }

  return clamp01(score);
}

/** Cross-domain coherence: low channel spread + TTC domain bonus. */
export function scoreCoherence(
  _node: TempleNode,
  sign: Sign<Modality, Domain>,
  sub: { T: number; X: number; C: number },
  evidence: TempleGridSignEvidence,
): number {
  const spread = Math.max(sub.T, sub.X, sub.C) - Math.min(sub.T, sub.X, sub.C);
  const base = 1 - spread;
  const triadBonus =
    evidence.ttc_domain === 'THEO_TECHNO_COSMO' ||
    (sign.domains?.length ?? 0) >= 3
      ? 0.1
      : 0;
  return clamp01(base + triadBonus);
}

/** Sovereignty: stay inside sovereign monad guardrails. */
export function scoreSovereignty(
  _node: TempleNode,
  _sign: Sign<Modality, Domain>,
  evidence: TempleGridSignEvidence,
  ctx: TempleGridScoreContext,
): number {
  let score = 1.0;

  if (evidence.source !== 'temple-grid' && evidence.derived !== true) {
    score -= 0.25;
  }
  if (ctx.eventType === 'unsafe_bridge' || evidence.kill_switch_tripped) {
    score -= 0.4;
  }
  if (evidence.unsigned_payload) {
    score -= 0.2;
  }

  return clamp01(score);
}

// ── Penalties ────────────────────────────────────────────────────────────────

export function penaltyUnknownNode(
  node: TempleNode,
  profile: TempleGridLogocProfile,
  evidence: TempleGridSignEvidence,
): number {
  if (node.status !== 'unknown') return 0;
  if (evidence.uncertainty_tagged) return profile.penalties.unknownNode * 0.35;
  return profile.penalties.unknownNode;
}

export function penaltyWeakConnectivity(
  node: TempleNode,
  ctx: TempleGridScoreContext,
  profile: TempleGridLogocProfile,
): number {
  const { degree, edges } = node.cosmo_slots.connectivity;
  if (degree !== edges.length) return profile.penalties.weakConnectivity;
  // Hub/gateway with no edges is weak
  if (
    (node.cosmo_slots.role_in_grid === 'hub' ||
      node.cosmo_slots.role_in_grid === 'gateway') &&
    degree === 0
  ) {
    return profile.penalties.weakConnectivity;
  }
  // Expected wheel/slot missing when context claims schedule placement
  if (ctx.eventType === 'scheduled_slot' && (!ctx.wheelId || !ctx.slotId)) {
    return profile.penalties.weakConnectivity * 0.5;
  }
  return 0;
}

export function penaltyProtocolDrift(
  node: TempleNode,
  evidence: TempleGridSignEvidence,
  profile: TempleGridLogocProfile,
): number {
  if (evidence.derived && !evidence.protocol_version) {
    // derived path inherits node protocol — no drift
    return 0;
  }
  if (
    evidence.protocol_version &&
    evidence.protocol_version !== node.tech_slots.protocol_version
  ) {
    return profile.penalties.protocolDrift;
  }
  if (
    evidence.packet_form &&
    evidence.packet_form !== node.tech_slots.packet_form
  ) {
    return profile.penalties.protocolDrift * 0.7;
  }
  if (
    evidence.naming_canonical &&
    evidence.naming_canonical !== node.tech_slots.naming_profile.canonical_name &&
    !(node.tech_slots.naming_profile.variants ?? []).includes(
      evidence.naming_canonical,
    )
  ) {
    return profile.penalties.protocolDrift * 0.5;
  }
  return 0;
}

export function penaltyDomainImbalance(
  sub: { T: number; X: number; C: number },
  profile: TempleGridLogocProfile,
): number {
  const max = Math.max(sub.T, sub.X, sub.C);
  const min = Math.min(sub.T, sub.X, sub.C);
  // Collapse: one high, two low
  if (max >= 0.7 && min <= 0.25 && max - min >= 0.45) {
    return profile.penalties.domainImbalance;
  }
  return 0;
}

// ── Fusion ───────────────────────────────────────────────────────────────────

export function verdictFromTotal(
  total: number,
  profile: TempleGridLogocProfile,
): TempleGridLogocVerdict {
  if (total >= profile.thresholds.accept) return 'accept';
  if (total >= profile.thresholds.review) return 'review';
  return 'reject';
}

/**
 * Score a Sign against a TempleNode under the TempleGrid LOGOC profile.
 * L = w_t T + w_x X + w_c C + w_h H + w_s S − P
 */
export function scoreTempleGridSign(
  sign: Sign<Modality, Domain>,
  node: TempleNode,
  profile: TempleGridLogocProfile = TEMPLE_GRID_LOGOC_V1,
  ctx: TempleGridScoreContext = {},
): TempleGridLogocBreakdown {
  const evidence =
    ctx.derivedFromGrid || ctx.evidence?.derived
      ? buildEvidenceFromNode(node, ctx.evidence)
      : { ...(ctx.evidence ?? {}) };

  let T = scoreTheo(node, sign, evidence);
  let X = scoreTech(node, sign, evidence);
  let C = scoreCosmo(node, sign, evidence, ctx);
  let H = scoreCoherence(node, sign, { T, X, C }, evidence);
  let S = scoreSovereignty(node, sign, evidence, ctx);

  // Soft-anchor live channels toward embedded fingerprint ⊕ runtime prior blend
  const useFp = ctx.useFingerprintBaseline !== false && node.logoc_fingerprint != null;
  if (useFp) {
    const exp = blendNodeExpectation(node, ctx.priors, ctx.scenarioId);
    const liveW = 0.65;
    const fpW = 0.35;
    T = clamp01(liveW * T + fpW * exp.channels.theo);
    X = clamp01(liveW * X + fpW * exp.channels.tech);
    C = clamp01(liveW * C + fpW * exp.channels.cosmo);
    H = clamp01(liveW * H + fpW * exp.channels.coherence);
    S = clamp01(liveW * S + fpW * exp.channels.sovereignty);
  }

  const penalties: TempleGridLogocPenalties = {
    unknownNode: penaltyUnknownNode(node, profile, evidence),
    weakConnectivity: penaltyWeakConnectivity(node, ctx, profile),
    protocolDrift: penaltyProtocolDrift(node, evidence, profile),
    domainImbalance: penaltyDomainImbalance({ T, X, C }, profile),
  };
  const P =
    penalties.unknownNode +
    penalties.weakConnectivity +
    penalties.protocolDrift +
    penalties.domainImbalance;

  const L =
    profile.weights.theo * T +
    profile.weights.tech * X +
    profile.weights.cosmo * C +
    profile.weights.coherence * H +
    profile.weights.sovereignty * S -
    P;

  const total = clamp01(L);

  return {
    profile_id: profile.profile_id,
    total,
    theo_score: round4(T),
    tech_score: round4(X),
    cosmo_score: round4(C),
    coherence_score: round4(H),
    sovereignty_score: round4(S),
    penalties: {
      unknownNode: round4(penalties.unknownNode),
      weakConnectivity: round4(penalties.weakConnectivity),
      protocolDrift: round4(penalties.protocolDrift),
      domainImbalance: round4(penalties.domainImbalance),
    },
    penalty_sum: round4(P),
    verdict: verdictFromTotal(total, profile),
  };
}

/**
 * Resolve node from grid and score with derived-from-grid evidence.
 */
export function scoreTempleGridNode(
  grid: TempleGrid,
  templeId: string,
  sign: Sign<Modality, Domain>,
  profile: TempleGridLogocProfile = TEMPLE_GRID_LOGOC_V1,
  ctx: TempleGridScoreContext = {},
): TempleGridLogocBreakdown {
  const node = resolveTemple(grid, templeId);
  return scoreTempleGridSign(sign, node, profile, {
    ...ctx,
    derivedFromGrid: true,
  });
}
