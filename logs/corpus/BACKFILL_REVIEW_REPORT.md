# Manual Review Report — Golden Backfill Sample
## Date: 2026-06-19
## Reviewer: Sovereign Agent (automated review with human-confirmable rationale)
## Backfill Version: heuristic_v1
## Seed: 42

---

## Golden Sample Events (5 reviewed)

### 1. ACCEPTED — 83ba87ba-8895-4507-933c-b7bdad000b23
- **Original type:** `hepar.audit.completed`
- **Narrative:** "This single audit completion event is causally linked to the protocol findings."
- **Flags:** `single_occurrence=True, causality=True, fact=True`
- **Classifier path:** `Sinsign → Index → Dicent` (ID 2, `Dicent-Indexical-Sinsign`)
- **Pragmatism band:** EXPERIENCE
- **Review decision:** ACCEPTED. The flags unambiguously map to the triad: `single_occurrence` → Sinsign, `causality` → Index, `fact` → Dicent. The narrative reinforces the causal linkage. This is a clean classification.

### 2. ACCEPTED — dd5e4938-7f98-4b0a-a96a-2f575d0239c3
- **Original type:** `test.signal`
- **Narrative:** "This single observed test event is causally linked to the scoring mechanism."
- **Flags:** `single_occurrence=True, causality=True, fact=True`
- **Classifier path:** `Sinsign → Index → Dicent` (ID 2, `Dicent-Indexical-Sinsign`)
- **Pragmatism band:** EXPERIENCE
- **Review decision:** ACCEPTED. Same clean triad mapping as #1. The synthetic narrative is well-formed for the classifier. Flags are consistent.

### 3. ACCEPTED — b65acf7d-5a15-4368-846b-e98a3878a1e5
- **Original type:** `gnosis.quarantine.triggered`
- **Narrative:** "This single quarantine event is causally linked to the lane LANE_C classification."
- **Flags:** `single_occurrence=True, causality=True, fact=True`
- **Classifier path:** `Sinsign → Index → Dicent` (ID 2, `Dicent-Indexical-Sinsign`)
- **Pragmatism band:** EXPERIENCE
- **Review decision:** ACCEPTED. Clean triad. The causal link to a lane classification is an indexical relation (pointer/symptom), correctly captured by `causality=True`. The single occurrence and factual assertion map cleanly.

### 4. ACCEPTED — 6e9a54d0-bac8-47c5-b1f7-c752e01eaab7
- **Original type:** `gnosis.score.computed`
- **Narrative:** "This single gnosis observation event is causally linked to agent agent-x behavior."
- **Flags:** `single_occurrence=True, causality=True, fact=True`
- **Classifier path:** `Sinsign → Index → Dicent` (ID 2, `Dicent-Indexical-Sinsign`)
- **Pragmatism band:** EXPERIENCE
- **Review decision:** ACCEPTED. Clean triad. The observation→agent link is indexical. Flags and narrative are consistent.

### 5. FLAGGED FOR REVIEW — b6f686fc-f75e-40b8-a31e-b9778898d2da
- **Original type:** `hepar.audit.started`
- **Narrative:** "The audit initiation rule concludes therefore a valid zero-day argument holds."
- **Flags:** `rule_based=True, reason=True`
- **Classifier path:** AMBIGUOUS — no clear object-relation flag (`similarity`, `causality`, or `convention`)
- **Pragmatism band:** N/A (pending)
- **Review decision:** FLAGGED. The event has `rule_based` (Legisign vehicle) and `reason` (Argument interpretant), but the object-relation triad is underspecified. The narrative mentions "rule" and "argument" but doesn't specify whether the zero-day relation is:
  - **Icon** (structural similarity to known patterns)
  - **Index** (causal trace in the bytecode)
  - **Symbol** (conventionally labeled as "zero-day" by community consensus)
- **Recommendation:** A human auditor should assign the object-relation flag based on the actual audit context. If the detection was based on bytecode pattern matching → `similarity=True` (Icon). If based on execution trace → `causality=True` (Index). If based on CVE database lookup → `convention=True` (Symbol).
- **Action:** Left in `peirce_migration_pending` state with `peirce_migration_source: "heuristic_v1_pending"`. Will be reclassified after flag enrichment.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total golden sample | 5 |
| Accepted into corpus | 4 (80%) |
| Flagged for review | 1 (20%) |
| Accepted band distribution | EXPERIENCE: 4 |

## Backfill Script

- **Script:** `monad-ecosystem/packages/logoc/scripts/backfill_v5.1_corpus.py`
- **Input:** `logs/signal-stream.jsonl` (21 sovereign-bus signals)
- **Full output:** `logs/logoc_corpus_v5.2_backfilled.jsonl` (21 events)
- **Golden sample:** `logs/golden_backfill_sample.jsonl` (5 events)
- **Accepted corpus:** `logs/corpus/accepted_v5.2_backfill.jsonl` (4 events)
- **Flagged for review:** `logs/corpus/flagged_for_review.jsonl` (1 event + 15 other ambiguous events)

## Next Steps

1. **Flag enrichment:** The 15 ambiguous events (71.4% of corpus) need human review or NLP enrichment to assign missing `semiotic_flags` (primarily object-relation flags: `similarity`, `causality`, `convention`).
2. **ML upgrade:** When the supervised model for `semiotic_flags` is trained (Phase 2), rerun backfill on ambiguous events.
3. **Corpus growth:** As new sovereign-bus signals arrive, automatically backfill via the `annotate()` pipeline hook.
