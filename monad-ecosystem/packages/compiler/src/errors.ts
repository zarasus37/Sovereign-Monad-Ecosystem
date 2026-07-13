/**
 * @sovereign/compiler — the MLIR-style TTCL compiler stack.
 *
 * Errors are *compile errors* (the prose's "you get a compile error, not a
 * runtime surprise" — `theo-techno-cosmo/plex/Review/The Four Fundamentals TTCL
 * Is Built.txt:71`): they surface at L3 (load/binding), L2 (inference /
 * constitution / budget), or L1 (provenance linearity / capability), before
 * the program is lowered to the @sovereign/ttcl runtime (L0). None of these
 * reach runtime execution.
 */

/** Base class for every compiler failure. All L3/L2/L1 failures extend this. */
export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompilerError";
  }
}

/**
 * L3 — the input program failed its JSON Schema validation. Carries the ajv
 * error list so the caller can report which fields were malformed.
 */
export class ProgramSchemaError extends CompilerError {
  readonly errors: readonly { instancePath: string; schemaPath: string; message?: string }[];
  constructor(
    errors: readonly { instancePath: string; schemaPath: string; message?: string }[],
  ) {
    const summary = errors
      .map((e) => `${e.instancePath || "<root>"}: ${e.message ?? "invalid"}`)
      .join("; ");
    super(`semiotic-program schema validation failed — ${summary}`);
    this.name = "ProgramSchemaError";
    this.errors = errors;
  }
}

/** L3 — an op referenced an SSA node id that was never declared. */
export class UnresolvedReferenceError extends CompilerError {
  readonly ref: string;
  readonly referringNode: string;
  constructor(ref: string, referringNode: string) {
    super(`unresolved reference: '${ref}' (referenced by node '${referringNode}')`);
    this.name = "UnresolvedReferenceError";
    this.ref = ref;
    this.referringNode = referringNode;
  }
}

/** L3 — the SSA graph is cyclic (SSA must be acyclic). */
export class CyclicSsaError extends CompilerError {
  readonly cycle: readonly string[];
  constructor(cycle: readonly string[]) {
    super(`cyclic SSA: ${cycle.join(" -> ")} -> ${cycle[0]}`);
    this.name = "CyclicSsaError";
    this.cycle = cycle;
  }
}

/** L2 — the output node was not declared (or refers to a wheel, not a sign). */
export class InvalidOutputError extends CompilerError {
  readonly outputId: string;
  constructor(outputId: string, reason: string) {
    super(`invalid output '${outputId}': ${reason}`);
    this.name = "InvalidOutputError";
    this.outputId = outputId;
  }
}

/** L2 inference — a `compose` over an incompatible (PURE ⊥) input. */
export class LatticeAbortError extends CompilerError {
  constructor(nodeId: string, reason: string) {
    super(`lattice abort at '${nodeId}': ${reason}`);
    this.name = "LatticeAbortError";
  }
}

/** L2 constitution — the graph failed constitution compliance. */
export class ConstitutionCompileError extends CompilerError {
  readonly reasoning: readonly string[];
  constructor(reasoning: readonly string[]) {
    super(`constitution compliance failed at L2:\n  - ${reasoning.join("\n  - ")}`);
    this.name = "ConstitutionCompileError";
    this.reasoning = reasoning;
  }
}

/**
 * L1 Provenance — the provenance sub-graph failed the linear-types discipline:
 * a token consumed more than once (or never, when it is not the single
 * terminal), an ambiguous provenance root (zero or >1 unconsumed tokens), an
 * encodeSign over a non-SYMBOL sign, or a KeyCap consumed more than once (or
 * never — every declared capability must be spent exactly once). This is the
 * compile-time mirror of the runtime `KeyCapAlreadyConsumedError` /
 * `EncSignModalityError` backstops — the L1 pass makes linearity an auditable
 * compile fact, not a runtime surprise.
 */
export class ProvenanceCompileError extends CompilerError {
  readonly reasoning: readonly string[];
  constructor(reasoning: readonly string[]) {
    super(`provenance compliance failed at L1:\n  - ${reasoning.join("\n  - ")}`);
    this.name = "ProvenanceCompileError";
    this.reasoning = reasoning;
  }
}