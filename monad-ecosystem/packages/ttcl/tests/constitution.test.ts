/**
 * @sovereign/ttcl constitution scorer tests (Layer 6).
 *
 * `scoreSign` is the single scoring path: five weighted criteria, all weights
 * from the canonical numerics (`shared/schemas/ttcl-numerics.json` via
 * `@sovereign/types`). These tests pin the criterion math and the 0.72 pass
 * boundary, and confirm the scorer reads LOGOC's manifold (C3) without
 * reimplementing it.
 */

import { describe, expect, it } from "vitest";
import {
  compose,
  makeSign,
  getManifold,
  scoreSign,
} from "../src/runtime/index.js";
import type { CoarseMode, Domain, Modality, Sign } from "../src/runtime/index.js";

const manifold = getManifold();

/** A FORMAL_THOUGHT class whose interpretant is an Argument. */
function formalArgumentClassId(): number {
  const cls = manifold
    .allClasses()
    .find(
      (c) => c.pragmatism_band === "FORMAL_THOUGHT" && c.path[2] === "Argument",
    );
  if (!cls) throw new Error("spec missing a FORMAL_THOUGHT/Argument class");
  return cls.id;
}

/** An EXPERIENCE-band class (for the boundary-above case). */
function experienceClassId(): number {
  const cls = manifold.allClasses().find((c) => c.pragmatism_band === "EXPERIENCE");
  if (!cls) throw new Error("spec missing an EXPERIENCE class");
  return cls.id;
}

/** An INSTINCT-band class (for C4-failure). */
function instinctClassId(): number {
  const cls = manifold.allClasses().find((c) => c.pragmatism_band === "INSTINCT");
  if (!cls) throw new Error("spec missing an INSTINCT class");
  return cls.id;
}

/** Derive the coarse mode from a class's object-relation path element. */
function modeOf(classId: number): CoarseMode {
  const cls = manifold.get(classId);
  const mode = cls.path[1]?.toUpperCase();
  if (mode !== "ICON" && mode !== "INDEX" && mode !== "SYMBOL") {
    throw new Error(`unexpected path[1] for class ${classId}: ${cls.path[1]}`);
  }
  return mode;
}

/** Build a FORMAL_THOUGHT/Argument sign in a given domain. */
function formalSign(
  domain: Domain,
  modality: Modality,
  pps: number,
  source?: string,
): Sign<Modality, Domain> {
  const id = formalArgumentClassId();
  const trace = source ? { intentionId: "i-1", source } : undefined;
  return makeSign(id, modeOf(id), domain, modality, pps, trace);
}

const THRESHOLD = 0.72;

describe("scoreSign — canonical weight loading", () => {
  it("reads all five weights + the threshold from the canonical numerics", () => {
    // A fully-satisfied sign reveals the weights via criterion.contribution
    // (weight × score, score===1 → contribution === weight).
    const joined = compose(
      formalSign("THEOLOGY", "SYMBOL", 0.9, "srcA"),
      formalSign("TECHNOLOGY", "INDEX", 0.8, "srcB"),
      formalSign("COSMOLOGY", "ICON", 0.7, "srcC"),
    );
    const result = scoreSign(joined);
    expect(result.criteria.tripartite.weight).toBeCloseTo(0.3, 6);
    expect(result.criteria.logicCompression.weight).toBeCloseTo(0.25, 6);
    expect(result.criteria.sourceAligned.weight).toBeCloseTo(0.25, 6);
    expect(result.criteria.epistemicHumility.weight).toBeCloseTo(0.1, 6);
    expect(result.criteria.noRlhfSignal.weight).toBeCloseTo(0.1, 6);
    expect(result.threshold).toBeCloseTo(THRESHOLD, 6);
  });
});

describe("scoreSign — a sign passing all 5 criteria", () => {
  it("scores the maximum and passes at threshold", () => {
    const joined = compose(
      formalSign("THEOLOGY", "SYMBOL", 0.9, "srcA"),
      formalSign("TECHNOLOGY", "INDEX", 0.8, "srcB"),
      formalSign("COSMOLOGY", "ICON", 0.7, "srcC"),
    );
    const result = scoreSign(joined);
    // Every criterion fully held.
    expect(result.criteria.tripartite.held).toBe(true); // all 3 domains
    expect(result.criteria.logicCompression.held).toBe(true); // HYBRID
    expect(result.criteria.sourceAligned.held).toBe(true); // source + valid
    expect(result.criteria.epistemicHumility.held).toBe(true); // FORMAL_THOUGHT
    expect(result.criteria.noRlhfSignal.held).toBe(true); // default true
    expect(result.total).toBeCloseTo(1.0, 6);
    expect(result.total).toBeGreaterThanOrEqual(THRESHOLD);
    expect(result.pass).toBe(true);
    // Reasoning trace is populated, one line per criterion + the verdict line.
    expect(result.reasoning.length).toBeGreaterThanOrEqual(6);
  });
});

