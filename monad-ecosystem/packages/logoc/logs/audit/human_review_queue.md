# Human Review Queue — Post-P8 Final State

**Date:** June 23, 2026 (P8 completion)  
**Corpus:** `master_corpus_v5.10.jsonl`  
**ML Model:** `ml_classifier_v13.json`  
**Pipeline:** Rubric + Naive Bayes ensemble  
**Status:** ✅ **0 pending human-review events**

---

## Summary

The P8 human-review cleanup pass resolved the final 7 events that required expert judgment.

- **Total events reviewed:** 7
- **Reclassifications:** 2
- **Kept as-is:** 5
- **Remaining pending:** 0

All 334 events in the v5.10 corpus now have a confirmed Peirce sign class and are labeled `peirce_migration_pending: false`.

---

## Reclassifications

| Event ID | Previous Class | New Class | Rationale |
|---|---|---|---|
| `gnosis_Gnostic Jesus (The Historical Figur_ev13` | 42 | 2 | Single demonstrative recognition; path `Sinsign/Index/Dicent` |
| `gnosis_Friedrich Nietzsche (1844–1900) GNO_ev08` | 5 | 2 | Single biographical receipt of universal; path `Sinsign/Index/Dicent` |

---

## Kept As-Is

| Event ID | Class | Rationale |
|---|---|---|
| `Spinoza_ev09` | 42 | ML agrees with flagged class; rubric low-confidence only — verified Class 42 |
| `Machiavelli_ev11` | 42 | ML agrees with flagged class; rubric low-confidence only — verified Class 42 |
| `Akhenaten_ev06` | 4 | Path-class gap (`Rheme-Indexical-Legisign`); rubric general law — verified Class 4 |
| `Bruno_ev06` | 4 | Path-class gap (`Rheme-Indexical-Legisign`); rubric general law — verified Class 4 |
| `Trithemius_ev01` | 1 | Confidence 0.96, ML agrees — verified Class 1 |

---

## Artifacts

- `logs/corpus/master_corpus_v5.10.jsonl` — final labeled corpus (334 events, 11 classes, 0 pending)
- `logs/audit/ml_classifier_v13.json` — final ML model (test accuracy 98.59%, full accuracy 98.5%)
- `logs/audit/correction_log_v5.10.json` — detailed correction record for the 7 P8 events
- `logs/audit/human_review_queue_v5.9.md` — historical pre-P8 queue (27 events) preserved for reference

---

## Next Review Trigger

Future drift detection or model retraining may produce a new human-review queue. When that happens, this file should be superseded by a new versioned queue document (e.g., `human_review_queue_v5.11.md`).
