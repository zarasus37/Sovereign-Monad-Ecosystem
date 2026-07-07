/**
 * Wheel<N> — the Llull rotating wheel, the combinatorial substrate of TTCL.
 *
 * A wheel is a rotating position over a cyclic alphabet of size N. Rotations
 * wrap modulo N; negative steps rotate backward. `combineWheels` multiplies
 * wheel sizes to yield the joint state-space cardinality — the "budget as a
 * dependent type" combinator from the Llull–Trithemius–Peirce specification.
 */

export class WheelBudgetExceededError extends Error {
  readonly budget: number;
  readonly product: number;
  constructor(budget: number, product: number) {
    super(`Wheel budget exceeded: product ${product} > budget ${budget}`);
    this.name = "WheelBudgetExceededError";
    this.budget = budget;
    this.product = product;
  }
}

export class Wheel<N extends number> {
  readonly size: N;
  #pos: number;

  constructor(size: N, initial = 0) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(`Wheel size must be a positive integer, got ${size}`);
    }
    this.size = size;
    this.#pos = ((initial % size) + size) % size;
  }

  /** Current wheel position in `[0, size)`. */
  get position(): number {
    return this.#pos;
  }

  /** Rotate by `steps` (wraps modulo size; negative rotates backward). */
  rotate(steps: number): void {
    this.#pos = (this.#pos + ((steps % this.size) + this.size)) % this.size;
  }

  /** Set the position explicitly (wraps modulo size; negative handled). */
  set(position: number): void {
    this.#pos = ((position % this.size) + this.size) % this.size;
  }

  /** Reset to the origin (position 0). */
  reset(): void {
    this.#pos = 0;
  }

  snapshot(): { size: N; position: number } {
    return { size: this.size, position: this.#pos };
  }
}

/**
 * Joint state-space cardinality of a set of wheels: the product ∏ size_i.
 * This is the "budget as a dependent type" combinator — the count of distinct
 * camera positions reachable by rotating the wheels independently.
 */
export function combineWheels<W extends Wheel<any>[]>(...wheels: W): number {
  return wheels.reduce((acc, w) => acc * w.size, 1);
}

/** `combineWheels` with a budget cap; throws when the product exceeds `budget`. */
export function combineWheelsBudgeted(
  budget: number,
  ...wheels: Wheel<any>[]
): number {
  const product = combineWheels(...wheels);
  if (product > budget) {
    throw new WheelBudgetExceededError(budget, product);
  }
  return product;
}