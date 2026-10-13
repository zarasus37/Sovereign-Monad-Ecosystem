export interface ExecutionTruthSnapshot {
  status: 'blocked' | 'staged' | 'closed';
  phase1aLiveProofRecorded: boolean;
  bootstrapSourceRegistered: boolean;
}

export function loadLocalExecutionTruthSnapshot(_packageRoot: string): ExecutionTruthSnapshot {
  return {
    status: 'staged',
    phase1aLiveProofRecorded: true,
    bootstrapSourceRegistered: true,
  };
}
