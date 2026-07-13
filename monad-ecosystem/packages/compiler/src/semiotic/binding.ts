/**
 * L3 SemioticDialect — wheel-binding pass.
 *
 * Resolves every op input reference to a declared node, enforces SSA
 * acyclicity, and validates the declared `output` node. This is the prose's
 * "resolves all asset references" L3 responsibility (`theo-techno-cosmo/plex/
 * archive/TTCL_v1_0_BREAKDOWN.md:196` — "Wheel-binding pass: Resolves all sign
 * references to loaded assets").
 *
 * Pure: throws on failure, returns nothing on success. Mutates nothing — the
 * graph's `nodes`/`order` are already final from the loader.
 */

import type { SignGraph, SsaNode, NodeId, OpDecl, KeyCapDecl, TokenDecl, ProvenanceOpDecl } from "./graph.js";
import {
  UnresolvedReferenceError,
  CyclicSsaError,
  InvalidOutputError,
} from "../errors.js";

/**
 * Resolve every op input + the output + enforce acyclicity. Throws a
 * `CompilerError` subtype on the first failure (L3 errors are compile errors,
 * before any L2 pass or L0 materialization).
 */
export function bindGraph(graph: SignGraph): void {
  // 1. Resolve every op input reference.
  for (const id of graph.order) {
    const node = graph.nodes.get(id)!;
    if (node.kind === "op") {
      for (const ref of node.inputs) {
        if (!graph.nodes.has(ref)) {
          throw new UnresolvedReferenceError(ref, id);
        }
      }
    }
  }

  // 2. Validate the output node (must exist and must produce a sign).
  const output = graph.nodes.get(graph.outputId);
  if (!output) {
    throw new InvalidOutputError(
      graph.outputId,
      "output node not declared",
    );
  }
  if (output.kind === "wheel") {
    throw new InvalidOutputError(
      graph.outputId,
      "output is a wheel, not a sign",
    );
  }

  // 3. Enforce acyclicity (SSA must be a DAG). Op edges go op -> inputs.
  //    A sign/wheel node has no out-edges in this dependency graph, so cycles
  //    can only form through op inputs. DFS with a tri-color marking.
  assertAcyclic(graph);
}

function assertAcyclic(graph: SignGraph): void {
  // WHITE = unvisited, GRAY = on current stack, BLACK = finished.
  const color = new Map<NodeId, "white" | "gray" | "black">();
  for (const id of graph.order) color.set(id, "white");

  for (const start of graph.order) {
    if (color.get(start) === "white") {
      const stack: NodeId[] = [];
      dfsVisit(graph, start, color, stack);
    }
  }
}

function dfsVisit(
  graph: SignGraph,
  id: NodeId,
  color: Map<NodeId, "white" | "gray" | "black">,
  stack: NodeId[],
): void {
  color.set(id, "gray");
  stack.push(id);
  const node = graph.nodes.get(id)!;
  if (node.kind === "op") {
    for (const ref of node.inputs) {
      const c = color.get(ref)!;
      if (c === "gray") {
        // Found a back-edge → cycle. Slice the stack from the first occurrence.
        const cycleStart = stack.indexOf(ref);
        throw new CyclicSsaError(stack.slice(cycleStart));
      }
      if (c === "white") {
        dfsVisit(graph, ref, color, stack);
      }
    }
  }
  stack.pop();
  color.set(id, "black");
}

/**
 * Helper (re-exported for L2 passes): the op nodes in dependency order. The
 * loader's `order` is declaration order, which is already topological for a
 * well-formed program (a program can only reference previously-declared
 * nodes — enforced by the acyclicity check), so this is just `order` filtered
 * to ops. Provided as a named export so passes don't reach into `order` ad hoc.
 */
export function opsInOrder(graph: SignGraph): OpDecl[] {
  return graph.order
    .map((id) => graph.nodes.get(id)!)
    .filter((n): n is OpDecl => n.kind === "op");
}

/** Helper: the declared wheel nodes in declaration order. */
export function wheelDecls(graph: SignGraph): SsaNode[] {
  return graph.order
    .map((id) => graph.nodes.get(id)!)
    .filter((n) => n.kind === "wheel");
}

/**
 * L3 — provenance-binding pass: resolve every provenance reference + enforce
 * acyclicity over the provenance sub-graph. No-op when the program has no
 * `provenance` section. Provenance refs flow FROM provenance nodes TO main-graph
 * nodes (wheels/signs) and within the provenance sub-graph (tokens →
 * mergeProvenance inputs, encodeSign → decodeSign token) — never the reverse,
 * so no cycle can form through the main graph. Throws the same L3 errors as
 * `bindGraph` (`UnresolvedReferenceError` / `CyclicSsaError`).
 *
 * Pure: throws on failure, returns nothing on success. Mutates nothing.
 */
