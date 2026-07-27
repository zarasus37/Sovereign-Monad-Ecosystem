# Scaling Preference Pairs: 250 → ~25k

> **Status:** Plan (2026-07-27). Open-minded utility — not LOGOC-only circular labeling.  
> **Gold file today:** `gnosis-training/data/preference_pairs_ALL.jsonl` (**250** human-judged).  
> **Guides:** `docs/gnosis-training/TTC_PREFERENCE_PAIRS_GUIDE.md`, constitution CAT1–8 guides, promote scripts under `gnosis-training/scripts/`.  
> **Principle:** Scale volume without destroying the **gold standard** that makes Stage 2 worth running.

---

## 0. Why 250 is not enough — and why “just 25k synthetic” is not enough either

| Fact | Implication |
|------|-------------|
| 250 pairs ≈ dry-run / thin reward fit for 8B | Risk: overfitting, sycophancy, brittle CAT coverage |
| Pure LLM-generated + LOGOC auto-label | Risk: model learns **classifier echo**, not human/council judgment |
| Your gold pairs are **style + law** (tripartite, JOIN, TTC axes, anti-RLHF) | That *is* the seed of a scalable factory |

**Goal:** ~**25,000** *training-useful* pairs with **known provenance tiers**, not 25k anonymous noise.

---

## 1. Current gold (what we have)

| Property | Value |
|----------|--------|
| Count | **250** |
| Format | JSONL preference pairs (`prompt` / `chosen` / `rejected` / scores / `failing_criteria` / optional CAT9 TTC fields) |
| Flags | `synthetic: false` (0 synthetic flags in ALL today) |
| Score gap (chosen−rejected total) | mean **~0.35**, min **0.15** (healthy separation) |
| Promote path | Human review → `promote_*.py` → `preference_pairs_ALL.jsonl` |

**Category mix (live count):**

| CAT | n | Note |
|-----|--:|------|
| CAT1 | 44 | Strong |
| CAT2 | 34 | |
| CAT3 | 29 | |
| CAT4 | 27 | |
| CAT5 | 30 | |
| CAT6 | 30 | |
| CAT7 | **11** | Thin — expand early |
| CAT8 | **10** | Thin — expand early |
| CAT9 | 35 | TTC axes: theo 9 / techno 17 / cosmo 9 — **rebalance theo/cosmo** |

Thin CATs and CAT9 axis skew are the first **targets for Council + G2**, not random volume.

**Pipeline already in tree (do not reinvent blindly):**

| Tool | Role |
|------|------|
| `python -m gnosis_training bootstrap-worksheet` | Worksheet from events (not gold) |
| `python -m gnosis_training synth-pairs` | Dry-run synthetic only — **not** human judgments |
| `python -m gnosis_training validate-worksheet` | Schema / authoring health |
| `python -m gnosis_training ttc-metrics` | CAT9 readiness |
| `scripts/promote_*.py` | Promote reviewed batches into ALL |

---

## 2. Provenance tiers (required for honest 25k)

Every pair in an expanded corpus must carry a tier:

| Tier | Source | Train weight (suggested) | Target share of 25k |
|------|--------|--------------------------|---------------------|
| **G0 Gold** | Human-judged (current 250 + future human) | **1.0** | ≥ 250 (grow when you can) |
| **G1 Council** | Council voice / multi-perspective generation + human or multi-member ratify | **0.85–1.0** | **5k–10k** aspirational |
| **G2 Seeded expand** | Mutate/paraphrase/variant from G0/G1 with hard gap checks | **0.5–0.7** | **10k–15k** |
| **G3 Hard negative** | Systematic *rejected* patterns (sycophancy, mono-lens, free-text, external-reward-only) | **0.6–0.8** | **3k–5k** |
| **G4 LOGOC-filtered draft** | LLM draft → LOGOC/TTC filter → **queue for G1**, not auto-gold | **0.0 until promoted** | Buffer only |

**Never** train Stage 2 reward as if G4 = G0.

Suggested JSON fields on every new pair:

```json
{
  "provenance_tier": "G0|G1|G2|G3",
  "seed_pair_ids": ["PP-001"],
  "generator": "human|council:llull|expand:v1|hardneg:v1",
  "synthetic": true,
  "bootstrap": false,
  "reviewed_by": null
}
```

---

## 3. Factory design (how we actually get to ~25k)

```text
┌─────────────────┐
│  G0 Gold (250+) │──analyze coverage, gaps, failure modes──┐
└────────┬────────┘                                         │
         │                                                  ▼
         │         ┌──────────────────────────────────────────────┐
         ├────────►│  Council generation (G1)                     │
         │         │  Each member / lens: prompts + chosen/reject │
         │         │  Multi-member ratify or founder sample-audit │
         │         └───────────────────┬──────────────────────────┘
         │                             │
         ▼                             ▼
┌─────────────────┐         ┌─────────────────────────────┐
│ Expand from seed│         │ Hard-negative forge (G3)    │
│ (G2): paraphrase│         │ systematic bad modes        │
│ cross-CAT, TTC  │         └──────────────┬──────────────┘
│ surface variants│                        │
└────────┬────────┘                        │
         │                                 │
         └──────────────┬──────────────────┘
                        ▼
              ┌─────────────────────┐
              │ Automated gates     │
              │ schema · score gap  │
              │ tripartite checks   │
              │ LOGOC/TTC as FILTER │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │ Train corpus mix    │
              │ weighted by tier    │
              │ → Reward / GRPO     │
              └─────────────────────┘
```

### 3.1 Step A — Analyze the 250 (do this first)

Produce a **coverage report** (scriptable):

