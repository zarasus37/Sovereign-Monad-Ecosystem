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
 * `map` is eliminated by the rewrite pass (a structural identity at the IR
 * level) — `buildValues` materializes an eliminated `map` as its carrier's
 * value via the resolve map. `fold`/`choose` materialize as `inputs[0]`'s sign
 * (the first branch — a concrete representative), while their *inferred type*
 * is the lattice JOIN of all branches (inference); the lowered value is one
 * real branch, the type is the upper bound. `attachModality` lowers to a fresh
 * Sign equal to its carrier with `.modality` overridden — the override lives
 * only in this runtime Sign (+ the inference cache), not in the immutable
 * `SignDecl`.
 */

import { getManifold } from "@sovereign/types";
import type { EventTrace } from "@sovereign/types";
import {
  Wheel,
  KeyCap,
  makeSign,
  mergeTraces,
  encodeSign,
  decodeSign,
} from "@sovereign/ttcl";
import type { Sign, Modality, Domain, EncToken } from "@sovereign/ttcl";

import type { SignGraph, NodeId, OpDecl, SignDecl, ProvenanceOpDecl, KeyCapDecl } from "../semiotic/graph.js";
import { provenanceOpsInOrder, provenanceKeyCapsInOrder } from "../semiotic/binding.js";
import { canonical, type ResolveMap } from "./rewrite.js";
import { LatticeAbortError } from "../errors.js";

/** A materialized node value: a Wheel or a Sign. */
export type SsaValue = Wheel<any> | Sign<Modality, Domain>;

/**
 * Build the runtime value of every node. Returns a map keyed by id. Throws
 * `LatticeAbortError` for an op over a wheel, and `UnknownSignClassError` (via
 * `makeSign`/the manifold) for an unknown class id. Does NOT throw on a
 * sub-triadic compose (the constitution pass handles that).
 *
 * `resolve` is the rewrite pass's resolve map (id → canonicalId). An eliminated
 * `map` node is materialized as its canonical carrier's value (already built,
 * since the carrier precedes it in topological order). Defaults to an empty map
 * (no rewrite) so direct callers of the exported `buildValues` are unaffected.
 */
