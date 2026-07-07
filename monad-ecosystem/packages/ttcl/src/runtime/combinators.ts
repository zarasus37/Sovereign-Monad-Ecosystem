/**
 * TTCL core combinators — the runtime that makes the tripartite grammar
 * executable rather than decorative.
 *
 * The keystone is `compose`: the TTCL JOIN that unifies Theology + Technology +
 * Cosmology into a HYBRID (⊤) sign, gated by the Triadic Minimal Gate (all
 * three domains must be present; fewer is structurally invalid — PURE ⊥ — and
 * aborts). `choose` is the auditable Free-Will combinator: both branches
 * materialize before the predicate resolves, and the branch taken is recorded
 * so free will is reconstructable, not merely asserted.
 */

import { getManifold, type PeirceSignClass } from "@sovereign/logoc";
import type { EventTrace } from "@sovereign/types";
import type { Sign, Modality, Domain } from "../types.js";
import { Wheel } from "./wheel.js";

export class TriadicGateError extends Error {
  readonly present: Domain[];
  constructor(present: Domain[]) {
    super(
      `Triadic gate failed: all three domains required, present [${present.join(", ")}]`,
    );
    this.name = "TriadicGateError";
    this.present = present;
  }
}

import { UnknownSignClassError } from "./errors.js";
export { UnknownSignClassError } from "./errors.js";

export interface ChooseAudit<S extends Sign<any, any> = Sign<any, any>> {
  /** Which branch the predicate selected — the auditable free-will record. */
  readonly branchTaken: "A" | "B";
  /** The sign the choice was made over. */
  readonly sign: S;
  /** ISO-8601 timestamp of the decision. */
  readonly at: string;
}

/** Validate every input's `peirce.sign_class_id` against the LOGOC manifold. */
function assertKnownClasses(signs: ReadonlyArray<Sign<any, any>>): void {
  const m = getManifold();
  for (const s of signs) {
    try {
      m.get(s.peirce.sign_class_id);
    } catch {
      throw new UnknownSignClassError(s.peirce.sign_class_id);
    }
  }
}

/** FNV-1a 32-bit hash — stable, dependency-free, used for path checksums. */
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const MODALITY_CODES: Record<Modality, number> = {
  PURE: 0,
  ICON: 1,
  INDEX: 2,
  SYMBOL: 3,
  HYBRID: 4,
};
const DOMAIN_CODES: Record<Domain, number> = {
  THEOLOGY: 0,
  TECHNOLOGY: 1,
  COSMOLOGY: 2,
};
const COARSEMODE_CODES: Record<string, number> = { ICON: 0, INDEX: 1, SYMBOL: 2 };

function invert<T extends string>(rec: Record<T, number>): Record<number, T> {
  return Object.fromEntries(
    Object.entries(rec).map(([k, v]) => [v, k as T]),
  ) as Record<number, T>;
}
const MODALITY_FROM_CODE = invert(MODALITY_CODES);
const DOMAIN_FROM_CODE = invert(DOMAIN_CODES);
const COARSEMODE_FROM_CODE: Record<number, "ICON" | "INDEX" | "SYMBOL"> = {
  0: "ICON",
  1: "INDEX",
  2: "SYMBOL",
};

function traceHash(trace: EventTrace | undefined): number {
  if (!trace) return 0;
  return fnv1a32(`${trace.intentionId}|${trace.source}`);
}

/**
 * Merge a set of traces into one chain record. The lexicographically smallest
 * `intentionId` becomes the chain root; distinct `source`s are joined with `+`;
 * the first defined `parentEventId` / `constraintEnvelopeId` /
 * `narrativePurposeId` / `createdAt` is preserved. Returns `undefined` when no
 * input carries a trace.
 */
