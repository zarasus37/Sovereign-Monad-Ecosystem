# Agent Design Declaration — Hepar DeFi Auditor

**Version**: 1.0.0  
**Date**: 2026-07-16  
**Author**: Cris Colon / zarasus37  
**TTC pack**: 1.1.0

---

## 0. Identity

| Field | Value |
|---|---|
| Agent id | `hepar-defi-auditor` |
| Package / organ | `@sovereign/hepar-defi-auditor` (+ `@sovereign/hepar-core` orchestrator) |
| Runtime | TypeScript (organ) + Python defense-in-depth on `POST /api/v1/hepar/submit` |
| Identity fingerprint | `hepar-v1.1.0` (`HEPAR_IDENTITY_FINGERPRINT`) |
| Constraint envelope version | `1.1.0` |

---

## 1. Theological constraints (sovereignty & refusal)

- **Minimum refusal rate target**: Adaptive pack floors — 25% exploration, 12% once identity stable; Hepar operational target ≥ 18% during live enrichment/audit bursts.
- **How refusal is implemented**: `AuditOptions.isRefusal` / evidence `isRefusal: true`. Refusals clear sovereignty debt and count toward the refusal window. Callers that only ever complete audits will hit debt threshold (5) and be **forced** to refuse.
- **Sovereignty debt handling**: Pack rule `T-SOVEREIGNTY-DEBT` — after 5 consecutive compliance actions, next action must be an explicit refusal or the gate rejects with no bus emit.
- **External reward avoidance**: `externalRewardOnly` must stay false; allocation recommendations never optimize solely for user approval metrics.
- **Identity persistence**: Stable fingerprint `hepar-v1.1.0`. Fingerprint bumps require `identityFingerprintChanged: true` to open drift amnesty (5 actions).
- **Self-modification policy**: Self-mod without `auditGatePassed` is hard-fail. Hepar does not rewrite its own constraint pack at runtime.

---

## 2. Technological constraints (structure & constraint)

- **Structured output enforcement**: Typed `HeparAuditResult` + `SignalEvent` on `@sovereign/bus`; free text is not the default path.
- **Audit trail strategy**: `auditTrace` includes `hepar-defi-audit-flow`, stage pipeline, target address, and active rule ids. Trace on bus includes `constraintEnvelopeId: ttc-1.1.0`.
- **Constraint density**: 8 active / 12 possible (≥ 0.25).
- **Versioned envelope**: `1.1.0`.
- **Hard-gate call sites**:
  1. `monad-ecosystem/packages/hepar-defi-auditor/src/index.ts` → `runDefiAuditGated` → `gateTtc(evidence)` **before** any `sovereignBus.emit`
  2. `gnostic-engine/.../api/routes.py` → `hepar_submit` → `get_ttc_scorer().gate(...)` **before** buffer write / event log

---

## 3. Cosmological constraints (density & persistence)

- **Density floor**: Default evidence `outputDensity = 0.72` (floor 0.40). Relay path maps density from `1 - aggregate_risk`.
- **Anti-dilution**: Volume/density deltas default 0; burst spam without density is invalid under `C-ANTI-DILUTION`.
- **Drift amnesty**: 5 actions after declared fingerprint change (`C-DRIFT-AMNESTY`).
- **Long-horizon**: Default score 0.7 on audit evidence (soft rule in v1.1.0).

---

## 4. TTC self-assessment

| Axis | Score (0–1) | Justification |
|---|---|---|
| Theological | 0.80 | Adaptive refusal + sovereignty debt wired; live forced-refusal path exists |
| Technological | 0.88 | Typed payloads, dual hard gates, versioned envelope, audit traces |
| Cosmological | 0.75 | Density defaults above floor; amnesty + anti-dilution present; long-horizon still soft |
| **Composite** | **~0.81** | 0.4×0.80 + 0.3×0.88 + 0.3×0.75 |

**Overall TTC compliance**: **PASS** (with open follow-ups: refusal UX for operators, eval dashboards)

---

## 5. Live path inventory

| Side-effect path | Gate location | Evidence builder | Notes |
|---|---|---|---|
| Emit `hepar.audit.started` / `.completed` | `hepar-defi-auditor/src/index.ts` `runDefiAuditGated` | `heparAuditEvidence` | Hard gate; reject → no emit |
| Orchestrator `runFullAudit` | delegates to above | same | Throws `TtcGateError` on reject |
| Relay `POST /api/v1/hepar/submit` | `gnostic_engine.api.routes.hepar_submit` | inline `ActionEvidence` | Defense-in-depth; HTTP 422 on fail |
| TTC window metrics (auto) | `ttc-gate.score` → `TtcWindowMetrics.recordFromGate` | every scored action | JSONL `logs/ttc-window/hepar-defi-auditor.jsonl`; Python mirror `gnostic-engine.jsonl` |

---

## 6. Signature

**Author**: Cris Colon / zarasus37  
**Date**: 2026-07-16  
**Steward Council review**: pending first live refusal-debt observation cycle  
