/**
 * L1 ProvenanceDialect — the linear-types / capability compile gate.
 *
 * The fourth and final lowering level (the prose's "Linear types" fundamental,
 * `theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is Built.txt`):
 * runs *after* the L2 SignGraphDialect passes (inference / constitution /
 * budget) and *before* L0 materialization, matching the spec ordering
 * L3→L2→L1→L0. When the program has no `provenance` section, this pass is a
 * no-op and the program lowers exactly as before.
 *
 * Three checks (TTCL §II.6 — "Linear token threading → Encoding lowering →
 * Key capability check"):
 *
 *   1. Linear token threading — every `Token` (emitToken / mergeProvenance
 *      output) is consumed at most once (by a mergeProvenance input), and
 *      exactly one token is the unconsumed *terminal* — the provenance root.
 *      A double-consumed token, an all-consumed chain (no root), or an
 *      ambiguous root (>1 unconsumed) is a compile error.
 *   2. Encoding lowering — every `encodeSign` op's `sign` ref must infer to a
 *      SYMBOL-modality sign (the runtime `encodeSign(s: Sign<Symbol,T>, …)`
 *      contract). This is the compile-time mirror of the runtime
 *      `EncSignModalityError` — surfaced at L1, not as a runtime surprise.
 *   3. Key capability check — every declared `KeyCap` is consumed exactly once
 *      (referenced by exactly one encodeSign / decodeSign op's `keyCap`).
 *      A double-consumed key (reuse) or an unconsumed key (a declared
 *      capability never spent — a provenance gap) is a compile error. This is
 *      the compile-time mirror of the runtime `KeyCapAlreadyConsumedError`.
 *
 * Like the constitution pass, this does NOT throw on a failing verdict — it
 * returns the verdict so the facade aggregates reasoning into a single
 * `ProvenanceCompileError`. Structural ref errors (dangling refs, cycles,
 * kind mismatches) were already caught at L3 `bindProvenance`; this pass is
 * purely the *semantic* linear-types discipline.
 */

import type { NodeId, InferredType, SignGraph, ProvenanceOpDecl, TokenDecl, KeyCapDecl } from "../semiotic/graph.js";
import {
  provenanceKeyCapsInOrder,
  provenanceTokensInOrder,
  provenanceOpsInOrder,
} from "../semiotic/binding.js";
import { ProvenanceCompileError } from "../errors.js";

/** The L1 provenance verdict (semantic checks only; L0 lowering is separate). */
export interface ProvenanceResult {
  /** `true` only when token threading + modality + capability all hold. */
  readonly pass: boolean;
  /** The unconsumed terminal token id (the provenance root), if any tokens. */
  readonly rootToken?: NodeId;
  /** Flat reasoning trace; empty when `pass`. */
  readonly reasoning: string[];
}

/**
 * Run the L1 provenance pass. Does NOT throw on a failing verdict — returns it
 * so the facade can throw `ProvenanceCompileError` (after aggregating). No-op
 * (returns `pass: true`) when the program has no `provenance` section.
 */
export function checkProvenance(
  graph: SignGraph,
  types: ReadonlyMap<NodeId, InferredType>,
): ProvenanceResult {
  const section = graph.provenance;
  if (!section) {
    return { pass: true, reasoning: [] };
  }

  const reasoning: string[] = [];

  // 1. Linear token threading.
  const rootToken = checkTokenThreading(graph, reasoning);

  // 2. Encoding lowering — SYMBOL-modality check on every encodeSign.
  checkEncodingModality(graph, types, reasoning);

  // 3. Key capability check — each KeyCap consumed exactly once.
  checkKeyCapability(graph, reasoning);

  const pass = reasoning.length === 0;
  return { pass, rootToken, reasoning: pass ? [] : reasoning };
}

/**
 * Token threading: every token consumed at most once; exactly one unconsumed
 * terminal (the provenance root). Returns the root token id (or undefined when
 * there are no tokens). Appends reasoning on violation.
 */
