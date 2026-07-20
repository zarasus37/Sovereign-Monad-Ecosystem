/**
 * Layer 6 — the multi-objective function J = αC + βL + γT − δS.
 *
 * The spec gives the formula and the term *names* (`TTCL_v1_0_BREAKDOWN.md:230-241`)
 * but, like the Layer 5 rewrite/attachModality work, leaves the per-term
 * normalization underspecified. Each term below is concretized on a comparable
 * [0, 1] scale, grounded in the spec's one-line gloss for that term, and
 * documented here rather than presented as spec-mandated.
 *
 *   C = Coverage   — "distinct composite signs visited" (line 235).
 *                     Per move: 1 if the new composite key is newly visited, else 0.
 *                     (The cumulative count is the run's coverage stat.)
 *   L = Locality   — "step-to-step smoothness (min change per move)" (line 236).
 *                     Per move: 1 − (roughness − 1)/(MAX_ROUGHNESS − 1), where
 *                     roughness ranks the move's semantic disruption
 *                     (LocalRotate 1 < WheelSwap 2 < PatternSwitch 3). Smaller
 *                     moves are smoother → L higher. Range [0, 1].
 *   T = Tripartite — "all 3 facets present in every N-step window" (line 237).
 *                     Per step: (#distinct TTCL domains appearing across the
 *                     trailing windowN composites) / 3. A single composite is
 *                     often bipartite (a pair of two wheels spans ≤2 domains);
 *                     the window is what guarantees the curriculum sees all 3.
 *   S = Cost       — "composites materialized per step (penalized)" (line 238).
 *                     Per move: (materializationCost − 1)/(MAX_COST − 1), where
 *                     a LocalRotate shifts one slot (cost 1) and a
 *                     PatternSwitch / WheelSwap materializes a fresh composite
 *                     (cost 2). Normalized to [0, 1]; enters J as −δS.
 *
 * The objective is computed per step; the SA loop accepts on ΔJ = J_new − J_old
 * (ΔJ > 0, else exp(ΔJ/T)). Because C, L, T, S are each in [0, 1], ΔJ ranges
 * over roughly [−(α+β+γ+δ), +(α+β+γ+δ)] = [−1, +1] for the default weights
 * (which sum to 1.0), keeping the acceptance probability well-behaved.
 */

import type { Domain } from "@sovereign/ttcl";

import type { WheelRegistry } from "./registry.js";
import { compositeKey } from "./moves.js";
import { ALL_DOMAINS, type Move, type ScheduleConfig, type ScheduleState } from "./state.js";

/** The six objective terms + the scalar J. All in [0, 1] except J. */
export interface ObjectiveTerms {
  readonly C: number;
  readonly L: number;
  readonly T: number;
  readonly S: number;
  /** Letter-pair validity (εP term) — 1 if valid, 0 if invalid, 1 if no letter-pairs configured. */
  readonly P: number;
  /** Fourth-Figure Tabula Generalis validity (ζF term) — 1 if valid, 0 if invalid, 1 if not enabled. */
  readonly F: number;
  readonly J: number;
}

/**
 * Letter-pair validity check (εP term).
 * 
 * Returns 1 if the current composite's letter combination is valid according to the
 * 45-pair letter table, 0 if invalid. When letter-pairs are not configured, returns 1.
 * 
 * Per spec: letter-pair validity is a DISTINCT term (εP), NOT a filter that rejects moves.
 * Invalid composites still execute but receive no εP bonus.
 */
export function letterPairValidity(
  state: ScheduleState,
  registry: WheelRegistry
): number {
  if (!registry.letterPairs) return 1; // No filter configured = always valid
  
  const pair = registry.pairById.get(state.pattern)!;
  const [w1, w2] = pair.wheels;
  
  const wheel1 = registry.wheels.get(w1)!;
  const wheel2 = registry.wheels.get(w2)!;
  
  const pos1 = state.offsets[w1]!;
  const pos2 = state.offsets[w2]!;
  
  // Get letters at current positions (fallback to A, B, C... if no alphabet defined)
  const letter1 = wheel1.alphabet?.[pos1] ?? String.fromCharCode(65 + pos1);
  const letter2 = wheel2.alphabet?.[pos2] ?? String.fromCharCode(65 + pos2);
  
  // Normalize key order (BC = CB for lookup)
  const key = letter1 < letter2 ? `${letter1}${letter2}` : `${letter2}${letter1}`;
  
  // Valid if letter pair exists in the 45-pair table
  return registry.letterPairs.letterPairLookup.has(key) ? 1 : 0;
}

/**
 * Fourth-Figure Tabula Generalis validity check (ζF term).
 * 
 * Returns 1 if the 3-wheel composite's letter combination forms a valid
 * camera in the Tabula Generalis (84 cameras), 0 if invalid.
 * When Fourth Figure is not enabled, returns 1.
 * 
 * This evaluates THREE wheels (THEOLOGY, TECHNOLOGY, COSMOLOGY facets),
 * unlike εP which evaluates two wheels from the active pair.
 */
