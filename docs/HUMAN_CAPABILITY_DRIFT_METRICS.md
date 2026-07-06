# Human Capability Drift Metrics v0.1

> Operational draft for CHARTER.md §2.1 — *Human capability drift is observable.*
> These metrics are proposed proxies, not final KPIs. They are designed to be computable from existing data sources already present in the repo.

## Purpose

The Sovereign Monad Guardrail Charter (§2) states that the ecosystem must enable **mutual growth**: agents grow in capability while humans grow in insight, discernment, and skill. Drift occurs when agents get “smarter” while humans become less capable, less curious, or less engaged.

This document proposes five observable metrics that can be computed from existing artifacts and event logs. Negative sustained trends in any of them should trigger a charter review under CHARTER.md §2.1.

---

## Metric HCD‑1 — Human Review Queue Burden Rate

**Question:** Is the system pushing an increasing share of ambiguous work onto humans, or are humans staying ahead of the machine-classification boundary?

**Definition:**

```
HCD-1 = (events flagged for human review) / (total events processed in the same window)
```

**Data sources:**

- `logs/audit/human_review_queue.md` — historical queue snapshots and auto-accept rate.
- `logs/audit/correction_log_v5.10.json` — counts of items that required post-ML human correction.
- `monad-ecosystem/control-center/src/frontend/src/services/logoc-api.ts` — `pipeline_triage_status === "human_review"` field on `LogocEvent`.

**How to compute:**

1. Partition events by processing window (e.g., daily / weekly / per corpus version).
2. Count events where `pipeline_triage_status === "human_review"` or `peirce_migration_pending === true`.
3. Divide by total events in the window.

**Drift signals:**

- **Yellow:** HCD‑1 increases for three consecutive windows while auto-accept rate stays flat or falls.
- **Red:** HCD‑1 exceeds the historical 95th percentile for the domain *and* the human correction rate is also rising — humans are not just reviewing more, they are also catching more machine errors.

**Charter linkage:** §2.1 — humans must not be reduced to passive cleanup crews for agent output.

---

## Metric HCD‑2 — Override Fidelity Index

**Question:** When humans override machine classification, are their overrides becoming more accurate, or are they guessing?

**Definition:**

```
HCD-2 = (human overrides later validated as correct) / (total human overrides in the window)
```

**Data sources:**

- `logs/audit/correction_log_v5.10.json` — `corrections[]` entries show which reclassifications were applied (`action: "reclassify"`).
- `logs/audit/human_review_queue.md` — recommended resolutions and confidence tags.
- `monad-ecosystem/control-center/src/frontend/src/hooks/use-logoc.ts` — `HRDecision` store exports (`approved`, `reclassify`, `rejected`, `escalated`) with timestamps.

**How to compute:**

1. Collect every human decision in a window.
2. For reclassifications, compare to the next authoritative audit/corpus version (e.g., `correction_log_v5.10.json` vs `master_corpus_v5.10.jsonl`).
3. A decision is “validated correct” if it matches the later retained class or if the later audit explicitly kept it as-is with high rationale.
4. Weight by confidence: low-confidence overrides that turn out correct are still positive, but a string of low-confidence incorrect overrides is a stronger drift signal.

**Drift signals:**

- **Yellow:** HCD‑2 declines for two consecutive audit cycles.
- **Red:** HCD‑2 drops below 0.6 while the absolute number of overrides rises — humans are intervening more but understanding less.

**Interpreting a low value:** A low HCD‑2 value can mean either (a) humans are second‑guessing the ML boundary and usually wrong, or (b) the ML boundary is already well‑calibrated, so most human review decisions correctly leave events unchanged. Do not treat the number alone as a performance score; compare it against the auto‑accept rate and the distribution of ML confidence for the reviewed events.

**Charter linkage:** §2 — humans must grow in discernment; declining override fidelity is evidence of the opposite.

---

## Metric HCD‑3 — Human-Initiated Query Diversity

**Question:** Is the human still asking original questions, or is the human vocabulary narrowing toward a small set of pre-canned prompts?

**Definition:**

```
HCD-3 = normalized entropy of unique human-initiated command/query templates
      = - Σ p(t) log(p(t)) / log(N)
```

where `p(t)` is the frequency of query template `t` and `N` is the number of distinct templates in the window.

**Data sources:**

- `@sovereign/bus` event logs filtered by `trace.source` values that mark a human origin (e.g., `control-center`, `operator-ui`, `human-review`, `manual-override`).
- `agent.action.taken` events where `trace.intentionId` contains a human-authored intention.
- `dove.signal.tier1` / `dove.signal.tier2` review events initiated by a human analyst.
- In the short term, query templates can be derived from Control Center localStorage interaction telemetry and git commit messages authored by humans.

**How to compute:**

1. Extract human-originated events from the bus or UI logs.
2. Normalize command/query strings into templates (remove literal IDs, amounts, dates).
3. Compute Shannon entropy over template frequencies, normalized by the log of the number of distinct templates.

**Drift signals:**

- **Yellow:** HCD‑3 declines for three consecutive windows.
- **Red:** HCD‑3 falls below 0.4 *and* the top three templates account for more than 60% of human-initiated activity.

**Charter linkage:** §2.1 — diversity of human-initiated queries is explicitly listed as a capability proxy.

---

## Metric HCD‑4 — Reasoning Exposure Ratio

**Question:** Before approving or acting, do humans inspect the agent’s reasoning and intention trace?

**Definition:**

```
HCD-4 = (human approvals preceded by reasoning/trace inspection)
      / (total human approvals in the window)
```

**Data sources:**

