// ─── Stage C: Monte Carlo Execution ──────────────────────────────────────────
//
// Five agents explore execution paths with seeded reproducible RNG.
// Each agent targets a specific vulnerability class.
// STUB mode: deterministic seeded findings. LIVE mode: plug in live runners.

import type {
  StageCConfig,
  StageCResult,
  AgentCampaignResult,
  AgentFinding,
  AgentId,
  ActionBand,
  Severity,
  StageAResult,
} from './types/hepar.types.js';

// Seeded LCG (same as Stage A for reproducibility)
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function deriveAgentSeed(masterSeed: string, agentIdx: number, protocolId: string): number {
  const str = `${masterSeed}:${agentIdx}:${protocolId}`;
  return str.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9);
}

const AGENTS: AgentId[] = ['PRIVILEGE', 'ARITHMETIC', 'REENTRANCY', 'ECONOMIC', 'STATE'];

const AGENT_DESCRIPTIONS: Record<AgentId, string[]> = {
  PRIVILEGE:   ['Unchecked caller pattern', 'RBAC bypass opportunity', 'Admin function exposed'],
  ARITHMETIC:  ['Integer overflow in calculation', 'Precision loss in division', 'Rounding bias exploitable'],
  REENTRANCY:  ['Call-before-state-update path', 'Delegatecall callback reentry', 'ERC721 hook reentry'],
  ECONOMIC:    ['Frontrunning opportunity', 'Flash loan exploit vector', 'Oracle price manipulation'],
  STATE:       ['Total supply invariant break', 'Locked token path', 'Balance ledger desync'],
};

const SEVERITY_LEVELS: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function voteFromFindings(findings: AgentFinding[]): ActionBand {
  if (findings.some(f => f.severity === 'CRITICAL')) return 'BLOCK';
  if (findings.some(f => f.severity === 'HIGH'))     return 'WARN';
  if (findings.some(f => f.severity === 'MEDIUM'))   return 'INVESTIGATE';
  return 'ALLOW';
}

export class StageC {
  private readonly cfg: Required<StageCConfig>;

  constructor(cfg: StageCConfig = {}) {
    this.cfg = {
      pathsPerAgent:  cfg.pathsPerAgent ?? 50,
      agentsToRun:    cfg.agentsToRun ?? [...AGENTS],
      masterSeed:     cfg.masterSeed ?? 'sovereign-hepar-seed',
      timeoutMs:      cfg.timeoutMs ?? 30_000,
      allowStubMode:  cfg.allowStubMode !== false,
    };
  }

  async execute(protocolId: string, stageAResult: StageAResult): Promise<StageCResult> {
    const t0 = Date.now();
    const campaigns: AgentCampaignResult[] = [];

    const hasCriticalFindings = stageAResult.findings.some(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH',
    );

    for (let idx = 0; idx < this.cfg.agentsToRun.length; idx++) {
      const agentId = this.cfg.agentsToRun[idx];
      const rng = lcg(deriveAgentSeed(this.cfg.masterSeed, idx, protocolId));
      const findings: AgentFinding[] = [];
      const paths = this.cfg.pathsPerAgent;

      for (let p = 0; p < paths; p++) {
        const r = rng();
        // Elevated hit probability when Stage A flagged critical issues
        const threshold = hasCriticalFindings ? 0.35 : 0.08;
        if (r < threshold) {
          const descIdx   = Math.floor(rng() * AGENT_DESCRIPTIONS[agentId].length);
          const sevIdx    = hasCriticalFindings
            ? Math.min(Math.floor(rng() * SEVERITY_LEVELS.length) + 1, 3)
            : Math.floor(rng() * 3);
          findings.push({
            agentId,
            findingId: `${agentId.toLowerCase()}-${protocolId}-p${p}`,
            severity:  SEVERITY_LEVELS[sevIdx],
            confidence: 0.55 + rng() * 0.40,
            description: AGENT_DESCRIPTIONS[agentId][descIdx],
            pathHash: `0x${Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0')}`,
          });
        }
      }

      campaigns.push({
        agentId,
        findings,
        pathsExplored: paths,
        coverageRatio: Math.min(0.3 + rng() * 0.5, 1.0),
        executionTimeMs: Math.floor(rng() * 800 + 100),
        vote: voteFromFindings(findings),
      });
    }

    // Deduplicate by findingId
    const seen = new Set<string>();
    const aggregatedFindings: AgentFinding[] = [];
    for (const c of campaigns) {
      for (const f of c.findings) {
        if (!seen.has(f.findingId)) {
          seen.add(f.findingId);
          aggregatedFindings.push(f);
        }
      }
    }

    return {
      protocolId,
      campaigns,
      aggregatedFindings,
      executionStatus: 'STUB',
      durationMs: Date.now() - t0,
    };
  }
}
