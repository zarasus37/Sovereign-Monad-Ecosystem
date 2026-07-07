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

import type { SignGraph, SsaNode, NodeId, OpDecl } from "./graph.js";
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