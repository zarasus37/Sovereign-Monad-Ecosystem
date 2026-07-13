/**
 * L2 SignGraphDialect — pass 3: constitution compliance (graph-wide).
 *
 * This is the keystone of the compiler stack — the prose's central guarantee
 * (`theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is Built.txt:85`):
 * "you cannot write a gnosis event that compiles unless it is
 * constitutionally valid. The 0.72 threshold is not a filter applied after the
 * fact — it is enforced at Level 2 of the compiler before the event ever
 * reaches training data."
 *
 * Today the scorer (`ttcl/src/runtime/constitution.ts:204 scoreSign`) is a
 * per-Sign runtime predicate. This pass LIFTS it to a graph-wide compile gate:
 *   1. Score the program's `output` Sign with the existing `scoreSign` (reused
 *      unchanged — no parallel score). The output is the gnosis event; raw
 *      single-domain leaves are intermediate *material* and are not gated
 *      (they are meant to be composed — requiring them to pass C1 would make
 *      every triadic compose uncompilable).
 *   2. Graph-level triadic closure: the output's inferred domains must include
 *      all three TTCL domains (the Triadic Minimal Gate, `combinators.ts:148-151`).
 *      This is *stricter* than per-Sign scoring: a single-domain HYBRID can
 *      pass `scoreSign` (the other four criteria compensate) yet still fail the
 *      Triadic Minimal Gate — the graph-wide pass catches what per-Sign scoring
 *      misses.
 *   3. Aggregate into `GraphConstitutionResult`. A failing graph throws
 *      `ConstitutionCompileError` — a compile error at L2, so the program
 *      never reaches L0 materialization (the facade throws before returning
 *      the output).
 *
 * For diagnostics, every sign-producing node is scored into `nodeResults`, but
 * only the output's score + triadic closure gate `pass`.
 */

import { scoreSign } from "@sovereign/ttcl";
import type { ConstitutionResult } from "@sovereign/ttcl";
import { CONSTITUTION_PASS_THRESHOLD } from "@sovereign/types";

import type { SignGraph, NodeId, InferredType } from "../semiotic/graph.js";
import { typeOf } from "./inference.js";
import { isSign, type SsaValue } from "./materialize.js";
import { ConstitutionCompileError } from "../errors.js";

/** The graph-wide constitution verdict. */
export interface GraphConstitutionResult {
  /** `true` only when every per-node score passes AND triadic closure holds. */
  readonly pass: boolean;
  /** The threshold `total` was compared against (canonical 0.72 unless overridden). */
  readonly threshold: number;
  /** Per-node scorer verdicts, keyed by node id (sign-producing nodes only). */
  readonly nodeResults: ReadonlyMap<NodeId, ConstitutionResult>;
  /** `true` when the output Sign's domains include all three TTCL domains. */
  readonly triadicClosure: boolean;
  /** Flat reasoning trace (per-node + graph-level), for compile-error messages. */
  readonly reasoning: string[];
}

const ALL_DOMAINS: readonly ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"] = [
  "THEOLOGY",
  "TECHNOLOGY",
  "COSMOLOGY",
];

/**
 * Run the graph-wide constitution pass. Does NOT throw on a failing graph —
 * returns the verdict so the facade can decide (the facade throws
 * `ConstitutionCompileError` when `pass === false`). Per the spec's four-pass
 * order, constitution (pass 3) runs before budget (pass 4); a program failing
 * both surfaces the constitution error first.
 *
 * Throws `InvalidOutputError` only if the output node is not sign-producing
 * (a structural error caught at L3 binding, but defended here too).
 */
export function checkConstitution(
  graph: SignGraph,
  types: ReadonlyMap<NodeId, InferredType>,
  values: ReadonlyMap<NodeId, SsaValue>,
): GraphConstitutionResult {
  const threshold = graph.constitutionThreshold ?? CONSTITUTION_PASS_THRESHOLD;
  const nodeResults = new Map<NodeId, ConstitutionResult>();
  const reasoning: string[] = [];

  // Score every sign-producing node for diagnostics. (The gate below uses only
  // the output's score; raw leaves are material, not gnosis events.)
  for (const id of graph.order) {
    const v = values.get(id);
    if (v && isSign(v)) {
      nodeResults.set(id, scoreSign(v));
    }
  }

  // 1. Gate: score the OUTPUT sign (the gnosis event).
  const outputSign = values.get(graph.outputId);
  if (!outputSign || !isSign(outputSign)) {
    // Defensive: binding guarantees the output is sign-producing.
    throw new Error(`constitution: output '${graph.outputId}' is not a Sign`);
  }
  const outputResult = scoreSign(outputSign);
  if (!outputResult.pass) {
    reasoning.push(
      `output '${graph.outputId}' fails scoreSign: total ${outputResult.total} < ${threshold}`,
    );
  }

  // 2. Graph-level: triadic closure on the output's inferred domains.
  const outputType = typeOf(graph, graph.outputId, types);
  const outputDomains = new Set(outputType.domains);
  const triadicClosure = ALL_DOMAINS.every((d) => outputDomains.has(d));
  if (!triadicClosure) {
    reasoning.push(
      `output '${graph.outputId}' lacks triadic closure: domains [${outputType.domains.join(", ")}] (the Triadic Minimal Gate requires all of THEOLOGY, TECHNOLOGY, COSMOLOGY)`,
    );
  }

  const pass = outputResult.pass && triadicClosure;

  return {
    pass,
    threshold,
    nodeResults,
    triadicClosure,
    reasoning: pass ? [] : reasoning,
  };
}

/**
 * Build the `ConstitutionCompileError` from a failing verdict (the facade
 * calls this when `pass === false`). Kept separate so the budget pass can
 * append its own reasoning to the aggregate before throwing.
 */
export function toCompileError(
  verdict: GraphConstitutionResult,
  extraReasoning: readonly string[] = [],
): ConstitutionCompileError {
  return new ConstitutionCompileError([...verdict.reasoning, ...extraReasoning]);
}

// Re-export so callers don't need a second import for the threshold constant.
export { CONSTITUTION_PASS_THRESHOLD };