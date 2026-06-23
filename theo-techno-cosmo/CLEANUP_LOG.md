# theo-techno-cosmo/ — Cleanup Log

This file tracks cleanup passes against the theo-techno-cosmo pillar.
Each entry lists the date, scope, and a short rationale.

---

## 2026-06-23 — P11: misplaced code → archive/code/

**Scope:** `plex/` and `plex/CODE/`

**Action:** Moved 10 files (3 Python scripts, 7 prose notes about
those scripts) from `plex/` top-level and `plex/CODE/` into a new
`plex/archive/code/` subdirectory. Added a README.md in
`plex/archive/code/` documenting each file's status.

**Why:** The pillar README explicitly forbids "application runtime
code" in `plex/`. The active LOGOC pipeline lives in
`monad-ecosystem/packages/logoc/scripts/` (and the in-process
`gnostic-engine/` Rust core). The archived files are reference /
historical only.

**What was NOT changed:**

- `THE COUNCILE/` gnosis source files (referenced by v5.10 corpus
  `source_file` field — renaming would break provenance)
- `Wheel/` images (already correctly gitignored)
- `plex/Manifest/`, `plex/Review/`, `plex/Research/` (live docs)
- `notes/` (working references)

**Validation:**
- pnpm typecheck (control-center): clean
- pnpm build (control-center): clean (corpus pipeline still
  points at v5.10)
- v5.10 corpus provenance: intact (no `source_file` changes)

**Commits:** see git log for "P11" / "theo-techno-cosmo" prefix.

---

## 2026-06-23 — Wheel/ and notes/ audit

**Scope:** `Wheel/`, `notes/`, `desktop.ini` files

**Status:** Audited, no changes needed.

- `Wheel/` (7.0 MB) contains JPG/PNG contemplative diagrams. All
  correctly excluded by `.gitignore` (`*.jpg`, `*.png` lines 100-101).
  The 14 images include Raymond Llull's Ars Magna figures
  (`figura_t/v/x`, `figure_of_theology`, `kosmologia`,
  `technologia`) and a 4th figure.png. These are research aids for
  Wheel-of-Virtues doctrine and are intentionally kept untracked.
- `notes/` (81 KB) contains the 5.4 KB LOGOC_Theotechnocosmological_
  Constitution.pdf and 4 working-text files. The PDF is the
  formal constitution text. All files are referenced by other
  pillar docs.
- `desktop.ini` files in 4 subdirectories are Windows folder
  metadata. They are tracked per the existing repo convention
  (they appear in `.gitignore` for *.ini but the existing tracked
  copies stay).
