#!/usr/bin/env node
/**
 * Layer 7 dry-run feedstock prep — emit the tiny Gnosis-event JSONL slices the
 * dry run trains on.
 *
 * Drives the REAL Layer 6 → Layer 7 data path (no stub):
 *   `generateSchedule` (@sovereign/scheduler, the SA wheel-rotation optimizer)
 *     → `generateGnosisEvents` (@sovereign/gnosis-training-data, the consumer)
 *     → filter `constitution_score.passes` (the SFT inclusion gate, spec line 172)
 *     → slice the first N passing events.
 *
 * Emits two files under `gnosis-training/data/`:
 *   - `gnosis-events-train.jsonl`  (DRY_RUN_TRAIN_EVENTS = 16 passing events)
 *   - `gnosis-events-test.jsonl`   (DRY_RUN_TEST_EVENTS  = 8  passing events,
 *                                   disjoint from train by offset)
 *
 * NDJSON only — NO `#`-prefixed header line. The Python reader
 * (`gnosis_training.dataset.read_events_jsonl`) does not strip comment lines, so
 * emitting `jsonlHeader` would crash it; the header is omitted here on purpose.
 *
 * Deterministic: a pure function of the fixture registry + DEFAULT_CONFIG seed
 * (42) — same inputs → byte-identical JSONL (the repo's reproducibility gate).
 * Run on any box with the built TS `dist/` (the run script builds it first).
 *
 * NOTE: this is the SAME data path the real 8B run uses — only the slice size
 * differs. The `assistant` content is EMPTY (the data-gen producer emits the
 * target empty; SFT trains on the system+user scaffold). See
 * `docs/gnosis-training/DRY_RUN_RUNBOOK.md`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import the BUILT dist directly via relative paths (not bare `@sovereign/*`
// specifiers). pnpm installs each workspace package's `@sovereign/*` symlinks
// inside THAT package's own `node_modules/`, never at the repo root — so a raw
// `node` script in `gnosis-training/scripts/` cannot resolve bare specifiers by
// walking up. Importing the dist files directly lets node resolve each dist's
// internal `@sovereign/*` imports from the package's own `node_modules/`. This
// is why the run script builds the two packages' dist first. Requires the
// `@sovereign/scheduler` + `@sovereign/gnosis-training-data` dist to be built
// (the run script does `pnpm --filter ... build` before invoking this).
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

const TRAIN_COUNT = 16;
const TEST_COUNT = 8;

function main() {
  const schedule = generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG);
  const registry = loadRegistry(REGISTRY_PATH);
  const allEvents = generateGnosisEvents(schedule, registry);

  // The SFT inclusion gate (spec line 172): only constitution-passing events
  // train. Filter client-side so the slices are exactly TRAIN/TEST passing
  // events — otherwise the gate would silently drop rows and SFT would get
  // fewer samples than the dry-run config expects.
  const passing = allEvents.filter((e) => e.constitution_score.passes === true);
  if (passing.length < TRAIN_COUNT + TEST_COUNT) {
    console.error(
      `prepare-feedstock: only ${passing.length} passing events available, ` +
        `need ${TRAIN_COUNT + TEST_COUNT}. Re-run with a longer schedule ` +
        `(DEFAULT_CONFIG.steps).`,
    );
    process.exit(1);
  }

  const train = passing.slice(0, TRAIN_COUNT);
  const test = passing.slice(TRAIN_COUNT, TRAIN_COUNT + TEST_COUNT);

  mkdirSync(DATA_DIR, { recursive: true });
  const trainPath = resolve(DATA_DIR, "gnosis-events-train.jsonl");
  const testPath = resolve(DATA_DIR, "gnosis-events-test.jsonl");
  writeFileSync(trainPath, serializeEventsJsonl(train), "utf8");
  writeFileSync(testPath, serializeEventsJsonl(test), "utf8");

  console.log(
    `prepare-feedstock: wrote ${train.length} train + ${test.length} test ` +
      `passing gnosis events (${allEvents.length} total emitted, ` +
      `${passing.length} passing) →`,
  );
  console.log(`  ${trainPath}`);
  console.log(`  ${testPath}`);
}

main();