/**
 * L2 → L0 — materialize the SSA graph into @sovereign/ttcl runtime objects.
 *
 * `buildValues` walks the graph in dependency order and constructs, for each
 * node, its runtime value: a `Wheel` (from `ttcl/src/runtime/wheel.ts:21`) for
 * wheel nodes, a `Sign` for sign-producing nodes. The existing `@sovereign/ttcl`
 * runtime IS the L0 target ("generated TS is the L0 and already works") — this
 * is in-memory instantiation, not code emission.
 *
 * `compose` is lowered through a *gate-free* compose (`composeSigns` below) so
 * that a sub-triadic compose does not throw a runtime `TriadicGateError`; the
 * triadic-count gate is the constitution pass's graph-wide responsibility (a
 * compile error at L2, not a runtime surprise). The dominant-peirce / pps-min
 * / domain-union / merged-trace logic mirrors the runtime `compose`
 * (`ttcl/src/runtime/combinators.ts:141-170`) exactly, minus the gate.
 *
 * v1: `map`/`fold`/`choose` materialize as a passthrough of `inputs[0]`'s sign
 * (the carrier), matching the inference pass's passthrough semantics.
 */

import { getManifold } from "@sovereign/types";
import type { EventTrace } from "@sovereign/types";
import {
  Wheel,
  makeSign,
  mergeTraces,
} from "@sovereign/ttcl";
import type { Sign, Modality, Domain } from "@sovereign/ttcl";

import type { SignGraph, NodeId, OpDecl, SignDecl } from "../semiotic/graph.js";
import { LatticeAbortError } from "../errors.js";

/** A materialized node value: a Wheel or a Sign. */
export type SsaValue = Wheel<any> | Sign<Modality, Domain>;

/**
 * Build the runtime value of every node. Returns a map keyed by id. Throws
 * `LatticeAbortError` for an op over a wheel, and `UnknownSignClassError` (via
 * `makeSign`/the manifold) for an unknown class id. Does NOT throw on a
 * sub-triadic compose (the constitution pass handles that).
 */
export function buildValues(graph: SignGraph): Map<NodeId, SsaValue> {
  const values = new Map<NodeId, SsaValue>();
  for (const id of graph.order) {
    const node = graph.nodes.get(id)!;
    if (node.kind === "wheel") {
      values.set(id, new Wheel<any>(node.size, node.initial));
      continue;
    }
    if (node.kind === "sign") {
      values.set(id, materializeSign(node));
      continue;
    }
    // op
    values.set(id, materializeOp(graph, node, values));
  }
  return values;
}

function materializeSign(decl: SignDecl): Sign<Modality, Domain> {
  return makeSign(
    decl.classId,
    decl.mode,
    decl.domain,
    decl.modality,
    decl.pps,
    decl.trace,
    decl.domains,
    decl.noRlhf,
  );
}

function materializeOp(
  graph: SignGraph,
  op: OpDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
): SsaValue {
  if (op.op === "compose") {
    return composeSigns(graph, op, values);
  }
  // map / fold / choose — passthrough of inputs[0] (the carrier sign).
  const carrier = values.get(op.inputs[0])!;
  if (!(carrier instanceof Wheel) && typeof carrier === "object" && "modality" in carrier) {
    return carrier;
  }
  throw new LatticeAbortError(op.id, `op '${op.op}' cannot operate on a wheel ('${op.inputs[0]}')`);
}

/**
 * Gate-free compose — mirrors `ttcl/src/runtime/combinators.ts:141-170` minus
 * the triadic-count gate (lines 149-151). The dominant peirce is the most
 * argumentative input (FORMAL_THOUGHT band, then highest thirdness_weight);
 * `pps` is the tightest sync point (min across inputs); `trace` is the merged
 * intention chain; `domains` is the union of input domains; `modality` is
 * HYBRID; the carrier `domain` is COSMOLOGY (the integral/outermost domain).
 * The gate (≥3 domains) is enforced graph-wide by the constitution pass.
 */
function composeSigns(
  graph: SignGraph,
  op: OpDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
): Sign<"HYBRID", Domain> {
  const inputs: Sign<Modality, Domain>[] = [];
  for (const ref of op.inputs) {
    const v = values.get(ref)!;
    if (v instanceof Wheel || !("modality" in v)) {
      throw new LatticeAbortError(op.id, `compose cannot join a wheel ('${ref}')`);
    }
    inputs.push(v);
  }
  if (inputs.length === 0) {
    throw new LatticeAbortError(op.id, "compose requires at least one input");
  }

  // Validate every input's class id (the runtime compose does this via
  // assertKnownClasses; makeSign already validated loadSigns, but a compose
  // over another compose's output carries that output's already-validated
  // peirce, so this is a defensive re-check against the manifold).
  const manifold = getManifold();
  for (const s of inputs) {
    // Throws via the manifold on an unknown id (defensive — makeSign already
    // guaranteed this for leaf signs).
    manifold.get(s.peirce.sign_class_id);
  }

  const present = Array.from(new Set(inputs.map((s) => s.domain))) as Domain[];
  const pps = Math.min(...inputs.map((s) => s.pps));
  const dominant = [...inputs].sort((a, b) => {
    const af = a.peirce.pragmatism_band === "FORMAL_THOUGHT" ? 1 : 0;
    const bf = b.peirce.pragmatism_band === "FORMAL_THOUGHT" ? 1 : 0;
    if (bf !== af) return bf - af;
    return b.peirce.thirdness_weight - a.peirce.thirdness_weight;
  })[0];
  const traces = inputs.map((s) => s.trace) as ReadonlyArray<EventTrace | undefined>;
  return {
    modality: "HYBRID",
    domain: "COSMOLOGY",
    pps,
    peirce: dominant.peirce,
    trace: mergeTraces(traces),
    domains: present,
  };
}

/** Collect the materialized wheels (for the budget pass + the L0 output). */
export function collectWheels(
  graph: SignGraph,
  values: ReadonlyMap<NodeId, SsaValue>,
): Wheel<any>[] {
  return graph.order
    .map((id) => graph.nodes.get(id)!)
    .filter((n) => n.kind === "wheel")
    .map((n) => values.get(n.id) as Wheel<any>);
}

/** Type guard: is this value a Sign (not a Wheel)? */
export function isSign(v: SsaValue): v is Sign<Modality, Domain> {
  return !(v instanceof Wheel) && typeof v === "object" && "modality" in v;
}