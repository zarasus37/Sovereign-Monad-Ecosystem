/**
 * Validate THE COUNCILE registry against schema + source files on disk.
 *   node scripts/check-council-registry.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadAjv() {
  for (const p of [
    resolve(root, 'node_modules/ajv'),
    resolve(root, 'monad-ecosystem/packages/gnosis-training-data/node_modules/ajv'),
  ]) {
    try {
      return require(p);
    } catch {
      /* next */
    }
  }
  return require('ajv');
}

const AjvModule = loadAjv();
const Ajv = AjvModule.default ?? AjvModule.Ajv ?? AjvModule;

const schemaPath = resolve(root, 'shared/ttcl-specs/council-registry.schema.json');
const registryPath = resolve(
  root,
  'theo-techno-cosmo/THE COUNCILE/council-registry.json',
);
const councilDir = resolve(root, 'theo-techno-cosmo/THE COUNCILE');

if (!existsSync(registryPath)) {
  console.error('Missing council-registry.json — run: node scripts/gen-council-registry.mjs');
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(registry)) {
  console.error('Council registry FAILED schema:');
  for (const e of validate.errors ?? []) {
    console.error(`  ${e.instancePath || '/'} ${e.message}`);
  }
  process.exit(1);
}

const filesOnDisk = new Set(
  readdirSync(councilDir).filter((f) => {
    const p = join(councilDir, f);
    return (
      statSync(p).isFile() &&
      f !== 'README.md' &&
      f !== 'council-registry.json'
    );
  }),
);

let missing = 0;
const claimed = new Set();
for (const m of registry.members) {
  for (const f of m.source_files) {
    claimed.add(f);
    if (!filesOnDisk.has(f)) {
      console.error(`member ${m.member_id}: missing source file ${f}`);
      missing += 1;
    }
  }
}
if (missing) process.exit(1);

const unclaimed = [...filesOnDisk].filter((f) => !claimed.has(f));
if (unclaimed.length) {
  console.error('Source files not claimed by any member:');
  for (const f of unclaimed) console.error(`  ${f}`);
  process.exit(1);
}

const ids = new Set();
for (const m of registry.members) {
  if (ids.has(m.member_id)) {
    console.error(`duplicate member_id: ${m.member_id}`);
    process.exit(1);
  }
  ids.add(m.member_id);
}

const recent = registry.members.filter((m) => m.recently_added);
console.log(
  `Council registry OK: ${registry.registry_id} members=${registry.stats.member_count} sources=${registry.stats.source_file_count} recently_added=${recent.length}`,
);
if (recent.length) {
  console.log(`  new: ${recent.map((m) => m.display_name).join(', ')}`);
}
process.exit(0);
