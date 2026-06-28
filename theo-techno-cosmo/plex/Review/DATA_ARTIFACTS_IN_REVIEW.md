# Data Artifacts Present in Review/

`plex/Review/` is intended for **audit trails, drift signals, alignment case studies, and interpretation documents**. Occasionally data artifacts land here during working sessions. This file documents them so readers know whether each artifact is canonical, a review variant, or a stale copy.

## Current Data Artifacts

| File | Status | Canonical Location or Note |
|---|---|---|
| `LOGOC_MODEL_v5_REVIEW_VARIANT.json` | ✅ Review variant | Adds `split_handling` and `inference_schema` annotations to the canonical `plex/Manifest/LOGOC_MODEL_v5.json`. |
| `logoc_inference_v5_REVIEW_VARIANT.py` | ✅ Review variant | Adds `tier_locked` / `tier_split` fields to the canonical inference script. Reference copy is `plex/CODE/logoc_inference_reference.py`. |
| `logoc_corpus_full_integrated_v5 (1).jsonl.txt` | ⚠️ Text dump | Appears to be a text conversion of the JSONL corpus. Retained as working reference; not canonical. |
| `logoc_corpus_full_integrated_v5 (1).jsonl.txt.bak` | ⚠️ Backup | Backup of the text dump above. Retained for provenance. |
| `LOGOC_MODEL_v5.md` | ✅ Stub | Redirects to canonical `plex/Manifest/LOGOC_MODEL_v5.json` and notes the review variant. |
| `logoc_inference_v5.md` | ✅ Stub | Redirects to `plex/CODE/logoc_inference_reference.py` and notes the review variant. |
| `logoc_corpus_v5_final.md` | ✅ Stub | Redirects to canonical `plex/Manifest/logoc_corpus_v5_final.csv`. |
| `LOGOC_SCHEMA_v5.md` | ✅ Stub | Redirects to canonical `plex/Manifest/LOGOC_SCHEMA_v5.json`. |
| `preference_pairs_EXAMPLES.jsonl` | ✅ Review material | Example preference pairs for reward-model review. |
| `pre_scaling_test_scores.csv` | ✅ Review material | Pre-scaling test scores for calibration review. |
| `insights.csv` | ✅ Review material | Compressed insights index for review sessions. |

## Removed Duplicates

The following files were previously present as identical duplicates and have been removed from `Review/`:

- `LOGOC_SCHEMA_v5.json` → canonical in `plex/Manifest/`
- `logoc_corpus_v5_final.csv` → canonical in `plex/Manifest/`

## Policy

1. **No new canonical data in Review/.** Canonical schemas, models, and corpora belong in `plex/Manifest/`.
2. **Review variants must be labeled.** Use the `_REVIEW_VARIANT` suffix and add a stub markdown file at the original filename.
3. **True duplicates are deleted.** If a file is identical to the Manifest copy, remove it from Review/.
