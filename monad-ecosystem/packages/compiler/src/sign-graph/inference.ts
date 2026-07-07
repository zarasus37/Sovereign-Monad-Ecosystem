/**
 * L2 SignGraphDialect — pass 1: type/modality inference.
 *
 * Walks the SSA graph in dependency order and infers each node's `InferredType`
 * (modality + triadic domains). This is the symbolic analogue of what the
 * runtime `compose` (`ttcl/src/runtime/combinators.ts:141`) computes at
 * execution time — done here *before* execution so a lattice abort is a
 * compile error (`LatticeAbortError`), not a runtime `TriadicGateError`.
 *
 * Modal lattice (`theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is
 * Built.txt:35-52`): HYBRID ⊤ → ICON/INDEX/SYMBOL → PURE ⊥. The TTCL `compose`
 * is the JOIN operator: its output is always HYBRID (matches runtime
 * `combinators.ts:160`). A `compose` over a PURE (⊥) input is a lattice abort
 * — you cannot join an invalid sign.
 *
 * v1 simplification (documented): `map` / `fold` / `choose` are
 * modality-preserving passthroughs — each operates on a single carrier sign
 * (`inputs[0]`, matching the runtime signatures in `combinators.ts:173/184/202`)
 * and yields that sign's inferred type. Full branch-join semantics (the result
 * of `choose`/`fold` is one of two branch results, whose type is the JOIN of
 * the branches) is deferred to a follow-up; the load-bearing analysis for this
 * PR is `compose` + constitution + budget.
 */

import type { Domain, Modality } from "@sovereign/ttcl";

import type { SignGraph, NodeId, InferredType, OpDecl } from "../semiotic/graph.js";
import { opsInOrder } from "../semiotic/binding.js";
import { LatticeAbortError } from "../errors.js";

/**
 * Infer the type of every sign-producing node. Returns a map keyed by node id.
 * Throws `LatticeAbortError` on a `compose` over a PURE input. Wheel nodes are
 * not sign-producing and are skipped (absent from the map).
 */
export function inferTypes(graph: SignGraph): Map<NodeId, InferredType> {
  const cache = new Map<NodeId, InferredType>();
  // Declaration order is topological (the binding pass enforced acyclicity and
  // a program can only reference previously-declared nodes), so a single
  // forward pass resolves every op's inputs.
  for (const id of graph.order) {
    const node = graph.nodes.get(id)!;
    if (node.kind === "wheel") continue;
    if (node.kind === "sign") {
      cache.set(id, {
        modality: node.modality,
        domains: node.domains ?? [node.domain],
      });
      continue;
    }
    // node.kind === "op"
    cache.set(id, inferOp(graph, node, cache));
  }
  return cache;
}

function inferOp(
  graph: SignGraph,
  op: OpDecl,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  if (op.op === "compose") {
    return inferCompose(graph, op, cache);
  }
  // map / fold / choose — passthrough of inputs[0] (the carrier sign).
  const carrier = graph.nodes.get(op.inputs[0])!;
  if (carrier.kind === "wheel") {
    throw new LatticeAbortError(op.id, `op '${op.op}' cannot operate on a wheel ('${op.inputs[0]}')`);
  }
  const carrierType = cache.get(op.inputs[0])!;
  return { modality: carrierType.modality, domains: carrierType.domains };
}

function inferCompose(
  graph: SignGraph,
  op: OpDecl,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  const inputTypes: InferredType[] = [];
  for (const ref of op.inputs) {
    const node = graph.nodes.get(ref)!;
    if (node.kind === "wheel") {
      throw new LatticeAbortError(op.id, `compose cannot join a wheel ('${ref}')`);
    }
    inputTypes.push(cache.get(ref)!);
  }
  // Lattice abort: any PURE (⊥) input is invalid to join.
  if (inputTypes.some((t) => t.modality === "PURE")) {
    throw new LatticeAbortError(
      op.id,
      "cannot compose a PURE (⊥) sign — incompatible modalities",
    );
  }
  // compose is the JOIN: output modality is HYBRID (matches runtime). Domains
  // are the union of input domains (triadic ancestry), matching `compose`'s
  // `domains` field at `combinators.ts:168`. The triadic *count* gate is NOT
  // enforced here — that is the constitution pass's graph-wide responsibility.
  const domains = unionDomains(inputTypes.map((t) => t.domains));
  return { modality: "HYBRID" as Modality, domains };
}

function unionDomains(domainLists: readonly (readonly Domain[])[]): readonly Domain[] {
  const seen = new Set<Domain>();
  for (const list of domainLists) for (const d of list) seen.add(d);
  // Preserve canonical order THEOLOGY, TECHNOLOGY, COSMOLOGY for stable output.
  const canonical: Domain[] = ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"];
  return canonical.filter((d) => seen.has(d));
}

/**
 * Convenience: infer the type of a single node, given a fully-inferred cache.
 * Exported for the constitution pass + tests.
 */
export function typeOf(
  graph: SignGraph,
  id: NodeId,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  const t = cache.get(id);
  if (!t) {
    throw new Error(`inference: no type for node '${id}' (is it a wheel?)`);
  }
  return t;
}