export function buildValues(
  graph: SignGraph,
  resolve: ResolveMap = new Map(),
): Map<NodeId, SsaValue> {
  const values = new Map<NodeId, SsaValue>();
  for (const id of graph.order) {
    // The rewrite pass may have eliminated this node (a `map` fused to its
    // carrier). Its value is its canonical carrier's value.
    const canon = canonical(resolve, id);
    if (canon !== id) {
      values.set(id, values.get(canon)!);
      continue;
    }
    const node = graph.nodes.get(id)!;
    if (node.kind === "wheel") {
      values.set(id, new Wheel<any>(node.size, node.initial));
      continue;
    }
    if (node.kind === "sign") {
      values.set(id, materializeSign(node));
      continue;
    }
    if (node.kind === "op") {
      values.set(id, materializeOp(graph, node, values));
      continue;
    }
    // Provenance nodes (keycap/token/provop) are never pushed to `order` by
    // the loader, so this is unreachable — guard in depth.
    throw new Error(`materialize: unexpected node kind '${node.kind}' in order`);
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
  if (op.op === "attachModality") {
    return materializeAttachModality(graph, op, values);
  }
  // map / fold / choose — passthrough of inputs[0] (the carrier / first branch).
  // (`map` nodes are normally eliminated by the rewrite pass before reaching
  // here; this branch is the fallback when no rewrite was run.)
  const carrier = values.get(op.inputs[0])!;
  if (!(carrier instanceof Wheel) && typeof carrier === "object" && "modality" in carrier) {
    return carrier;
  }
  throw new LatticeAbortError(op.id, `op '${op.op}' cannot operate on a wheel ('${op.inputs[0]}')`);
}

/**
 * `attachModality` — lower to a fresh Sign equal to the carrier with its
 * `modality` overridden. The carrier is read through the values map (an
 * eliminated `map` carrier would already be its canonical's value). Domains,
 * peirce, pps, and trace are inherited unchanged.
 */
function materializeAttachModality(
  graph: SignGraph,
  op: OpDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
): Sign<Modality, Domain> {
  if (op.modality === undefined) {
    // Defensive: inference already threw; unreachable under the facade.
    throw new LatticeAbortError(op.id, "attachModality requires a `modality` field");
  }
  const carrier = values.get(op.inputs[0])!;
  if (!isSign(carrier)) {
    throw new LatticeAbortError(op.id, `attachModality cannot operate on a wheel ('${op.inputs[0]}')`);
  }
  return { ...carrier, modality: op.modality };
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

// --- L0 — provenance lowering (encodeSign / decodeSign → runtime cipher) ---
//
// The L1 pass has already validated linear threading, the SYMBOL-modality
// requirement, and the KeyCap capability discipline. L0 lowers each provenance
// encoding op to the runtime Trithemius cipher: encodeSign produces an opaque
// `EncToken`; decodeSign consumes an EncToken + KeyCap to recover a Sign. Each
// KeyCap is materialized fresh from its `KeyCapDecl` (wheel ref → the
// materialized Wheel, + alphabetSize) and is consumed exactly once — the
// runtime `KeyCapAlreadyConsumedError` is the backstop for the linear-use
// invariant the L1 pass already proved.
//
// Order: encodeSign ops have no provenance-internal dependencies (they read a
// main-graph sign); decodeSign ops depend on an encodeSign's EncToken. The
// binding pass guarantees decodeSign.token resolves to an encodeSign op, so
// processing all encodeSign ops before decodeSign ops is a valid topological
// order for the provenance-internal dependency graph.

/** A materialized provenance value: an EncToken (encodeSign) or a Sign (decodeSign). */
export type ProvenanceValue = EncToken | Sign<Modality, Domain>;

/** Per-op outcome of the L0 provenance lowering, keyed by provop id. */
export type ProvenanceValues = ReadonlyMap<NodeId, ProvenanceValue>;

/**
 * Lower the provenance encoding ops to runtime values. Returns an empty map
 * when the program has no `provenance` section (the L1 pass was a no-op).
 *
 * Throws the runtime `EncSignModalityError` / `KeyCapAlreadyConsumedError` only
 * if the L1 pass was bypassed — under the facade they are unreachable (the L1
 * pass proved linearity + modality). Kept as defense-in-depth backstops.
 */
export function buildProvenanceValues(
  graph: SignGraph,
  values: ReadonlyMap<NodeId, SsaValue>,
): ProvenanceValues {
  const section = graph.provenance;
  if (!section) return new Map();

  // Materialize a fresh KeyCap for each declaration (the wheel comes from the
  // main-graph materialization; alphabetSize from the decl).
  const keyCaps = new Map<NodeId, KeyCap<Wheel<any>, number>>();
  for (const decl of provenanceKeyCapsInOrder(graph)) {
    const wheel = wheelFor(graph, decl, values);
    keyCaps.set(decl.id, new KeyCap<Wheel<any>, number>(wheel, decl.alphabetSize));
  }

  const out = new Map<NodeId, ProvenanceValue>();

  // Pass 1: encodeSign (no provenance-internal deps).
  for (const o of provenanceOpsInOrder(graph)) {
    if (o.op !== "encodeSign") continue;
    out.set(o.id, lowerEncodeSign(graph, o, values, keyCaps));
  }
  // Pass 2: decodeSign (depends on an encodeSign EncToken, now in `out`).
  for (const o of provenanceOpsInOrder(graph)) {
    if (o.op !== "decodeSign") continue;
    out.set(o.id, lowerDecodeSign(graph, o, values, keyCaps, out));
  }

  return out;
}

function wheelFor(
  graph: SignGraph,
  decl: KeyCapDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
): Wheel<any> {
  const w = values.get(decl.wheel);
  if (!(w instanceof Wheel)) {
    // Defensive: bindProvenance resolved decl.wheel to a wheel node, which
    // buildValues materialized. Unreachable under the facade.
    throw new Error(
      `provenance: KeyCap '${decl.id}' references wheel '${decl.wheel}' that did not materialize`,
    );
  }
  return w;
}

function lowerEncodeSign(
  graph: SignGraph,
  o: ProvenanceOpDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
  keyCaps: ReadonlyMap<NodeId, KeyCap<Wheel<any>, number>>,
): EncToken {
  const sign = values.get(o.sign!);
  if (!sign || !isSign(sign)) {
    throw new Error(
      `provenance: encodeSign '${o.id}' references sign '${o.sign}' that did not materialize`,
    );
  }
  const wheel = wheelFor(graph, { kind: "keycap", id: o.id, wheel: o.wheel, alphabetSize: 0 }, values);
  const keyCap = keyCaps.get(o.keyCap)!;
  // L1 proved the sign is SYMBOL-modality; the cast satisfies the runtime
  // signature `encodeSign(sign: Sign<"SYMBOL", T>, …)`.
  return encodeSign(sign as Sign<"SYMBOL", Domain>, wheel, keyCap);
}

function lowerDecodeSign(
  graph: SignGraph,
  o: ProvenanceOpDecl,
  values: ReadonlyMap<NodeId, SsaValue>,
  keyCaps: ReadonlyMap<NodeId, KeyCap<Wheel<any>, number>>,
  out: ReadonlyMap<NodeId, ProvenanceValue>,
): Sign<Modality, Domain> {
  const enc = out.get(o.token!);
  if (!enc || "modality" in enc) {
    // `enc` must be an EncToken from an encodeSign op (binding guaranteed the
    // ref resolves to an encodeSign; the encodeSign pass above populated it).
    // A Sign has `modality`; an EncToken does not — so `modality in enc` means
    // the referenced op produced a Sign, not an EncToken.
    throw new Error(
      `provenance: decodeSign '${o.id}' references token '${o.token}' that is not an EncToken`,
    );
  }
  const wheel = wheelFor(graph, { kind: "keycap", id: o.id, wheel: o.wheel, alphabetSize: 0 }, values);
  const keyCap = keyCaps.get(o.keyCap)!;
  return decodeSign(enc, wheel, keyCap);
}