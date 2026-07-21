// ─── Stage A: Static Forensics ────────────────────────────────────────────────
//
// Analyzes wallet and contract addresses for bytecode-level patterns:
// proxy admin signals, LP unlock vectors, taint patterns, and anomalies.
// Operates in STUB mode (deterministic seeded scoring) ready for live hooks.

import type { StageAConfig, StageAResult, StaticFinding, PatternType, Severity } from './types/hepar.types.js';

// Simple seeded LCG for deterministic, reproducible findings
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function addressToSeed(address: string): number {
  return address.toLowerCase().split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
}

const KNOWN_MALICIOUS_PREFIXES = ['0xdead', '0x0000000000000000000000000000000000000001'];

function isFlaggedAddress(address: string): boolean {
  return KNOWN_MALICIOUS_PREFIXES.some(p => address.toLowerCase().startsWith(p));
}

const PATTERN_TABLE: Array<{ pattern: PatternType; label: string }> = [
  { pattern: 'PROXY_ADMIN',       label: 'Upgradeable proxy admin slot detected' },
  { pattern: 'LP_UNLOCK',         label: 'Liquidity provider unlock signal present' },
  { pattern: 'WALLET_TAINT',      label: 'Wallet associated with adverse history' },
  { pattern: 'ADVERSARIAL_SIGNAL',label: 'Adversarial interaction pattern found' },
  { pattern: 'BYTECODE_ANOMALY',  label: 'Non-standard bytecode region detected' },
];

const SEVERITY_LEVELS: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class StageA {
  private readonly cfg: Required<StageAConfig>;

  constructor(cfg: StageAConfig = {}) {
    this.cfg = {
      bytecodeThreshold: cfg.bytecodeThreshold ?? 500,
      patternMatchingDepth: cfg.patternMatchingDepth ?? 2,
    };
  }

  async analyze(protocolId: string, addresses: string[]): Promise<StageAResult> {
    const t0 = Date.now();
    const findings: StaticFinding[] = [];

    for (const address of addresses) {
      const rng = lcg(addressToSeed(address));
      const isBad = isFlaggedAddress(address);

      // Always emit WALLET_TAINT finding for flagged addresses
      if (isBad) {
        findings.push({
          id: `stageA-${protocolId}-${address}-taint`,
          pattern: 'WALLET_TAINT',
          severity: 'CRITICAL',
          confidence: 0.98,
          description: `Known adverse wallet marker: ${address}`,
          address,
        });
      }

      // Probabilistic pattern scan (deterministic by address seed)
      const depth = this.cfg.patternMatchingDepth;
      for (let i = 0; i < PATTERN_TABLE.length; i++) {
        const prob = rng();
        if (prob < (isBad ? 0.7 : 0.15) * (depth / 3)) {
          const sevIdx = Math.floor(rng() * SEVERITY_LEVELS.length);
          const { pattern, label } = PATTERN_TABLE[i];
          findings.push({
            id: `stageA-${protocolId}-${address}-${pattern}`,
            pattern,
            severity: SEVERITY_LEVELS[sevIdx],
            confidence: 0.5 + rng() * 0.45,
            description: `${label} — address ${address}`,
            address,
          });
        }
      }
    }

    return {
      protocolId,
      addresses,
      findings,
      executionStatus: 'STUB',
      durationMs: Date.now() - t0,
    };
  }
}
