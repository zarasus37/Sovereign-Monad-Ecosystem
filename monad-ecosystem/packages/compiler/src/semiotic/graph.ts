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

/**
 * The combinator ops the L2 dialect accepts.
 *
 * `compose` is the TTCL JOIN (output HYBRID). `map` is a unary carrier
 * passthrough (the IR carries no function payload, so it is structural identity
 * — the rewrite pass eliminates it). `fold` / `choose` are the branching
 * combinators: their inferred type is the lattice JOIN of all inputs (full
 * branch-join semantics). `attachModality` overrides its carrier's modality
 * (the L3 op the spec names but does not define — realized here as a distinct
 * SSA op per PROJECT_STATE; see `OpDecl.modality`).
 */
export type CombinatorOp = "compose" | "map" | "fold" | "choose" | "attachModality";

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

/**
 * A combinator op node; references prior SSA nodes by id. `modality` is the
 * target modality for `attachModality` (required for that op, absent otherwise
 * — enforced by the schema's `if`/`then` and defended in inference).
 */
export interface OpDecl {
  readonly kind: "op";
  readonly id: NodeId;
  readonly op: CombinatorOp;
  readonly inputs: readonly NodeId[];
  readonly modality?: Modality;
}

/** Any SSA node (main graph + provenance sub-graph, discriminated by `kind`). */
export type SsaNode =
  | WheelDecl
  | SignDecl
  | OpDecl
  | KeyCapDecl
  | TokenDecl
  | ProvenanceOpDecl;

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
  /**
   * Optional L1 Provenance section (the Linear-types fundamental). Absent on
   * programs with no `provenance` block — every L1 step is then a no-op. When
   * present, the L1 pass (`sign-graph/provenance.ts`) enforces linear token
   * threading, the SYMBOL-modality check on encodeSign, and the KeyCap
   * capability check. Provenance node ids are distinct from the main-graph
   * `nodes` ids (the loader enforces program-wide uniqueness).
   */
  readonly provenance?: ProvenanceSection;
}

// --- L1 Provenance IR ---
//
// The "separate provenance section" design (the user-confirmed Q2 choice)
// refers to the *JSON schema* section `provenance: {...}` — distinct from the
// L2 combinator `ops` array, so the existing `op:"encodeSign"` rejection test
// stays valid. At the IR level the provenance node kinds ARE part of the
// `SsaNode` union (discriminated by `kind`): they live in the shared `nodes`
// map for uniform ref resolution + program-wide id uniqueness, but are NOT
// pushed to `order` — so the four L2 passes (which iterate `order`) never see
// them and stay no-op when provenance is absent. The ordered lists are held in
// `ProvenanceSection` for the L1 pass. This matches the spec ordering
// L3→L2→L1→L0 (the L1 pass runs after L2, before L0). Provenance references
// flow FROM provenance nodes TO main-graph nodes (signs/wheels), never the
// reverse, so no cycle can form through the main graph.

/** The Trithemius key-capability ops (encoding lowering). */
export type ProvenanceOpKind = "encodeSign" | "decodeSign";

/** The linear token ops (provenance threading). */
export type TokenOp = "emitToken" | "mergeProvenance";

/**
 * A declared Trithemius key capability (single-use). `wheel` references a
 * `WheelDecl` in the main graph; `alphabetSize` is the cipher alphabet (256
 * for byte-range signs). Materialized to a runtime `KeyCap` at L0.
 */
export interface KeyCapDecl {
  readonly kind: "keycap";
  readonly id: NodeId;
  readonly wheel: NodeId;
  readonly alphabetSize: number;
}

/**
 * A linear provenance token node. `emitToken` anchors a token at `index`;
 * `mergeProvenance` joins `inputs` (referenced tokens) into one merged lineage.
 * Each token is consumed at most once (by a mergeProvenance input); exactly one
 * token is the unconsumed terminal — the provenance root.
 */
export interface TokenDecl {
  readonly kind: "token";
  readonly id: NodeId;
  readonly op: TokenOp;
  /** emitToken: the anchor index. */
  readonly index?: number;
  /** mergeProvenance: referenced token ids. */
  readonly inputs: readonly NodeId[];
}

/**
 * A provenance encoding op (lowers to the runtime Trithemius cipher at L0).
 * `encodeSign` reads `sign` (a SYMBOL-modality sign-producing node) + consumes
 * `keyCap`, producing an EncToken. `decodeSign` reads `token` (an encodeSign
 * op's EncToken) + consumes `keyCap`, producing a recovered Sign. `wheel` is
 * accepted for signature fidelity to `encodeSign(s, w, k)`; the cipher key
 * state lives in the KeyCap's wheel.
 */
export interface ProvenanceOpDecl {
  readonly kind: "provop";
  readonly id: NodeId;
  readonly op: ProvenanceOpKind;
  /** encodeSign: the sign node id to encode. */
  readonly sign?: NodeId;
  /** decodeSign: the EncToken-producing op id to decode. */
  readonly token?: NodeId;
  readonly wheel: NodeId;
  readonly keyCap: NodeId;
}

/** The L1 Provenance sub-graph. */
export interface ProvenanceSection {
  readonly keyCaps: readonly KeyCapDecl[];
  readonly tokens: readonly TokenDecl[];
  readonly ops: readonly ProvenanceOpDecl[];
}

// --- L2 inference results (cached on a parallel map, never on the node) ---

/** The inferred type of a sign-producing node. */
export interface InferredType {
  readonly modality: Modality;
  readonly domains: readonly Domain[];
}