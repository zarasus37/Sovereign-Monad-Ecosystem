#!/usr/bin/env node
/**
 * Preference-pair worksheet feedstock prep — emit ~250 passing Gnosis events as
 * the PROMPT set for the human-authored reward-model worksheet.
 *
 * Same real Layer 6 → 7 data path as `prepare-feedstock.mjs` (generateSchedule
 * → generateGnosisEvents → filter `constitution_score.passes`), but instead of
 * the dry-run's tiny 16+8 train/test split it emits a single larger slice the
 * `bootstrap-worksheet` CLI turns into one pair-per-event. The guide's target
 * is 250 human-judged pairs (`theo-techno-cosmo/plex/Review/
 * REWARD_MODEL_PREFERENCE_PAIRS_GUIDE.md`), so we emit 250 passing events.
 *
 * Emits one file under `gnosis-training/data/`:
 *   - `gnosis-events-worksheet.jsonl`  (250 passing events → 250-pair scaffold)
 *
 * NDJSON only (no `#` header — the Python reader doesn't strip comments).
 * Deterministic: a pure function of the fixture registry + DEFAULT_CONFIG seed.
 *
 * The worksheet's pre-assigned `category` is a round-robin PLACEHOLDER
 * (`build_bootstrap_worksheet` uses `index % 8`); it does NOT match the guide's
 * exact 50/40/35/30/30/30/25/10 distribution. The human assigns the real
 * category per the guide as they author each pair. Run on any box with the
 * built TS `dist/` (the run script / `pnpm --filter ... build` builds it first).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import the BUILT dist directly via relative paths (not bare `@sovereign/*`).
// See prepare-feedstock.mjs for the pnpm-per-package-symlink gotcha.
import {
  generateSchedule,
  loadRegistry,
  DEFAULT_CONFIG,
} from "../../monad-ecosystem/packages/scheduler/dist/index.js";
import {
  generateGnosisEvents,
  serializeEventsJsonl,
} from "../../monad-ecosystem/packages/gnosis-training-data/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const REGISTRY_PATH = resolve(repoRoot, "shared", "fixtures", "layer6", "wheel-registry.json");
const DATA_DIR = resolve(__dirname, "..", "data");

// The guide's target: 250 human-judged pairs. One pair per event → 250 events.
const WORKSHEET_COUNT = 250;

function main() {
  const schedule = generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG);
  const registry = loadRegistry(REGISTRY_PATH);
  const allEvents = generateGnosisEvents(schedule, registry);

  const passing = allEvents.filter((e) => e.constitution_score.passes === true);
  if (passing.length < WORKSHEET_COUNT) {
    console.error(
      `prepare-worksheet-feedstock: only ${passing.length} passing events ` +
        `available, need ${WORKSHEET_COUNT}. Re-run with a longer schedule ` +
        `(DEFAULT_CONFIG.steps).`,
    );
    process.exit(1);
  }

  const events = passing.slice(0, WORKSHEET_COUNT);
  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = resolve(DATA_DIR, "gnosis-events-worksheet.jsonl");
  writeFileSync(outPath, serializeEventsJsonl(events), "utf8");

  console.log(
    `prepare-worksheet-feedstock: wrote ${events.length} passing gnosis events ` +
      `(${allEvents.length} total emitted, ${passing.length} passing) for the ` +
      `preference-pair worksheet →`,
  );
  console.log(`  ${outPath}`);
  console.log(
    `next: uv run python -m gnosis_training bootstrap-worksheet ` +
      `data/gnosis-events-worksheet.jsonl data/preference_pairs_worksheet.jsonl`,
  );
}

main();