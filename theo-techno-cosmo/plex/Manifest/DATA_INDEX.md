# PLEX/Manifest Data Index

This directory holds the **canonical release artifacts** for LOGOC v5.0 and related operational specifications. If you see the same filename elsewhere in the PLEX, that copy is either a duplicate (to be removed) or a review/audit variant (explicitly labeled).

## Canonical LOGOC v5.0 Release Artifacts

| File | Role | Consumed By |
|---|---|---|
| `LOGOC_MODEL_v5.json` | Trained model — priors, tiers, keyword weights, wheel positions. | `monad-ecosystem/packages/logoc/`, `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` |
| `LOGOC_SCHEMA_v5.json` | Full theoretical schema — Peirce, Llull, Trithemius integrations. | Reference for corpus validation and rubric design. |
| `logoc_corpus_v5_final.csv` | 55-event training corpus with full scores. | Model training, benchmark regression tests. |
| `logoc_corpus_full_integrated_v5 (1).jsonl` | Full JSONL corpus with semiotic readings. | Enrichment, audit, and research queries. |
| `logoc_inference_v5.py` | Original release inference pipeline — score any new event. | Reference only; production pipeline is in `monad-ecosystem/packages/logoc/peirce/pipeline.py` and `gnostic-engine/.../logoc_pipeline.py`. |
| `LOGOC_FORMAL_INTEGRATION_v5.md` | Human-readable integration document. | Onboarding and doctrine alignment. |
| `LOGOC_v5_RELEASE_README.md` | Release notes and quick-start usage. | First read for LOGOC v5.0. |

## Operational Specifications

| File | Role |
|---|---|
| `OPERATIONAL_AXIOMS_PHASE4.md` | 12 axioms → current operational status, enforcement, measurement. |
| `AGENT_PERSONALITY_FRAMES_v5.md` | Six archetypes + authentic/hollow signals + Dove watch points. |
| `DOVE_OPERATIONAL_SPECIFICATION_v1.md` | Five observables, signal types, intervention levels, meta-governance. |
| `ECOSYSTEM_ALIGNMENT_AUDIT_PHASE4.md` | Cross-pillar alignment audit framework. |
| `INTEGRATION_MAP.md` | Knowledge navigation by role. |

## Review/Audit Variants

When a working-session variant of a canonical artifact exists, it is kept in `plex/Review/` with an explicit `_REVIEW_VARIANT` suffix and a stub markdown file at the original name explaining the redirection.

| Canonical File | Review Variant (if any) |
|---|---|
| `LOGOC_MODEL_v5.json` | `plex/Review/LOGOC_MODEL_v5_REVIEW_VARIANT.json` (adds `split_handling`, `inference_schema`) |
| `logoc_inference_v5.py` | `plex/Review/logoc_inference_v5_REVIEW_VARIANT.py` (adds `tier_locked`, `tier_split`) |

## Reference Code

Implementation sketches and historical reference scripts are in `plex/CODE/`.

| Sketch | Production Equivalent |
|---|---|
| `plex/CODE/apoptosis_engine_reference.py` | Triage/rejection logic in `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` |
| `plex/CODE/preference_pair_generator_reference.py` | `monad-ecosystem/packages/logoc/scripts/train_ml_classifier.py` |
| `plex/CODE/logoc_inference_reference.py` | `monad-ecosystem/packages/logoc/peirce/pipeline.py` |

## Maintenance Rule

When updating a canonical artifact in this directory, update this index if the file's role or consumers change. Do not let new duplicates accumulate in `plex/Review/`; either move review variants there with the `_REVIEW_VARIANT` suffix or delete true duplicates.
