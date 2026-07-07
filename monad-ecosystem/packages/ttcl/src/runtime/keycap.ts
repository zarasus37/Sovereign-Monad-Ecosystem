/**
 * KeyCap<W, K> — the Trithemius polyalphabetic cipher key.
 *
 * A KeyCap wraps a `Wheel` and an alphabet of size K. Encryption shifts each
 * symbol by a wheel-derived offset that advances after every symbol, so the
 * cipher key rotates through the alphabet — the polyalphabetic property that
 * makes Trithemius's Tabula Recta a linear-provenance primitive.
 *
 * `encrypt` and `decrypt` both rotate the wheel forward as they process. To
 * decrypt a ciphertext produced by `encrypt`, the wheel must be returned to
 * the position `encrypt` started from. `encrypt` therefore records and returns
 * `keyOffset` (its starting wheel position); `decrypt(cipher, keyOffset)`
 * resets the wheel there before processing. This is the honest polyalphabetic
 * model — the wheel IS the key state, and decrypting requires the same key
 * sequence that encrypted.
 */

import { Wheel } from "./wheel.js";

export class KeyCap<W extends Wheel<any>, K extends number> {
  readonly wheel: W;
  readonly alphabetSize: K;

  constructor(wheel: W, alphabetSize: K) {
    if (!Number.isInteger(alphabetSize) || alphabetSize <= 0) {
      throw new RangeError(
        `KeyCap alphabetSize must be a positive integer, got ${alphabetSize}`,
      );
    }
    this.wheel = wheel;
    this.alphabetSize = alphabetSize;
  }

  /** Encrypt `plain` (symbols in `[0, alphabetSize)`); advances the wheel. */
  encrypt(plain: number[]): { cipher: number[]; keyOffset: number } {
    const keyOffset = this.wheel.position;
    const cipher = this.process(plain, (sym, shift) => sym + shift);
    return { cipher, keyOffset };
  }

  /** Decrypt `cipher` starting from wheel position `keyOffset`; advances the wheel. */
  decrypt(cipher: number[], keyOffset: number): number[] {
    this.wheel.set(keyOffset);
    return this.process(cipher, (sym, shift) => sym - shift);
  }

  /** Explicit re-keying step (rotate the wheel by one). */
  rotateKey(): void {
    this.wheel.rotate(1);
  }

  private process(
    input: number[],
    op: (sym: number, shift: number) => number,
  ): number[] {
    const K = this.alphabetSize;
    const out: number[] = [];
    for (const sym of input) {
      if (!Number.isInteger(sym) || sym < 0 || sym >= K) {
        throw new RangeError(`Symbol ${sym} out of range [0, ${K})`);
      }
      const shift = this.wheel.position % K;
      const v = op(sym, shift) % K;
      out.push((v + K) % K);
      this.wheel.rotate(1);
    }
    return out;
  }
}

/** Rotate a KeyCap's wheel by `steps` (mutates and returns for chaining). */
export function keyRotate<K extends KeyCap<any, any>>(key: K, steps: number): K {
  for (let i = 0; i < steps; i++) key.rotateKey();
  return key;
}