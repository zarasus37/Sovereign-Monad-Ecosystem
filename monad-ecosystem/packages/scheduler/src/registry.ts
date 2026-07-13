/**
 * Layer 6 — the wheel + pair-table registry.
 *
 * `loadRegistry` reads raw JSON, validates it against the canonical
 * `wheel-registry-schema.json` (`shared/ttcl-specs/`) with ajv at runtime, then
 * enforces the cross-reference integrity the schema cannot express (facet
 * wheels + pair wheels must reference declared wheels; no duplicate wheel
 * names; a facet's wheel must actually cover that domain; no duplicate pair
 * ids). On success it builds an in-memory `WheelRegistry` with live
 * `@sovereign/ttcl` `Wheel<N>` instances (one per declared wheel, `initial:0`)
 * so a consumer can drive the real runtime, plus plain `size`/domain metadata
 * for the scheduler's immutable state transitions.
 *
 * Schema resolution + ajv follow the @sovereign/compiler loader discipline: the
 * schema is read from the repo root via `import.meta.url` (one canonical copy,
 * not imported as a JSON module that would break `tsc` declaration emit), and
 * ajv is a *runtime* dependency with the named `{ Ajv }` import required under
 * NodeNext (the CJS default import is a non-callable namespace — see the
 * ajv-nodenext memory).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import { Wheel, type Domain } from "@sovereign/ttcl";

import { RegistrySchemaError, RegistryIntegrityError } from "./errors.js";

// Resolve the canonical schema from the repo root. From this file
// (src/registry.ts or dist/registry.js, both at .../scheduler/{src,dist}/),
// four `..` reach the repo root; `shared/ttcl-specs/wheel-registry-schema.json`
// is the single source of truth.
const SCHEMA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "shared",
  "ttcl-specs",
  "wheel-registry-schema.json",
);
const schemaJson: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

// One ajv instance; the registry schema is compiled once at module load.
const ajv = new Ajv({ allErrors: true, strict: true });
const validate: ValidateFunction = ajv.compile(schemaJson as AnySchema);

/** A declared wheel (Llull Figura): a name, a slot count, and its domain binding. */
export interface WheelAsset {
  readonly name: string;
  readonly size: number;
  readonly domains: readonly Domain[];
}

/** A pair-table entry: an id and the two distinct wheel names that form the pair. */
export interface Pair {
  readonly id: string;
  readonly wheels: readonly [string, string];
}

/**
 * The in-memory registry: live `Wheel<N>` instances (real @sovereign/ttcl
 * wheels, `initial:0`, available for any runtime consumer) plus the metadata
 * the scheduler's immutable state transitions need.
 */
export interface WheelRegistry {
  readonly registry: string;
  /** Declared wheels keyed by name. */
  readonly wheels: ReadonlyMap<string, WheelAsset>;
  /** Wheel names in declaration order. */
  readonly wheelNames: readonly string[];
  /** Live `Wheel<N>` instances keyed by name (initial position 0). */
  readonly liveWheels: ReadonlyMap<string, Wheel<number>>;
  /** The default facet-to-wheel assignment: domain → wheel name. */
  readonly facets: ReadonlyMap<Domain, string>;
  /** The pair table, in declaration order. */
  readonly pairs: readonly Pair[];
  /** Pair ids in declaration order. */
  readonly pairIds: readonly string[];
  /** Pairs keyed by id. */
  readonly pairById: ReadonlyMap<string, Pair>;
}

/** The raw JSON shape (post-ajv, pre-integrity). */
interface RegistryJson {
  registry: string;
  wheels: { name: string; size: number; domains: Domain[] }[];
  facets: { THEOLOGY: string; TECHNOLOGY: string; COSMOLOGY: string };
  pairs: { id: string; wheels: [string, string] }[];
}

/**
 * Load + validate + integrity-check a wheel registry JSON file. Throws a
 * `RegistrySchemaError` (ajv) or `RegistryIntegrityError` (cross-refs) on
 * failure; returns the in-memory `WheelRegistry` on success.
 */
export function loadRegistry(path: string): WheelRegistry {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return buildRegistry(raw);
}

/** Build (validate + integrity-check) a registry from a parsed JSON value. */
export function buildRegistry(raw: unknown): WheelRegistry {
  if (!validate(raw)) {
    throw new RegistrySchemaError(validate.errors ?? []);
  }
  const json = raw as RegistryJson;

  // Integrity 1: no duplicate wheel names; build the wheel map.
  const wheels = new Map<string, WheelAsset>();
  const wheelNames: string[] = [];
  for (const w of json.wheels) {
    if (wheels.has(w.name)) {
      throw new RegistryIntegrityError(`duplicate wheel name '${w.name}'`);
    }
    wheels.set(w.name, { name: w.name, size: w.size, domains: w.domains });
    wheelNames.push(w.name);
  }

  // Live Wheel<N> instances (real runtime wheels, initial position 0).
  const liveWheels = new Map<string, Wheel<number>>();
  for (const w of json.wheels) {
    liveWheels.set(w.name, new Wheel<number>(w.size, 0));
  }

  // Integrity 2: every facet wheel exists AND covers that domain.
  const facetEntries: readonly [Domain, string][] = [
    ["THEOLOGY", json.facets.THEOLOGY],
    ["TECHNOLOGY", json.facets.TECHNOLOGY],
    ["COSMOLOGY", json.facets.COSMOLOGY],
  ];
  const facets = new Map<Domain, string>();
  for (const [domain, wheelName] of facetEntries) {
    const asset = wheels.get(wheelName);
    if (!asset) {
      throw new RegistryIntegrityError(
        `facet ${domain} references undeclared wheel '${wheelName}'`,
      );
    }
    if (!asset.domains.includes(domain)) {
      throw new RegistryIntegrityError(
        `facet ${domain} → wheel '${wheelName}' does not cover ${domain} (its domains are [${asset.domains.join(", ")}])`,
      );
    }
    facets.set(domain, wheelName);
  }

  // Integrity 3: every pair wheel exists; pair wheels are distinct (schema
  // enforces uniqueness, but assert the two entries differ by value too); no
  // duplicate pair ids.
  const pairs: Pair[] = [];
  const pairIds: string[] = [];
  const pairById = new Map<string, Pair>();
  for (const p of json.pairs) {
    if (pairById.has(p.id)) {
      throw new RegistryIntegrityError(`duplicate pair id '${p.id}'`);
    }
    for (const wn of p.wheels) {
      if (!wheels.has(wn)) {
        throw new RegistryIntegrityError(
          `pair '${p.id}' references undeclared wheel '${wn}'`,
        );
      }
    }
    if (p.wheels[0] === p.wheels[1]) {
      throw new RegistryIntegrityError(
        `pair '${p.id}' must join two distinct wheels (got '${p.wheels[0]}' twice)`,
      );
    }
    const pair: Pair = { id: p.id, wheels: p.wheels };
    pairs.push(pair);
    pairIds.push(p.id);
    pairById.set(p.id, pair);
  }

  return {
    registry: json.registry,
    wheels,
    wheelNames,
    liveWheels,
    facets,
    pairs,
    pairIds,
    pairById,
  };
}

/**
 * Pure wheel-position rotation mirroring `@sovereign/ttcl` `Wheel.rotate`
 * (`wheel.ts:40`): `(pos + ((steps % size) + size)) % size`. Used by the
 * scheduler's immutable state transitions so the visited-set can hold plain
 * offset numbers without mutating the live `Wheel` instances.
 */
export function rotateOffset(size: number, pos: number, steps: number): number {
  return (pos + ((steps % size) + size)) % size;
}