function checkTokenThreading(graph: SignGraph, reasoning: string[]): NodeId | undefined {
  const tokens = provenanceTokensInOrder(graph);
  if (tokens.length === 0) return undefined;

  // Count consumers: how many mergeProvenance inputs reference each token.
  const consumers = new Map<NodeId, string[]>();
  for (const t of tokens) {
    if (t.op === "mergeProvenance") {
      const seen = new Set<NodeId>();
      for (const ref of t.inputs) {
        consumers.set(ref, [...(consumers.get(ref) ?? []), t.id]);
        // Double-list within a single merge is also a double-consume.
        if (seen.has(ref)) {
          reasoning.push(
            `token '${ref}' is consumed twice by mergeProvenance '${t.id}'`,
          );
        }
        seen.add(ref);
      }
    }
  }

  let root: NodeId | undefined;
  for (const t of tokens) {
    const refs = consumers.get(t.id) ?? [];
    if (refs.length > 1) {
      reasoning.push(
        `token '${t.id}' is consumed ${refs.length}× (by ${refs.join(", ")}) — linear tokens are single-use`,
      );
      continue;
    }
    if (refs.length === 0) {
      if (root !== undefined) {
        reasoning.push(
          `ambiguous provenance root: token '${t.id}' is unconsumed but '${root}' is already the terminal — exactly one root token is required`,
        );
      } else {
        root = t.id;
      }
    }
  }

  if (root === undefined) {
    reasoning.push(
      "no provenance root — every token is consumed (a token chain must have exactly one unconsumed terminal)",
    );
  }

  return root;
}

/** Encoding lowering: every encodeSign's `sign` ref must infer to SYMBOL. */
function checkEncodingModality(
  graph: SignGraph,
  types: ReadonlyMap<NodeId, InferredType>,
  reasoning: string[],
): void {
  for (const o of provenanceOpsInOrder(graph)) {
    if (o.op !== "encodeSign" || !o.sign) continue;
    const t = types.get(o.sign);
    if (!t) {
      // Defensive: bindProvenance resolved the ref to a sign node, which
      // inference types. Unreachable unless the sign is a wheel (also caught).
      reasoning.push(`encodeSign '${o.id}' references sign '${o.sign}' with no inferred type`);
      continue;
    }
    if (t.modality !== "SYMBOL") {
      reasoning.push(
        `encodeSign '${o.id}' requires a SYMBOL-modality sign, got ${t.modality} ('${o.sign}')`,
      );
    }
  }
}

/** Key capability check: each KeyCap referenced by exactly one op. */
function checkKeyCapability(graph: SignGraph, reasoning: string[]): void {
  const keyCaps = provenanceKeyCapsInOrder(graph);
  const ops = provenanceOpsInOrder(graph);

  const consumers = new Map<NodeId, string[]>();
  for (const o of ops) {
    consumers.set(o.keyCap, [...(consumers.get(o.keyCap) ?? []), o.id]);
  }

  for (const k of keyCaps) {
    const refs = consumers.get(k.id) ?? [];
    if (refs.length === 0) {
      reasoning.push(
        `KeyCap '${k.id}' is declared but never consumed — every capability must be spent exactly once`,
      );
    } else if (refs.length > 1) {
      reasoning.push(
        `KeyCap '${k.id}' is consumed ${refs.length}× (by ${refs.join(", ")}) — single-use capability reused`,
      );
    }
  }
}

/**
 * Build the `ProvenanceCompileError` from a failing verdict (the facade calls
 * this when `pass === false`). Mirrors `constitution.toCompileError`.
 */
export function toProvenanceCompileError(
  verdict: ProvenanceResult,
): ProvenanceCompileError {
  return new ProvenanceCompileError(verdict.reasoning);
}

// Re-export the provenance node-list helpers so callers don't reach into
// binding ad hoc.
export { provenanceOpsInOrder, provenanceTokensInOrder, provenanceKeyCapsInOrder };
export type { ProvenanceOpDecl, TokenDecl, KeyCapDecl };