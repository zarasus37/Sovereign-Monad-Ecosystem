Preference Pairs Output — README
================================

What this produces
- A generator script `generate_pairs.py` that produces the required JSONL files.
- Output folder: `preference_pairs_output/` containing:
  - `preference_pairs_cat1.jsonl` (50 pairs)
  - `preference_pairs_cat2.jsonl` (40 pairs)
  - `preference_pairs_cat3.jsonl` (35 pairs)
  - `preference_pairs_cat4.jsonl` (30 pairs)
  - `preference_pairs_cat5.jsonl` (30 pairs)
  - `preference_pairs_cat6.jsonl` (30 pairs)
  - `preference_pairs_cat7.jsonl` (25 pairs)
  - `preference_pairs_cat8.jsonl` (10 pairs)
  - `preference_pairs_ALL.jsonl` (merged & shuffled, 250 lines)

How to run
Open PowerShell in the `Review` directory and run:

```powershell
python .\generate_pairs.py
```

Notes
- The generator uses deterministic seeding (`random.seed(42)`) for reproducible output.
- The script enforces the QC rules in `REWARD_MODEL_PREFERENCE_PAIRS_GUIDE.md` where possible: chosen totals >= 0.72, gap >= 0.15, apeiron pairs labeled and scored between 0.55–0.71.
- Review the generated pairs for content quality and domain specificity; this script produces high-level synthetic responses as a starting dataset.


