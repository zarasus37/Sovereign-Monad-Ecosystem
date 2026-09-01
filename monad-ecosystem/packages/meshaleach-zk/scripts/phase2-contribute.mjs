#!/usr/bin/env node
/**
 * Phase-2 zkey contribution helper (production ceremony).
 * Does NOT run a full powersoftau — expects:
 *   - artifacts/build/gate_human_bound.r1cs (from circom / build:circuit)
 *   - a prepared Phase-1 ptau (public or local) via --ptau=
 *   - optional existing zkey to contribute further via --from=
 *
 * Examples:
 *   # First circuit-specific setup from public ptau
 *   node scripts/phase2-contribute.mjs --ptau=./pot14_final.ptau --name=sovereign-c0
 *
 *   # Second contributor
 *   node scripts/phase2-contribute.mjs --from=artifacts/build/gate_0001.zkey --name=sovereign-c1
 *
 *   # Export final + pin as production
 *   node scripts/phase2-contribute.mjs --finalize --from=artifacts/build/gate_0002.zkey
 *
 * See PRODUCTION_PTAU.md for the full multi-party runbook.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const buildDir = join(pkgRoot, 'artifacts', 'build');
const outDir = join(pkgRoot, 'artifacts');
mkdirSync(buildDir, { recursive: true });

function arg(name, fallback = undefined) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const require = createRequire(import.meta.url);
const snarkjsMain = require.resolve('snarkjs');
let snarkjsCli = join(dirname(snarkjsMain), 'cli.cjs');
if (!existsSync(snarkjsCli)) {
  snarkjsCli = join(pkgRoot, '..', '..', '..', 'node_modules', 'snarkjs', 'build', 'cli.cjs');
}
if (!existsSync(snarkjsCli)) {
  console.error('snarkjs cli not found');
  process.exit(1);
}

/**
 * Ceremony entropy is toxic waste: whoever knows it can forge proofs. It must
 * never reach stdout, which lands in terminals, CI logs, screen shares and
 * scrollback. Redact any -e=/--entropy= argument before echoing the command.
 */
function redactArgs(args) {
  return args.map((a) =>
    /^(-e=|--entropy=)/.test(a) ? a.slice(0, a.indexOf('=') + 1) + '<redacted>' : a,
  );
}

function run(args) {
  console.log('>', process.execPath, 'snarkjs', redactArgs(args).join(' '));
  const r = spawnSync(process.execPath, [snarkjsCli, ...args], {
    stdio: 'inherit',
    shell: false,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const r1cs = join(buildDir, 'gate_human_bound.r1cs');
const name = arg('name', 'sovereign-contributor');
const entropy = arg('entropy') || randomBytes(32).toString('hex');
const ptau = arg('ptau');
const fromZkey = arg('from');
const outZkey = arg('out');

if (flag('finalize')) {
  const src = fromZkey || join(outDir, 'gate_human_bound.zkey');
  if (!existsSync(src)) {
    console.error('finalize needs --from=path/to/final.zkey or existing gate_human_bound.zkey');
    process.exit(1);
  }
  const dest = join(outDir, 'gate_human_bound.zkey');
  if (resolve(src) !== resolve(dest)) copyFileSync(src, dest);
  const vkey = join(outDir, 'verification_key.json');
  run(['zkey', 'export', 'verificationkey', dest, vkey]);

  // Finalizing pins the artifact as ceremony.mode=production. Verification is
  // therefore mandatory, not conditional: this used to be
  // `if (ptau && existsSync(r1cs))`, so omitting --ptau silently skipped the
  // only check that the zkey actually corresponds to this circuit and phase-1,
  // and the script still pinned it as production.
  if (!ptau) {
    console.error(
      'finalize requires --ptau=path/to/prepared.ptau so the zkey can be verified ' +
        'against the r1cs before it is pinned as production. See PRODUCTION_PTAU.md.',
    );
    process.exit(1);
  }
  if (!existsSync(ptau)) {
    console.error('finalize: --ptau file not found:', ptau);
    process.exit(1);
  }
  if (!existsSync(r1cs)) {
    console.error(
      'finalize: missing r1cs at ' + r1cs + ' — build the circuit first so the ' +
        'zkey can be verified against it.',
    );
    process.exit(1);
  }
  console.log('Verifying zkey against r1cs + ptau…');
  run(['zkey', 'verify', r1cs, ptau, dest]);
  // pin as production
  const pinScript = join(__dirname, 'pin-vkey.mjs');
  const contrib = arg('contributors', name);
  const phase1 = arg('phase1', ptau || 'unspecified');
  const pin = spawnSync(
    process.execPath,
    [
      pinScript,
      `--mode=production`,
      `--contributors=${contrib}`,
      `--phase1=${phase1}`,
    ],
    { stdio: 'inherit' },
  );
  // The result used to be discarded, so a failed pin still printed
  // "Finalized production zkey + vkey pin" and exited 0 -- a false success on
  // the step that decides whether the committed vkey hash is trustworthy.
  if (pin.error) {
    console.error('Failed to run pin-vkey.mjs:', pin.error.message);
    process.exit(1);
  }
  if (pin.status !== 0) {
    console.error(
      `pin-vkey.mjs exited ${pin.status} — the production vkey pin was NOT written. ` +
        'The zkey and verification_key.json on disk are now ahead of the committed pin.',
    );
    process.exit(pin.status ?? 1);
  }
  console.log('Finalized production zkey + vkey pin. Mode=production.');
  process.exit(0);
}

if (fromZkey) {
  if (!existsSync(fromZkey)) {
    console.error('Missing --from zkey', fromZkey);
    process.exit(1);
  }
  const dest = outZkey || join(buildDir, `gate_contrib_${Date.now()}.zkey`);
  run([
    'zkey',
    'contribute',
    fromZkey,
    dest,
    `--name=${name}`,
    '-v',
    `-e=${entropy}`,
  ]);
  console.log('Contribution written to', dest);
  console.log('Next: pass --from=', dest, 'to the next contributor, or --finalize --from=', dest);
  process.exit(0);
}

// Initial groth16 setup from ptau
if (!ptau || !existsSync(ptau)) {
  console.error(
    'Need --ptau=path/to/prepared.ptau for first setup, or --from=zkey for contribute, or --finalize',
  );
  process.exit(1);
}
if (!existsSync(r1cs)) {
  console.error('Missing r1cs — run: pnpm run build:circuit (or circom only) first');
  process.exit(1);
}

const zkey0 = join(buildDir, 'gate_0000.zkey');
const zkey1 = outZkey || join(buildDir, 'gate_0001.zkey');
run(['groth16', 'setup', r1cs, ptau, zkey0]);
run([
  'zkey',
  'contribute',
  zkey0,
  zkey1,
  `--name=${name}`,
  '-v',
  `-e=${entropy}`,
]);
console.log('Initial setup + first contribute →', zkey1);
console.log('Hand off for more contributes, then: node scripts/phase2-contribute.mjs --finalize --from=' + zkey1 + (ptau ? ` --ptau=${ptau}` : ''));
