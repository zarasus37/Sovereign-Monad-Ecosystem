# Gnosis V2 Pre-Train Audit (Vector 6.1)

_Generated: 2026-07-21T16:41:57.440314+00:00_

## Claimed corpus

- Path claimed in task: `data/preference_pairs_worksheet.jsonl`
- Total rows: **250**
- validate-worksheet: **0 ok** / 250 pending authoring / 0 invalid
- Category counts: `{'CAT1': 32, 'CAT2': 32, 'CAT3': 31, 'CAT4': 31, 'CAT5': 31, 'CAT6': 31, 'CAT7': 31, 'CAT8': 31}`

## Trainable corpus (spec line 478 — human-judged only)

- Path: `data/preference_pairs_ALL.jsonl`
- Pairs passing `validate_pair` + non-bootstrap: **250**
- Category counts: `{'CAT1': 44, 'CAT2': 34, 'CAT3': 29, 'CAT4': 27, 'CAT5': 30, 'CAT6': 30, 'CAT7': 11, 'CAT8': 10, 'CAT9': 35}`
- CATs represented: CAT1, CAT2, CAT3, CAT4, CAT5, CAT6, CAT7, CAT8, CAT9
- CATs missing vs CAT1–CAT9: (none)

## Honesty notes

- `preference_pairs_worksheet.jsonl` is a bootstrap worksheet (250 pending, empty responses) — **not** a 71-pair human-judged corpus. Reward training must use human-authored pairs (spec line 478).
- Task claimed 71 pairs in worksheet; actual row count is 250.
- Task claimed 71 human-judged pairs; trainable file has 250 validate_pair-ok pairs.
- Training proceeds on `data/preference_pairs_ALL.jsonl` with 250 human-judged pairs.
