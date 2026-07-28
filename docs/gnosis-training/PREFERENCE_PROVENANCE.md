# Preference pair provenance (GP-2)

> **Status:** Implemented in `gnosis_training.preference` (RULE P).  
> **Scale plan:** `docs/gnosis-training/SCALE_250_TO_25K.md`

---

## Tiers

| Tier | Meaning | Trainable? |
|------|---------|------------|
| **G0** | Human gold | Yes (weight 1.0) |
| **G1** | Council-generated (+ review) | Yes |
| **G2** | Seeded expand from G0/G1 | Yes (requires `seed_pair_ids`) |
| **G3** | Hard-negative forge | Yes |
| **G4** | Draft / queue (LOGOC-filtered etc.) | **No** until promoted |

Missing `provenance_tier` on legacy gold is allowed; effective tier is **G0** if `synthetic=false` and `bootstrap=false`.

---

## Wire fields (optional on each JSONL object)

```json
{
  "pair_id": "PP-001",
  "category": "CAT1",
  "prompt": "...",
  "chosen": { "response": "...", "scores": { "...": 0.9, "total": 0.9 }, "notes": "" },
  "rejected": { "response": "...", "scores": { "...": 0.5, "total": 0.55 }, "notes": "" },
  "failing_criteria": ["C1"],
  "apeiron": false,
  "bootstrap": false,
  "constitution_version": "v2.0",
  "synthetic": false,
  "provenance_tier": "G0",
  "seed_pair_ids": [],
  "generator": "human",
  "reviewed_by": null,
  "core_ids": ["freedom_in_constraint"]
}
```

| Field | Type | Rules |
|-------|------|--------|
| `provenance_tier` | string | `G0`…`G4` if present |
| `seed_pair_ids` | string[] | **Required non-empty for G2** |
| `generator` | string | Free tag, e.g. `human`, `council:llull`, `expand:v1` |
| `reviewed_by` | string \| null | Optional reviewer id |
| `core_ids` | string[] | Optional Core Resonance motif ids (see `CORE_RESONANCE.md`) |

---

## RULE P (validate_pair)

1. Unknown tier → invalid  
2. `G0` + `synthetic=true` → invalid  
3. `G2` without seeds → invalid  
4. `G1`/`G2`/`G3` + `bootstrap=true` → invalid  
5. `G4` may validate for queue files but **`load_human_pairs` skips G4**

---

## CLI

```powershell
cd gnosis-training
# Backfill gold tags (writes *.g0.jsonl by default)
uv run python -m gnosis_training tag-provenance-g0 data/preference_pairs_ALL.jsonl

# Coverage sees tier histogram after backfill
uv run python -m gnosis_training pair-coverage data/preference_pairs_ALL.g0.jsonl
```

---

## Training

Use `is_trainable_pair` / `load_human_pairs` so drafts never enter the reward trainer. Weighted sampling by tier is GP-7 (later).
