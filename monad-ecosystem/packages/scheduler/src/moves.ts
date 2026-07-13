/**
 * Layer 6 — the move proposals + the state-transition kernel.
 *
 * The three move kinds and their draw probabilities are spec-fixed
 * (`TTCL_v1_0_BREAKDOWN.md:248-251`): LocalRotate 0.65, PatternSwitch 0.25,
 * WheelSwap 0.10. `proposeMove` draws by those probabilities; `applyMove`
 * produces a *new* immutable state (never mutates). The global constraint
 * "at least one wheel per TTCL facet always active" (line 253) is enforced by
 * construction — every proposed WheelSwap targets a wheel the loader has
 * already validated covers that domain, so the invariant cannot be broken by
 * any single move; `constraintHolds` is provided as an assertion for tests and
 * the anneal loop.
 *
 * Coverage key: the spec's "distinct composite signs visited" (line 235) is the
 * materialized combination — the active pair at its two current wheel
 * positions. `compositeKey` therefore ranges over `(pattern, pos_w1, pos_w2)`,
 * NOT the full 5-wheel offset vector: a LocalRotate on a wheel NOT in the
 * active pair changes the state but not the composite (ΔC = 0), which is the
 * intended dynamics (coverage rewards rotating the active pair + switching
 * pairs, not spinning idle wheels). The non-active offsets still matter — a
 * later WheelSwap can promote an idle wheel's current position into a new
 * composite.
 */

import type { Domain } from "@sovereign/ttcl";

import type { WheelRegistry } from "./registry.js";
import { rotateOffset } from "./registry.js";
import { ALL_DOMAINS, type Move, type MoveKind, type ScheduleState, MOVE_PROBABILITIES } from "./state.js";
import type { Rng } from "./rng.js";

/**
 * Propose a move from `state` by the spec move probabilities. The proposal is
 * always *valid* (a LocalRotate targets a real wheel; a PatternSwitch targets a
 * real pair, different from the current when alternatives exist; a WheelSwap
 * targets a wheel that covers the chosen facet). When a move kind has no valid
 * alternative (only one pair, or only one wheel covers a facet), the proposal
 * falls back to a LocalRotate so no step is wasted on a no-op.
 */
export function proposeMove(state: ScheduleState, rng: Rng, registry: WheelRegistry): Move {
  const r = rng.next();
  if (r < MOVE_PROBABILITIES.LocalRotate) {
    return proposeLocalRotate(rng, registry);
  }
  if (r < MOVE_PROBABILITIES.LocalRotate + MOVE_PROBABILITIES.PatternSwitch) {
    return proposePatternSwitch(state, rng, registry);
  }
  return proposeWheelSwap(state, rng, registry);
}

/** LocalRotate: pick any declared wheel, rotate it by ±1. */
function proposeLocalRotate(rng: Rng, registry: WheelRegistry): Move {
  const wheel = rng.pick(registry.wheelNames);
  const delta: 1 | -1 = rng.next() < 0.5 ? -1 : 1;
  return { kind: "LocalRotate", wheel, delta };
}

/** PatternSwitch: pick a pair different from the current pattern, or fall back. */
function proposePatternSwitch(state: ScheduleState, rng: Rng, registry: WheelRegistry): Move {
  const alternatives = registry.pairIds.filter((id) => id !== state.pattern);
  if (alternatives.length === 0) {
    // Only one pair in the table — PatternSwitch is impossible; fall back.
    return proposeLocalRotate(rng, registry);
  }
  return { kind: "PatternSwitch", toPair: rng.pick(alternatives) };
}

/** WheelSwap: pick a facet + a different wheel that covers it, or fall back. */
function proposeWheelSwap(state: ScheduleState, rng: Rng, registry: WheelRegistry): Move {
  const facet = rng.pick(ALL_DOMAINS);
  const current = state.facets[facet];
  const candidates = registry.wheelNames.filter((name) => {
    if (name === current) return false;
    return registry.wheels.get(name)!.domains.includes(facet);
  });
  if (candidates.length === 0) {
    // No other wheel covers this facet — fall back to a LocalRotate.
    return proposeLocalRotate(rng, registry);
  }
  return { kind: "WheelSwap", facet, toWheel: rng.pick(candidates) };
}

/**
 * Apply a move, returning a *new* state (immutable). The constraint is
 * preserved by construction (see module doc); `constraintHolds` can assert it.
 */
export function applyMove(state: ScheduleState, move: Move, registry: WheelRegistry): ScheduleState {
  switch (move.kind) {
    case "LocalRotate": {
      const size = registry.wheels.get(move.wheel)!.size;
      const cur = state.offsets[move.wheel]!;
      return { ...state, offsets: { ...state.offsets, [move.wheel]: rotateOffset(size, cur, move.delta) } };
    }
    case "PatternSwitch":
      return { ...state, pattern: move.toPair };
    case "WheelSwap":
      return { ...state, facets: { ...state.facets, [move.facet]: move.toWheel } };
  }
}

/**
 * The global invariant: every facet maps to a declared wheel that covers that
 * domain. Holds at the initial state (loader-validated) and is preserved by
 * every move (proposals only target covering wheels). Exposed for assertions.
 */
export function constraintHolds(state: ScheduleState, registry: WheelRegistry): boolean {
  for (const d of ALL_DOMAINS) {
    const name = state.facets[d];
    const asset = registry.wheels.get(name);
    if (!asset || !asset.domains.includes(d)) return false;
  }
  return true;
}

/**
 * The coverage key for a state: the active pair + its two wheel positions. Two
 * states with the same composite key materialize the same composite sign; ΔC
 * = 1 iff a move produces a composite key not yet in the visited set.
 */
export function compositeKey(state: ScheduleState, registry: WheelRegistry): string {
  const pair = registry.pairById.get(state.pattern)!;
  const [w1, w2] = pair.wheels;
  return `${state.pattern}:${state.offsets[w1]!}:${state.offsets[w2]!}`;
}

/** The magnitude (cost) of a move, used by the Locality + Cost terms. */
export function moveMagnitude(move: Move): number {
  switch (move.kind) {
    case "LocalRotate":
      return 1;
    case "PatternSwitch":
      return 2;
    case "WheelSwap":
      return 2;
  }
}

/** The maximum move magnitude (the Locality normalizer). */
export const MAX_MOVE_MAGNITUDE = 2;

/** Move-kind label for the step log. */
export function moveKind(move: Move): MoveKind {
  return move.kind;
}