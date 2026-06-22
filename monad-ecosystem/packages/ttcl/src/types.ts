export type PeirceSignClassId = number; // 0–65

export interface PeirceSignature {
  id: PeirceSignClassId;
  label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: 'INSTINCT' | 'EXPERIENCE' | 'FORMAL_THOUGHT';
}

export type Sign<M, T> = {
  modality: M;
  domain: T;
  pps: number;
  peirce: PeirceSignature;
};

// --- Type-gating Utility Types ---

/**
 * Ensures the given Sign operates within the FORMAL_THOUGHT pragmatism band.
 * Used to restrict functions (e.g. `prove()`) from accepting raw instinctual signs.
 *
 * @example
 *   function prove<S extends Sign<any, any>>(sign: RequireFormalThought<S>): Proof<S> { ... }
 */
export type RequireFormalThought<S extends Sign<any, any>> = S['peirce']['pragmatism_band'] extends 'FORMAL_THOUGHT' ? S : never;

/**
 * Ensures the given Sign has a strong element of secondness (secondness_weight >= 0.4).
 * Since TypeScript cannot compare floating point at the type level, this type
 * is a semantic contract enforced by the classifier at sign-creation time.
 * It narrows to the subset of Signs whose Peirce path places them in a
 * secondness-dominant triadic position (e.g. Index or Dicent interpretant).
 *
 * @example
 *   function emitObservation<S extends Sign<any, any>>(sign: RequireStrongSecondness<S>): Observation<S> { ... }
 */
export type RequireStrongSecondness<S extends Sign<any, any>> = S['peirce']['path'][1] extends 'Index' | 'Dicent' ? S : never;

/**
 * Ensures the sign is an argument (thirdness dominating, interpretant = Argument).
 * Used for inference and logical conclusion gates.
 *
 * @example
 *   function deriveConclusion<S extends Sign<any, any>>(sign: RequireArgument<S>): Conclusion<S> { ... }
 */
export type RequireArgument<S extends Sign<any, any>> = S['peirce']['path'][2] extends 'Argument' ? S : never;

// --- Compile-time gating demonstrations ---
// These are type-level proof-of-concept signatures.  Runtime enforcement
// lives in the classifier and the manifold weight invariants.

/** prove() only accepts FORMAL_THOUGHT signs with Argument interpretant. */
export declare function prove<S extends Sign<any, any>>(sign: RequireFormalThought<RequireArgument<S>>): { theorem: string; sign: S };

/** emitObservation() only accepts signs with strong secondness (Index object-relation). */
export declare function emitObservation<S extends Sign<any, any>>(sign: RequireStrongSecondness<S>): { observation: string; sign: S };

/** distill() accepts any sign, but the return type is constrained by the input band. */
export declare function distill<S extends Sign<any, any>>(sign: S): S extends { peirce: { pragmatism_band: 'FORMAL_THOUGHT' } } ? { refined: true; sign: S } : { refined: false; sign: S };
