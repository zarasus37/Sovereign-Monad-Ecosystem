/**
 * L2 SignGraphDialect — pass 4: budgeted expansion.
 *
 * Runs `combineWheelsBudgeted(budget, ...wheels)` (`ttcl/src/runtime/wheel.ts:68`)
 * over every declared wheel. The product of wheel sizes is the joint
 * state-space cardinality ("budget as a dependent type", the Llull combinator);
 * exceeding the declared budget throws `WheelBudgetExceededError` at compile
 * time. This is the prose's "Budgeted expansion" L2 pass (`theo-techno-cosmo/
 * plex/archive/TTCL_v1_0_BREAKDOWN.md:204`), the last of the four L2 passes
 * (inference → rewrite → constitution → budget).
 *
 * The thrown `WheelBudgetExceededError` is the SAME error the runtime
 * `combineWheelsBudgeted` throws — L2 surfaces it as a compile error before L0.
 */

import { combineWheelsBudgeted } from "@sovereign/ttcl";
import type { Wheel } from "@sovereign/ttcl";

import type { SignGraph } from "../semiotic/graph.js";
import { collectWheels } from "./materialize.js";
import type { SsaValue } from "./materialize.js";

export interface BudgetResult {
  /** `true` when ∏ wheel sizes ≤ budget. */
  readonly ok: boolean;
  /** The joint state-space cardinality (the product). */
  readonly product: number;
  /** The declared budget cap. */
  readonly budget: number;
}

/**
 * Run the budget gate. On overflow, re-throws the runtime
 * `WheelBudgetExceededError` (the facade runs this after constitution, per the
 * spec's four-pass order).
 */
export function checkBudget(
  graph: SignGraph,
  values: ReadonlyMap<string, SsaValue>,
): BudgetResult {
  const wheels = collectWheels(graph, values);
  const product = combineWheelsBudgeted(graph.budget, ...wheels);
  return { ok: true, product, budget: graph.budget };
}

/** Re-exported for callers that want to catch the runtime error type. */
export type { Wheel };