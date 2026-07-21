// ─── HeparOrchestrator ────────────────────────────────────────────────────────
//
// Coordinates the full 4-stage forensic pipeline: A → B → C → D.
// Supports full pipeline execution and partial (up-to-stage) runs.

import { StageA } from './stageA';
import { StageB } from './stageB';
import { StageC } from './stageC';
import { StageD } from './stageD';
import type {
  HeparOrchestratorConfig,
  HeparPipelineResult,
} from './types/hepar.types';

export class HeparOrchestrator {
  private readonly stageA: StageA;
  private readonly stageB: StageB;
  private readonly stageC: StageC;
  private readonly stageD: StageD;

  constructor(cfg: HeparOrchestratorConfig = {}) {
    this.stageA = new StageA(cfg.stageA);
    this.stageB = new StageB(cfg.stageB);
    this.stageC = new StageC(cfg.stageC);
    this.stageD = new StageD(cfg.stageD);
  }

  async executeFullPipeline(
    protocolId: string,
    addresses: string[],
  ): Promise<HeparPipelineResult> {
    const t0 = Date.now();

    const stageA = await this.stageA.analyze(protocolId, addresses);
    const stageB = await this.stageB.prove(protocolId, stageA);
    const stageC = await this.stageC.execute(protocolId, stageA);
    const stageD = this.stageD.fuse(stageA, stageB, stageC);

    return { protocolId, addresses, stageA, stageB, stageC, stageD, totalDurationMs: Date.now() - t0 };
  }

  async executeUpToStage(
    upTo: 'A' | 'B' | 'C' | 'D',
    protocolId: string,
    addresses: string[],
  ): Promise<HeparPipelineResult> {
    const t0 = Date.now();
    const result: HeparPipelineResult = { protocolId, addresses, totalDurationMs: 0 };

    result.stageA = await this.stageA.analyze(protocolId, addresses);
    if (upTo === 'A') { result.totalDurationMs = Date.now() - t0; return result; }

    result.stageB = await this.stageB.prove(protocolId, result.stageA);
    if (upTo === 'B') { result.totalDurationMs = Date.now() - t0; return result; }

    result.stageC = await this.stageC.execute(protocolId, result.stageA);
    if (upTo === 'C') { result.totalDurationMs = Date.now() - t0; return result; }

    result.stageD = this.stageD.fuse(result.stageA, result.stageB, result.stageC);
    result.totalDurationMs = Date.now() - t0;
    return result;
  }
}

export function createDefaultHeparOrchestrator(): HeparOrchestrator {
  return new HeparOrchestrator({
    stageA: { bytecodeThreshold: 500, patternMatchingDepth: 2 },
    stageB: { timeoutPerInvariant: 5000, allowStubMode: true },
    stageC: { pathsPerAgent: 50, timeoutMs: 30_000, allowStubMode: true },
    stageD: { consensusThreshold: 0.4, allowPartialConsensus: true },
  });
}
