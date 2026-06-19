export type CardiaActivationStatus =
  | 'blocked'
  | 'ready_for_funding'
  | 'staged'
  | 'ready_for_guarded_live'
  | 'active';

export interface CardiaActivationPolicy {
  minimumExecutionTruthStatus: 'blocked' | 'staged' | 'closed';
  requireMultisig: boolean;
  requireGuardedLiveCapApproval: boolean;
  recommendedFirstFundingMon: string;
  maxInitialDisbursementPercent: number;
}

export interface CardiaActivationRecord {
  walletFunded: boolean;
  multisigDefined: boolean;
  guardedLiveCapApproved: boolean;
  firstDisbursementExecuted: boolean;
  liveBankrollRouted: boolean;
  notes: string[];
}

export interface CardiaActivationInput {
  executionTruthStatus: 'blocked' | 'staged' | 'closed';
  phase1aLiveProofRecorded: boolean;
  bootstrapSourceRegistered: boolean;
  cardiaDeploymentMode: 'analysis_only' | 'bounded_ready' | 'blocked';
  reserveHealthy: boolean;
  record: CardiaActivationRecord;
}

export interface CardiaActivationSnapshot {
  implemented: true;
  status: CardiaActivationStatus;
  executionTruthStatus: 'blocked' | 'staged' | 'closed';
  phase1aLiveProofRecorded: boolean;
  bootstrapSourceRegistered: boolean;
  cardiaDeploymentMode: 'analysis_only' | 'bounded_ready' | 'blocked';
  reserveHealthy: boolean;
  walletFunded: boolean;
  multisigDefined: boolean;
  guardedLiveCapApproved: boolean;
  firstDisbursementExecuted: boolean;
  liveBankrollRouted: boolean;
  recommendedFirstFundingMon: string;
  maxInitialDisbursementPercent: number;
  blockers: string[];
  nextActions: string[];
  notes: string[];
}
