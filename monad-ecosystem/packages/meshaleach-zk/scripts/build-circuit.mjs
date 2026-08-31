#!/usr/bin/env node
/**
 * Compile gate_human_bound.circom → r1cs/wasm, powersoftau, zkey, vkey.
 * Uses local bin/circom.exe (Windows) or circom on PATH.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const circuits = join(pkgRoot, 'circuits');
const buildDir = join(pkgRoot, 'artifacts', 'build');
const outDir = join(pkgRoot, 'artifacts');
mkdirSync(buildDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

/**
 * Refuse to write if a production-ceremony artifact is already pinned at the
 * target path. The demo build (this script) must never clobber a multi-party
 * production zkey/vkey/meta — production ceremonies are run via
 * scripts/phase2-contribute.mjs and pinned with --mode=production.
 *
 * - production → hard refuse, exit non-zero (the whole point of this guard).
 * - demo      → loud warning (the committed demo pin will change).
 * - missing   → proceed (fresh state).
 */
const metaPath = join(outDir, 'circuit_meta.json');
if (existsSync(metaPath)) {
  let existingMode = 'unknown';
  try {
    const parsed = JSON.parse(readFileSync(metaPath, 'utf8'));
    existingMode = parsed?.ceremony?.mode ?? 'unknown';
  } catch (err) {
    console.warn('[build-circuit] could not parse existing circuit_meta.json:', err.message);
  }
  if (existingMode === 'production') {
    console.error(
      '[build-circuit] REFUSING: artifacts/circuit_meta.json is pinned to ceremony.mode="production".\n' +
        'A multi-party production ceremony has already been run; the demo build\n' +
        '(this script) must NOT overwrite its zkey, verification_key.json, or meta.\n' +
        '\n' +
        'To refresh demo artifacts, first move the production meta out of the way\n' +
        '(e.g. archive it), or run scripts/phase2-contribute.mjs for a new production\n' +
        'ceremony. See PRODUCTION_PTAU.md.',
    );
    process.exit(1);
  }
  if (existingMode === 'demo') {
    console.warn(
      '[build-circuit] WARNING: existing demo artifacts will be overwritten. The committed\n' +
        'vkey.sha256 pin will change. Pass --force to suppress this warning.',
    );
  }
}

const circomLocal = join(pkgRoot, 'bin', 'circom.exe');
const circomBin = existsSync(circomLocal) ? circomLocal : 'circom';

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed with status ${r.status}`);
  }
}

const circomFile = join(circuits, 'gate_human_bound.circom');
if (!existsSync(circomFile)) throw new Error('missing circuit');

run(circomBin, [
  circomFile,
  '--r1cs',
  '--wasm',
  '--sym',
  '-o',
  buildDir,
]);

const require = createRequire(import.meta.url);
// resolve('snarkjs') → …/snarkjs/build/main.cjs → CLI is sibling cli.cjs
const snarkjsMain = require.resolve('snarkjs');
let snarkjsCli = join(dirname(snarkjsMain), 'cli.cjs');
if (!existsSync(snarkjsCli)) {
  snarkjsCli = join(pkgRoot, '..', '..', '..', 'node_modules', 'snarkjs', 'build', 'cli.cjs');
}
if (!existsSync(snarkjsCli)) {
  throw new Error(`snarkjs cli not found (tried ${snarkjsCli})`);
}

const ptau = join(buildDir, 'pot12_final.ptau');
const r1cs = join(buildDir, 'gate_human_bound.r1cs');
const zkey0 = join(buildDir, 'gate_0000.zkey');
const zkey = join(outDir, 'gate_human_bound.zkey');
const vkey = join(outDir, 'verification_key.json');
const wasm = join(buildDir, 'gate_human_bound_js', 'gate_human_bound.wasm');
const wasmDest = join(outDir, 'gate_human_bound.wasm');

// Powers of tau (small ceremony for demo circuit — production must re-run trusted setup)
run(process.execPath, [snarkjsCli, 'powersoftau', 'new', 'bn128', '12', join(buildDir, 'pot12_0000.ptau'), '-v']);
run(process.execPath, [
  snarkjsCli,
  'powersoftau',
  'contribute',
  join(buildDir, 'pot12_0000.ptau'),
  join(buildDir, 'pot12_0001.ptau'),
  '--name=sovereign-meshaleach',
  '-v',
  '-e=sovereign entropy phase2',
]);
run(process.execPath, [
  snarkjsCli,
  'powersoftau',
  'prepare',
  'phase2',
  join(buildDir, 'pot12_0001.ptau'),
  ptau,
  '-v',
]);

run(process.execPath, [snarkjsCli, 'groth16', 'setup', r1cs, ptau, zkey0]);
run(process.execPath, [
  snarkjsCli,
  'zkey',
  'contribute',
  zkey0,
  zkey,
  '--name=sovereign-contrib',
  '-v',
  '-e=sovereign zkey entropy',
]);
run(process.execPath, [snarkjsCli, 'zkey', 'export', 'verificationkey', zkey, vkey]);

// copy wasm to artifacts root
import { copyFileSync } from 'node:fs';
if (existsSync(wasm)) {
  copyFileSync(wasm, wasmDest);
} else {
  // circom may place wasm differently
  const alt = join(buildDir, 'gate_human_bound.wasm');
  if (existsSync(alt)) copyFileSync(alt, wasmDest);
  else throw new Error('wasm not found after circom');
}

// write meta (demo ceremony) + pin vkey
const vkeyBytes = readFileSync(vkey);
const vkeySha256 = createHash('sha256').update(vkeyBytes).digest('hex');
writeFileSync(join(outDir, 'vkey.sha256'), vkeySha256 + '\n');
writeFileSync(
  join(outDir, 'circuit_meta.json'),
  JSON.stringify(
    {
      name: 'gate_human_bound',
      system: 'groth16',
      curve: 'bn128',
      public: ['out_gate', 'out_human', 'commit'],
      builtAt: new Date().toISOString(),
      note: 'Demo ptau — re-run trusted setup for production',
      vkeySha256,
      ceremony: {
        mode: 'demo',
        vkeySha256,
        phase1: 'local powersoftau new bn128 12',
        phase2Contributors: ['sovereign-demo'],
        beacon: null,
        zkeyVerify: 'demo-local',
        note: 'Demo only — use scripts/phase2-contribute.mjs + PRODUCTION_PTAU.md for production',
        pinnedAt: new Date().toISOString(),
      },
    },
    null,
    2,
  ),
);

console.log('Circuit artifacts written to', outDir);
console.log('Demo vkey pin:', vkeySha256);
