/**
 * Layer 6 — the scheduler state, config, and move types.
 *
 * The spec's state space (`TTCL_v1_0_BREAKDOWN.md:245`) is
 *   (offset_A, offset_T, offset_V, offset_X, offset_S, pattern)
 * — i.e. one offset per rotating wheel plus an active `pattern`. The spec
 * leaves the facet-to-wheel binding implicit, but the `WheelSwap` move
 * ("change which wheel covers a facet", line 251) implies that binding is
 * *mutable* state, so this concretization makes `facets` an explicit state
 * field: `Record<Domain, WheelName>`. This is a faithful concretization of an
 * underspecified state, documented here rather than presented as spec-mandated
 * (the same honesty discipline as the Layer 5 rewrite/attachModality work).
 *
 * `pattern` is concretized (per the user-confirmed design) as the id of an
 * active wheel-pair drawn from the registry's pair table — grounded in the
 * spec's `combineWheels(wA, wB, rule, budget)` pairing-rule signature (line
 * 128) and the "PairTable (ALL, Hybrid, 45 pairs)" asset (line 457).
 *
 * All state objects are readonly/immutable: a move *produces a new* state
 * (never mutates in place), so the visited-set and the step log can hold
 * stable references.
 */

import type { Domain } from "@sovereign/ttcl";

import type { WheelRegistry } from "./registry.js";

/**
 * The canonical domain order (THEOLOGY, TECHNOLOGY, COSMOLOGY). No shared
 * canonical-order array exists in the repo — `@sovereign/ttcl` and
 * `@sovereign/compiler` each keep a private copy, so the scheduler defines its
 * own (matching theirs) rather than reaching across packages.
 */
export const ALL_DOMAINS: readonly Domain[] = ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"];

/** A scheduler state: one offset per wheel, the active pair, and the facet assignment. */
export interface ScheduleState {
  /** Wheel name → current offset in [0, size). */
  readonly offsets: Readonly<Record<string, number>>;
  /** The active pair id (a member of the registry's pair table). */
  readonly pattern: string;
  /** Domain → the wheel name currently covering that facet. */
  readonly facets: Readonly<Record<Domain, string>>;
}

/**
 * The annealing configuration. Defaults follow the spec exactly where it is
 * concrete (objective weights line 240; SA constants line 257-259) and pick a
 * documented default where the spec is silent (`steps`, `seed`, `windowN`).
 */
export interface ScheduleConfig {
  /** Objective weights α, β, γ, δ (spec: 0.35 / 0.25 / 0.30 / 0.10). */
  readonly weights: { readonly alpha: number; readonly beta: number; readonly gamma: number; readonly delta: number };
  /** Initial temperature (spec: 1.0). */
  readonly T_init: number;
  /** Minimum temperature — the anneal stops here (spec: 0.001). */
  readonly T_min: number;
  /** Per-step cooling factor (spec: 0.9995). */
  readonly cooling: number;
  /** Maximum number of steps (the spec gives no figure; 5000 is a documented default). */
  readonly steps: number;
  /** PRNG seed (the spec's "run multiple seeds" mitigation, line 488, requires seedability; default 42). */
  readonly seed: number;
  /** The tripartite window size N (spec: "every N-step window", no figure given; default 3). */
  readonly windowN: number;
}

/** The default configuration (spec-concrete where possible, documented defaults otherwise). */
export const DEFAULT_CONFIG: ScheduleConfig = {
  weights: { alpha: 0.35, beta: 0.25, gamma: 0.30, delta: 0.10 },
  T_init: 1.0,
  T_min: 0.001,
  cooling: 0.9995,
  steps: 5000,
  seed: 42,
  windowN: 3,
};

/** The three move kinds, drawn by their spec probabilities (line 249-251). */
export type MoveKind = "LocalRotate" | "PatternSwitch" | "WheelSwap";

/** A proposed move (discriminated union). */
export type Move =
  | { readonly kind: "LocalRotate"; readonly wheel: string; readonly delta: 1 | -1 }
  | { readonly kind: "PatternSwitch"; readonly toPair: string }
  | { readonly kind: "WheelSwap"; readonly facet: Domain; readonly toWheel: string };

/** The spec move probabilities (LocalRotate 0.65 / PatternSwitch 0.25 / WheelSwap 0.10). */
export const MOVE_PROBABILITIES = {
  LocalRotate: 0.65,
  PatternSwitch: 0.25,
  WheelSwap: 0.10,
} as const;

/**
 * The initial state: every wheel at offset 0, the first pair in the registry
 * active, and the registry's default facet assignment. The constraint "at
 * least one wheel per TTCL facet always active" (line 253) holds by
 * construction — the registry loader guarantees every facet maps to a wheel
 * that covers it.
 */
export function initialState(registry: WheelRegistry): ScheduleState {
  const offsets: Record<string, number> = {};
  for (const name of registry.wheelNames) offsets[name] = 0;
  const facets: Record<Domain, string> = {
    THEOLOGY: registry.facets.get("THEOLOGY")!,
    TECHNOLOGY: registry.facets.get("TECHNOLOGY")!,
    COSMOLOGY: registry.facets.get("COSMOLOGY")!,
  };
  return { offsets, pattern: registry.pairIds[0], facets };
}