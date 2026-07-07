/**
 * Token<Index> — a linear-use provenance token.
 *
 * Enforces "consumed exactly once" at RUNTIME, not merely at compile time. The
 * first `consume()` returns the index and marks the token spent; any further
 * `consume()` throws. This is the structural (non-ceremonial) provenance the
 * TTCL specification mandates — linear types whose use-invariant is a runtime
 * fact, auditable rather than hoped-for.
 */

export class TokenAlreadyConsumedError extends Error {
  readonly index: unknown;
  constructor(index: unknown) {
    super(`Token already consumed (index=${String(index)})`);
    this.name = "TokenAlreadyConsumedError";
    this.index = index;
  }
}

export class Token<Index> {
  readonly index: Index;
  #consumed = false;

  constructor(index: Index) {
    this.index = index;
  }

  /** True once `consume()` has been called. */
  get consumed(): boolean {
    return this.#consumed;
  }

  /**
   * Consume the token, returning its index. Throws `TokenAlreadyConsumedError`
   * on any second consumption — the linear-use invariant enforced at runtime.
   */
  consume(): Index {
    if (this.#consumed) {
      throw new TokenAlreadyConsumedError(this.index);
    }
    this.#consumed = true;
    return this.index;
  }
}