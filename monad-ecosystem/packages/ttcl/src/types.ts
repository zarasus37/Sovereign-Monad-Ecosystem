/**
 * TTCL — Theo-Techno-Cosmological Language: core types.
 *
 * The Peirce semiotic signature (`PeirceSignature`), the 66-class manifold, and
 * the semiotic primitives (`PragmatismBand` / `CoarseMode`) are owned by
 * `@sovereign/types` — the contracts package — where the manifold was relocated
 * from @sovereign/logoc. The manifold is the shared essence both TTCL and LOGOC
 * derive from, so it lives in the contracts package, not inside either runtime.
 * TTCL re-exports the signature type and composes signs against the manifold at
 * runtime; it does NOT duplicate the manifold. One definition of the Peirce
 * primitives, shared by both packages.
 */

export type PeirceSignClassId = number;

// Peirce semiotic primitives are canonical in @sovereign/types. Re-export so
// consumers of @sovereign/ttcl receive the same PeirceSignature shape the
// manifold produces — one definition, not two.
export type { PeirceSignature, PragmatismBand, CoarseMode } from "@sovereign/types";

import type { EventTrace, PeirceSignature } from "@sovereign/types";

/** The modal lattice: HYBRID ⊤ → ICON / INDEX / SYMBOL → PURE ⊥. */
export type Modality = "PURE" | "ICON" | "INDEX" | "SYMBOL" | "HYBRID";

/** The three irreducible TTCL domains, unified by Logic (the JOIN operator). */
export type Domain = "THEOLOGY" | "TECHNOLOGY" | "COSMOLOGY";

/**
 * `Sign<M, T>` — the core TTCL semiotic unit.
 *
 * - `modality` places the sign on the modal lattice.
 * - `domain` is the TTCL domain (Theology / Technology / Cosmology).
 * - `pps` is the Primary Parameter Schema sync score (a per-emission runtime
 *   position on the manifold ring); its canonical values are owned by the
 *   numeric-centralization layer (`shared/schemas/ttcl-numerics.json`).
 * - `peirce` is the LOGOC `PeirceSignature` (the 66-class classification).
 * - `trace` is the optional CHARTER §4 intention trace. Combinators that emit
 *   bus-eligible gnosis events require it; enforcement lives at the bus
 *   boundary (`validateIntentionTraceability`), not here — the TTCL runtime
 *   stays side-effect-free.
 * - `domains` is the optional triadic ancestry — the set of TTCL domains this
 *   sign represents. A raw single-domain sign carries `[domain]`; a HYBRID
 *   produced by `compose(theo, tech, cosmo)` carries all three. Consumed by
 *   the constitution scorer's C1 (tripartite) criterion. Defaults to `[domain]`.
 * - `noRlhf` is the optional caller-set flag (default `true`) asserting no
 *   reinforcement-learning-from-human-feedback signal is present. Consumed by
 *   the constitution scorer's C5 criterion.
 */
export type Sign<M extends Modality, T extends Domain> = {
  readonly modality: M;
  readonly domain: T;
  readonly pps: number;
  readonly peirce: PeirceSignature;
  readonly trace?: EventTrace;
  /** Triadic ancestry — domains this sign represents (defaults to `[domain]`). */
  readonly domains?: readonly Domain[];
  /** Caller-set flag (default `true`) that no RLHF signal is present. */
  readonly noRlhf?: boolean;
};

// --- Compile-time semiotic gates (Axiom 6 — Demiurge/Constraints) ---
// These encode structural constraints at compile time so malformed signs are
// rejected before runtime. The same constraints are re-checked at runtime in
// `runtime/prove.ts` (TypeScript types erase at runtime, so the gate logic must
// be reified as values to be trustworthy).

/** Restricts a Sign to the FORMAL_THOUGHT pragmatism band. */
export type RequireFormalThought<S extends Sign<any, any>> =
  S["peirce"]["pragmatism_band"] extends "FORMAL_THOUGHT" ? S : never;

/**
 * Narrows to Signs whose Peirce path places them in a secondness-dominant
 * triadic position (Index object-relation / Dicent interpretant).
 */
export type RequireStrongSecondness<S extends Sign<any, any>> =
  S["peirce"]["path"][1] extends "Index" | "Dicent" ? S : never;

/** Narrows to Signs whose interpretant is an Argument. */
export type RequireArgument<S extends Sign<any, any>> =
  S["peirce"]["path"][2] extends "Argument" ? S : never;