/**
 * @generated DO NOT EDIT — generated from shared/ttcl-specs/sign-events.json
 * @source shared/ttcl-specs/sign-events.json
 * by monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs.
 *
 * @sovereign/ttcl runtime — Sign factory functions (Layer 3 — codegen, Phase B).
 *
 * This file is generated wholesale from the JSON source of truth on every
 * gen-ttcl-artifacts.mjs run. Drift (a hand-edit, or the JSON changing without a
 * re-run) is caught by `scripts/check-ttcl-artifacts-drift.mjs`, which regenerates
 * this file into memory and diffs it against the committed copy.
 *
 * Edit shared/ttcl-specs/sign-events.json, then re-run:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs
 */

// Sign factories are thin wrappers over makeSign (../runtime/sign.js). The
// LOGOC manifold stays the sole source of truth for the peirce block — factories
// never hand-assemble a PeirceSignature. Drift is caught by
// scripts/check-ttcl-artifacts-drift.mjs.

import { makeSign } from "../runtime/sign.js";
import type { Sign, Domain } from "../types.js";
import type { EventTrace } from "@sovereign/types";

/**
 * The well-formed triadic HYBRID observation: compose(Theology, Technology, Cosmology) dominant peirce = class 8 (Delome-Symbol-Legisign, FORMAL_THOUGHT, thirdness 0.85 — the most argumentative class). Spans all three domains; would pass the constitution triadic gate. pps 0.30 places it in the volatile band (genuine sync tension, not a locked state).
 * Source: monad-ecosystem/packages/ttcl/src/runtime/combinators.ts:140 (compose) + logoc/spec/peirce_sign_classes.json:122 (class 8)
 */
export function makeTriadicObservation(trace?: EventTrace): Sign<"HYBRID", Domain> {
  return makeSign(
    8, // sign_class_id
    "INDEX", // mode
    "COSMOLOGY", // domain
    "HYBRID", // modality
    0.3, // pps
    trace,
    ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"], // domains
    true, // noRlhf
  ) as Sign<"HYBRID", Domain>;
}

/**
 * A raw single-domain TECHNOLOGY index — class 2 (Dicent-Indexical-Sinsign, EXPERIENCE, secondness 1.0). Single-domain by design, so it scores < 0.72 on the constitution C1 (tripartite) criterion and is structurally incapable of passing the Triadic Minimal Gate alone. pps 1.00 = fully synced raw packet. Used as the negative-shape counterpoint to triadicObservation.
 * Source: monad-ecosystem/packages/ttcl/src/runtime/combinators.ts:148 (Triadic Minimal Gate) + logoc/spec/peirce_sign_classes.json:33 (class 2)
 */
export function makeRawTechnologyPacket(trace?: EventTrace): Sign<"INDEX", "TECHNOLOGY"> {
  return makeSign(
    2, // sign_class_id
    "INDEX", // mode
    "TECHNOLOGY", // domain
    "INDEX", // modality
    1, // pps
    trace,
    ["TECHNOLOGY"], // domains
    true, // noRlhf
  ) as Sign<"INDEX", "TECHNOLOGY">;
}
