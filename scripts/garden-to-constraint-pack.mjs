#!/usr/bin/env node
/**
 * garden-to-constraint-pack.mjs — generate a constraint pack from a Council garden.
 *
 * Reads a `*GNOSIS EVENT EXTRACTION.txt` file under
 * `theo-techno-cosmo/THE COUNCILE/` and emits a constraint pack
 * matching the existing `shared/constraints/v{N}/` shape (theological /
 * technological / cosmological + manifest).
 *
 * PoC scope (2026-10-11): one garden, three domain files, soft-severity rules.
 * Each event becomes one rule in the FIRST non-empty Three-Domain Reading
 * domain. Rule IDs are namespaced per garden: `{KEY}-EVENT-NN`.
 *
 * Usage:
 *   node scripts/garden-to-constraint-pack.mjs \
 *     --garden "theo-techno-cosmo/THE COUNCILE/Aristotle (384-322 BCE) GNOSIS EVENT EXTRACTION.txt" \
 *     --out shared/constraints/v0.1.0-gardens \
 *     --key aristotle
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const gardenPath = args.garden;
const outDir = args.out;
const gardenKey = args.key;

if (!gardenPath || !outDir || !gardenKey) {
  console.error('Usage: --garden <path> --out <dir> --key <gardenKey>');
  process.exit(2);
}

const text = readFileSync(gardenPath, 'utf8');
const events = parseEvents(text);
const domainOfEvent = events.map((e) => pickDomain(e));
const byDomain = { theological: [], technological: [], cosmological: [] };
events.forEach((e, i) => byDomain[domainOfEvent[i]].push(e));

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Emit all three domain files (the loader requires the full shape).
// Empty domains carry version + provenance + an empty rules array so the
// pack is self-contained and round-trips through the existing loader.
for (const domain of ['theological', 'technological', 'cosmological']) {
  const list = byDomain[domain];
  const out = {
    version: '0.1.0-gardens',
    domain,
    principle: list.length
      ? `Council garden insights — ${domain} domain (PoC)`
      : `Council garden insights — ${domain} domain (empty; no events in this garden touched ${domain})`,
    operational_question: list.length
      ? `Does this preserve the ${domain} integrity that the named historical figure articulated?`
      : `n/a — this garden produced no ${domain} events. Pick a different garden if you need ${domain} coverage.`,
    failure_mode: list.length
      ? 'Drift, soft paraphrase, reduction of the figure to a slogan; using the rule without attribution.'
      : 'n/a',
    immutable: false,
    source: { garden: gardenPath, gardenKey, generated_by: 'scripts/garden-to-constraint-pack.mjs', generated_at: new Date().toISOString() },
    rules: list.map(eventToRule),
  };
  writeFileSync(resolve(outDir, `${domain}.json`), JSON.stringify(out, null, 2) + '\n');
}

// Manifest — mirrors the v1.1.0 manifest shape.
const manifest = {
  version: '0.1.0-gardens',
  name: `council-gardens/${gardenKey}`,
  title: `Council Garden Constraint Pack — ${gardenKey} (PoC)`,
  immutable: false,
  effective_date: new Date().toISOString().slice(0, 10),
  source_of_truth: `theo-techno-cosmo/THE COUNCILE/${basename(gardenPath)}`,
  derivation: 'Generated from a single Council garden via scripts/garden-to-constraint-pack.mjs',
  domains: ['theological', 'technological', 'cosmological'],
  files: {
    theological: 'theological.json',
    technological: 'technological.json',
    cosmological: 'cosmological.json',
  },
  validity_rule: 'These are soft (severity=soft) rules derived from a historical figure. They are not charter axioms. They co-exist with the charter pack (v1.1.0) but do NOT carry hard-fail authority.',
  related: {
    charter: 'docs/CHARTER.md',
    charter_pack: 'shared/constraints/v1.1.0/',
    loader: 'gnostic_engine.constraints.load_constraint_pack',
    generator: 'scripts/garden-to-constraint-pack.mjs',
    po_doc: 'docs/P0_GARDEN_TO_CONSTRAINT_PACK_POC_2026-10-11.md',
  },
};
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote ${events.length} event rules across ${Object.values(byDomain).filter((l) => l.length > 0).length} domain files.`);
console.log(`By domain: theological=${byDomain.theological.length}, technological=${byDomain.technological.length}, cosmological=${byDomain.cosmological.length}`);

// ---------- parsers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    out[k] = argv[i + 1];
  }
  return out;
}

function basename(p) {
  return p.split(/[\\/]/).pop();
}

function parseEvents(text) {
  // Split on `## Event NN — *title*` markers. The split eats `## Event NN — *`
  // so the block begins with the title text and ends with `*`.
  const blocks = text.split(/^## Event\s+\d+\s+—\s+\*/m);
  const events = [];
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // The first line of the block is `<title>*` — extract the title.
    const firstLine = block.split('\n', 1)[0];
    const title = firstLine.replace(/\*+\s*$/, '').trim();
    const parsed = {
      number: i,
      title,
      compressedInsight: extractField(block, /\*\*Compressed Insight:\*\*\s*([\s\S]+?)(?=\n\*\*|$)/),
      confidence: extractField(block, /\*\*Confidence:\*\*\s*([\d.]+)/),
      sources: extractField(block, /\*\*Sources:\*\*\s*([\s\S]+?)(?=\n---|\n##|$)/),
      threeDomainReading: {
        theology: extractField(block, /-\s+\*\*Theology:\*\*\s*([\s\S]+?)(?=\n\s*-\s+\*\*|$)/),
        technology: extractField(block, /-\s+\*\*Technology:\*\*\s*([\s\S]+?)(?=\n\s*-\s+\*\*|$)/),
        cosmology: extractField(block, /-\s+\*\*Cosmology:\*\*\s*([\s\S]+?)(?=\n\*\*|$)/),
      },
    };
    if (parsed.compressedInsight) events.push(parsed);
  }
  return events;
}

function extractField(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1].trim();
}

function pickDomain(event) {
  const order = ['theology', 'cosmology', 'technology']; // priority: first non-empty
  for (const d of order) {
    if (event.threeDomainReading[d]) return d === 'theology' ? 'theological' : d === 'technology' ? 'technological' : 'cosmological';
  }
  // Fallback — no domain info; place in theological as the canonical first domain.
  return 'theological';
}

function eventToRule(event) {
  return {
    id: `${gardenKey.toUpperCase()}-EVENT-${String(event.number).padStart(2, '0')}`,
    name: event.title,
    severity: 'soft',
    description: event.compressedInsight,
    params: {
      source: event.sources,
      confidence: event.confidence ? parseFloat(event.confidence) : null,
      three_domain_reading: event.threeDomainReading,
    },
  };
}

function pickNonEmpty(byDomain) {
  const out = {};
  for (const [domain, list] of Object.entries(byDomain)) {
    if (list.length > 0) out[domain] = `${domain}.json`;
  }
  return out;
}
