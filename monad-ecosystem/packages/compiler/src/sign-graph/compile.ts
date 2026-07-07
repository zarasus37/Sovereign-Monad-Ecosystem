/**
 * compileProgram — the single entry point of the compiler stack.
 *
 * Pipeline (the prose's four lowering levels, with L1 deferred and L0 = the
 * existing @sovereign/ttcl runtime):
 *
 *   L3 load      → loadProgram(json)        : ajv-validate + build SSA SignGraph
 *                  bindGraph(graph)         : resolve refs + acyclicity + output
 *   L2 analyze   → inferTypes(graph)       : modality/domains (lattice abort)
 *                  buildValues(graph)      : materialize runtime Wheels/Signs
 *                  checkConstitution(...)  : graph-wide scoreSign + triadic closure
 *                  checkBudget(...)        : combineWheelsBudgeted
 *   L0 lower     → return the terminal Sign + wheels (only if L2 passed)
 *
 * Each L3/L2 step throws a `CompilerError` subtype (or the runtime
 * `WheelBudgetExceededError`) on failure. On constitution/budget failure the
 * facade throws `ConstitutionCompileError` aggregating every failure's
 * reasoning — and the materialized output is NOT returned. That is the prose's
 * "compile error, not a runtime surprise" guarantee: a constitution-failing
 * program does not reach L0.
 */

import type { Modality, Domain, Sign, Wheel } from "@sovereign/ttcl";

import type { SignGraph, NodeId, InferredType } from "../semiotic/graph.js";
import { loadProgram } from "../semiotic/loader.js";
import { inferTypes } from "./inference.js";
import { buildValues, collectWheels, isSign, type SsaValue } from "./materialize.js";
import {
  checkConstitution,
  toCompileError,
  type GraphConstitutionResult,
} from "./constitution.js";
import { checkBudget } from "./budget.js";
import { ConstitutionCompileError } from "../errors.js";

/** The L0 output: the terminal materialized Sign + the declared wheels. */
export interface CompiledOutput {
  readonly sign: Sign<Modality, Domain>;
  readonly wheels: readonly Wheel<any>[];
}

/** The full result of a successful compilation. */
export interface CompiledProgram {
  readonly graph: SignGraph;
  readonly types: ReadonlyMap<NodeId, InferredType>;
  readonly constitution: GraphConstitutionResult;
  readonly output: CompiledOutput;
}

/**
 * Compile a semiotic program: load → analyze → lower. Throws a `CompilerError`
 * subtype on any L3/L2 failure, or `WheelBudgetExceededError` on a budget
 * overflow that the constitution pass did not catch first. On success returns
 * the materialized terminal Sign + the full graph-wide constitution verdict.
 */
export function compileProgram(json: unknown): CompiledProgram {
  // L3 — load + bind.
  const graph = loadProgram(json);

  // L2 — inference (may throw LatticeAbortError).
  const types = inferTypes(graph);

  // L2 → L0 — materialize runtime values (may throw UnknownSignClassError).
  const values = buildValues(graph);

  // L2 — budgeted expansion (may throw WheelBudgetExceededError — a typed
  // compile error). Run before constitution so a state-space overflow is the
  // first failure surfaced; the program cannot be valid with an unbounded
  // state space.
  checkBudget(graph, values);

  // L2 — constitution compliance (graph-wide). Never throws on a failing
  // verdict; returns the verdict so we aggregate reasoning.
  const constitution = checkConstitution(graph, types, values);
  if (!constitution.pass) {
    throw toCompileError(constitution);
  }

  // L0 — return the terminal materialized Sign + the wheels.
  const outputSign = values.get(graph.outputId)!;
  if (!isSign(outputSign)) {
    // Defensive: binding guarantees the output is a sign-producing node.
    throw new ConstitutionCompileError([
      `output '${graph.outputId}' did not materialize to a Sign`,
    ]);
  }
  const wheels = collectWheels(graph, values);

  return {
    graph,
    types,
    constitution,
    output: {
      sign: outputSign,
      wheels,
    },
  };
}