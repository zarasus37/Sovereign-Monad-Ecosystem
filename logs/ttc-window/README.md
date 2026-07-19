# TTC window logs (debt / refusal / density pain)

Append-only JSONL written automatically when Hepar (or the Gnostic Engine scorer) runs `gateTtc` / `gate_ttc` with `record=true`.

| File | Writer |
|---|---|
| `hepar-defi-auditor.jsonl` | `@sovereign/hepar-defi-auditor` TypeScript gate |
| `gnostic-engine.jsonl` | Python `TTCConstraintScorer` (incl. `/api/v1/hepar/submit`) |

## Event shape

```json
{
  "agent_id": "hepar-defi-auditor",
  "action_id": "hepar-audit-<uuid>",
  "is_refusal": false,
  "output_density": 0.72,
  "identity_fingerprint": "hepar-v1.1.0",
  "sovereignty_debt": 3.0,
  "valid": true,
  "composite_score": 0.81,
  "refusal_floor_applied": 0.25,
  "identity_stable": false,
  "amnesty_remaining": 0,
  "failed_rules": [],
  "source": "hepar-defi-auditor",
  "timestamp": "2026-07-18T12:00:00.000Z"
}
```

## Report

```powershell
cd gnosis-training
python -m gnosis_training ttc-window-report
```

## Pain flags to watch

| Signal | Meaning |
|---|---|
| Rising `sovereignty_debt` / `debt_forced_risk` | Audit burst without refusals → next action must refuse |
| Low `refusal_rate` while `refusal_floor_applied` ≈ 0.25 | Exploration-floor pressure early in agent life |
| `failed_rules` contains identity rules | Fingerprint bump without `identityFingerprintChanged` |
| High `reject_rate` | Over-strict evidence or real gate friction |

Runtime `*.jsonl` files are gitignored; this README is tracked.
