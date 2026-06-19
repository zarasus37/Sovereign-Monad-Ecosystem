import * as fs from 'fs';
import * as path from 'path';

export interface EvaluationResult {
  hasPhase1aProof: boolean;
  hasBootstrapSource: boolean;
  hasRuntimeHardening: boolean;
  hasGuardedLiveDocs: boolean;
  hasExecutionRecord: boolean;
  isReady: boolean;
}

export class ExecutionTruthValidator {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public evaluate(): EvaluationResult {
    // Check for artifacts to confirm proof state
    // We expect the proof files to be located in specific parts of the workspace, such as docs/ or agents/monad-mev/
    
    const phase1aProofPath = path.join(this.workspaceRoot, 'agents', 'monad-mev', 'deployments', 'phase1a.proof.json');
    const hasPhase1aProof = fs.existsSync(phase1aProofPath);

    const bootstrapSourcePath = path.join(this.workspaceRoot, 'agents', 'monad-mev', 'config', 'bootstrap.json');
    const hasBootstrapSource = fs.existsSync(bootstrapSourcePath);

    // Hardening might be validated by the presence of a hardened script or configuration
    const runtimeHardeningPath = path.join(this.workspaceRoot, 'agents', 'monad-mev', 'organ-runtime', 'hardened_runtime.json');
    const hasRuntimeHardening = fs.existsSync(runtimeHardeningPath);

    const guardedLiveDocsPath = path.join(this.workspaceRoot, 'agents', 'monad-mev', 'docs', 'GUARDED_LIVE.md');
    const hasGuardedLiveDocs = fs.existsSync(guardedLiveDocsPath);

    const executionRecordPath = path.join(this.workspaceRoot, 'agents', 'monad-mev', 'diagnostics', 'guarded_live_execution.json');
    const hasExecutionRecord = fs.existsSync(executionRecordPath);

    const isReady = hasPhase1aProof && hasBootstrapSource && hasRuntimeHardening && hasGuardedLiveDocs && hasExecutionRecord;

    return {
      hasPhase1aProof,
      hasBootstrapSource,
      hasRuntimeHardening,
      hasGuardedLiveDocs,
      hasExecutionRecord,
      isReady
    };
  }
}
