// ─── Stage D: Consensus Fusion ────────────────────────────────────────────────
//
// Merges Stage B proved violations and Stage C agent votes into a single
// final decision: BLOCK, WARN, INVESTIGATE, or ALLOW.
// Generates an attestation payload for downstream integration.

import type {
  StageDConfig,
  StageDResult,
  AttestationPayload,
  StageBResult,
  StageCResult,
  StageAResult,
  ActionBand,
  Severity,
} from './types/hepar.types.js';

const DEFAULT_WEIGHTS: Record<ActionBand, number> = {
  BLOCK:       2.0,
  WARN:        1.0,
  INVESTIGATE: 0.5,
  ALLOW:       0.0,
};

const ACTION_BAND_ORDER: ActionBand[] = ['BLOCK', 'WARN', 'INVESTIGATE', 'ALLOW'];

function topSeverity(stageA: StageAResult): Severity | null {
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  for (const s of order) {
    if (stageA.findings.some(f => f.severity === s)) return s;
  }
  return null;
}

function escalationPaths(decision: ActionBand): string[] {
  switch (decision) {
    case 'BLOCK':       return ['BLOCK:halt_cardia_funding', 'BLOCK:emit_hepar_fail_event', 'BLOCK:notify_operator'];
    case 'WARN':        return ['WARN:flag_for_review', 'WARN:reduce_funding_cap'];
    case 'INVESTIGATE': return ['INVESTIGATE:queue_human_review'];
    default:            return [];
  }
}

export class StageD {
  private readonly cfg: Required<StageDConfig>;

  constructor(cfg: StageDConfig = {}) {
    this.cfg = {
      consensusThreshold:   cfg.consensusThreshold ?? 0.5,
      severityWeights:      { ...DEFAULT_WEIGHTS, ...(cfg.severityWeights ?? {}) },
      allowPartialConsensus: cfg.allowPartialConsensus !== false,
    };
  }

  fuse(
    stageA: StageAResult,
    stageB: StageBResult,
    stageC: StageCResult,
  ): StageDResult {
    const t0 = Date.now();
    const votes: Record<string, ActionBand> = {};

    // Votes from Stage B proved violations
    for (const v of stageB.violations) {
      if (v.proved) {
        votes[`stageB:${v.findingId}`] =
          v.severity === 'CRITICAL' || v.severity === 'HIGH' ? 'BLOCK'
          : v.severity === 'MEDIUM' ? 'WARN'
          : 'INVESTIGATE';
      }
    }

    // Votes from Stage C agents
    for (const campaign of stageC.campaigns) {
      votes[`stageC:${campaign.agentId}`] = campaign.vote;
    }

    // Tally weighted votes
    const tally: Record<ActionBand, number> = { BLOCK: 0, WARN: 0, INVESTIGATE: 0, ALLOW: 0 };
    const totalVotes = Object.values(votes).length;
    for (const v of Object.values(votes)) {
      tally[v] += this.cfg.severityWeights[v] ?? 1.0;
    }

    // Determine consensus decision (highest weighted band meeting threshold)
    let decision: ActionBand = 'ALLOW';
    const totalWeight = Object.values(tally).reduce((a, b) => a + b, 0);
    for (const band of ACTION_BAND_ORDER) {
      const ratio = totalWeight > 0 ? tally[band] / totalWeight : 0;
      if (ratio >= this.cfg.consensusThreshold) {
        decision = band;
        break;
      }
    }

    // Confidence = ratio of winning band
    const winWeight = tally[decision];
    const confidence = totalWeight > 0 ? Math.min(winWeight / totalWeight, 1.0) : 0.0;

    const protocolId = stageA.protocolId;
    const top = topSeverity(stageA);

    const attestation: AttestationPayload = {
      protocolId,
      decision,
      confidence,
      timestamp:      new Date().toISOString(),
      stageAFindings: stageA.findings.length,
      stageBViolations: stageB.violations.filter(v => v.proved).length,
      stageCCampaigns:  stageC.campaigns.length,
      topSeverity:    top ?? 'LOW',
      executionStatus: 'STUB',
    };

    return {
      protocolId,
      decision,
      confidence,
      votes,
      attestation,
      escalationPaths: escalationPaths(decision),
      executionStatus: 'STUB',
      durationMs: Date.now() - t0,
    };
  }
}
