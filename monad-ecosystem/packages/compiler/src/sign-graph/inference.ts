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
 * Op semantics (the spec names the L2 ops but defines only `compose`'s JOIN and
 * the `map(f)∘map(g)≡map(f∘g)` fusion rule; the rest is filled in here, grounded
 * in the lattice + PROJECT_STATE's "full branch-join for map/fold/choose" gloss):
 *
 *   - `compose`     — the JOIN: output HYBRID, domains = union (aborts on PURE).
 *   - `map`         — a unary carrier passthrough (the IR carries no function
 *                     payload, so it is structural identity; the rewrite pass
 *                     eliminates it). Output = carrier's type.
 *   - `fold`/`choose` — branching combinators. Output type is the lattice JOIN
 *                     of ALL inputs (branch-join): domains = union; modality =
 *                     `joinModalities` (PURE is the join identity, so a PURE
 *                     branch does NOT abort — see `joinModalities`).
 *   - `attachModality` — overrides its single carrier's modality with `op.modality`
 *                     (domains inherited). This is how a non-SYMBOL sign becomes
 *                     eligible for the L1 `encodeSign` path without re-declaration.
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
    if (node.kind === "op") {
      cache.set(id, inferOp(graph, node, cache));
      continue;
    }
    // Provenance nodes (keycap/token/provop) are never pushed to `order` by
    // the loader, so this is unreachable — guard in depth.
    throw new Error(`inference: unexpected node kind '${node.kind}' in order`);
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
  if (op.op === "attachModality") {
    return inferAttachModality(graph, op, cache);
  }
  if (op.op === "map") {
    return inferPassthrough(graph, op, cache);
  }
  // fold / choose — the branching combinators: result type is the lattice JOIN
  // of all branch inputs (full branch-join semantics).
  return inferBranchJoin(graph, op, cache);
}

/** `map` — unary carrier passthrough (structural identity at the IR level). */
function inferPassthrough(
  graph: SignGraph,
  op: OpDecl,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  const carrier = graph.nodes.get(op.inputs[0])!;
  if (carrier.kind === "wheel") {
    throw new LatticeAbortError(op.id, `op '${op.op}' cannot operate on a wheel ('${op.inputs[0]}')`);
  }
  const carrierType = cache.get(op.inputs[0])!;
  return { modality: carrierType.modality, domains: carrierType.domains };
}

/**
 * `fold` / `choose` — branch-join: the result type is the lattice JOIN of all
 * branch inputs. Domains are the union (triadic ancestry across branches);
 * modality is `joinModalities` (PURE is the join identity — a PURE branch does
 * not abort, unlike `compose`'s PURE abort).
 */
function inferBranchJoin(
  graph: SignGraph,
  op: OpDecl,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  const inputTypes: InferredType[] = [];
  for (const ref of op.inputs) {
    const node = graph.nodes.get(ref)!;
    if (node.kind === "wheel") {
      throw new LatticeAbortError(op.id, `op '${op.op}' cannot join a wheel ('${ref}')`);
    }
    inputTypes.push(cache.get(ref)!);
  }
  return {
    modality: joinModalities(inputTypes.map((t) => t.modality)),
    domains: unionDomains(inputTypes.map((t) => t.domains)),
  };
}

/**
 * `attachModality` — override the carrier's modality with `op.modality`. The
 * triadic domains are inherited (attaching a modality does not change a sign's
 * domain ancestry). Throws if `modality` is absent (defensive — the schema's
 * `if`/`then` requires it) or if the carrier is a wheel.
 */
function inferAttachModality(
  graph: SignGraph,
  op: OpDecl,
  cache: ReadonlyMap<NodeId, InferredType>,
): InferredType {
  if (op.modality === undefined) {
    throw new LatticeAbortError(op.id, "attachModality requires a `modality` field");
  }
  const carrier = graph.nodes.get(op.inputs[0])!;
  if (carrier.kind === "wheel") {
    throw new LatticeAbortError(op.id, `attachModality cannot operate on a wheel ('${op.inputs[0]}')`);
  }
  const carrierType = cache.get(op.inputs[0])!;
  return { modality: op.modality, domains: carrierType.domains };
}

/**
 * Lattice JOIN of a set of modalities (the branch-join for `fold`/`choose`).
 * PURE (⊥) is the join identity: a PURE branch is one possible ⊥-typed option
 * and contributes nothing to the upper bound. All-PURE → PURE; a single
 * distinct non-PURE modality → that modality; ≥2 distinct non-PURE → HYBRID (⊤).
 *
 * This deliberately does NOT abort on PURE (unlike `compose`, which aborts on a
 * PURE input): `compose` *combines* inputs (⊥ poisons the combination), while
 * `fold`/`choose` *select among* branches (a ⊥ branch is merely one option, and
 * the JOIN is the upper bound of what the result could be).
 */
function joinModalities(modalities: readonly Modality[]): Modality {
  const distinct = new Set(modalities.filter((m) => m !== "PURE"));
  if (distinct.size === 0) return "PURE";
  if (distinct.size === 1) return [...distinct][0];
  return "HYBRID";
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