export function mergeTraces(
  traces: ReadonlyArray<EventTrace | undefined>,
): EventTrace | undefined {
  const defined = traces.filter((t): t is EventTrace => t !== undefined);
  if (defined.length === 0) return undefined;
  const intentionId = defined.map((t) => t.intentionId).sort()[0];
  const source = Array.from(new Set(defined.map((t) => t.source))).join("+");
  const parentEventId = defined.find((t) => t.parentEventId)?.parentEventId;
  const constraintEnvelopeId = defined.find(
    (t) => t.constraintEnvelopeId,
  )?.constraintEnvelopeId;
  const narrativePurposeId = defined.find(
    (t) => t.narrativePurposeId,
  )?.narrativePurposeId;
  const createdAt = defined.find((t) => t.createdAt)?.createdAt;
  return {
    intentionId,
    source,
    parentEventId,
    constraintEnvelopeId,
    narrativePurposeId,
    createdAt,
  };
}

/**
 * `compose` — the TTCL JOIN. Unifies Theology + Technology + Cosmology into a
 * HYBRID (⊤) sign.
 *
 * Triadic Minimal Gate: all three domains must be present; fewer than three is
 * structurally invalid (resolves to PURE ⊥) and aborts with `TriadicGateError`.
 *
 * The dominant `peirce` is the most argumentative input — preferring
 * FORMAL_THOUGHT band, then highest `thirdness_weight`. `pps` is the tightest
 * sync point (minimum across inputs). `trace` is the merged intention chain.
 * HYBRID spans all domains; `COSMOLOGY` (the integral/outermost domain) is
 * used as the carrier for the `domain` field.
 */
export function compose<S extends Sign<any, any>>(
  ...signs: S[]
): Sign<"HYBRID", Domain> {
  if (signs.length === 0) {
    throw new TriadicGateError([]);
  }
  assertKnownClasses(signs);
  const present = Array.from(new Set(signs.map((s) => s.domain))) as Domain[];
  if (present.length < 3) {
    throw new TriadicGateError(present);
  }
  const pps = Math.min(...signs.map((s) => s.pps));
  const dominant = [...signs].sort((a, b) => {
    const af = a.peirce.pragmatism_band === "FORMAL_THOUGHT" ? 1 : 0;
    const bf = b.peirce.pragmatism_band === "FORMAL_THOUGHT" ? 1 : 0;
    if (bf !== af) return bf - af;
    return b.peirce.thirdness_weight - a.peirce.thirdness_weight;
  })[0];
  return {
    modality: "HYBRID",
    domain: "COSMOLOGY",
    pps,
    peirce: dominant.peirce,
    trace: mergeTraces(signs.map((s) => s.trace)),
    // Triadic ancestry: a HYBRID sign spans every domain present at compose
    // time (the gate guarantees all three). Carried for the C1 constitution
    // criterion so a HYBRID sign scores fully tripartite without re-derivation.
    domains: present,
  };
}

/** Apply a pure function to a sign; returns the function's result. */
export function map<M extends Modality, T extends Domain, U>(
  sign: Sign<M, T>,
  f: (s: Sign<M, T>) => U,
): U {
  return f(sign);
}

/**
 * `fold` — dispatch over the modal lattice. HYBRID → `onHybrid`; any other
 * modality (the lattice middle: ICON/INDEX/SYMBOL, or PURE ⊥) → `onPure`.
 */
export function fold<M extends Modality, T extends Domain, R>(
  sign: Sign<M, T>,
  onPure: (s: Sign<Exclude<Modality, "HYBRID">, T>) => R,
  onHybrid: (s: Sign<"HYBRID", Domain>) => R,
): R {
  return sign.modality === "HYBRID"
    ? onHybrid(sign as Sign<"HYBRID", Domain>)
    : onPure(sign as Sign<Exclude<Modality, "HYBRID">, T>);
}

/**
 * `choose` — the Free-Will combinator (continuation-passing, auditable).
 *
 * Per the TTCL specification, BOTH branches MATERIALIZE before the predicate
 * resolves: genuine choice, not lazy evaluation. The audit record captures
 * which branch was taken so the decision is reconstructable from stored
 * events rather than merely asserted.
 */
