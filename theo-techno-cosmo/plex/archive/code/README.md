# archive/code/ — Archived research code (P11 cleanup, 2026-06-23)

This directory holds **research-stage Python scripts and associated notes**
that were originally placed at `plex/` top-level and `plex/CODE/`. They
were moved here as part of **P11 (theo-techno-cosmo deep cleanup)** because:

- The pillar README explicitly says **"Do Not Put Here: application
  runtime code"**
- The active LOGOC pipeline lives in
  `monad-ecosystem/packages/logoc/scripts/` and
  `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py`
- These scripts were never wired into the production pipeline and are
  retained here as historical reference for the algorithm design

---

## File inventory

| File | What it is | Status |
|------|------------|--------|
| `apoptosis_engine.py` | LTP-ML Apoptotic Retention scheduler (v0 / prototype) | Not in production. Concept may inform future ML training-data rotation policy. |
| `preference_pairs.py` | TTCL v2.0 reward-model preference-pair generator | Superseded by HR-review workflow in v5.x corpus |
| `import json.py` | Seed wheel definitions (A/T/V/X/S/Theologia) | Superseded by `master_corpus_v5.10.jsonl` rubric |
| `import hashlib, json.py` | Wheel event hasher (TTCL v2.0 spec seal 3ADEE65E9CD8D291) | Reference only |
| `# Build v5 schema + save final inte.txt` | Python snippet, originally `# Build v5 schema...` filename | Reference |
| `# Generate 10 fully worked example pairs.py` | Example pair generator | Reference |
| `environment_setup_utils.txt` | Python env setup notes (venv + pip) | Reference |
| `OFFICIAL v5 RELEASE — save all artifacts.txt` | v5 release checklist | Done; no further action |
| `Codesh Script from a Gnosis Event.txt` | Codesh tool draft | Reference |
| `Dodecatemoria Index (Full 144).txt` | Dodecatemoria table | Reference |
| `enriched corpus.txt` | Enriched corpus notes | Reference |
| `desktop.ini` | Windows folder metadata | Tracked per repo convention |

---

## Why these were not deleted

- The TTCL v2.0 design choices encoded here informed the current rubric
  decomposition
- The apoptotic retention concept is referenced in the MOF v2.4
  (Master Operating File) as a future capability
- Deletion would erase the algorithmic provenance of the v5.x pipeline

If any file becomes obsolete by a later MOF revision, it can be
removed at that point with a note in the cleanup CHANGELOG.

---

## CHANGELOG

### 2026-06-23 — P11 cleanup
- Moved `apoptosis_engine.py` (was `plex/`) and all of `plex/CODE/`
  contents to `plex/archive/code/`
- Documented each file's status above
- Active LOGOC pipeline is unaffected (v5.10 corpus still uses
  `monad-ecosystem/packages/logoc/scripts/` and `gnostic-engine/`)
- Corpus event provenance unchanged — gnosis source files in
  `THE COUNCILE/` are referenced by `source_file` in the v5.10 corpus
  and must not be moved or renamed
