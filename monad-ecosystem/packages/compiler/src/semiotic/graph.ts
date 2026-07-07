/**
 * SSA SignGraph — the in-memory IR built by the L3 SemioticDialect loader and
 * analyzed by the L2 SignGraphDialect passes.
 *
 * Naming: this is the *compiler lowering* "L3"/"L2" axis (the MLIR stack from
 * `theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is Built.txt:55-71`),
 * distinct from the codegen "Layer 3" / scorer "Layer 6" / parity "Layer 7.8"
 * numbering used elsewhere in the repo. The dialect names (`SemioticDialect`,
 * `SignGraphDialect`) are the primary identifiers to avoid that collision.
 */

import type { EventTrace, CoarseMode } from "@sovereign/types";
import type { Modality, Domain } from "@sovereign/ttcl";

/** SSA node id (declared `id` from the program JSON). */
export type NodeId = string;

/** The four combinator ops the L2 dialect accepts in v1. */
export type CombinatorOp = "compose" | "map" | "fold" | "choose";

/** A wheel declaration node (Llull rotating wheel). */
export interface WheelDecl {
  readonly kind: "wheel";
  readonly id: NodeId;
  readonly size: number;
  readonly initial: number;
}

/** A sign declaration node; materialized via `makeSign` at lower time. */
export interface SignDecl {
  readonly kind: "sign";
  readonly id: NodeId;
  readonly classId: number;
  readonly mode: CoarseMode;
  readonly domain: Domain;
  readonly modality: Modality;
  readonly pps: number;
  readonly trace?: EventTrace;
  readonly domains?: readonly Domain[];
  readonly noRlhf?: boolean;
}

/** A combinator op node; references prior SSA nodes by id. */
export interface OpDecl {
  readonly kind: "op";
  readonly id: NodeId;
  readonly op: CombinatorOp;
  readonly inputs: readonly NodeId[];
}

/** Any SSA node. */
export type SsaNode =
  | WheelDecl
  | SignDecl
  | OpDecl;

/**
 * The compiled-then-analyzed IR. Built by the loader (L3), walked by the
 * passes (L2). Immutable after construction.
 */
export interface SignGraph {
  /** All SSA nodes, keyed by id. */
  readonly nodes: ReadonlyMap<NodeId, SsaNode>;
  /** Declaration order (wheels, then signs, then ops) — the topological seed. */
  readonly order: readonly NodeId[];
  /** Terminal node id (the program's `output`). */
  readonly outputId: NodeId;
  /** Wheel state-space budget cap. */
  readonly budget: number;
  /** Optional constitution threshold override (defaults to the numerics value). */
  readonly constitutionThreshold?: number;
  /** Program id (for diagnostics). */
  readonly program: string;
}

// --- L2 inference results (cached on a parallel map, never on the node) ---

/** The inferred type of a sign-producing node. */
export interface InferredType {
  readonly modality: Modality;
  readonly domains: readonly Domain[];
}