export function choose<S extends Sign<any, any>, R>(
  sign: S,
  branchA: (s: S) => R,
  branchB: (s: S) => R,
  predicate: (s: S) => "A" | "B",
): { result: R; audit: ChooseAudit<S> } {
  const a = branchA(sign);
  const b = branchB(sign);
  const branchTaken = predicate(sign);
  return {
    result: branchTaken === "A" ? a : b,
    audit: {
      branchTaken,
      sign,
      at: new Date().toISOString(),
    },
  };
}

/** Rotate a wheel by `steps` (mutates and returns for chaining). */
export function rotateWheel<W extends Wheel<any>>(wheel: W, steps: number): W {
  wheel.rotate(steps);
  return wheel;
}

// `keyRotate` operates on `KeyCap`; re-exported here for the documented
// combinator surface.
export { keyRotate } from "./keycap.js";

/**
 * `encodeSign` — deterministic numeric encoding of a `Sign` for storage and
 * transport.
 *
 * Layout: `[modalityCode, domainCode, pps, classId, modeCode, ...pathHashes, traceHash]`.
 * `peirce` is recoverable from the LOGOC manifold (the sole source of truth for
 * weights/labels/path) via `classId`; `mode` is stored explicitly so decoding
 * does not depend on path-position assumptions; `pathHashes` act as an
 * integrity checksum against the current manifold; `trace` is intentionally
 * lossy (only a hash) — the full trace lives in the durable event store.
 */
export function encodeSign<M extends Modality, T extends Domain>(
  sign: Sign<M, T>,
): number[] {
  const pathHashes = sign.peirce.path.map((p) => fnv1a32(p));
  return [
    MODALITY_CODES[sign.modality],
    DOMAIN_CODES[sign.domain],
    sign.pps,
    sign.peirce.sign_class_id,
    COARSEMODE_CODES[sign.peirce.mode] ?? 0,
    ...pathHashes,
    traceHash(sign.trace),
  ];
}

function classToSignature(
  cls: PeirceSignClass,
  mode: "ICON" | "INDEX" | "SYMBOL",
) {
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
 * `decodeSign` — inverse of `encodeSign`. Reconstructs `peirce` from the LOGOC
 * manifold via `classId` (the manifold is the only source of truth for
 * weights/labels/path), verifies the encoded path checksum against the current
 * manifold (detects version drift), and restores `mode` from the stored code.
 * `trace` is NOT recoverable (returns `undefined`) — it must be rejoined from
 * the durable event store.
 */
export function decodeSign(encoded: number[]): Sign<Modality, Domain> {
  if (encoded.length < 6) {
    throw new Error(`decodeSign: payload too short (${encoded.length})`);
  }
  const [mCode, dCode, pps, classId, modeCode, ...rest] = encoded;
  const modality = MODALITY_FROM_CODE[mCode];
  const domain = DOMAIN_FROM_CODE[dCode];
  const mode = COARSEMODE_FROM_CODE[modeCode];
  if (!modality) {
    throw new Error(`decodeSign: invalid modality code ${mCode}`);
  }
  if (!domain) {
    throw new Error(`decodeSign: invalid domain code ${dCode}`);
  }
  if (!mode) {
    throw new Error(`decodeSign: invalid coarse-mode code ${modeCode}`);
  }
  let cls: PeirceSignClass;
  try {
    cls = getManifold().get(classId);
  } catch {
    throw new UnknownSignClassError(classId);
  }
  const pathLen = cls.path.length;
  const pathHashes = rest.slice(0, pathLen);
  // `rest[pathLen]` is the trace hash — intentionally not restored.
  for (let i = 0; i < pathLen; i++) {
    if (fnv1a32(cls.path[i]) !== pathHashes[i]) {
      throw new Error(
        `decodeSign: path checksum mismatch at index ${i} — manifold drift detected`,
      );
    }
  }
  return {
    modality,
    domain,
    pps,
    peirce: classToSignature(cls, mode),
    trace: undefined,
  };
}