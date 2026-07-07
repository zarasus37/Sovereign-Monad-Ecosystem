/**
 * Sign construction helpers.
 *
 * The LOGOC manifold (`getManifold().get(id)`) returns a `PeirceSignClass` —
 * the static 66-class entry with `id` / `label` / `ring_*`. A per-event
 * `PeirceSignature` adds `mode` and renames `id`→`sign_class_id`,
 * `label`→`sign_class_label`. `classToSignature` performs that conversion;
 * `makeSign` builds a complete `Sign` by looking up a class id on the manifold,
 * so callers never hand-assemble a `PeirceSignature`.
 */

// Re-export the manifold primitives so TTCL consumers can reach the 66-class
// manifold (the canonical Peirce source of truth) through @sovereign/ttcl
// without a second bare import. The manifold lives in @sovereign/types now
// (relocated from @sovereign/logoc — it is the shared essence both TTCL and
// LOGOC derive from). `PeirceSignature` / `CoarseMode` / `PragmatismBand` are
// re-exported from ../types.js; here we expose the value-side manifold.
export { getManifold, type PeirceManifold, type PeirceSignClass } from "@sovereign/types";
import { getManifold, type PeirceSignClass, type PeirceSignature, type CoarseMode, type EventTrace } from "@sovereign/types";
import type { Sign, Modality, Domain } from "../types.js";

/** Convert a manifold sign class into a per-event `PeirceSignature`. */
export function classToSignature(
  cls: PeirceSignClass,
  mode: CoarseMode,
): PeirceSignature {
  return {
    mode,
    sign_class_id: cls.id,
    sign_class_label: cls.label,
    path: cls.path,
    firstness_weight: cls.firstness_weight,
    secondness_weight: cls.secondness_weight,
    thirdness_weight: cls.thirdness_weight,
    pragmatism_band: cls.pragmatism_band,
  };
}

/**
 * Construct a `Sign` by looking up a Peirce class id on the LOGOC manifold.
 * Throws (via the manifold) when `classId` is unknown.
 *
 * `domains` defaults to `[domain]` (a raw sign represents only its own domain);
 * pass all three for a triadic context. `noRlhf` defaults to `true` (no RLHF
 * signal present) — set `false` when the caller knows an RLHF signal exists.
 */
export function makeSign<T extends Domain>(
  classId: number,
  mode: CoarseMode,
  domain: T,
  modality: Modality,
  pps: number,
  trace?: EventTrace,
  domains?: readonly Domain[],
  noRlhf?: boolean,
): Sign<Modality, T> {
  const cls = getManifold().get(classId);
  return {
    modality,
    domain,
    pps,
    peirce: classToSignature(cls, mode),
    trace,
    domains: domains ?? [domain],
    noRlhf: noRlhf ?? true,
  };
}