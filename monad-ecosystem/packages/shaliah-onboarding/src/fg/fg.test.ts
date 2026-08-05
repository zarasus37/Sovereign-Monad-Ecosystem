import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Wallet } from 'ethers';
import { FG_LESSONS, FG1_LESSON_IDS, getLesson } from './curriculum.js';
import {
  attemptFg1Gate,
  attemptFg2Gate,
  attemptFg3Gate,
  completeLessonsForGate,
  setUserRate,
  startFgSession,
  FG_R_DEFAULT,
} from './fgSession.js';
import { evaluateFg2Gate } from './gates.js';
import { verifyMeshaleachPoC } from './meshaleachPoCMint.js';

describe('FG curriculum catalog', () => {
  it('has 14 content lessons L1.1–L3.4', () => {
    assert.equal(FG_LESSONS.length, 14);
    assert.equal(FG1_LESSON_IDS.length, 5);
    assert.ok(getLesson('L3.4'));
  });
});

describe('FG session', () => {
  it('locks r until FG-3 and unlocks rate sovereignty', async () => {
    const s = startFgSession('mesh-1');
    assert.equal(s.r, FG_R_DEFAULT);
    assert.equal(s.rLocked, true);

    completeLessonsForGate(s, 'fg1', 1_000);
    const g1 = await attemptFg1Gate(
      s,
      {
        defiRisk: 'Safer pool with audit; risks include liquidity and smart contract drawdown.',
        timePreference: 'I trade time for compound future growth with patience.',
        realEconomy: 'Storage and time cost of waiting on commodity demand.',
        claimExplain: 'My claim is units; NAV is the collective pool value of funds.',
      },
      2_000,
    );
    assert.equal(g1.passed, true);
    assert.equal(s.unlocked.safeDeployMenu, true);
    assert.equal(s.state, 'fg1_passed');

    completeLessonsForGate(s, 'fg2', 3_000);
    const g2fail = evaluateFg2Gate('mesh-1', {
      channelAlloc: 'claim community job escrow split with commons care',
      drawdown: 'I will not panic; I assess risk and take coherent action on loss.',
      highRiskAction: 'autopilot',
      highRiskReason: 'whatever',
      liquidityChoice: 'soft window with emergency path not hard vault',
      stewardshipExplain: 'Stewardship means my claim sits in a shared pool I care for.',
    });
    assert.equal(g2fail.passed, false);

    const g2 = await attemptFg2Gate(
      s,
      {
        channelAlloc: 'I fund claim community and job escrow without pure private hoarding.',
        drawdown: 'Loss is information; I assess risk and act without panic or freeze.',
        highRiskAction: 'refuse',
        highRiskReason: 'Risk tier too high for my current envelope.',
        liquidityChoice: 'soft commitment windows with emergency hardship path.',
        stewardshipExplain: 'Stewardship: human claim in a shared pool I do not exploit.',
      },
      4_000,
    );
    assert.equal(g2.passed, true, g2.failures.join('; '));
    assert.equal(s.unlocked.highRiskConfirm, true);

    completeLessonsForGate(s, 'fg3', 5_000);
    const g3 = await attemptFg3Gate(
      s,
      {
        ratePredictions:
          'At 5% less claim growth; at 20% default; at 30% more claim and commons from eligible C.',
        boundsDefense: 'Floor protects pool and commons; ceiling limits liquidity stress; zero starves pool.',
        chosenR: 0.15,
        chosenRReason: 'Balanced claim growth with room for near-term goals.',
        escalate: 'refuse',
        escalateReason: 'Prefer stable r this season.',
        covenantStatement: 'I set r; Shaliah does not; my claim stays mine.',
      },
      6_000,
    );
    assert.equal(g3.passed, true, g3.failures.join('; '));
    assert.equal(s.state, 'fg3_passed');
    assert.equal(s.rLocked, false);
    assert.equal(s.unlocked.rateSovereignty, true);
    assert.equal(s.r, 0.15);

    const denied = setUserRate(s, 0.1, 6_001);
    assert.equal(denied.ok, false); // cooldown

    const okLater = setUserRate(s, 0.1, 6_000 + 31 * 24 * 60 * 60 * 1000);
    assert.equal(okLater.ok, true);
    assert.equal(s.r, 0.1);
  });

  it('mints EIP-191 MeshaleachPoC with merkle-sd on gate pass', async () => {
    const wallet = Wallet.createRandom();
    const s = startFgSession('mesh-poc');
    completeLessonsForGate(s, 'fg1', 1_000);
    const g1 = await attemptFg1Gate(
      s,
      {
        defiRisk: 'Safer pool with audit; risks include liquidity and smart contract drawdown.',
        timePreference: 'I trade time for compound future growth with patience.',
        realEconomy: 'Storage and time cost of waiting on commodity demand.',
        claimExplain: 'My claim is units; NAV is the collective pool value of funds.',
      },
      2_000,
      { signer: wallet, walletAddress: wallet.address, withMerkleDisclosure: true },
    );
    assert.equal(g1.passed, true);
    assert.equal(s.meshaleachSeals.length, 1);
    const poc = s.meshaleachSeals[0]!;
    assert.equal(poc.gate, 'fg1');
    assert.equal(poc.proof.system, 'merkle-sd');
    assert.ok(poc.proof.merkle);
    const v = verifyMeshaleachPoC(poc, { expectedAddress: wallet.address });
    assert.equal(v.ok, true, v.ok ? '' : v.error);
    assert.ok(s.events.some((e) => e.kind === 'fg.meshaleach_poc_minted'));
  });

  it('rejects r outside bounds after FG-3', () => {
    const s = startFgSession('mesh-2');
    s.state = 'fg3_passed';
    s.rLocked = false;
    s.unlocked = {
      claimStatement: true,
      safeDeployMenu: true,
      highRiskConfirm: true,
      rateSovereignty: true,
      domainTags: ['fg3.rate_sovereignty'],
    };
    assert.equal(setUserRate(s, 0).ok, false);
    assert.equal(setUserRate(s, 0.5).ok, false);
  });
});
