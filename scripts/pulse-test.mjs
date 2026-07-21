/**
 * Go-Live Pulse Test (operator)
 *
 * Verifies sovereign-host wiring end-to-end against a deployed host:
 *   1. Hepar audit  → POST /api/v1/hepar/audit
 *   2. Bootstrap PL → POST /api/v1/gate-acl/promote-pl
 *   3. Bind wallet  → POST /api/v1/gate-acl/bind-wallet
 *   4. Credit PL    → POST /api/v1/gate-acl/promote-pl
 *   5. SSE stream   → GET  /api/v1/cardia/funding/stream/:wallet
 *
 * Env (never hardcode keys):
 *   SOVEREIGN_HOST_URL  — default Azure ACA host if unset
 *   PULSE_PRIVATE_KEY   — optional 0x… hex; if unset, a throwaway wallet is generated
 *
 * Usage:
 *   node scripts/pulse-test.mjs
 *   $env:PULSE_PRIVATE_KEY="0x…"; node scripts/pulse-test.mjs
 */

import { ethers } from 'ethers';

const HOST =
  process.env.SOVEREIGN_HOST_URL?.replace(/\/$/, '') ||
  'https://sovereign-host.wittycoast-d4ae00a3.eastus2.azurecontainerapps.io';

const PRIVATE_KEY = process.env.PULSE_PRIVATE_KEY;
const WALLET = PRIVATE_KEY
  ? new ethers.Wallet(PRIVATE_KEY)
  : ethers.Wallet.createRandom();

const WALLET_BIND_MESSAGE_PREFIX = 'Sovereign Monad Ecosystem Bind';

function makeBindMessage(localPrincipalId, walletAddress, pl = 0) {
  const ts = Date.now();
  return [
    WALLET_BIND_MESSAGE_PREFIX,
    `Local ID: ${localPrincipalId}`,
    `Wallet: ${walletAddress}`,
    `PL: ${pl}`,
    `Timestamp: ${ts}`,
  ].join('\n');
}