- Counts per CAT1–CAT9  
- Mean / min chosen−rejected score gap  
- Failure criteria histogram (`C1`…`C5`, TTC rules)  
- Prompt length / domain balance  
- “Thin spots” (under-represented axes)

**Output:** `logs/gnosis/pair_coverage_250.json` + short MD summary.

### 3.2 Step B — Council as generators (high value)

The Council corpus (`theo-techno-cosmo/THE COUNCILE/`) is not a chat toy — it is a **multi-lens library**.

| Mode | How |
|------|-----|
| **Voice-conditioned pairs** | Prompt: “As {member}, respond to …” → chosen = tripartite JOIN in that voice; rejected = mono-lens / sycophantic / free-text |
| **Cross-member contrast** | Same prompt; chosen = high-density council-aligned; rejected = low-density “helpful” sludge |
| **Event extraction → pairs** | Existing GNOSIS EVENT EXTRACTION files → questions that force the same epistemic moves |

**Ratification:**  
- Full human review for first **500–1k** council pairs (sets quality bar)  
- Then **spot-check** (e.g. 5–10%) + automated gates for the rest of G1  

### 3.3 Step C — Seeded expansion from gold (G2)

From each G0 (and later G1) pair, generate **controlled variants**:

| Variant type | Example |
|--------------|---------|
| Paraphrase prompt | Same deep question, new surface |
| Domain stress | Same structure, force missing-lens failure on rejected |
| CAT9 axis | Same prompt family, T/X/C gate-aligned reject modes |
| Length / format | Keep law, change rhetoric density |
| Adversarial polish | Rejected becomes more “fluent but wrong” (harder negative) |

**Rules:**  
- Preserve **chosen law** (tripartite + JOIN or TTC axis rules)  
- Enforce score / TTC gap floors (existing RULE T1 style)  
- Cap variants per seed (e.g. **20–40**) so one PP-001 does not dominate  

Math sketch:  
`250 seeds × 40 variants ≈ 10k` G2 before council volume.

### 3.4 Step D — Hard-negative forge (G3)

Systematically generate **rejected** sides (and pair with strong chosen templates):

- Sycophancy / moralizing (`C5`)  
- Mono-lens (missing T or X or C)  
- Free-text no structure  
- External-reward-only / bypass audit  
- Certainty theater on open questions (`C4`)  
- Volume-over-density  

Chosen side can be a **canonical good template** or nearest gold chosen.

### 3.5 Step E — LOGOC / TTC as **filter**, not sole judge

Use `gnostic-engine` heuristics / TTC scores to:

- **Drop** drafts that fail density / structure / gap  
- **Rank** queue for human/council review  
- **Never** silently mint G0  

Active learning: send only **uncertain** or **high-value** drafts to humans.

---

## 4. Target mix (example path to 25k)

| Tier | Count | Notes |
|------|------:|-------|
| G0 Gold | 250–500 | Keep sacred; grow slowly |
| G1 Council | 8,000 | Main quality engine after seed analysis |
| G2 Expand | 12,000 | Seeded from G0/G1 |
| G3 Hardneg | 4,500 | Failure-mode coverage |
| **Total** | **~25k** | Weighted sampling at train time |

Train sampler example:

```text
P(pair) ∝ tier_weight[tier] × category_balance_boost
```

---

## 5. Engineering work packages

| ID | Deliverable | Owner type |
|----|-------------|------------|
| **GP-1** | Coverage analyzer for `preference_pairs_ALL.jsonl` | **Done** — `python -m gnosis_training pair-coverage` → `logs/gnosis/pair_coverage_latest.{json,md}` |
| **GP-2** | Schema: `provenance_tier`, `seed_pair_ids`, `generator` | **Done** — RULE P in `preference.py`; `tag-provenance-g0` CLI; see `PREFERENCE_PROVENANCE.md` |
| **GP-3** | Council pair generator (member-conditioned prompts) | Script + registry |
| **GP-4** | Seed expand pipeline (G2) with gap checks | Script |
| **GP-5** | Hard-negative forge (G3) | Script |
| **GP-6** | LOGOC/TTC filter + review queue | Bridge to gnostic-engine |
| **GP-7** | Weighted dataloader / mix config for reward stage | Training |
| **GP-8** | Eval set held out (pure G0 + fresh human) | Never train on holdout |

---

## 6. Quality bars (non-negotiable even at scale)

1. **Chosen beats rejected** on constitution total and/or TTC composite by configured gap.  
2. **Chosen** still tripartite + JOIN when the prompt allows (CAT1–8 law).  
3. CAT9 pairs still reinforce **gate cooperation**, not fighting Hepar.  
4. No train run that treats unreviewed G4 as gold.  
5. Holdout eval always includes **human G0** slices.  
6. Imagination / multi-lens principle: expand **lenses and domains**, not only paraphrase spam.

---

## 7. Relation to outside “25k LOGOC” idea

| Outside memo | Our stance |
|--------------|------------|
| Scale to 25k+ | **Yes** |
| LOGOC auto-label as sole gold | **No** |
| Analyze current pairs + expand | **Yes** |
| Council as generator | **Yes — preferred** |
| Synthetic drafts in the pipeline | **Yes, as G2/G4 under gates** |

---

## 8. Immediate next step (when you say go)

1. Run **GP-1** coverage report on the 250.  
2. Lock **provenance schema** (GP-2).  
3. Prototype **one Council member → 50 pairs** through validate-worksheet + human spot check.  
4. If quality holds, open the firehose (G1 + G2 + G3) toward 25k with weighted training.

---

## 9. One-line

> Grow from 250 by **teaching the factory what gold looks like** (analyze + Council + seeded expand + hard negatives), and use LOGOC/TTC as **gates**, not as a fake human.

---

*Open for iteration. Implement scripts when founder says start GP-1.*
