/**
 * Validate Enheduanna TempleGrid fixture against temple-grid-schema.json (ajv).
 * Exit 0 on pass; non-zero + errors on fail.
 *
 *   node scripts/check-temple-grid.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadAjv() {
  // Prefer workspace-root or package-local ajv (gnosis-training-data depends on it)
  const candidates = [
    resolve(root, 'node_modules/ajv'),
    resolve(root, 'monad-ecosystem/packages/gnosis-training-data/node_modules/ajv'),
    resolve(root, 'monad-ecosystem/packages/scheduler/node_modules/ajv'),
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch {
      /* try next */
    }
  }
  // bare resolve
  return require('ajv');
}

const AjvModule = loadAjv();
const Ajv = AjvModule.default ?? AjvModule.Ajv ?? AjvModule;

const schemaPath = resolve(root, 'shared/ttcl-specs/temple-grid-schema.json');
const fixturePath = resolve(root, 'shared/fixtures/layer6/enheduanna-temple-grid.json');
const priorsSchemaPath = resolve(
  root,
  'shared/ttcl-specs/temple-grid-logoc-priors.schema.json',
);
const priorsPath = resolve(
  root,
  'shared/fixtures/layer6/temple-grid-logoc-priors.json',
);

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(fixture);

if (!ok) {
  console.error('TempleGrid fixture FAILED schema validation:');
  for (const e of validate.errors ?? []) {
    console.error(`  ${e.instancePath || '/'} ${e.message}`);
  }
  process.exit(1);
}

const nodes = fixture.nodes ?? [];
const active = nodes.filter((n) => n.status === 'active').length;
const unknown = nodes.filter((n) => n.status === 'unknown').length;
const hymns = new Set(nodes.map((n) => n.hymn_index));
const withFp = nodes.filter((n) => n.logoc_fingerprint != null).length;

if (nodes.length !== 42) {
  console.error(`expected 42 nodes, got ${nodes.length}`);
  process.exit(1);
}
if (hymns.size !== 42) {
  console.error(`expected 42 unique hymn_index, got ${hymns.size}`);
  process.exit(1);
}
if (fixture.provenance?.ttc_domain !== 'THEO_TECHNO_COSMO') {
  console.error('provenance.ttc_domain must be THEO_TECHNO_COSMO');
  process.exit(1);
}

// Fingerprint audit: baseline_total ≈ formula
let fpAuditFails = 0;
for (const n of nodes) {
  const fp = n.logoc_fingerprint;
  if (!fp) continue;
  if (fp.profile_id !== 'logoc.temple-grid.v1') {
    console.error(`bad profile_id on ${n.temple_id}`);
    fpAuditFails += 1;
    continue;
  }
  const ch = fp.channels;
  const w = fp.weights;
  const p = fp.penalty_priors;
  const expected =
    w.theo * ch.theo +
    w.tech * ch.tech +
    w.cosmo * ch.cosmo +
    w.coherence * ch.coherence +
    w.sovereignty * ch.sovereignty -
    (p.unknownNode + p.weakConnectivity + p.protocolDrift + p.domainImbalance);
  const clamped = Math.min(1, Math.max(0, expected));
  if (Math.abs(clamped - fp.baseline_total) > 0.02) {
    console.error(
      `fingerprint baseline drift on ${n.temple_id}: expected~${clamped.toFixed(4)} got ${fp.baseline_total}`,
    );
    fpAuditFails += 1;
  }
}
if (fpAuditFails > 0) process.exit(1);

// Priors overlay schema
const priorsSchema = JSON.parse(readFileSync(priorsSchemaPath, 'utf8'));
const priors = JSON.parse(readFileSync(priorsPath, 'utf8'));
const validatePriors = ajv.compile(priorsSchema);
if (!validatePriors(priors)) {
  console.error('TempleGrid LOGOC priors FAILED schema validation:');
  for (const e of validatePriors.errors ?? []) {
    console.error(`  ${e.instancePath || '/'} ${e.message}`);
  }
  process.exit(1);
}
if (priors.grid_id !== fixture.grid_id) {
  console.error(`priors.grid_id ${priors.grid_id} != grid ${fixture.grid_id}`);
  process.exit(1);
}
const templeIds = new Set(nodes.map((n) => n.temple_id));
for (const np of priors.node_priors ?? []) {
  if (!templeIds.has(np.temple_id)) {
    console.error(`priors node_prior unknown temple_id: ${np.temple_id}`);
    process.exit(1);
  }
}
const blendSum =
  (priors.global?.blend?.fingerprint_weight ?? 0) +
  (priors.global?.blend?.runtime_prior_weight ?? 0);
if (Math.abs(blendSum - 1) > 0.001) {
  console.error(`blend weights must sum to 1, got ${blendSum}`);
  process.exit(1);
}

console.log(
  `TempleGrid OK: ${fixture.grid_id} v${fixture.schema_version} nodes=${nodes.length} active=${active} unknown=${unknown} fingerprints=${withFp}`,
);
console.log(
  `Priors OK: ${priors.priors_id} nodes=${priors.node_priors?.length ?? 0} scenarios=${priors.scenarios?.length ?? 0}`,
);
process.exit(0);
