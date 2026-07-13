/**
 * @sovereign/compiler — the TTCL MLIR-style compiler stack.
 *
 * All four lowering levels of the four-level MLIR stack (the prose's "fourth
 * fundamental", `theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is
 * Built.txt:55-71`):
 *
 *   - L3 SemioticDialect   — loads wheels, signs, constitutions; resolves all
 *                            asset references (the loader + wheel-binding pass
 *                            + provenance-binding pass).
 *   - L2 SignGraphDialect  — SSA; the four passes: type/modality inference
 *                            (compose JOIN + fold/choose branch-join +
 *                            attachModality override), rewrite (fusion /
 *                            simplification — map identity-elimination),
 *                            constitution compliance (graph-wide), budgeted
 *                            expansion.
 *   - L1 ProvenanceDialect — linear token threading, encodeSign/decodeSign
 *                            encoding lowering, KeyCap capability check (a
 *                            no-op when the program has no `provenance` section).
 *   - L0 (the target)      — the existing @sovereign/ttcl runtime — this
 *                            package lowers a declarative program to in-memory
 *                            Wheel/Sign/EncToken objects; it emits no code.
 *
 * The keystone guarantee (`Four Fundamentals:85`): a constitution- or
 * provenance-failing program raises a `CompilerError` at L2/L1 and never
 * reaches L0. The 0.72 threshold and the linear-types discipline are enforced
 * at compile time, not as after-the-fact filters.
 *
 * Naming: the "L1"/"L2"/"L3" here are the *compiler lowering* axis, distinct
 * from the codegen "Layer 3" / scorer "Layer 6" / parity "Layer 7.8" numbering
 * used elsewhere in the repo. The dialect names are the primary identifiers.
 */

// L3 — SemioticDialect (the loader).
export { loadProgram } from "./semiotic/loader.js";
export type {
  SignGraph,
  SsaNode,
  NodeId,
  WheelDecl,
  SignDecl,
  OpDecl,
  CombinatorOp,
  InferredType,
  KeyCapDecl,
  TokenDecl,
  TokenOp,
  ProvenanceOpDecl,
  ProvenanceOpKind,
  ProvenanceSection,
} from "./semiotic/graph.js";

// L2 — SignGraphDialect (the passes).
export { inferTypes } from "./sign-graph/inference.js";
export { rewriteGraph, canonical, eliminatedNodes, type ResolveMap } from "./sign-graph/rewrite.js";
export { buildValues, collectWheels, isSign, type SsaValue } from "./sign-graph/materialize.js";
export { checkConstitution, toCompileError, type GraphConstitutionResult } from "./sign-graph/constitution.js";
export { checkBudget, type BudgetResult } from "./sign-graph/budget.js";

// L1 — ProvenanceDialect (the linear-types / capability gate).
export { checkProvenance, toProvenanceCompileError, type ProvenanceResult } from "./sign-graph/provenance.js";

// L0 — the facade (load → analyze → provenance → lower).
export { compileProgram, type CompiledProgram, type CompiledOutput, type CompiledProvenance } from "./sign-graph/compile.js";
export { buildProvenanceValues, type ProvenanceValue, type ProvenanceValues } from "./sign-graph/materialize.js";

// Errors (all extend CompilerError; L3/L2/L1 compile errors, never runtime).
export {
  CompilerError,
  ProgramSchemaError,
  UnresolvedReferenceError,
  CyclicSsaError,
  InvalidOutputError,
  LatticeAbortError,
  ConstitutionCompileError,
  ProvenanceCompileError,
} from "./errors.js";