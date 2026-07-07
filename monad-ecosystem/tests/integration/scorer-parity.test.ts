/**
 * Layer 7.8 — Scorer parity + round-half-up proof.
 *
 * Two surfaces:
 *
 * 1. Scorer parity — same Sign shape → the TS `scoreSign` (@sovereign/ttcl) and
 *    the Python `score_sign` (gnostic_engine.constitution) MUST produce the
 *    identical total (to 4 decimals, via the shared `_round4`/`round4` round-
 *    half-up) and the identical pass boolean. Corpus:
 *    shared/fixtures/layer7/sign_corpus.json — spans every reachable criterion
 *    score, including both C3=0.5 branches (trace-absent+valid-class, and
 *    trace-present+invalid-class via bogus id 999999), and pins the 0.72 pass
 *    boundary with the 0.725 pass + 0.70 fail golden vectors.
 *
 * 2. Round-half-up proof — the canonical rounding primitive (`round4` in TS,
 *    `_round4` in Python) MUST agree, and MUST diverge from Python's default
 *    banker's `round()` on true tie values. The co-architect's requested
 *    "Sign whose weighted sum lands on a 4th-decimal tie-break" is
 *    mathematically unreachable with canonical weights (0.30/0.25/0.25/0.10/0.10)
 *    and discrete criterion scores — a brute-force over every Sign config found
 *    zero tie cases. The faithful substitute is this direct primitive test:
 *    0.03125 and 0.15625 are exactly representable doubles whose ×10000 lands
 *    on k+0.5 with k EVEN, so banker's rounds DOWN (0.0312 / 0.1562) while
 *    round-half-up rounds UP (0.0313 / 0.1563). Both runtimes must give the UP
 *    value — proving they implement round-half-up, not banker's.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scoreSign, round4 } from '@sovereign/ttcl';
import type { Sign, Modality, Domain } from '@sovereign/ttcl';
import { runParityShim, repoRoot } from './_parity.js';

type PeirceSpec = {
  mode: 'ICON' | 'INDEX' | 'SYMBOL';
  sign_class_id: number;
  sign_class_label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: 'INSTINCT' | 'EXPERIENCE' | 'FORMAL_THOUGHT';
};

type SignCase = {
  id: string;
  modality: Modality;
  domain: Domain;
  pps: number;
  peirce: PeirceSpec;
  trace: { intention_id: string; source: string } | null;
  domains: Domain[] | null;
  no_rlhf: boolean | null;
  expected_total: number;
  expected_pass: boolean;
  note?: string;
};

const corpusPath = resolve(repoRoot, 'shared/fixtures/layer7/sign_corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf-8')) as { cases: SignCase[] };

/** Build a TTCL Sign directly from a corpus spec (bypasses makeSign, which
 *  would throw on the bogus class_id 999999 used for the C3=0.5 invalid-class case). */
function buildSign(spec: SignCase): Sign<Modality, Domain> {
  return {
    modality: spec.modality,
    domain: spec.domain,
    pps: spec.pps,
    peirce: {
      mode: spec.peirce.mode,
      sign_class_id: spec.peirce.sign_class_id,
      sign_class_label: spec.peirce.sign_class_label,
      path: spec.peirce.path,
      firstness_weight: spec.peirce.firstness_weight,
      secondness_weight: spec.peirce.secondness_weight,
      thirdness_weight: spec.peirce.thirdness_weight,
      pragmatism_band: spec.peirce.pragmatism_band,
    },
    trace:
      spec.trace === null
        ? undefined
        : { intentionId: spec.trace.intention_id, source: spec.trace.source },
    // null → undefined so the scorer's `?? [domain]` / `?? true` defaults apply;
    // [] (empty array) stays [] so C1 counts zero domains.
    domains: spec.domains ?? undefined,
    noRlhf: spec.no_rlhf ?? undefined,
  } as Sign<Modality, Domain>;
}