describe("scoreSign — per-criterion failure modes", () => {
  it("a two-domain sign fails C1 (tripartite not held)", () => {
    const id = formalArgumentClassId();
    const sign = makeSign(
      id,
      modeOf(id),
      "THEOLOGY",
      "SYMBOL",
      0.9,
      { intentionId: "i-1", source: "srcA" },
      ["THEOLOGY", "TECHNOLOGY"], // only 2 of 3 domains
    );
    const result = scoreSign(sign);
    expect(result.criteria.tripartite.held).toBe(false);
    expect(result.criteria.tripartite.score).toBeCloseTo(2 / 3, 6);
  });

  it("an INSTINCT sign fails C4 (epistemic humility not held)", () => {
    const id = instinctClassId();
    const sign = makeSign(id, modeOf(id), "THEOLOGY", "ICON", 0.9, {
      intentionId: "i-1",
      source: "srcA",
    });
    const result = scoreSign(sign);
    expect(result.criteria.epistemicHumility.held).toBe(false);
    expect(result.criteria.epistemicHumility.score).toBe(0);
  });

  it("an untraced sign loses C3 (source absent → score 0.5)", () => {
    const id = formalArgumentClassId();
    // No trace → trace.source absent, but peirce still validates on the manifold.
    const sign = makeSign(id, modeOf(id), "THEOLOGY", "HYBRID", 0.9);
    const result = scoreSign(sign);
    expect(result.criteria.sourceAligned.held).toBe(false);
    expect(result.criteria.sourceAligned.score).toBeCloseTo(0.5, 6);
  });

  it("a PURE-modality sign scores C2 at 0 (lattice abort, no compression)", () => {
    const id = formalArgumentClassId();
    const sign = makeSign(id, modeOf(id), "THEOLOGY", "PURE", 0.9, {
      intentionId: "i-1",
      source: "srcA",
    });
    const result = scoreSign(sign);
    expect(result.criteria.logicCompression.held).toBe(false);
    expect(result.criteria.logicCompression.score).toBe(0);
  });

  it("a noRlhf=false sign loses C5", () => {
    const id = formalArgumentClassId();
    const sign = makeSign(
      id,
      modeOf(id),
      "THEOLOGY",
      "SYMBOL",
      0.9,
      { intentionId: "i-1", source: "srcA" },
      undefined,
      false, // RLHF signal present
    );
    const result = scoreSign(sign);
    expect(result.criteria.noRlhfSignal.held).toBe(false);
    expect(result.criteria.noRlhfSignal.score).toBe(0);
  });
});

describe("scoreSign — pass/fail boundary at 0.72", () => {
  // The discrete criterion scores (C2/C3/C5 ∈ {0,0.5,1}, C4 ∈ {0,0.5,1}, C1 ∈
  // {0,1/3,2/3,1}) make 0.72 itself unreachable: totals are multiples of 0.05.
  // The threshold therefore cleanly separates the nearest reachable totals
  // 0.70 (just below) and 0.725 (just at/above). These two cases pin the gate.

  it("passes just above the threshold (total 0.725)", () => {
    // C1=1 (0.30) + C2=1 HYBRID (0.25) + C3=0.5 no-trace (0.125)
    // + C4=0.5 EXPERIENCE (0.05) + C5=0 noRlhf=false (0) = 0.725
    const id = experienceClassId();
    const sign = makeSign(
      id,
      modeOf(id),
      "COSMOLOGY",
      "HYBRID",
      0.9,
      undefined, // no trace → C3 source absent (manifold still valid → 0.5)
      ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"],
      false, // RLHF present → C5 = 0
    );
    const result = scoreSign(sign);
    expect(result.total).toBeCloseTo(0.725, 6);
    expect(result.total).toBeGreaterThanOrEqual(THRESHOLD);
    expect(result.pass).toBe(true);
  });

  it("fails just below the threshold (total 0.70)", () => {
    // C1=0 empty ancestry (0) + C2=1 HYBRID (0.25) + C3=1 source+valid (0.25)
    // + C4=1 FORMAL_THOUGHT (0.10) + C5=1 noRlhf=true (0.10) = 0.70
    const id = formalArgumentClassId();
    const sign = makeSign(
      id,
      modeOf(id),
      "THEOLOGY",
      "HYBRID",
      0.9,
      { intentionId: "i-1", source: "srcA" },
      [], // no triadic ancestry → C1 = 0
      true,
    );
    const result = scoreSign(sign);
    expect(result.total).toBeCloseTo(0.70, 6);
    expect(result.total).toBeLessThan(THRESHOLD);
    expect(result.pass).toBe(false);
  });
});

describe("scoreSign — purity", () => {
  it("does not throw on an unknown sign_class_id (reported via C3, not thrown)", () => {
    const id = formalArgumentClassId();
    const sign = makeSign(id, modeOf(id), "THEOLOGY", "SYMBOL", 0.9, {
      intentionId: "i-1",
      source: "srcA",
    }) as Sign<any, any>;
    (sign.peirce as any).sign_class_id = 999_999;
    // The scorer is a predicate, not a gate: an unknown class drops C3 to 0.5
    // (source still present) rather than throwing.
    expect(() => scoreSign(sign)).not.toThrow();
    const result = scoreSign(sign);
    expect(result.criteria.sourceAligned.held).toBe(false);
    expect(result.criteria.sourceAligned.score).toBeCloseTo(0.5, 6);
  });
});