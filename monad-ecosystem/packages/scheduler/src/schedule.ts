/**
 * Layer 6 — the schedule facade.
 *
 * `generateSchedule` is the public entry: load a wheel registry → seed a
 * deterministic PRNG → run the annealer → assemble the `CanonicalSchedule`
 * artifact → ajv-validate it against `canonical-schedule-schema.json` → return.
 * The artifact is the prose's "canonical_schedule.json that tells you the
 * default rotation sequence for data generation"
 * (`TTCL_v1_0_BREAKDOWN.md:271`).
 *
 * Serialization is canonical (sorted object keys, stable ordering of the
 * registry arrays) so two runs with the same config + registry + seed produce
 * byte-identical JSON — the reproducibility gate for the checked-in fixture.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import type { Domain } from "@sovereign/ttcl";

import { loadRegistry, type WheelRegistry, type WheelAsset, type Pair } from "./registry.js";
import { anneal, type ScheduleRun, type ScheduleStep, type ScheduleBest, type CoverageStats } from "./anneal.js";
import { mulberry32 } from "./rng.js";
import { DEFAULT_CONFIG, type ScheduleConfig, type ScheduleState } from "./state.js";
import { ScheduleSchemaError } from "./errors.js";

// Resolve the canonical output schema from the repo root (four `..` from src/).
const SCHEMA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "shared",
  "ttcl-specs",
  "canonical-schedule-schema.json",
);
const schemaJson: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate: ValidateFunction = ajv.compile(schemaJson as AnySchema);

/** Artifact version + generator id. */
export const ARTIFACT_VERSION = "1.0.0";
export const GENERATOR_ID = "ttcl-scheduler-v1";

/** The registry snapshot recorded in the artifact (JSON shape, not the in-memory map form). */
export interface RegistrySnapshot {
  readonly registry: string;
  readonly wheels: readonly { readonly name: string; readonly size: number; readonly domains: readonly Domain[] }[];
  readonly facets: Readonly<Record<Domain, string>>;
  readonly pairs: readonly { readonly id: string; readonly wheels: readonly [string, string] }[];
}

/** The full canonical-schedule artifact (matches canonical-schedule-schema.json). */
export interface CanonicalSchedule {
  readonly version: string;
  readonly generator: string;
  readonly config: ScheduleConfig;
  readonly registry: RegistrySnapshot;
  readonly initial: ScheduleState;
  readonly steps: readonly ScheduleStep[];
  readonly best: ScheduleBest;
  readonly coverage: CoverageStats;
}

/** Snapshot a registry into the JSON shape recorded in the artifact. */
function snapshotRegistry(registry: WheelRegistry): RegistrySnapshot {
  const wheels = registry.wheelNames.map((name) => {
    const w: WheelAsset = registry.wheels.get(name)!;
    return { name: w.name, size: w.size, domains: w.domains };
  });
  const facets: Record<Domain, string> = {
    THEOLOGY: registry.facets.get("THEOLOGY")!,
    TECHNOLOGY: registry.facets.get("TECHNOLOGY")!,
    COSMOLOGY: registry.facets.get("COSMOLOGY")!,
  };
  const pairs = registry.pairs.map((p: Pair) => ({ id: p.id, wheels: p.wheels }));
  return { registry: registry.registry, wheels, facets, pairs };
}

/** Assemble the artifact from an anneal run + the registry it ran against. */
export function assembleSchedule(run: ScheduleRun, registry: WheelRegistry): CanonicalSchedule {
  return {
    version: ARTIFACT_VERSION,
    generator: GENERATOR_ID,
    config: run.config,
    registry: snapshotRegistry(registry),
    initial: run.initial,
    steps: run.steps,
    best: run.best,
    coverage: run.coverage,
  };
}

/**
 * Generate a canonical schedule: load registry → anneal → assemble → validate.
 * Throws `ScheduleSchemaError` if the assembled artifact fails its schema
 * (unreachable in practice — signals a scheduler bug). `config` defaults to
 * `DEFAULT_CONFIG` when omitted.
 */
export function generateSchedule(registryPath: string, config: ScheduleConfig = DEFAULT_CONFIG): CanonicalSchedule {
  const registry = loadRegistry(registryPath);
  const rng = mulberry32(config.seed);
  const run = anneal(registry, config, rng);
  const schedule = assembleSchedule(run, registry);
  if (!validate(schedule)) {
    throw new ScheduleSchemaError(validate.errors ?? []);
  }
  return schedule;
}

/**
 * Canonical JSON serialization: 2-space indent, keys sorted. Two schedules that
 * are equal-by-value serialize to byte-identical strings — the reproducibility
 * gate (regenerating the checked-in fixture from the default seed must match).
 */
export function serializeSchedule(schedule: CanonicalSchedule): string {
  return JSON.stringify(schedule, null, 2);
}