export function fourthFigureValidity(
  state: ScheduleState,
  registry: WheelRegistry,
  facets: Readonly<Record<Domain, string>>
): number {
  if (!registry.fourthFigure || !registry.fourthFigure.enabled) return 1;
  
  // Get the three wheels currently active (THEOLOGY, TECHNOLOGY, COSMOLOGY)
  const domainOrder: Domain[] = ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"];
  
  const letters = domainOrder.map(domain => {
    const wheelName = facets[domain];
    const wheel = registry.wheels.get(wheelName)!;
    const pos = state.offsets[wheelName]!;
    return wheel.alphabet?.[pos] ?? String.fromCharCode(65 + pos);
  });
  
  // Normalize: sort alphabetically for lookup (BCD = CDB = DBC)
  const sorted = [...letters].sort();
  const key = sorted.join('');
  
  return registry.fourthFigure.cameraLookup.has(key) ? 1 : 0;
}

/** Move roughness — the semantic disruption rank (drives the Locality term). */
export function roughness(move: Move): number {
  switch (move.kind) {
    case "LocalRotate":
      return 1;
    case "WheelSwap":
      return 2;
    case "PatternSwitch":
      return 3;
  }
}

/** Max roughness (the Locality normalizer). */
export const MAX_ROUGHNESS = 3;

/** Move materialization cost — composites materialized (drives the Cost term). */
export function materializationCost(move: Move): number {
  switch (move.kind) {
    case "LocalRotate":
      return 1;
    case "PatternSwitch":
      return 2;
    case "WheelSwap":
      return 2;
  }
}

/** Min + max materialization cost (the Cost-term normalizers). */
export const MIN_COST = 1;
export const MAX_COST = 2;

/** Locality L(move) ∈ [0, 1]: smaller moves are smoother. */
export function locality(move: Move): number {
  return 1 - (roughness(move) - 1) / (MAX_ROUGHNESS - 1);
}

/** Cost S(move) ∈ [0, 1]: normalized composites materialized. */
export function cost(move: Move): number {
  return (materializationCost(move) - MIN_COST) / (MAX_COST - MIN_COST);
}

/**
 * The domains present in the active composite: the union of the two wheels'
 * domain bindings. A composite is often bipartite — the window, not the single
 * composite, carries the tripartite guarantee.
 */
export function compositeDomains(state: ScheduleState, registry: WheelRegistry): ReadonlySet<Domain> {
  const pair = registry.pairById.get(state.pattern)!;
  const out = new Set<Domain>();
  for (const wn of pair.wheels) {
    for (const d of registry.wheels.get(wn)!.domains) out.add(d);
  }
  return out;
}

/**
 * Tripartite T ∈ [0, 1] over a trailing window of composite-domain sets: the
 * fraction of the 3 TTCL domains present in at least one composite in the
 * window. `window` is the trailing `windowN` composite-domain sets (most
 * recent last); the caller maintains it in the anneal loop.
 */
export function tripartite(window: readonly ReadonlySet<Domain>[]): number {
  if (window.length === 0) return 0;
  const present = new Set<Domain>();
  for (const composite of window) {
    for (const d of composite) present.add(d);
  }
  return present.size / ALL_DOMAINS.length;
}

/**
 * Evaluate the objective terms for a step: given the move just taken, the new
 * state, the trailing composite-domain window (NOT yet including this step —
 * the caller appends this step's compositeDomains), and the visited composite
 * keys, return {C, L, T, S, P, F, J}.
 *
 * C uses `compositeKey(newState)` against `visited` (the caller adds the new
 * key to the set after evaluation if the step is accepted). T uses `window`
 * (the pre-step trailing window). L + S use `move`. P uses letter-pair validity.
 * F uses Fourth-Figure validity (3-wheel composite).
 *
 * Extended formula: J = αC + βL + γT − δS + εP + ζF
 */
export function evaluateMove(
  move: Move,
  newState: ScheduleState,
  window: readonly ReadonlySet<Domain>[],
  visited: ReadonlySet<string>,
  registry: WheelRegistry,
  config: ScheduleConfig,
): ObjectiveTerms {
  const C = visited.has(compositeKey(newState, registry)) ? 0 : 1;
  const L = locality(move);
  const T = tripartite(window);
  const S = cost(move);
  
  // Letter-pair validity (εP term) — distinct from Coverage per spec
  const P = letterPairValidity(newState, registry);
  
  // Fourth-Figure validity (ζF term) — evaluates 3-wheel composite
  const F = fourthFigureValidity(newState, registry, newState.facets);
  
  // Core objective: αC + βL + γT − δS
  const J_core = config.weights.alpha * C 
               + config.weights.beta * L 
               + config.weights.gamma * T 
               - config.weights.delta * S;
               
  // Add letter-pair bonus: J = J_core + εP + ζF
  const epsilon = config.weights.epsilon ?? 0.05;
  const zeta = config.weights.zeta ?? 0.02;
  const J = J_core + epsilon * P + zeta * F;
          
  return { C, L, T, S, P, F, J };
}

/** ΔJ = J_new − J_old (the SA acceptance delta). */
export function deltaJ(prev: ObjectiveTerms, next: ObjectiveTerms): number {
  return next.J - prev.J;
}