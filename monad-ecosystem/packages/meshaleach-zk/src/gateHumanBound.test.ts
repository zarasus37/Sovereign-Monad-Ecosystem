import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { artifactsReady } from './paths.js';
import { proveGateHumanBound, verifyGateHumanBound } from './gateHumanBound.js';

describe('gate_human_bound Groth16', () => {
  it('artifacts are built', () => {
    assert.equal(
      artifactsReady(),
      true,
      'run pnpm --filter @sovereign/meshaleach-zk build:circuit first',
    );
  });

  it('proves and verifies gate_passed ∧ human_bound', async () => {
    if (!artifactsReady()) return;
    const salt = BigInt('12345678901234567890');
    const bundle = await proveGateHumanBound({
      gate_passed: 1,
      human_bound: 1,
      salt,
    });
    assert.equal(bundle.public.out_gate, '1');
    assert.equal(bundle.public.out_human, '1');
    assert.ok(bundle.public.commit);
    const ok = await verifyGateHumanBound(bundle);
    assert.equal(ok, true);
  });

  it('rejects prove when gate is 0', async () => {
    if (!artifactsReady()) return;
    await assert.rejects(
      () =>
        proveGateHumanBound({
          gate_passed: 0,
          human_bound: 1,
          salt: 42n,
        }),
      /requires gate_passed=1/,
    );
  });
});
