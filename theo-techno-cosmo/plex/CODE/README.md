# PLEX/CODE — Reference Implementations

This directory holds **reference and historical code sketches** that illustrate how Theo-Techno-Cosmo (TTC) principles are expressed computationally. These files are **not production runtime code**.

The active production implementations live in:

- `gnostic-engine/src/gnostic_engine/core/`
- `monad-ecosystem/packages/logoc/`
- `monad-ecosystem/packages/gnosis-core/`
- `monad-ecosystem/packages/hepar-core/`

## Why This Directory Exists

The PLEX README promises a `CODE/` section where philosophical-operational concepts can be read alongside executable sketches. The files here were promoted from `plex/archive/code/` (P11 cleanup, 2026-06-23) because they remain useful as **design provenance** and **teaching references**, even though they are no longer wired into the live pipeline.

## Files

| File | What It Illustrates | Production Equivalent |
|---|---|---|
| `apoptosis_engine_reference.py` | LTP-ML apoptotic retention scheduler — how rejected/marginal samples can be isolated, reviewed, and either reintegrated or purged. | `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` triage statuses (`AUTO_ACCEPT`, `HUMAN_REVIEW`, `AMBIGUOUS`) and rejection logic. |
| `preference_pair_generator_reference.py` | TTCL v2.0 reward-model preference-pair generator — how constitution scores become training pairs. | `monad-ecosystem/packages/logoc/scripts/train_ml_classifier.py` and the HR-review workflow in the v5.x corpus. |
| `logoc_inference_reference.py` | LOGOC v5.0 symbolic-probabilistic event scorer — rubric weights, gnosis tiers, camera positions, Peirce classification. | `monad-ecosystem/packages/logoc/peirce/pipeline.py` and `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py`. |

## Status

- **Reference only.** Do not import these into production services.
- **Historical provenance.** They encode design choices that informed the current rubric and pipeline.
- **Teaching material.** Use them to understand the algorithmic intuition behind the production system.

## Note on Variants

A later working variant of `logoc_inference_v5.py` exists in `plex/Review/` with additional `tier_locked` / `tier_split` fields. That variant reflects a working-session annotation and is retained there as a review artifact. The canonical v5.0 release schema and model remain in `plex/Manifest/`.