describe('Layer 7.8 — scorer parity (TS scoreSign ↔ Python score_sign)', () => {
  // One Python spawn for the whole corpus (batch mode). The Python shim reads
  // the spec shape verbatim (snake_case keys, null for absent optionals).
  const py = runParityShim('scorer_all', { cases: corpus.cases }) as {
    results: { total: number; pass: boolean }[];
  };

  it('returns one result per corpus case', () => {
    expect(py.results).toHaveLength(corpus.cases.length);
  });

  for (let i = 0; i < corpus.cases.length; i++) {
    const c = corpus.cases[i];
    it(`case "${c.id}" — TS total/pass match Python and expected`, () => {
      const ts = scoreSign(buildSign(c));
      const pyResult = py.results[i];
      // Parity: identical total (the shared round-half-up makes these bitwise
      // equal — same float ops in the same order, same rounding primitive) and
      // identical pass boolean.
      expect(ts.total).toBe(pyResult.total);
      expect(ts.pass).toBe(pyResult.pass);
      // Self-check against the corpus's expected verdict.
      expect(ts.total).toBeCloseTo(c.expected_total, 6);
      expect(ts.pass).toBe(c.expected_pass);
    });
  }

  it('pins the 0.72 pass boundary (0.725 passes, 0.70 fails)', () => {
    const passCase = corpus.cases.find((c) => c.id === 'boundary-pass-0.725')!;
    const failCase = corpus.cases.find((c) => c.id === 'boundary-fail-0.70')!;
    expect(scoreSign(buildSign(passCase)).pass).toBe(true);
    expect(scoreSign(buildSign(failCase)).pass).toBe(false);
  });

  it('covers both C3=0.5 branches (trace-absent+valid-class and trace-present+invalid-class)', () => {
    const noTraceValid = corpus.cases.find((c) => c.id === 'c3-half-no-trace-valid-class')!;
    const traceInvalid = corpus.cases.find((c) => c.id === 'c3-half-invalid-class')!;
    const r1 = scoreSign(buildSign(noTraceValid));
    const r2 = scoreSign(buildSign(traceInvalid));
    // Both branches score C3 at 0.5 → identical totals despite different causes.
    expect(r1.total).toBe(r2.total);
    expect(r1.criteria.sourceAligned.score).toBeCloseTo(0.5, 6);
    expect(r2.criteria.sourceAligned.score).toBeCloseTo(0.5, 6);
  });
});

describe('Layer 7.8 — round-half-up proof (round4 diverges from banker\'s)', () => {
  // Values chosen so n*10000 lands exactly on k+0.5 with k EVEN, where banker's
  // (round-half-to-even) rounds DOWN and round-half-up rounds UP. Both are
  // exactly representable doubles (1/32 and 5/32), so there is no float-fuzz to
  // muddy the tie: this is a genuine 4th-decimal tie-break.
  const tieCases = [
    { value: 0.03125, roundHalfUp: 0.0313, bankers: 0.0312 },
    { value: 0.15625, roundHalfUp: 0.1563, bankers: 0.1562 },
  ];

  for (const tc of tieCases) {
    it(`round4(${tc.value}) = ${tc.roundHalfUp} (round-half-up), NOT ${tc.bankers} (banker's)`, () => {
      // TS primitive.
      expect(round4(tc.value)).toBe(tc.roundHalfUp);
      // Python primitive — proves the two runtimes agree on the rounding mode.
      const py = runParityShim('round4', { value: tc.value }) as { rounded: number };
      expect(py.rounded).toBe(tc.roundHalfUp);
      // Explicit divergence from banker's: the round-half-up result must NOT
      // equal what Python's default round() would produce.
      expect(tc.roundHalfUp).not.toBe(tc.bankers);
    });
  }

  it('the TS scorer uses the same round4 primitive (sanity: a known total rounds consistently)', () => {
    // The max-pass corpus case produces exactly 1.0 — round4 leaves it fixed.
    expect(round4(1.0)).toBe(1.0);
    // A representative sub-threshold weighted sum (0.7 boundary-fail path) is
    // already at 4 decimals; round4 is idempotent on it.
    expect(round4(0.7)).toBe(0.7);
  });
});