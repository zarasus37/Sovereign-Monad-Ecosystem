/**
 * Layer 7.8 — Classifier parity.
 *
 * Same input signal (narrative + semiotic_flags) → the TS heuristic classifier
 * (`@sovereign/logoc` PeirceClassifier) and the Python heuristic port
 * (`gnostic_engine.classification.HeuristicClassifier`) MUST produce the same
 * class_id, or BOTH flag ambiguous. The Python port is a verbatim line-for-line
 * mirror of the TS classifier; this test is the guard that keeps them locked.
 *
 * Corpus: shared/fixtures/layer7/classifier_corpus.json (flag-driven,
 * narrative-driven, mixed, and ambiguous cases).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PeirceClassifier, AmbiguousClassificationError } from '@sovereign/logoc';
import type { LogocEvent, SemioticFlags } from '@sovereign/logoc';
import { runParityShim, repoRoot } from './_parity.js';

type ClassifierCase = {
  id: string;
  narrative: string;
  semiotic_flags: Record<string, boolean>;
  expected_class_id: number | null;
  expected_ambiguous: boolean;
  note?: string;
};

const corpusPath = resolve(repoRoot, 'shared/fixtures/layer7/classifier_corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf-8')) as { cases: ClassifierCase[] };

const classifier = new PeirceClassifier();

/** Run the TS heuristic classifier on one case, returning {class_id, ambiguous}. */
function tsClassify(c: ClassifierCase): { class_id: number | null; ambiguous: boolean } {
  const event: LogocEvent = {
    schema_version: 'LOGOC-Event-v5.2',
    event_id: c.id,
    timestamp: '2026-07-07T00:00:00Z',
    narrative: c.narrative,
    semiotic_flags: c.semiotic_flags as SemioticFlags,
  };
  try {
    return { class_id: classifier.classify(event), ambiguous: false };
  } catch (err) {
    if (err instanceof AmbiguousClassificationError) {
      return { class_id: null, ambiguous: true };
    }
    // Any other throw (e.g. a decided triad with no manifold class) is treated
    // as "no classification" for parity, mirroring the Python shim's catch.
    return { class_id: null, ambiguous: true };
  }
}

describe('Layer 7.8 — classifier parity (TS heuristic ↔ Python heuristic port)', () => {
  // One Python spawn for the whole corpus (batch mode).
  const py = runParityShim(
    'classifier_all',
    { cases: corpus.cases.map((c) => ({ narrative: c.narrative, semiotic_flags: c.semiotic_flags })) },
  ) as { results: { class_id: number | null; ambiguous: boolean }[] };

  it('returns one result per corpus case', () => {
    expect(py.results).toHaveLength(corpus.cases.length);
  });

  for (let i = 0; i < corpus.cases.length; i++) {
    const c = corpus.cases[i];
    it(`case "${c.id}" — TS class_id matches Python and the expected verdict`, () => {
      const ts = tsClassify(c);
      const pyResult = py.results[i];
      // Parity: the two runtimes agree on both the class_id and ambiguity flag.
      expect(ts.class_id).toBe(pyResult.class_id);
      expect(ts.ambiguous).toBe(pyResult.ambiguous);
      // Self-check against the corpus's expected verdict.
      expect(ts.class_id).toBe(c.expected_class_id);
      expect(ts.ambiguous).toBe(c.expected_ambiguous);
    });
  }

  it('corpus covers at least one clean, one flag-driven, and one ambiguous case', () => {
    const clean = corpus.cases.filter((c) => c.expected_class_id !== null);
    const ambiguous = corpus.cases.filter((c) => c.expected_ambiguous);
    const flagDriven = corpus.cases.filter(
      (c) => Object.keys(c.semiotic_flags).length > 0 && c.narrative === '',
    );
    expect(clean.length).toBeGreaterThan(0);
    expect(ambiguous.length).toBeGreaterThan(0);
    expect(flagDriven.length).toBeGreaterThan(0);
  });
});