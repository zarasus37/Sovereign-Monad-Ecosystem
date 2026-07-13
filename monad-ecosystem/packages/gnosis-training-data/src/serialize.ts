/**
 * Deterministic NDJSON (JSONL) serialization of Gnosis training events.
 *
 * One stable-keyed `JSON.stringify` per line — no sorting of the event object is
 * needed because the fields are inserted in declaration order (the `GnosisEvent`
 * literal is built in canonical order in `consumer.ts`), so two runs with the
 * same `(schedule, registry, config)` produce byte-identical JSONL. The
 * reproducibility gate mirrors @sovereign/scheduler's `serializeSchedule`.
 */

import type { GnosisEvent } from "./event.js";
import { EVENT_FORMAT_VERSION } from "./consumer.js";

/**
 * Serialize events as NDJSON (one event per line). Deterministic + byte-stable.
 */
export function serializeEventsJsonl(events: readonly GnosisEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length > 0 ? "\n" : "");
}

/**
 * A deterministic JSONL header line recording the event-format version + event
 * count. Prefixed with `#` so a future SFT loader can strip metadata lines
 * before parsing records. Honest: records the format version, not a schema URL.
 */
export function jsonlHeader(eventCount: number): string {
  return `# format=${EVENT_FORMAT_VERSION} count=${eventCount}\n`;
}