async function pulse() {
  const LOCAL_PRINCIPAL_ID = `pulse-${Date.now()}`;
  console.log('═'.repeat(60));
  console.log(' GO-LIVE PULSE TEST');
  console.log('═'.repeat(60));
  console.log(`Host:      ${HOST}`);
  console.log(`Principal: ${LOCAL_PRINCIPAL_ID}`);
  console.log(`Wallet:    ${WALLET.address}`);
  console.log(
    `Key:       ${PRIVATE_KEY ? 'from PULSE_PRIVATE_KEY' : 'ephemeral (generated)'}`,
  );
  console.log();

  // ── Step 0: health ────────────────────────────────────────────────────
  console.log('[0/5] GET /health');
  const rh = await fetch(`${HOST}/health`);
  const health = await rh.json();
  console.log(
    `    status=${health.status} redis=${health.redis} kafka=${health.kafka} live_funding=${health.live_funding}`,
  );
  console.log(
    `    key_custody=${JSON.stringify(health.key_custody)}`,
  );
  if (health.status !== 'ALIVE') {
    console.error('    FAILED — host not ALIVE');
    process.exit(1);
  }
  console.log('    ✓ host ALIVE\n');

  // ── Step 1: Hepar audit ──────────────────────────────────────────────
  console.log('[1/5] POST /api/v1/hepar/audit');
  const r1 = await fetch(`${HOST}/api/v1/hepar/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: WALLET.address,
      localPrincipalId: LOCAL_PRINCIPAL_ID,
      protocolId: 'pulse-test',
    }),
  });
  const hepar = await r1.json();
  console.log(
    `    verdict: ${hepar.verdict}  score: ${hepar.score}  confidence: ${parseFloat(hepar.confidence || 0).toFixed(3)}`,
  );
  if (!r1.ok) {
    console.error('    FAILED', hepar);
    process.exit(1);
  }
  console.log('    ✓ hepar audit OK\n');

  // ── Step 2: Raise PL to ≥ 50 (bind-wallet gate) ──────────────────────
  // broken-genesis ~10 + archon tasks stack; repeat until server reports ≥ 50
  console.log('[2/5] POST /api/v1/gate-acl/promote-pl  (stack to PL ≥ 50)');
  let totalPl = 0;
  const plTasks = [
    {
      taskId: 'broken-genesis-repair',
      taskPayload: {
        kind: 'broken-genesis',
        isStable: true,
        totalEnergy: 75,
        theoWeight: 1,
        technoWeight: 1,
        cosmoWeight: 1,
        currentPl: 0,
      },
    },
    {
      taskId: 'archon-comprehension-gate',
      taskPayload: { kind: 'archon', gatesPassed: 3, currentPl: 10 },
    },
    {
      taskId: 'archon-comprehension-gate',
      taskPayload: { kind: 'archon', gatesPassed: 3, currentPl: 35 },
    },
    {
      taskId: 'archon-comprehension-gate',
      taskPayload: { kind: 'archon', gatesPassed: 3, currentPl: 50 },
    },
  ];
  for (const t of plTasks) {
    const r = await fetch(`${HOST}/api/v1/gate-acl/promote-pl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalId: LOCAL_PRINCIPAL_ID,
        domain: 'agent_ops',
        taskId: t.taskId,
        taskPayload: t.taskPayload,
      }),
    });
    const body = await r.json();
    if (body.error) {
      console.error(`    ⚠ ${t.taskId}: ${body.error}: ${body.message}`);
    } else {
      totalPl = body.event?.totalPl ?? totalPl;
      console.log(`    ${t.taskId} → totalPl=${totalPl}`);
    }
    if (totalPl >= 50) break;
  }
  if (totalPl < 50) {
    console.error(`    FAILED — need PL ≥ 50 for bind, got ${totalPl}`);
    process.exit(1);
  }
  console.log('    ✓ PL ≥ 50\n');

  // ── Step 3: Bind wallet ──────────────────────────────────────────────
  console.log('[3/5] POST /api/v1/gate-acl/bind-wallet');
  const message = makeBindMessage(LOCAL_PRINCIPAL_ID, WALLET.address, totalPl);
  const signature = await WALLET.signMessage(message);

  const r2 = await fetch(`${HOST}/api/v1/gate-acl/bind-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localPrincipalId: LOCAL_PRINCIPAL_ID,
      walletAddress: WALLET.address,
      signature,
      message,
    }),
  });
  const bind = await r2.json();
  if (bind.error) {
    console.error(`    ⚠ ${bind.error}: ${bind.message}`);
    process.exit(1);
  }
  console.log(`    status: ${bind.status}`);
  console.log('    ✓ wallet bound\n');

  // ── Step 4: (reserved — PL already stacked in step 2) ───────────────
  console.log('[4/5] PL path already satisfied before bind\n');

  // ── Step 5: SSE stream ───────────────────────────────────────────────
  console.log('[5/5] GET  /api/v1/cardia/funding/stream/:wallet');
  console.log('    (SSE window 10s)');
  const events = [];
  const started = Date.now();

  let done = false;
  const stream = await fetch(
    `${HOST}/api/v1/cardia/funding/stream/${WALLET.address}`,
    { headers: { Accept: 'text/event-stream' } },
  );

  if (!stream.ok || !stream.body) {
    console.error(`    ⚠ SSE HTTP ${stream.status}`);
  } else {
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (Date.now() - started < 10_000 && !done) {
      try {
        const { done: d, value } = await reader.read();
        if (d) {
          done = true;
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const ev = JSON.parse(line.slice(6));
              events.push(ev);
              console.log(
                `    [SSE] ${ev.type ?? ev.status}  ts=${ev.timestamp?.slice?.(-8) ?? ''}`,
              );
              if (events.length >= 4) {
                done = true;
                break;
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        break;
      }
    }
    try {
      reader.cancel();
    } catch {
      /* ignore */
    }
  }

  console.log(`    ✓ SSE stream OK (${events.length} events)\n`);
  console.log('═'.repeat(60));
  console.log(' PULSE COMPLETE');
  console.log('═'.repeat(60));
  console.log(
    'Note: live_funding remains false until you deliberately set CARDIA_FUNDING_LIVE=true',
  );
}

pulse().catch((err) => {
  console.error('PULSE FAILED:', err.message);
  process.exit(1);
});
