/**
 * @sovereign/compiler — the TTCL MLIR-style compiler stack.
 *
 * Two lowering levels of the four-level MLIR stack (the prose's "fourth
 * fundamental", `theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL Is
 * Built.txt:55-71`):
 *
 *   - L3 SemioticDialect  — loads wheels, signs, constitutions; resolves all
 *                           asset references (the loader + wheel-binding pass).
 *   - L2 SignGraphDialect — SSA; type/modality inference, constitution
 *                           compliance (graph-wide), budgeted expansion.
 *
 * L1 (Provenance: token threading, KeyCap capability, encodeSign lowering) is
 * deferred. L0 (the target) IS the existing @sovereign/ttcl runtime — this
 * package lowers a declarative program to in-memory Wheel/Sign objects; it
 * emits no code.
 *
 * The keystone guarantee (`Four Fundamentals:85`): a constitution-failing
 * program raises a `CompilerError` at L2 and never reaches L0. The 0.72
 * threshold is enforced at compile time, not as an after-the-fact filter.
 *
 * Naming: the "L2"/"L3" here are the *compiler lowering* axis, distinct from
 * the codegen "Layer 3" / scorer "Layer 6" / parity "Layer 7.8" numbering used
 * elsewhere in the repo. The dialect names are the primary identifiers.
 */

// L3 — SemioticDialect (the loader).
export { loadProgram } from "./semiotic/loader.js";
export type { SignGraph, SsaNode, NodeId, WheelDecl, SignDecl, OpDecl, CombinatorOp, InferredType } from "./semiotic/graph.js";

// L2 — SignGraphDialect (the passes) + the facade.
export { inferTypes } from "./sign-graph/inference.js";
export { buildValues, collectWheels, isSign, type SsaValue } from "./sign-graph/materialize.js";
export { checkConstitution, toCompileError, type GraphConstitutionResult } from "./sign-graph/constitution.js";
export { checkBudget, type BudgetResult } from "./sign-graph/budget.js";
export { compileProgram, type CompiledProgram, type CompiledOutput } from "./sign-graph/compile.js";

// Errors (all extend CompilerError; L3/L2 compile errors, never runtime).
export {
  CompilerError,
  ProgramSchemaError,
  UnresolvedReferenceError,
  CyclicSsaError,
  InvalidOutputError,
  LatticeAbortError,
  ConstitutionCompileError,
} from "./errors.js";