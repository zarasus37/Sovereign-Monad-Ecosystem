import fs from 'fs';
import path from 'path';
import { CardiaActivationInput, CardiaActivationPolicy, CardiaActivationRecord, CardiaActivationSnapshot } from './types';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function allowsFunding(status: CardiaActivationPolicy['minimumExecutionTruthStatus'], current: CardiaActivationInput['executionTruthStatus']) {
  const order = { blocked: 0, staged: 1, closed: 2 };
  return order[current] >= order[status];
}

export function buildCardiaActivationSnapshot(
  input: CardiaActivationInput,
  policy: CardiaActivationPolicy,
): CardiaActivationSnapshot {
  const blockers: string[] = [];
  const nextActions: string[] = [];

  if (!input.phase1aLiveProofRecorded) {
    blockers.push('live Phase 1a deployment proof is not recorded');
    nextActions.push('complete live Phase 1a deployment proof before funding Cardia');
  }

  if (!input.bootstrapSourceRegistered) {
    blockers.push('bootstrap approved-source registration is not recorded');
    nextActions.push('register the bootstrap approved source before funding Cardia');
  }

  if (!allowsFunding(policy.minimumExecutionTruthStatus, input.executionTruthStatus)) {
    blockers.push(`runtime execution-truth status is ${input.executionTruthStatus}`);
    nextActions.push('close the execution-truth gap before moving capital into Cardia');
  }

  if (input.cardiaDeploymentMode !== 'bounded_ready') {
    blockers.push(`Cardia runtime posture is ${input.cardiaDeploymentMode}`);
    nextActions.push('move Cardia from analysis_only to bounded_ready in the runtime profile');
  }

  if (!input.reserveHealthy) {
    blockers.push('Cardia reserve posture is not healthy');
    nextActions.push('restore reserve health before funding Cardia');
  }

  let status: CardiaActivationSnapshot['status'] = 'blocked';

  if (blockers.length === 0) {
    if (!input.record.walletFunded) {
      status = 'ready_for_funding';
      nextActions.push(`fund the first guarded-live Cardia wallet with at least ${policy.recommendedFirstFundingMon} MON`);
    } else if (
      (policy.requireMultisig && !input.record.multisigDefined) ||
      (policy.requireGuardedLiveCapApproval && !input.record.guardedLiveCapApproved)
    ) {
      status = 'staged';
      if (policy.requireMultisig && !input.record.multisigDefined) {
        blockers.push('multisig composition is not defined');
        nextActions.push('define the multisig path for the first guarded-live session');
      }
      if (policy.requireGuardedLiveCapApproval && !input.record.guardedLiveCapApproved) {
        blockers.push('guarded-live cap approval is missing');
        nextActions.push('approve the initial guarded-live disbursement cap');
      }
    } else if (!input.record.firstDisbursementExecuted || !input.record.liveBankrollRouted) {
      status = 'ready_for_guarded_live';
      if (!input.record.firstDisbursementExecuted) {
        nextActions.push('execute the first bounded Cardia disbursement');
      }
      if (!input.record.liveBankrollRouted) {
        nextActions.push('route the first live bankroll into the guarded-live runtime');
      }
    } else {
      status = 'active';
    }
  }

  return {
    implemented: true,
    status,
    executionTruthStatus: input.executionTruthStatus,
    phase1aLiveProofRecorded: input.phase1aLiveProofRecorded,
    bootstrapSourceRegistered: input.bootstrapSourceRegistered,
    cardiaDeploymentMode: input.cardiaDeploymentMode,
    reserveHealthy: input.reserveHealthy,
    walletFunded: input.record.walletFunded,
    multisigDefined: input.record.multisigDefined,
    guardedLiveCapApproved: input.record.guardedLiveCapApproved,
    firstDisbursementExecuted: input.record.firstDisbursementExecuted,
    liveBankrollRouted: input.record.liveBankrollRouted,
    recommendedFirstFundingMon: policy.recommendedFirstFundingMon,
    maxInitialDisbursementPercent: policy.maxInitialDisbursementPercent,
    blockers,
    nextActions,
    notes: input.record.notes,
  };
}

export function loadLocalCardiaActivationSnapshot(packageRoot: string): CardiaActivationSnapshot {
  const policyPath = path.resolve(packageRoot, 'cardia-activation-core', 'config', 'policy.json');
  const recordPath = path.resolve(packageRoot, 'cardia-activation-core', 'config', 'activation-record.json');
  const runtimeConfigPath = path.resolve(packageRoot, 'organ-runtime', 'config', 'runtime.json');
  const executionTruthModulePath = path.resolve(packageRoot, 'execution-truth-core', 'dist', 'index.js');
  const organRuntimeModulePath = path.resolve(packageRoot, 'organ-runtime', 'dist', 'index.js');

  const policy = readJson<CardiaActivationPolicy>(policyPath);
  const record = readJson<CardiaActivationRecord>(recordPath);
  const runtimeConfig = readJson<any>(runtimeConfigPath);

  const { loadLocalExecutionTruthSnapshot } = require(executionTruthModulePath) as {
    loadLocalExecutionTruthSnapshot: (packageRoot: string) => any;
  };
  const { buildRuntimeSnapshot } = require(organRuntimeModulePath) as {
    buildRuntimeSnapshot: (config: any) => any;
  };

  const executionTruth = loadLocalExecutionTruthSnapshot(packageRoot);
  const runtimeSnapshot = buildRuntimeSnapshot(runtimeConfig);
  const cardia = runtimeSnapshot.cardia || { deploymentMode: 'blocked', reserveHealthy: false };

  return buildCardiaActivationSnapshot(
    {
      executionTruthStatus: executionTruth.status,
      phase1aLiveProofRecorded: executionTruth.phase1aLiveProofRecorded,
      bootstrapSourceRegistered: executionTruth.bootstrapSourceRegistered,
      cardiaDeploymentMode: cardia.deploymentMode,
      reserveHealthy: Boolean(cardia.reserveHealthy),
      record,
    },
    policy,
  );
}
