/**
 * build-corpus.js
 *
 * Converts master_corpus_v5.9.jsonl → public/logoc-corpus.json
 * Run before `vite build` to ensure the static corpus is up to date.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPUS_JSONL = path.resolve(
  __dirname,
  "../../../../../logs/corpus/master_corpus_v5.9.jsonl"
);
const OUTPUT_JSON = path.resolve(__dirname, "../public/logoc-corpus.json");

function buildSnapshot() {
  const events = [];
  let accepted = 0;
  let pending = 0;
  const bandCounts = { INSTINCT: 0, EXPERIENCE: 0, FORMAL_THOUGHT: 0 };
  const classCounts = {};

  if (!fs.existsSync(CORPUS_JSONL)) {
    console.error(`Corpus not found: ${CORPUS_JSONL}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(CORPUS_JSONL, "utf-8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);

    const fe = {
      schema_version: "1.0",
      event_id: e.event_id,
      timestamp: e.timestamp ?? Date.now(),
      narrative: e.narrative ?? "",
      semiotic_flags: e.semiotic_flags ?? {},
      peirce: e.peirce ?? null,
      peirce_migration_pending: e.peirce_migration_pending ?? false,
      peirce_migration_source: e.peirce_migration_source ?? null,
      _gnosis_meta: e._gnosis_meta ?? e.meta ?? {},
    };

    if (e.peirce && e.peirce.sign_class_id !== undefined && e.peirce.sign_class_id !== null) {
      accepted++;
      const band = e.peirce.pragmatism_band ?? "UNKNOWN";
      bandCounts[band] = (bandCounts[band] ?? 0) + 1;
      const cid = String(e.peirce.sign_class_id);
      classCounts[cid] = (classCounts[cid] ?? 0) + 1;

      const fw = e.peirce.firstness_weight ?? 0.33;
      fe.pps = 1.0 - fw;
    } else {
      pending++;
    }

    events.push(fe);
  }

  return {
    events,
    generated_at: new Date().toISOString(),
    total: events.length,
    accepted,
    pending,
    band_distribution: bandCounts,
    class_distribution: classCounts,
  };
}

const snapshot = buildSnapshot();
fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(snapshot, null, 2));

console.log(`Generated: ${OUTPUT_JSON}`);
console.log(`  Total events: ${snapshot.total}`);
console.log(`  Accepted: ${snapshot.accepted}`);
console.log(`  Pending: ${snapshot.pending}`);
console.log(`  Bands: ${JSON.stringify(snapshot.band_distribution)}`);
console.log(`  File size: ${fs.statSync(OUTPUT_JSON).size.toLocaleString()} bytes`);
