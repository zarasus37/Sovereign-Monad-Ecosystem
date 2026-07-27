# Preference pair coverage report (GP-1)

- **Generated:** 2026-07-27T21:58:06.097769+00:00
- **Source:** `C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\gnosis-training\data\preference_pairs_ALL.jsonl`
- **Pair count:** 26700

## By category

| CAT | n |
|-----|--:|
| CAT1 | 3916 |
| CAT2 | 3026 |
| CAT3 | 2581 |
| CAT4 | 2403 |
| CAT5 | 2670 |
| CAT6 | 2670 |
| CAT7 | 3471 |
| CAT8 | 2848 |
| CAT9 | 3115 |

## CAT9 / ttc_axis

| Axis | n | share |
|------|--:|------:|
| theological | 801 | 25.7% |
| technological | 1513 | 48.6% |
| cosmological | 801 | 25.7% |

⚠️ CAT9/ttc_axis counts uneven (min < 60% of max)

## Score gap (chosen.total − rejected.total)

n=26700 · mean=0.3416 · median=0.364 · min=0.15 · max=0.63 · stdev=0.1272

## Failing criteria on rejected side

| Criterion | n |
|-----------|--:|
| C1 | 11568 |
| C4 | 5808 |
| C5 | 5355 |
| C2 | 5079 |
| C3 | 2511 |
| C-DENSITY-FLOOR | 648 |
| X-AUDITABILITY | 567 |
| X-STRUCTURED-OUTPUT | 486 |
| C-ANTI-DILUTION | 486 |
| X-CONSTRAINT-DENSITY | 486 |
| T-REFUSAL-BUDGET | 405 |
| T-SOVEREIGNTY-DEBT | 324 |
| T-NO-EXTERNAL-REWARD-ONLY | 324 |
| X-VERSIONED-CONSTRAINTS | 324 |
| T-IDENTITY-PERSISTENCE | 162 |
| C-PERSISTENCE | 162 |
| T-NO-SELF-MOD-WITHOUT-AUDIT | 81 |
| Axiom-6 | 81 |
| Axiom-11 | 81 |
| Axiom-7 | 81 |
| STEWARD-COUNCIL-VETO | 81 |
| C-DRIFT-AMNESTY | 81 |

## Flags & provenance

- synthetic: 26450
- bootstrap: 0
- apeiron: 2848
- pairs with chosen_ttc/rejected_ttc: 3115
- provenance_tier: `{'G0': 250, 'G1': 50, 'G2': 24000, 'G3': 2400}`

## ID hygiene

- unique pair_ids: 26700
- missing pair_id rows: 0
- duplicate pair_ids: none

## Recommendations

- Rebalance CAT9 ttc_axis coverage (theological / technological / cosmological)
- Next: Council prototype (G1) on thin CATs + seeded expand (G2) from strong gold seeds

---

See `docs/gnosis-training/SCALE_250_TO_25K.md` for G0–G3 factory plan.
