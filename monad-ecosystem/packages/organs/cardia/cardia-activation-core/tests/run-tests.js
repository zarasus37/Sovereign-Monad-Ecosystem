import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist', 'index.js');
const distUrl = new URL(`file://${distPath.replace(/\\/g, '/')}`);
const { buildCardiaActivationSnapshot, loadLocalCardiaActivationSnapshot } = await import(distUrl);

const basePolicy = {
  minimumExecutionTruthStatus: 'staged',
  requireMultisig: true,
  requireGuardedLiveCapApproval: true,
  recommendedFirstFundingMon: '10',
  maxInitialDisbursementPercent: 10,
};

test('buildCardiaActivationSnapshot blocks before live proof and execution truth', () => {
  const snapshot = buildCardiaActivationSnapshot(
    {
      executionTruthStatus: 'blocked',
      phase1aLiveProofRecorded: false,
      bootstrapSourceRegistered: false,
      cardiaDeploymentMode: 'analysis_only',
      reserveHealthy: true,
      record: {
        walletFunded: false,
        multisigDefined: false,
        guardedLiveCapApproved: false,
        firstDisbursementExecuted: false,
        liveBankrollRouted: false,
        notes: [],
      },
    },
    basePolicy,
  );

  assert.equal(snapshot.status, 'blocked');
  assert.ok(snapshot.blockers.includes('live Phase 1a deployment proof is not recorded'));
});

test('buildCardiaActivationSnapshot reaches ready_for_guarded_live only after funding and guardrails', () => {
  const snapshot = buildCardiaActivationSnapshot(
    {
      executionTruthStatus: 'closed',
      phase1aLiveProofRecorded: true,
      bootstrapSourceRegistered: true,
      cardiaDeploymentMode: 'bounded_ready',
      reserveHealthy: true,
      record: {
        walletFunded: true,
        multisigDefined: true,
        guardedLiveCapApproved: true,
        firstDisbursementExecuted: false,
        liveBankrollRouted: false,
        notes: [],
      },
    },
    basePolicy,
  );

  assert.equal(snapshot.status, 'ready_for_guarded_live');
});

test('loadLocalCardiaActivationSnapshot reflects the current ready_for_funding local posture', async () => {
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const snapshot = await loadLocalCardiaActivationSnapshot(packageRoot);
  assert.equal(snapshot.implemented, true);
  assert.equal(snapshot.status, 'ready_for_funding');
  assert.equal(snapshot.walletFunded, false);
});
