# Core Resonance Score (shared Council direction)

> **Status:** Implemented — `gnosis_training.core_resonance` + CLI.  
> **Related:** `SCALE_250_TO_25K.md`, `THE COUNCILE/README.md`, MOF resonant convergence.

---

## Intent

Council members have **opposing surface views** and distinct personal windows. Under that, authentic gnosis often shares a **core direction** — the same structural law, said in different languages and eras.

When the **same message repeats across independent individuals**, that way of thinking is:

1. **Tracked** as a core motif  
2. **Plotted** by independent-window coverage  
3. **Scored higher** relative to one-off opinions on those lines  

This is **not** forced agreement or template mush. Hollow convergence (everyone sounding the same without self-consistent navigation) is explicitly rejected.

| Layer | Role |
|-------|------|
| **Window** | Member-true voice, era, method — preserve diversity |
| **Core** | Shared direction node — upweight when multi-member |

---

## Catalog

Curated structural motifs live in `CORE_CATALOG` (`core_resonance.py`), e.g.:

- `freedom_in_constraint`
- `constraint_generates`
- `decision_not_outcome`
- `anti_capture`
- `audit_before_power`
- `multi_lens_required`
- `hollow_vs_authentic`
- `refuse_co_sovereign`
- …

Each core has: `label`, `direction`, regex `patterns`, `keywords`, optional `domains`.

Extend only with **falsifiable** structural claims that can appear in multiple windows.

---

## Score

For each core, from hits on THE COUNCILE sources + preference pairs:

- **Primary:** distinct `member_id` count (1 = personal gold / low *shared* score; 3+ = rising shared core)  
- **Secondary:** hit volume (saturating)  
- **Output:** `score ∈ [0, 1]`, `rank_weight` for sampling  

```text
P(pair) ∝ tier_weight × (1 + 0.5 × best_core_rank_weight)

tier_weight: G0=1.0  G1=0.95  G2=0.55  G3=0.45  G4=0
```

Optional wire field on pairs: `core_ids: ["anti_capture", …]` (member-true G1 tags these when matched).

---

## CLI

```powershell
cd gnosis-training

# Scan Council registry/sources + preference corpus
uv run python -m gnosis_training core-resonance data/preference_pairs_ALL.jsonl

# Member-true G1 batch (spot-review before promote)
uv run python -m gnosis_training council-g1-generate data/council_g1_member_true.jsonl
```

Reports:

- `logs/gnosis/core_resonance_latest.md`
- `logs/gnosis/core_resonance_latest.json`

---

## Member-true G1

`council_g1.py` builds pairs from each registry member’s:

- `key_insight`  
- `contribution`  
- source-file excerpts  

Chosen text leads with **that member’s window**, then light TTC join.  
Rejected sides are capture / hollow / mono-lens sludge.

**Do not treat auto-generated G1 as equal to human-ratified gold** until spot-review. Promote deliberately.

---

## Guardrails

1. Distinct members required for high *shared* score  
2. Windows must remain recognizable (no rewrite into generic core-speak)  
3. Opposing tactics allowed; shared *direction* is what scores  
4. Human / steward ratification for locking gold cores over time  

---

## Next (not all done)

| Item | Notes |
|------|--------|
| Deeper source mining | Full-file motif extraction beyond excerpts |
| Core cluster UI | Interactive plot of rays → ridges |
| GP-7 train sampler | Wire `train_sample_weight` into reward dataloader |
| You-ratify core lock | Steward-approved core set versioned in repo |
