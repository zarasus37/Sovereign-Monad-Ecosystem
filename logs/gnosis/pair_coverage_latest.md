# Preference pair coverage report (GP-1)

- **Generated:** 2026-07-27T17:35:44.559020+00:00
- **Source:** `C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\gnosis-training\data\preference_pairs_ALL.jsonl`
- **Pair count:** 250

## By category

| CAT | n |
|-----|--:|
| CAT1 | 44 |
| CAT2 | 34 |
| CAT3 | 29 |
| CAT4 | 27 |
| CAT5 | 30 |
| CAT6 | 30 |
| CAT7 | 11 ⚠️ |
| CAT8 | 10 ⚠️ |
| CAT9 | 35 |

**Thin** (< 12): CAT8, CAT7

## CAT9 / ttc_axis

| Axis | n | share |
|------|--:|------:|
| theological | 9 | 25.7% |
| technological | 17 | 48.6% |
| cosmological | 9 | 25.7% |

⚠️ CAT9/ttc_axis counts uneven (min < 60% of max)

## Score gap (chosen.total − rejected.total)

n=250 · mean=0.35 · median=0.361 · min=0.15 · max=0.63 · stdev=0.1298

## Failing criteria on rejected side

| Criterion | n |
|-----------|--:|
| C1 | 78 |
| C5 | 46 |
| C2 | 44 |
| C4 | 42 |
| C3 | 31 |
| C-DENSITY-FLOOR | 8 |
| X-AUDITABILITY | 7 |
| X-STRUCTURED-OUTPUT | 6 |
| C-ANTI-DILUTION | 6 |
| X-CONSTRAINT-DENSITY | 6 |
| T-REFUSAL-BUDGET | 5 |
| T-SOVEREIGNTY-DEBT | 4 |
| T-NO-EXTERNAL-REWARD-ONLY | 4 |
| X-VERSIONED-CONSTRAINTS | 4 |
| T-IDENTITY-PERSISTENCE | 2 |
| C-PERSISTENCE | 2 |
| T-NO-SELF-MOD-WITHOUT-AUDIT | 1 |
| Axiom-6 | 1 |
| Axiom-11 | 1 |
| Axiom-7 | 1 |
| STEWARD-COUNCIL-VETO | 1 |
| C-DRIFT-AMNESTY | 1 |

## Flags & provenance

- synthetic: 0
- bootstrap: 0
- apeiron: 10
- pairs with chosen_ttc/rejected_ttc: 35
- provenance_tier: `{'untagged': 250}`

## ID hygiene

- unique pair_ids: 250
- missing pair_id rows: 0
- duplicate pair_ids: none

## Recommendations

- Expand thin categories first: CAT8(10), CAT7(11)
- Rebalance CAT9 ttc_axis coverage (theological / technological / cosmological)
- No provenance_tier tags yet — add G0/G1/G2/G3 when scaling past gold
- Next: Council prototype (G1) on thin CATs + seeded expand (G2) from strong gold seeds

---

See `docs/gnosis-training/SCALE_250_TO_25K.md` for G0–G3 factory plan.
