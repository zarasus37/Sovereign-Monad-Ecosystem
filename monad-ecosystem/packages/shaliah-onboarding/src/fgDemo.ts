/**
 * CLI demo: FG-1 → FG-3 happy path with optional EIP-191 MeshaleachPoC mint.
 */
import { Wallet } from 'ethers';
import {
  attemptFg1Gate,
  attemptFg2Gate,
  attemptFg3Gate,
  completeLessonsForGate,
  startFgSession,
} from './fg/fgSession.js';
import { composeShaliahPrompt } from './prompts/shaliahOffices.js';
import { getLesson } from './fg/curriculum.js';

const principalId = 'demo-meshaleach';
const wallet = Wallet.createRandom();
const s = startFgSession(principalId);
const mint = {
  signer: wallet,
  walletAddress: wallet.address,
  withMerkleDisclosure: true,
};

console.log('=== FG session start ===');
console.log({ r: s.r, rLocked: s.rLocked, state: s.state, wallet: wallet.address });

completeLessonsForGate(s, 'fg1');
const g1 = await attemptFg1Gate(
  s,
  {
    defiRisk: 'Safer audited pool; liquidity risk and smart contract risk named first.',
    timePreference: 'I accept time for compound future growth with patience.',
    realEconomy: 'Commodity storage has time and demand cost of waiting.',
    claimExplain: 'Units are my claim; NAV is collective pool funds.',
  },
  Date.now(),
  mint,
);
console.log('FG-1', g1.passed, s.unlocked, 'seals', s.meshaleachSeals.length);

completeLessonsForGate(s, 'fg2');
const g2 = await attemptFg2Gate(
  s,
  {
    channelAlloc: 'claim community job escrow with care for commons',
    drawdown: 'I assess risk and act; no panic freeze on loss.',
    highRiskAction: 'confirm',
    highRiskReason: 'Within my understanding; I accept high risk consciously.',
    liquidityChoice: 'soft window plus emergency path',
    stewardshipExplain: 'Human steward of claim in shared pool.',
  },
  Date.now(),
  mint,
);
console.log('FG-2', g2.passed, g2.failures, 'seals', s.meshaleachSeals.length);

completeLessonsForGate(s, 'fg3');
const g3 = await attemptFg3Gate(
  s,
  {
    ratePredictions: '5% slower claim; 20% default; 30% more claim and commons from eligible C.',
    boundsDefense: 'Floor stops zero pool death; ceiling limits liquidity stress.',
    chosenR: 0.18,
    chosenRReason: 'Slightly under default for near-term flexibility.',
    escalate: 'accept',
    escalateReason: 'I consent to +2pp next season.',
    covenantStatement: 'I set r; Shaliah does not; my claim stays mine.',
  },
  Date.now(),
  mint,
);
console.log('FG-3', g3.passed, {
  r: s.r,
  rateSovereignty: s.unlocked.rateSovereignty,
  seals: s.meshaleachSeals.map((p) => ({
    gate: p.gate,
    system: p.proof.system,
    domain: p.domain_tag,
  })),
});

const lesson = getLesson('L3.3')!;
const prompt = composeShaliahPrompt({
  office: 'coach',
  fgStage: 'rate_sovereign',
  lessonId: lesson.id,
  lessonDeepRule: lesson.deepRule,
});
console.log('\n=== Sample Shaliah coach prompt (truncated) ===\n');
console.log(prompt.system.slice(0, 900) + '\n…');
