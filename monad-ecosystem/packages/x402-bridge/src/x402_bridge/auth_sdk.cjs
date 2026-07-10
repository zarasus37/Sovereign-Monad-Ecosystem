// auth_sdk.cjs — Working x402 auth + live-RPC helper using the official
// @quicknode/x402 SDK. Replaces the broken auth_jwt.js, which used shell-style
// '#' comment lines in a .js (a '#'-space line is a JS SyntaxError, not a
// comment) and CommonJS require() under a root package.json that is
// "type":"module" — so it loaded as ESM and never ran.
//
// This file is .cjs so Node always treats it as CommonJS regardless of the
// root "type":"module".
//
// Usage (first CLI arg = mode):
//   node auth_sdk.cjs probe   — verify the SDK + .env key are resolvable (no network auth)
//   node auth_sdk.cjs auth    — SIWX-enroll via SDK, cache JWT to .env, print JSON
//   node auth_sdk.cjs live    — fresh SIWX + one live eth_blockNumber via SDK client.fetch
//   node auth_sdk.cjs all     — auth then live (default)
//
// Loads the gitignored ./.env from CWD via dotenv so the private key is never
// passed on the command line. Requires @quicknode/x402 (+ optional dotenv).
// The SDK resolves from node_modules up the tree, or — for installs done
// outside the repo (npm can't install inside this pnpm workspace) — from the
// X402_SDK_NODE_PATH env var. See the README "One-time SDK install" section.
//
// Output: a single JSON line on stdout. Stages 2/3 of live_smoke.py parse it.
'use strict';

const path = require('path');
const fs = require('fs');

// Resolve a module by name from the normal node path, or from
// X402_SDK_NODE_PATH. Returns the module or throws a helpful error.
function requireSdkOrThrow(name) {
  try { return require(name); } catch (e) { /* fall through */ }
  const dir = process.env.X402_SDK_NODE_PATH;
  if (dir) {
    try { return require(path.join(dir, name)); } catch (e) { /* fall through */ }
  }
  throw new Error(
    "Cannot resolve '" + name + "'. The @quicknode/x402 SDK is not installed where Node can find it. " +
    "One-time install (outside the pnpm workspace):\n" +
    "  mkdir -p \"$LOCALAPPDATA/Temp/x402sdk\" && cd \"$LOCALAPPDATA/Temp/x402sdk\" && npm install @quicknode/x402 dotenv\n" +
    "Then set X402_SDK_NODE_PATH to that node_modules dir (or install the SDK into this package's own node_modules)."
  );
}

// dotenv is optional — if it is not installed, the key must come from the shell env.
try { requireSdkOrThrow('dotenv').config(); } catch (_) { /* rely on shell env */ }

const MODE = process.argv[2] || 'all';

function normPk(pk) {
  return pk && !pk.startsWith('0x') ? '0x' + pk : pk;
}

function buildClient() {
  const pk = normPk(process.env.X402_EVM_PRIVATE_KEY);
  if (!pk) throw new Error('X402_EVM_PRIVATE_KEY not set (check .env or shell env)');
  const baseUrl = process.env.X402_BASE_URL || 'https://x402.quicknode.com';
  const network = process.env.X402_PAYMENT_NETWORK || 'eip155:84532';
  const paymentModel = process.env.X402_PAYMENT_MODEL || 'credit-drawdown';
  const { createQuicknodeX402Client } = requireSdkOrThrow('@quicknode/x402');
  return createQuicknodeX402Client({
    baseUrl, network, evmPrivateKey: pk, paymentModel, preAuth: true,
  });
}

// Best-effort: cache the JWT into the .env next to CWD as X402_JWT_TOKEN=...
// (replacing any existing line), preserving all other lines incl. the key.
function cacheJwt(token) {
  const envPath = path.join(process.cwd(), '.env');
  let lines = [];
  if (fs.existsSync(envPath)) lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines = lines.filter(l => !l.startsWith('X402_JWT_TOKEN=') && l.trim() !== '');
  lines.push('X402_JWT_TOKEN=' + token);
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

async function doAuth() {
  const client = await buildClient();
  const token = client.getToken && client.getToken();
  if (!token) throw new Error('SDK returned no JWT token');
  let cached = false;
  try { cacheJwt(token); cached = true; } catch (e) { /* best-effort */ }
  const accountId = client.getAccountId && client.getAccountId();
  return { jwt_acquired: true, jwt: token, jwt_chars: token.length, accountId, jwt_cached: cached };
}

async function doLive() {
  const client = await buildClient();
  const baseUrl = process.env.X402_BASE_URL || 'https://x402.quicknode.com';
  const target = process.env.X402_TARGET_NETWORK || 'monad-mainnet';
  const url = baseUrl + '/' + target;
  const resp = await client.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  });
  const status = resp.status;
  const text = await resp.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch (_) {}
  const blockHex = parsed && parsed.result;
  const blockNum = blockHex ? parseInt(blockHex, 16) : null;
  const credits = resp.headers.get('x-credits-remaining') || resp.headers.get('x-ratelimit-remaining');
  return { http_status: status, block_hex: blockHex, block_number: blockNum, credits_remaining: credits, raw: text.slice(0, 200) };
}

(async () => {
  try {
    if (MODE === 'probe') {
      requireSdkOrThrow('@quicknode/x402'); // throws if unresolvable
      const pk = !!process.env.X402_EVM_PRIVATE_KEY;
      console.log(JSON.stringify({ success: true, mode: 'probe', sdk: 'ok', private_key_in_env: pk }));
      return;
    }
    let out = { success: true };
    if (MODE === 'auth' || MODE === 'all') out.auth = await doAuth();
    if (MODE === 'live' || MODE === 'all') out.live = await doLive();
    if (MODE === 'live' || MODE === 'all') out.success = !!(out.live && out.live.block_number !== null);
    console.log(JSON.stringify(out));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: String(e && e.message || e) }));
    process.exit(1);
  }
})();