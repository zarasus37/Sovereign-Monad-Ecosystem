/**
 * L2 SignGraphDialect — pass 2: rewrite (fusion, simplification).
 *
 * The spec's four L2 passes are: type/modality inference → **rewrite (fusion,
 * simplification)** → constitution compliance → budgeted expansion
 * (`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:198-205`). This pass
 * sits between inference and constitution. It is the only pass that transforms
 * the graph's *shape* — the others are forward analyses.
 *
 * The one fusion rule the spec actually writes down is `map(f) ∘ map(g) ≡
 * map(f∘g)` "when modalities match" (`FORMAL SPECIFICATION DOCUMENT.md:185`). In
 * this IR a `map` op carries NO function payload — it is a structural carrier
 * passthrough (inference gives it the carrier's type verbatim). So `f` and `g`
 * are both identity, `f∘g` is identity, and the rule collapses to: a chain of
 * `map`s is equivalent to its carrier. The representable form is therefore
 * **map identity-elimination**: every `map` node is rewired to its single
 * carrier (and `map(map(s))` resolves transitively to `s`). This is non-vacuous:
 * it removes nodes and rewires consumers, shrinking the graph that constitution
 * / budget / L0 consume. It is also exactly the "simplification" half of the
 * pass name — dead-passthrough elimination.
 *
 * What this pass does NOT do (deliberately, to avoid inventing spec semantics):
 *   - It does not flatten nested `fold`/`choose` (variadic fusion). No spec rule
 *     describes that, so it is left for a future PR with a written rule.
 *   - It does not eliminate `attachModality` (that op changes modality — it is
 *     not a passthrough and must survive to L0).
 *   - It does not mutate the immutable `SignGraph`. Instead it returns a
 *     **resolve map** (`id → canonicalId`); downstream passes consult it. This
 *     keeps the graph immutable (the documented invariant) and — critically —
 *     keeps node ids stable, so provenance refs (which the L3 binding pass
 *     resolved against the original ids) remain valid. An eliminated `map`'s id
 *     still resolves (to its carrier); nothing is renamed.
 *
 * The resolve map is consulted only by `buildValues` (which materializes an
 * eliminated `map` as its carrier's value). Inference's type cache already gave
 * every `map` its carrier's type, and constitution/provenance read the output
 * by id — so once `buildValues` populates the eliminated node's value, every
 * downstream reader sees the right thing without its own resolve lookup.
 */

import type { SignGraph, NodeId } from "../semiotic/graph.js";

/** The rewrite result: a map from every ordered node id to its canonical id. */
export type ResolveMap = ReadonlyMap<NodeId, NodeId>;

/**
 * Follow a resolve map to the canonical id of `id` (the transitive root). Falls
 * back to `id` itself when `id` is absent from the map (e.g. a provenance node,
 * which is not in `order` and never eliminated). Exported for `buildValues`.
 */
export function canonical(resolve: ResolveMap, id: NodeId): NodeId {
  let cur = id;
  // `resolve` stores fully-resolved canonicals (a map's entry points directly at
  // its carrier's canonical, set when the carrier was already processed), so a
  // single lookup suffices — the loop is a defensive backstop against a future
  // pass that stores one-hop entries.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = resolve.get(cur);
    if (next === undefined || next === cur) return cur;
    cur = next;
  }
}

/**
 * Run the rewrite pass: build the resolve map. For every node in declaration
 * (topological) order, its canonical is itself — UNLESS it is a `map` op, in
 * which case its canonical is its single carrier's canonical (the carrier was
 * declared first, so its entry is already present). Returns the map; the graph
 * is not mutated.
 *
 * Total (never throws): a `map` over a wheel is a lattice abort caught earlier
 * by inference, so every `map` that reaches this pass has a sign-producing
 * carrier. No further validation is needed here.
 */
export function rewriteGraph(graph: SignGraph): ResolveMap {
  const resolve = new Map<NodeId, NodeId>();
  for (const id of graph.order) {
    const node = graph.nodes.get(id)!;
    if (node.kind === "op" && node.op === "map") {
      // The carrier is inputs[0] (map is unary). Resolve transitively to its
      // canonical — already in the map because the carrier precedes this map in
      // topological order.
      const carrier = node.inputs[0];
      resolve.set(id, canonical(resolve, carrier));
    } else {
      resolve.set(id, id);
    }
  }
  return resolve;
}

/**
 * Convenience: the set of node ids the rewrite pass eliminated (mapped to a
 * different canonical). Exposed for diagnostics + tests. A `map` whose carrier
 * is itself (impossible for a real op, but defended) would not be eliminated.
 */
export function eliminatedNodes(resolve: ResolveMap): readonly NodeId[] {
  const out: NodeId[] = [];
  for (const [id, canon] of resolve) {
    if (canon !== id) out.push(id);
  }
  return out;
}