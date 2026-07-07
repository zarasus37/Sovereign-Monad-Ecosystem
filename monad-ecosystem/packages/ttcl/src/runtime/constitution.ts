/**
 * TTCL constitution scorer — the single scoring path (Layer 6).
 *
 * Five weighted criteria, all weights drawn from the canonical numerics
 * (`@sovereign/types` → `shared/schemas/ttcl-numerics.json`):
 *
 *   C1 Tripartite        (0.30) — triadic ancestry: fraction of
 *                                 {Theology, Technology, Cosmology} present.
 *   C2 Logic Compression (0.25) — HYBRID modality (compose output) = 1.0,
 *                                 single mode (ICON/INDEX/SYMBOL) = 0.5,
 *                                 PURE ⊥ = 0.0.
 *   C3 Source Aligned    (0.25) — trace.source present AND peirce validates
 *                                 against the LOGOC manifold. Both = 1.0,
 *                                 one = 0.5, neither = 0.0.
 *   C4 Epistemic Humility(0.10) — non-instinctual pragmatism band:
 *                                 FORMAL_THOUGHT = 1.0, EXPERIENCE = 0.5,
 *                                 INSTINCT = 0.0.
 *   C5 No RLHF Signal     (0.10) — caller-set `noRlhf` flag (default true).
 *
 * `total = Σ(weight × score)`; `pass = total >= CONSTITUTION_PASS_THRESHOLD`
 * (0.72). This is the ONE scorer — LOGOC's classifier remains a pure
 * classifier and does not implement a parallel score. The orchestrator that
 * holds a `Sign` calls `scoreSign`; LOGOC feeds it via the `peirce` field.
 *
 * Architecture note: the scorer lives in `@sovereign/ttcl` because its inputs
 * (triadic ancestry, modality, the `noRlhf` flag) are TTCL `Sign` concepts that
 * LOGOC's `LogocEvent` does not carry. ttcl already depends on `@sovereign/logoc`
 * (manifold) and `@sovereign/types` (numerics); the scorer adds no new edge, so
 * the package graph stays acyclic (no ttcl↔logoc cycle).
 */

import { getManifold } from "@sovereign/logoc";
import {
  CONSTITUTION_C1_TRIPARTITE_WEIGHT,
  CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT,
  CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT,
  CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT,
  CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT,
  CONSTITUTION_PASS_THRESHOLD,
} from "@sovereign/types";
import type { PragmatismBand } from "@sovereign/logoc";
import type { Sign, Domain, Modality } from "../types.js";

/** The five constitution criteria, in canonical order. */
export type ConstitutionCriterionKey =
  | "tripartite"
  | "logicCompression"
  | "sourceAligned"
  | "epistemicHumility"
  | "noRlhfSignal";

/** One criterion's evaluation: its canonical weight, 0–1 score, and verdict. */
export interface ConstitutionCriterion {
  /** Canonical weight from `shared/schemas/ttcl-numerics.json`. */
  readonly weight: number;
  /** Score in [0, 1] — the fraction of the criterion satisfied. */
  readonly score: number;
  /** Weighted contribution (`weight * score`) to the total. */
  readonly contribution: number;
  /** `true` when the criterion is fully satisfied (`score === 1`). */
  readonly held: boolean;
  /** Human-readable explanation of how the score was derived. */
  readonly reasoning: string;
}

/** The full constitution verdict for one `Sign`. */
export interface ConstitutionResult {
  /** Weighted total in [0, 1]. */
  readonly total: number;
  /** `true` when `total >= CONSTITUTION_PASS_THRESHOLD`. */
  readonly pass: boolean;
  /** The threshold `total` was compared against (canonical 0.72). */
  readonly threshold: number;
  /** Per-criterion evaluation. */
  readonly criteria: Readonly<Record<ConstitutionCriterionKey, ConstitutionCriterion>>;
  /** Flat reasoning trace, criterion by criterion. */
  readonly reasoning: string[];
}

const ALL_DOMAINS: readonly Domain[] = ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"];

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** C1 — triadic ancestry: fraction of the three domains present. */
function scoreTripartite(sign: Sign<Modality, Domain>): ConstitutionCriterion {
  const present = sign.domains ?? [sign.domain];
  const unique = new Set(present);
  const count = ALL_DOMAINS.filter((d) => unique.has(d)).length;
  const score = count / ALL_DOMAINS.length;
  return {
    weight: CONSTITUTION_C1_TRIPARTITE_WEIGHT,
    score,
    contribution: CONSTITUTION_C1_TRIPARTITE_WEIGHT * score,
    held: count === ALL_DOMAINS.length,
    reasoning: `Tripartite: ${count}/${ALL_DOMAINS.length} domains present (${Array.from(unique).join(", ") || "none"}).`,
  };
}