export function bindProvenance(graph: SignGraph): void {
  const section = graph.provenance;
  if (!section) return;

  // 1. Resolve every provenance reference.
  for (const k of section.keyCaps) {
    resolveRef(graph, k.wheel, k.id, "wheel");
  }
  for (const t of section.tokens) {
    if (t.op === "emitToken") {
      if (t.index === undefined || !Number.isInteger(t.index) || t.index < 0) {
        throw new UnresolvedReferenceError(
          "<emitToken index>",
          t.id,
        );
      }
    } else {
      // mergeProvenance: every input must be a declared token.
      for (const ref of t.inputs) {
        const node = resolveRef(graph, ref, t.id, "token");
        if (node.kind !== "token") {
          throw new UnresolvedReferenceError(ref, t.id);
        }
      }
    }
  }
  for (const o of section.ops) {
    if (o.op === "encodeSign") {
      if (!o.sign) {
        throw new UnresolvedReferenceError("<encodeSign sign>", o.id);
      }
      const signNode = resolveRef(graph, o.sign, o.id, "sign");
      if (signNode.kind !== "sign") {
        throw new UnresolvedReferenceError(o.sign, o.id);
      }
    } else {
      // decodeSign: the token ref must be an encodeSign op (EncToken producer).
      if (!o.token) {
        throw new UnresolvedReferenceError("<decodeSign token>", o.id);
      }
      const tokNode = graph.nodes.get(o.token);
      if (!tokNode || tokNode.kind !== "provop" || tokNode.op !== "encodeSign") {
        throw new UnresolvedReferenceError(o.token, o.id);
      }
    }
    resolveRef(graph, o.wheel, o.id, "wheel");
    const keyNode = resolveRef(graph, o.keyCap, o.id, "keycap");
    if (keyNode.kind !== "keycap") {
      throw new UnresolvedReferenceError(o.keyCap, o.id);
    }
  }

  // 2. Enforce acyclicity over the provenance sub-graph (token + provop deps).
  assertProvenanceAcyclic(graph);
}

/**
 * Resolve a ref to a declared node, requiring a specific `kind`. Throws
 * `UnresolvedReferenceError` if the ref is missing or the wrong kind. Returns
 * the node so the caller can further discriminate.
 */
function resolveRef(
  graph: SignGraph,
  ref: NodeId,
  referringNode: NodeId,
  expectedKind: "wheel" | "sign" | "token" | "keycap" | "provop",
): SsaNode {
  const node = graph.nodes.get(ref);
  if (!node) {
    throw new UnresolvedReferenceError(ref, referringNode);
  }
  if (node.kind !== expectedKind) {
    throw new UnresolvedReferenceError(ref, referringNode);
  }
  return node;
}

/**
 * Provenance-internal dependencies of a node (the refs that point to OTHER
 * provenance nodes — mergeProvenance inputs, decodeSign token). Refs to
 * main-graph nodes (signs/wheels) and to keycaps (which have no deps) are
 * acyclic anchors and excluded from the cycle search.
 */
function provenanceDeps(node: SsaNode): readonly NodeId[] {
  if (node.kind === "token" && node.op === "mergeProvenance") {
    return node.inputs;
  }
  if (node.kind === "provop" && node.op === "decodeSign" && node.token) {
    return [node.token];
  }
  return [];
}

function assertProvenanceAcyclic(graph: SignGraph): void {
  const section = graph.provenance!;
  const ids: NodeId[] = [
    ...section.keyCaps.map((k) => k.id),
    ...section.tokens.map((t) => t.id),
    ...section.ops.map((o) => o.id),
  ];
  const color = new Map<NodeId, "white" | "gray" | "black">();
  for (const id of ids) color.set(id, "white");

  for (const start of ids) {
    if (color.get(start) === "white") {
      const stack: NodeId[] = [];
      dfsVisitProv(graph, start, color, stack);
    }
  }
}

function dfsVisitProv(
  graph: SignGraph,
  id: NodeId,
  color: Map<NodeId, "white" | "gray" | "black">,
  stack: NodeId[],
): void {
  color.set(id, "gray");
  stack.push(id);
  const node = graph.nodes.get(id)!;
  for (const ref of provenanceDeps(node)) {
    const c = color.get(ref) ?? "white";
    if (c === "gray") {
      const cycleStart = stack.indexOf(ref);
      throw new CyclicSsaError(stack.slice(cycleStart));
    }
    if (c === "white") {
      dfsVisitProv(graph, ref, color, stack);
    }
  }
  stack.pop();
  color.set(id, "black");
}

/** Helper (for the L1 pass + tests): the provenance encoding ops in order. */
export function provenanceOpsInOrder(graph: SignGraph): readonly ProvenanceOpDecl[] {
  return graph.provenance?.ops ?? [];
}

/** Helper (for the L1 pass + tests): the provenance tokens in order. */
export function provenanceTokensInOrder(graph: SignGraph): readonly TokenDecl[] {
  return graph.provenance?.tokens ?? [];
}

/** Helper (for the L1 pass + tests): the declared KeyCaps in order. */
export function provenanceKeyCapsInOrder(graph: SignGraph): readonly KeyCapDecl[] {
  return graph.provenance?.keyCaps ?? [];
}