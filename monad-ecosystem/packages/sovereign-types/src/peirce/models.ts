/**
 * Peirce semiotic primitives — the shared substrate both the TTCL Sign runtime
 * (@sovereign/ttcl) and the LOGOC classifier (@sovereign/logoc) derive from.
 *
 * These three types are the contract: the 66-class manifold (../manifold.js) and
 * the per-event `PeirceSignature` both reference `PragmatismBand` / `CoarseMode`.
 * They live in @sovereign/types — the contracts package — so neither runtime owns
 * the other's essence (the manifold relocation's whole point).
 */

/** Peirce's three pragmatism bands (Layer 4a — instinct → experience → formal thought). */
export type PragmatismBand = "INSTINCT" | "EXPERIENCE" | "FORMAL_THOUGHT";

/** The three coarse sign modes (the modal lattice's middle tier). */
export type CoarseMode = "ICON" | "INDEX" | "SYMBOL";

/**
 * A per-event Peirce signature — the runtime projection of a manifold
 * `PeirceSignClass` onto a single observed event. Adds `mode` and renames
 * `id`→`sign_class_id`, `label`→`sign_class_label`; the weights/path/band are
 * carried verbatim from the manifold class so the signature is self-describing
 * without a manifold lookup (though the manifold stays the sole source of
 * truth — `sign_class_id` MUST be a valid manifold id).
 */
export interface PeirceSignature {
  mode: CoarseMode;
  sign_class_id: number;
  sign_class_label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: PragmatismBand;
}