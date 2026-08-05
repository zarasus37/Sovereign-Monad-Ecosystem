#!/usr/bin/env node
/**
 * Compile gate_human_bound.circom → r1cs/wasm, powersoftau, zkey, vkey.
 * Uses local bin/circom.exe (Windows) or circom on PATH.
 */
import { spawnSync } from 'node:child_process';
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

// write meta
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
    },
    null,
    2,
  ),
);

console.log('Circuit artifacts written to', outDir);