- `trace.intentionId` on `agent.action.taken` events in `@sovereign/bus` logs.
- `dove.signal.tier1` / `dove.signal.tier2` events and their review timestamps.
- Control Center `HRDecision` store: an approval is “preceded by inspection” if a human opened the event detail / triad inspector (`ReviewEventCard` expand) within the same session before recording the decision.
- `hepar.audit.completed` / `hepar.audit.finding` logs where the audit trace was read before sign-off.

**How to compute:**

1. Pair each human approval/reclassify decision with the preceding UI or log session for the same `intentionId` / `eventId`.
2. Count approvals where the human viewed the intention trace, triad alternatives, or audit rationale within a bounded lookback (e.g., 10 minutes).
3. Divide by total approvals.

**Drift signals:**

- **Yellow:** HCD‑4 declines for two consecutive windows.
- **Red:** HCD‑4 drops below 0.3 on consequential event types listed in `TRACE_REQUIRED_EVENT_TYPES` (`@sovereign/bus` `traceability.ts`) — humans are rubber-stamping high-stakes agent actions.

**Charter linkage:** §2 — tooling must expose reasoning and invite participation, not reduce humans to spectators.

---

## Metric HCD‑5 — Meaningful Correction Latency

**Question:** How long does it take from a drift signal to a human-initiated corrective action?

**Definition:**

```
HCD-5 = median time from first drift signal
        to first recorded human corrective action in the same scope
```

**Data sources:**

- `dove.signal.tier1` and `dove.signal.tier2` events in `@sovereign/bus` logs.
- `hepar.audit.finding` events that are not auto-resolved.
- `gnosis.quarantine.triggered` / `gnosis.blink.triggered` events.
- Human corrective actions recorded in `logs/audit/correction_log_v5.10.json` (`applied_at` timestamp) or in the Control Center `HRDecision` store (`decidedAt`).

**How to compute:**

1. Identify drift signals in a window.
2. For each signal, find the earliest recorded human corrective action in the same scope (same agent, same intention family, same contract, or same corpus batch).
3. Compute median latency per window.

**Drift signals:**

- **Yellow:** median HCD‑5 increases by more than 50% over the previous window.
- **Red:** median HCD‑5 exceeds 72 hours for Tier 2 governance-trigger signals without an explicit documented deferral.

**Charter linkage:** §6 — humans must have genuine leverage over outcomes; delayed or absent correction is evidence that leverage is becoming ceremonial.

---

## Suggested Dashboard Layout

| Metric | Primary source | Update cadence | Yellow threshold | Red threshold |
|---|---|---|---|---|
| HCD‑1 Burden Rate | `human_review_queue.md`, `pipeline_triage_status` | per corpus window | > 15% burden OR auto-accept < 85% | > 25% burden |
| HCD‑2 Override Fidelity | `correction_log_v5.10.json`, `HRDecision` export | per audit cycle | < 0.8 | < 0.6 |
| HCD‑3 Query Diversity | Bus logs + UI telemetry | weekly | < 0.5 normalized entropy | < 0.4 normalized entropy AND top-3 template share > 60% |
| HCD‑4 Reasoning Exposure | `trace.intentionId` + UI session logs | per action window | < 0.8 traced on `TRACE_REQUIRED_EVENT_TYPES` | < 0.3 traced on `TRACE_REQUIRED_EVENT_TYPES` |
| HCD‑5 Correction Latency | `dove.signal.tier*`, `HRDecision` timestamps | per signal window | median > 24 hours | median > 72 hours for Tier 2 signals |

These thresholds are also encoded in `monad-ecosystem/packages/hcd-monitor/src/config/thresholds.ts`. They are versioned in source so that any change to what "healthy" drift looks like must go through review.

---

## Implementation Notes

1. **Mechanical first, council second.** Wherever a metric can be computed by a LOGOC/audit script, it should be. Ambiguous cases (e.g., whether a query was “meaningful”) go to the Steward Council per CHARTER.md adjudication rules.
2. **Start with existing files.** The first implementation can run entirely against the current static audit artifacts (`human_review_queue.md`, `correction_log_v5.10.json`, and the Control Center `HRDecision` export) before requiring live bus ingestion.
3. **No punitive use.** These metrics are diagnostic, not performance-review weapons. They exist to detect structural drift, not to rank individual humans.
4. **Version and review.** This document is v0.1. After one full audit cycle of data, the Steward Council should review whether the thresholds and sources are correct.

---

## Related Documents

- [`docs/CHARTER.md`](./CHARTER.md) §2, §2.1 — Mutual growth and human capability drift.
- [`docs/SHARED_AI_COLLABORATION_CHARTER.md`](./SHARED_AI_COLLABORATION_CHARTER.md) — AI collaborator obligations to preserve human agency.
- [`monad-ecosystem/packages/sovereign-bus/src/traceability.ts`](../monad-ecosystem/packages/sovereign-bus/src/traceability.ts) — `TRACE_REQUIRED_EVENT_TYPES` referenced by HCD‑4.
- [`logs/audit/human_review_queue.md`](../logs/audit/human_review_queue.md) — primary source for HCD‑1 and HCD‑2.
- [`logs/audit/correction_log_v5.10.json`](../logs/audit/correction_log_v5.10.json) — primary source for HCD‑2 and HCD‑5.
- [`monad-ecosystem/control-center/src/frontend/src/hooks/use-logoc.ts`](../monad-ecosystem/control-center/src/frontend/src/hooks/use-logoc.ts) — `HRDecision` store shape referenced by HCD‑2, HCD‑4, and HCD‑5.
