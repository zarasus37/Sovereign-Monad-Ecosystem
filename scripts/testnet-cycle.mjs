#!/usr/bin/env node
/**
 * testnet-cycle.mjs — automated testnet cycle for the Cardia funding engine.
 *
 * 1. Runs the Meshaleach UI walk (Phase 1-4) to bring the consumer surface to
 *    `plScore >= 50` (so wallet-bind is enabled and the funding engine accepts
 *    the trigger).
 * 2. POSTs /api/v1/cardia/funding/trigger with the test wallet address.
 * 3. Verifies the response: parses the FundingMandate, checks that the engine
 *    returned a real status (TX_SYNTHESIZED for dry-run; TX_BROADCAST /
 *    TX_CONFIRMED for live; AUDIT_PASSED for accepted-not-yet-broadcast).
 * 4. Prints a pass/fail summary + a testnet-explorer link if a txHash was
 *    produced.
 *
 * Usage:
 *   # Local dev (Vite proxy to sovereign-host on 3001)
 *   SOVEREIGN_API_TOKEN=<token> PRINCIPAL_WALLET=0x... pnpm testnet:cycle
 *
 *   # Testnet (Vite local, sovereign-host on testnet behind a public URL)
 *   BASE=http://127.0.0.1:5173 API_BASE=https://sovereign-host-testnet.eastus2.azurecontainerapps.io \
 *     SOVEREIGN_API_TOKEN=<token> PRINCIPAL_WALLET=0x... pnpm testnet:cycle
 *
 * Flags (env):
 *   SKIP_WALK=1          skip the Playwright walk; assume plScore is already
 *                        recorded locally (use when the user has manually
 *                        verified Phase 1-3 and just wants to test the trigger)
 *   SKIP_VITE=1          don't start the Vite dev server (assumes one is up)
 *   EXPECTED_TX=1        expect a real on-chain tx (TX_BROADCAST/CONFIRMED).
 *                        If the engine returns TX_SYNTHESIZED instead, that's
 *                        a fail rather than a pass — useful in live-config tests
 *                        where you want to confirm real chain activity.
 *
 * Exit codes:
 *   0  pass (or a deliberate skip, e.g. CARDIA_FUNDING_LIVE=false → 503)
 *   1  fail (plScore < 50, or trigger returned AUDIT_FAILED/TX_FAILED/transport)
 *   2  setup error (missing env, bad wallet, walk script not found)
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const BASE = (process.env.BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const API_BASE = (process.env.API_BASE || BASE).replace(/\/$/, "");
const TOKEN = process.env.SOVEREIGN_API_TOKEN;
const PRINCIPAL_WALLET = process.env.PRINCIPAL_WALLET;
const SKIP_WALK = process.env.SKIP_WALK === "1";
const SKIP_VITE = process.env.SKIP_VITE === "1";
const EXPECTED_TX = process.env.EXPECTED_TX === "1";
const EXPLORER_BASE =
  process.env.EXPLORER_BASE || "https://testnet-explorer.monad.xyz";

// ── 0. Validate inputs ──────────────────────────────────────────────────────
const errors = [];
if (!TOKEN) errors.push("SOVEREIGN_API_TOKEN is required");
if (!PRINCIPAL_WALLET) errors.push("PRINCIPAL_WALLET is required");
else if (!/^0x[a-fA-F0-9]{40}$/.test(PRINCIPAL_WALLET))
  errors.push("PRINCIPAL_WALLET must be a 0x-prefixed 20-byte address");
if (errors.length) {
  console.error("Setup errors:");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\nRun `pnpm testnet:cycle` with the required env vars set.");
  process.exit(2);
}

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const hr = "═".repeat(60);
console.log(hr);
console.log(" TESTNET CYCLE — Cardia funding engine");
console.log(hr);
console.log(`Frontend  (BASE):   ${cyan(BASE)}`);
console.log(`API      (API_BASE):${cyan(API_BASE)}`);
console.log(`Wallet:             ${cyan(PRINCIPAL_WALLET)}`);
console.log(`Expect real tx:     ${EXPECTED_TX ? yellow("yes (live cycle)") : dim("no (dry-run acceptable)")}`);
console.log("");

// ── 1. Run the walk to PL >= 50 ──────────────────────────────────────────────
let plScore = 0;
if (!SKIP_WALK) {
  console.log(`[1/3] Running Meshaleach UI walk (Phase 1-4)${SKIP_VITE ? " [SKIP_VITE=1]" : ""}...`);
  plScore = await runWalkAndGetPlScore();
  if (plScore < 0) {
    console.error(red("FAIL: walk script did not return a parseable plScore."));
    process.exit(1);
  }
} else {
  console.log("[1/3] Skipping walk (SKIP_WALK=1). Assuming plScore is already at threshold.");
  plScore = 50; // optimistic
}

const plColor = plScore >= 50 ? green : red;
console.log(`   plScore: ${plColor(String(plScore))} ${plScore >= 50 ? "(>= 50 ✓)" : red("(< 50 — wallet bind won't be enabled)")}`);
if (plScore < 50) {
  console.error(red("\nFAIL: plScore is below the 50-point threshold needed to enable wallet bind + funding."));
  console.error("       Run the walk (unset SKIP_WALK) or manually advance through Phase 1-3.");
  process.exit(1);
}
console.log("");

// ── 2. Hit the funding trigger ─────────────────────────────────────────────
console.log(`[2/3] POST ${API_BASE}/api/v1/cardia/funding/trigger`);
const trigger = await postTrigger();
if (trigger.skipped) {
  // 503 SERVICE_DISABLED — engine mounted, flag is off. This is an
  // expected pre-prod state; we treat it as a deliberate skip, not fail.
  console.log(yellow(`   SKIPPED — ${trigger.message}`));
  console.log("");
  console.log("[3/3] Verdict");
  console.log(yellow("SKIP — engine mounted but CARDIA_FUNDING_LIVE is not true. " +
    "Re-run with the flag on a testnet host to actually exercise funding."));
  process.exit(0);
}
if (trigger.error) {
  console.error(red(`   HTTP ${trigger.status} — ${trigger.error}`));
  console.error(red("\nFAIL: trigger endpoint returned an error."));
  process.exit(1);
}

const m = trigger.body;
console.log(`   mandateId:    ${cyan(m.mandateId || "(missing)")}`);
console.log(`   status:       ${statusColor(m.status)(m.status || "(missing)")}`);
console.log(`   amount:       ${m.amount != null ? `$${m.amount} USD` : "(missing)"}`);
console.log(`   principal:    ${m.principalWallet || "(missing)"}`);
console.log(`   txHash:       ${m.txHash || dim("(no chain tx — TX_SYNTHESIZED dry-run)")}`);
console.log(`   blockNumber:  ${m.blockNumber ?? dim("n/a")}`);
const traceCount = Array.isArray(m.auditTrace) ? m.auditTrace.length : 0;
console.log(`   auditTrace:   ${traceCount} step${traceCount === 1 ? "" : "s"}`);
if (Array.isArray(m.auditTrace)) {
  for (const step of m.auditTrace.slice(-5)) {
    console.log(`     - ${dim(step)}`);
  }
}
if (m.synthesized) console.log(`   synthesized:  ${yellow("true (dry-run path)")}`);
if (m._auth?.principalId) console.log(`   _auth:        ${dim(m._auth.principalId)}`);
console.log("");

// ── 3. Verdict ─────────────────────────────────────────────────────────────
console.log("[3/3] Verdict");
const ok = ["TX_SYNTHESIZED", "TX_BROADCAST", "TX_CONFIRMED", "AUDIT_PASSED"].includes(m.status);
if (!ok) {
  console.error(red(`FAIL: engine returned status=${m.status} (expected one of TX_*/AUDIT_PASSED)`));
  if (m.status === "AUDIT_FAILED") {
    console.error(red("       Hepar blocked the funding — check the auditTrace for the refusal reason."));
  }
  if (m.status === "TX_FAILED") {
    console.error(red("       The transfer broadcasted but did not confirm — check the testnet explorer for txHash."));
  }
  process.exit(1);
}
if (EXPECTED_TX && !["TX_BROADCAST", "TX_CONFIRMED"].includes(m.status)) {
  console.error(red(`FAIL: EXPECTED_TX=1 but status=${m.status} (dry-run path; live transfer did not fire)`));
  process.exit(1);
}
console.log(green(`PASS — engine returned ${m.status}`));
if (["TX_BROADCAST", "TX_CONFIRMED"].includes(m.status) && m.txHash) {
  console.log(dim(`Verify on testnet explorer: ${EXPLORER_BASE}/tx/${m.txHash}`));
}
process.exit(0);

// ── helpers ─────────────────────────────────────────────────────────────────

function statusColor(status) {
  switch (status) {
    case "TX_SYNTHESIZED":
    case "AUDIT_PASSED":
    case "PENDING_HEPAR_AUDIT":
      return yellow;
    case "TX_BROADCAST":
    case "TX_CONFIRMED":
      return green;
    case "AUDIT_FAILED":
    case "TX_FAILED":
      return red;
    default:
      return (s) => s;
  }
}

async function runWalkAndGetPlScore() {
  return await new Promise((resolve) => {
    const args = ["scripts/run-meshaleach-walk.mjs"];
    const child = spawn("node", args, {
      cwd: REPO_ROOT,
      env: { ...process.env, BASE },
      stdio: ["ignore", "pipe", "inherit"],
    });
    let buf = "";
    child.stdout.on("data", (d) => { buf += d.toString(); });
    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(yellow(`(walk exited with code ${code}; continuing — the JSON may still parse)`));
      }
      // The walk prints a "── onboarding store ──" block before the JSON.
      const m = buf.match(/onboarding store[\s\S]*?(\{[\s\S]*?\n\})/);
      if (!m) {
        resolve(-1);
        return;
      }
      try {
        const state = JSON.parse(m[1]);
        resolve(typeof state.plScore === "number" ? state.plScore : -1);
      } catch {
        resolve(-1);
      }
    });
  });
}

async function postTrigger() {
  try {
    const r = await fetch(`${API_BASE}/api/v1/cardia/funding/trigger`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ principalWallet: PRINCIPAL_WALLET }),
    });
    const text = await r.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { _raw: text }; }
    if (r.status === 503) {
      return {
        skipped: true,
        message: body.message || "SERVICE_DISABLED",
      };
    }
    if (!r.ok) {
      return { error: text || r.statusText, status: r.status };
    }
    return { body, status: r.status };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
