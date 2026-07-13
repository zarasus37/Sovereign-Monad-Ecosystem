/**
 * Layer 6 — the simulated-annealing loop.
 *
 * Spec constants (`TTCL_v1_0_BREAKDOWN.md:255-262`): T_init 1.0, T_min 0.001,
 * cooling 0.9995 per step; accept a move if ΔJ > 0, else with probability
 * exp(ΔJ / T_current). The loop explores the space of valid rotation sequences
 * (line 265), tracking the best state by J, the distinct-composite coverage, and
 * a per-domain visit balance for the curriculum report.
 *
 * Determinism: the loop is a pure function of (registry, config, rng). The draw
 * order is fixed — per step: (1) the move-type draw, (2) the move-internal
 * draws, (3) exactly one accept/reject draw *only when* ΔJ ≤ 0 and T > 0 — so
 * the same seed always yields the same trajectory and the checked-in
 * `canonical_schedule.json` is reproducible byte-for-byte. The window of
 * accepted composite-domain sets (the tripartite window) advances only on an
 * accepted step, so it reflects the curriculum actually visited.
 */

import type { Domain } from "@sovereign/ttcl";

import type { WheelRegistry } from "./registry.js";
import { applyMove, compositeKey, proposeMove } from "./moves.js";
import { evaluateMove, deltaJ, compositeDomains, type ObjectiveTerms } from "./objective.js";
import { ALL_DOMAINS, initialState, type MoveKind, type ScheduleConfig, type ScheduleState } from "./state.js";
import type { Rng } from "./rng.js";

/** A recorded annealing step. */
export interface ScheduleStep {
  readonly t: number;
  /** The state after this step (the candidate if accepted, else the unchanged current). */
  readonly state: ScheduleState;
  readonly terms: ObjectiveTerms;
  readonly temperature: number;
  readonly move: MoveKind | "initial";
  readonly accepted: boolean;
  readonly deltaJ: number;
}

/** The best state seen during the run. */
export interface ScheduleBest {
  readonly step: number;
  readonly state: ScheduleState;
  readonly J: number;
}

/** Per-domain visit counts across accepted composites (curriculum balance). */
export type DomainVisits = Readonly<Record<Domain, number>>;

/** The run's coverage statistics. */
export interface CoverageStats {
  /** Distinct composite keys visited (the C-cumulative). */
  readonly distinctComposites: number;
  /** Number of steps recorded. */
  readonly totalSteps: number;
  /** Accepted-step count. */
  readonly acceptedSteps: number;
  /** Per-domain appearance count across accepted composites. */
  readonly domainVisits: DomainVisits;
}

/** The complete anneal output, before facade wrapping + schema validation. */
export interface ScheduleRun {
  readonly config: ScheduleConfig;
  readonly initial: ScheduleState;
  readonly steps: readonly ScheduleStep[];
  readonly best: ScheduleBest;
  readonly coverage: CoverageStats;
}

/** Empty-terms baseline for the initial step (no move, no window). */
function initialTerms(config: ScheduleConfig): ObjectiveTerms {
  // The seed state: C would be 1 (first visit) but there is no move to score
  // L/S against. Record J = γ·1 (a tripartite-neutral baseline) so the first
  // real ΔJ is well-defined. The seed is always "accepted".
  const J = config.weights.gamma; // tripartite present (T=1) at the seed window
  return { C: 1, L: 1, T: 1, S: 0, J };
}

/**
 * Run the annealer. Pure: deterministic given (registry, config, rng).
 */
export function anneal(registry: WheelRegistry, config: ScheduleConfig, rng: Rng): ScheduleRun {
  const start = initialState(registry);

  const visited = new Set<string>([compositeKey(start, registry)]);
  const window: ReadonlySet<Domain>[] = [compositeDomains(start, registry)];
  const domainVisits: Record<Domain, number> = { THEOLOGY: 0, TECHNOLOGY: 0, COSMOLOGY: 0 };
  for (const d of window[0]!) domainVisits[d]++;

  const steps: ScheduleStep[] = [];
  let current = start;
  let currentTerms = initialTerms(config);
  let best: ScheduleBest = { step: 0, state: start, J: currentTerms.J };
  let acceptedSteps = 0;

  steps.push({
    t: 0,
    state: start,
    terms: currentTerms,
    temperature: config.T_init,
    move: "initial",
    accepted: true,
    deltaJ: 0,
  });

  let T = config.T_init;
  for (let t = 1; t <= config.steps; t++) {
    if (T <= config.T_min) break;

    const move = proposeMove(current, rng, registry);
    const candidate = applyMove(current, move, registry);
    const candidateTerms = evaluateMove(move, candidate, window, visited, registry, config);
    const dJ = deltaJ(currentTerms, candidateTerms);

    // Accept if ΔJ > 0, else with probability exp(ΔJ / T). One draw, only when needed.
    let accepted: boolean;
    if (dJ > 0) {
      accepted = true;
    } else if (T > 0) {
      const p = Math.exp(dJ / T);
      accepted = rng.next() < p;
    } else {
      accepted = false;
    }

    steps.push({
      t,
      state: accepted ? candidate : current,
      terms: candidateTerms,
      temperature: T,
      move: move.kind,
      accepted,
      deltaJ: dJ,
    });

    if (accepted) {
      current = candidate;
      currentTerms = candidateTerms;
      acceptedSteps++;
      visited.add(compositeKey(candidate, registry));
      const cd = compositeDomains(candidate, registry);
      window.push(cd);
      if (window.length > config.windowN) window.shift();
      for (const d of cd) domainVisits[d]++;
      if (candidateTerms.J > best.J) best = { step: t, state: candidate, J: candidateTerms.J };
    }

    T *= config.cooling;
  }

  const coverage: CoverageStats = {
    distinctComposites: visited.size,
    totalSteps: steps.length,
    acceptedSteps,
    domainVisits,
  };

  return { config, initial: start, steps, best, coverage };
}

/** Convenience: the domain list for iterating domainVisits in canonical order. */
export const DOMAIN_ORDER = ALL_DOMAINS;