/** C2 — logic compression: HYBRID ⊤ > single mode > PURE ⊥. */
function scoreLogicCompression(sign: Sign<Modality, Domain>): ConstitutionCriterion {
  let score: number;
  let label: string;
  switch (sign.modality) {
    case "HYBRID":
      score = 1.0;
      label = "HYBRID (compose output — maximal logic compression)";
      break;
    case "ICON":
    case "INDEX":
    case "SYMBOL":
      score = 0.5;
      label = `${sign.modality} (single mode — partial compression)`;
      break;
    case "PURE":
      score = 0.0;
      label = "PURE ⊥ (no compression — lattice abort)";
      break;
  }
  return {
    weight: CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT,
    score,
    contribution: CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT * score,
    held: score === 1.0,
    reasoning: `Logic compression: ${label}.`,
  };
}

/** C3 — source aligned: trace.source present AND peirce valid on the manifold. */
function scoreSourceAligned(sign: Sign<Modality, Domain>): ConstitutionCriterion {
  const hasSource = !!sign.trace?.source;
  let manifoldValid = false;
  try {
    getManifold().get(sign.peirce.sign_class_id);
    manifoldValid = true;
  } catch {
    manifoldValid = false;
  }
  const score = (hasSource ? 1 : 0) + (manifoldValid ? 1 : 0) === 2
    ? 1.0
    : (hasSource || manifoldValid)
      ? 0.5
      : 0.0;
  const parts = [
    hasSource ? "trace.source present" : "trace.source absent",
    manifoldValid ? "peirce valid on manifold" : "peirce NOT valid on manifold",
  ];
  return {
    weight: CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT,
    score,
    contribution: CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT * score,
    held: score === 1.0,
    reasoning: `Source aligned: ${parts.join("; ")} → ${score}.`,
  };
}

const BAND_SCORE: Record<PragmatismBand, number> = {
  FORMAL_THOUGHT: 1.0,
  EXPERIENCE: 0.5,
  INSTINCT: 0.0,
};

/** C4 — epistemic humility: non-instinctual pragmatism band. */
function scoreEpistemicHumility(sign: Sign<Modality, Domain>): ConstitutionCriterion {
  const band = sign.peirce.pragmatism_band;
  const score = BAND_SCORE[band] ?? 0.0;
  return {
    weight: CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT,
    score,
    contribution: CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT * score,
    held: score === 1.0,
    reasoning: `Epistemic humility: pragmatism_band=${band} → ${score}.`,
  };
}

/** C5 — no RLHF signal: caller-set flag (default true). */
function scoreNoRlhf(sign: Sign<Modality, Domain>): ConstitutionCriterion {
  const flag = sign.noRlhf ?? true;
  const score = flag ? 1.0 : 0.0;
  return {
    weight: CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT,
    score,
    contribution: CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT * score,
    held: flag,
    reasoning: `No RLHF signal: noRlhf=${flag} → ${score}.`,
  };
}

/**
 * `scoreSign` — the single constitution scoring path. Evaluates a `Sign`
 * against the five weighted criteria and returns the verdict. Pure: no side
 * effects, no throws (an unknown `sign_class_id` is reported via C3, not
 * thrown — the scorer is a predicate, not a gate).
 */
export function scoreSign(sign: Sign<Modality, Domain>): ConstitutionResult {
  const criteria = {
    tripartite: scoreTripartite(sign),
    logicCompression: scoreLogicCompression(sign),
    sourceAligned: scoreSourceAligned(sign),
    epistemicHumility: scoreEpistemicHumility(sign),
    noRlhfSignal: scoreNoRlhf(sign),
  };

  const total = round4(
    Object.values(criteria).reduce((sum, c) => sum + c.contribution, 0),
  );
  const pass = total >= CONSTITUTION_PASS_THRESHOLD;
  const reasoning = Object.values(criteria).map((c) => c.reasoning);
  reasoning.push(
    `Total ${total} ${pass ? ">=" : "<"} threshold ${CONSTITUTION_PASS_THRESHOLD} → ${pass ? "PASS" : "FAIL"}.`,
  );

  return {
    total,
    pass,
    threshold: CONSTITUTION_PASS_THRESHOLD,
    criteria,
    reasoning,
  };
}