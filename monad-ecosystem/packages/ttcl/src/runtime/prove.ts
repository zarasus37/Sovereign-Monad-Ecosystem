/**
 * Runtime semiotic gates — the value-level reification of the compile-time
 * `Require*` type gates.
 *
 * TypeScript types erase at runtime, so the `RequireFormalThought` /
 * `RequireStrongSecondness` / `RequireArgument` constraints must be re-checked
 * against actual values to be trustworthy. `prove` / `emitObservation` /
 * `distill` do that and return a structured `ProofResult` so the caller decides
 * whether to abort or downgrade — they are runtime predicates, not panics, and
 * do not throw on gate failure (only on an unknown sign class, which is a
 * data-integrity error rather than a gate outcome).
 */

import { getManifold } from "@sovereign/types";
import { UnknownSignClassError } from "./errors.js";
import type { Sign, Modality, Domain } from "../types.js";

export interface GateResult {
  /** Whether this gate was required for the operation being performed. */
  readonly required: boolean;
  /** Whether the gate's condition actually held for this sign. */
  readonly held: boolean;
}

export interface ProofResult<S extends Sign<any, any>> {
  /** Overall pass/fail: all *required* gates held. */
  readonly pass: boolean;
  /** The sign that was proved. */
  readonly sign: S;
  /** Per-gate outcomes. */
  readonly gates: {
    readonly formalThought: GateResult;
    readonly strongSecondness: GateResult;
    readonly argument: GateResult;
  };
  /** Human-readable reasoning for each failed required gate. */
  readonly reasoning: string[];
}

/** Assert the sign's class id is known to the LOGOC manifold. */
function assertKnownClass(sign: Sign<any, any>): void {
  try {
    getManifold().get(sign.peirce.sign_class_id);
  } catch {
    throw new UnknownSignClassError(sign.peirce.sign_class_id);
  }
}

function evaluateGates(sign: Sign<any, any>): {
  formalThought: boolean;
  strongSecondness: boolean;
  argument: boolean;
} {
  const p = sign.peirce;
  return {
    formalThought: p.pragmatism_band === "FORMAL_THOUGHT",
    strongSecondness: p.path[1] === "Index" || p.path[1] === "Dicent",
    argument: p.path[2] === "Argument",
  };
}

function buildProof<S extends Sign<any, any>>(
  sign: S,
  required: { formalThought: boolean; strongSecondness: boolean; argument: boolean },
): ProofResult<S> {
  assertKnownClass(sign);
  const held = evaluateGates(sign);
  const reasoning: string[] = [];

  const pushReason = (
    name: string,
    req: boolean,
    h: boolean,
    detail: string,
  ) => {
    if (req && !h) {
      reasoning.push(`${name} gate failed: ${detail}`);
    }
  };
  pushReason(
    "formal-thought",
    required.formalThought,
    held.formalThought,
    `pragmatism_band=${sign.peirce.pragmatism_band}`,
  );
  pushReason(
    "strong-secondness",
    required.strongSecondness,
    held.strongSecondness,
    `path[1]=${sign.peirce.path[1] ?? "<none>"}`,
  );
  pushReason(
    "argument",
    required.argument,
    held.argument,
    `path[2]=${sign.peirce.path[2] ?? "<none>"}`,
  );

  const pass =
    (!required.formalThought || held.formalThought) &&
    (!required.strongSecondness || held.strongSecondness) &&
    (!required.argument || held.argument);

  return {
    pass,
    sign,
    gates: {
      formalThought: { required: required.formalThought, held: held.formalThought },
      strongSecondness: {
        required: required.strongSecondness,
        held: held.strongSecondness,
      },
      argument: { required: required.argument, held: held.argument },
    },
    reasoning,
  };
}

/**
 * `prove` — requires FORMAL_THOUGHT band and Argument interpretant. Mirrors the
 * compile-time `RequireFormalThought<RequireArgument<S>>` gate at runtime.
 */
export function prove<S extends Sign<any, any>>(sign: S): ProofResult<S> {
  return buildProof(sign, {
    formalThought: true,
    strongSecondness: false,
    argument: true,
  });
}

/**
 * `emitObservation` — requires strong secondness (Index object-relation /
 * Dicent interpretant). Mirrors `RequireStrongSecondness<S>` at runtime.
 */
export function emitObservation<S extends Sign<any, any>>(
  sign: S,
): ProofResult<S> {
  return buildProof(sign, {
    formalThought: false,
    strongSecondness: true,
    argument: false,
  });
}

/**
 * `distill` — reports (does not require) the formal-thought band; refines
 * toward formal thought. Non-formal signs are not rejected, only flagged.
 */
export function distill<S extends Sign<any, any>>(sign: S): ProofResult<S> {
  const result = buildProof(sign, {
    formalThought: true,
    strongSecondness: false,
    argument: false,
  });
  if (!result.gates.formalThought.held) {
    // Override reasoning to make distill's intent clear.
    return {
      ...result,
      reasoning: ["distill will not refine a non-formal sign"],
    };
  }
  return result;
}