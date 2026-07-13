/**
 * Gnosis-event JSON Schema loader + validator.
 *
 * Loads `shared/ttcl-specs/gnosis-event.json` from the repo root (four `..`
 * from src/, mirroring @sovereign/scheduler's schedule.ts schema-resolution
 * pattern) and compiles an ajv validator at module load. ajv is imported as the
 * named `{ Ajv }` — required under NodeNext (the CJS default export is a
 * non-callable namespace; see the ajv-nodenext memory).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";

const SCHEMA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "shared",
  "ttcl-specs",
  "gnosis-event.json",
);

const schemaJson: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate: ValidateFunction = ajv.compile(schemaJson as AnySchema);

/** `true` when `event` conforms to `gnosis-event.json`. */
export function validateGnosisEvent(event: unknown): boolean {
  return validate(event) === true;
}

/** ajv errors from the last `validateGnosisEvent` call (null if it passed). */
export function lastGnosisEventErrors(): unknown {
  return validate.errors;
}