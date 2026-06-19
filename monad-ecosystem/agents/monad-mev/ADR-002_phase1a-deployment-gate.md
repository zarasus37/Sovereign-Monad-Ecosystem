# ADR-002: Phase 1a Deployment Readiness Gate Definition

**Status:** Proposed
**Date:** 2026-04-03
**Deciders:** Founder / architect
**Linked Issues:** ISSUE-001, ISSUE-002, ISSUE-003
**MOF Sections:** 6.1, 9.2, 9.4, 9.4.1, 10, 11, 13

---

## Context

Phase 1a currently has:
- 11 contracts reconstructed from the canonical MOF, surviving `DoveCore.sol`, and the Revenue Router specification
- 14 passing Hardhat tests covering routing invariants, Dove non-blocking behavior, governance pause paths, founder draw boundaries, and a deployment-sequence rehearsal
- A locked 21-step deployment sequence with a local runner
- Three open blockers (ISSUE-001, ISSUE-002, ISSUE-003)

The MOF states the current build gate as: *"Contracts Reconstructed → Test Expansion → Issue Resolution → Deployment."*

What the MOF does not yet specify precisely is: **what exact criteria must be true before the deployment sequence is executed on mainnet?** This ADR defines that gate.

This matters because the MOF's Implementation Honesty Principle (Section 3.6) requires that "contract-enforced" and "deployed" are never claimed before they are real. The deployment gate is the formal line between "reconstruction proven in local environment" and "live on-chain."

---

## Constraints (from MOF)

- Dove failure must never halt economic flow (Design Invariant 5)
- Every wei received must route atomically (Design Invariant 1 & 2)
- Treasury floor must remain enforced (Design Invariant 3)
- Allocation basis points must sum exactly (Design Invariant 4)
- No silent ETH ingress through `receive()` / `fallback()` (Design Invariant 6)
- Receiver/router addressing must lock after wiring (Design Invariant 7)
- The original Phase 1a source set was not recovered — the reconstruction must prove behavioral parity before being treated as equivalent
- Phase 1a is not closed until a true closed-loop exists: inflow → router → sinks → MEV → profits → router

---

## The Core Tension

There are two competing pressures:

**Pressure to deploy sooner:** Every day without a live router is a day without real capital data. The MEV engine needs a live bankroll feed. ISSUE-002 (real execution logic) cannot be fully resolved without real capital exposure. There is a bootstrap tension where the system cannot prove itself without being live, but it should not go live before it is proven.

**Pressure to harden further:** The reconstruction has not been compared line-by-line against a recovered original. The 13 tests are described as "meaningfully expanded and executable" but explicitly "not sufficient to classify Phase 1a as deployment-ready." If the contracts misbehave on mainnet, the damage is real capital, real routing failures, and real governance events.

The deployment gate must resolve this tension honestly.

---

## Options Considered

### Option A: Minimal Gate (deploy now with current 13 tests)

**Criteria:** Contracts compile, 13 tests pass, deployment sequence rehearsal passes locally.

| Dimension | Assessment |
|-----------|------------|
| Speed | Immediate |
| Risk | High — known coverage gaps, open blockers unresolved |
| Alignment with MOF | Violates Implementation Honesty Principle and Validation Principle (Section 3.2) |
| Capital at risk | Low initially if guarded-live profile is active and bankroll is minimal |

**Verdict:** Not acceptable. The MOF explicitly states the current suite is not deployment-ready. Proceeding would be a false validation failure mode (Section 17.5).

---

### Option B: Full Formal Gate (exhaustive coverage before any deployment)

**Criteria:** 100% branch coverage, formal verification of all invariants, all open issues closed, external audit complete, then deploy.

| Dimension | Assessment |
|-----------|------------|
| Speed | Slow — weeks to months |
| Risk | Low on deployment; high on project momentum |
| Alignment with MOF | Overcorrects — Phase 1a is not a production financial system at launch; it's a guarded bootstrap |
| Capital at risk | Minimal during guarded-live operation regardless |

**Verdict:** Not appropriate for Phase 1a's actual risk profile. The MOF is explicit that Phase 1a is a controlled, guarded-live deployment, not a public launch. External audit is a pre-Oracle-commercialization requirement (Layer 6), not a Phase 1a gate.

---

### Option C: Structured Readiness Gate (recommended)

A defined, finite list of criteria that must be true before deployment executes. Not exhaustive coverage for all time — sufficient coverage to confidently claim the seven design invariants hold under real conditions.

**Proposed gate criteria:**

#### Gate 1 — All Design Invariants Have Passing Tests

The seven Phase 1a design invariants (Section 9.4) must each have at least one dedicated test that fails if the invariant is violated:

| Invariant | Test Status (current) |
|-----------|----------------------|
| Atomic routing from InboundReceiver through all sinks | ✅ Covered (test 1) |
| Full router routing across all sinks | ✅ Covered (test 1) |
| Treasury floor enforcement | ✅ Covered (test 3) |
| Allocation basis points sum exactly | ✅ Covered (test 2 / test 3) |
| Dove failure does not halt economic flow | ✅ Covered (test 6) |
| No silent ETH ingress via fallback/receive | ✅ Covered (test 5) |
| Receiver/router addressing locks after wiring | ✅ Covered (test 4) |

**Assessment:** All 7 invariants appear covered by the current 13 tests. This gate may already be met. Confirm by mapping each test to its invariant explicitly.

#### Gate 2 — ISSUE-001 (Threshold Calibration) Resolved

The MEV bankroll threshold calibration must be verified under tested conditions before real capital is disbursed. An incorrect threshold at deployment means the MEV engine either receives too little capital (underperforms) or too much (overexposes early capital to unproven execution). This is a release-gating blocker for good reason.

**Required output:** documented threshold values, the test conditions they were validated under, and the criteria for adjusting them in production.

#### Gate 3 — ISSUE-003 (Price Feed) Resolved or Mitigated

The monad-market-agent must be stable before Phase 1a is considered closed-loop. Deployment without a stable feed means the closed-loop proof can never be demonstrated. However, the contract deployment itself does not depend on the price feed — only the MEV wire-up (Build Order Step 9) does.

**Resolution:** ISSUE-003 must be resolved before Step 9 (Wire RevenueSinkMEV to SMMEVAE), not before the initial contract deployment steps. This allows the 21-step deployment sequence to proceed through contract deployment while ISSUE-003 is being fixed in parallel.

#### Gate 4 — Guarded-Live Profile Active

A deployment safety profile must be defined and active. At minimum:
- Maximum single bankroll disbursement capped (tie to ISSUE-001 threshold resolution)
- Emergency governance pause tested and confirmed functional (test 9 covers this)
- Founder draw tested against boundaries (test 10 covers this)
- Multisig composition defined for Tier 3 Dove events, with founder holding less than blocking power

**Required output:** written guarded-live profile document specifying all live caps and the multisig composition.

#### Gate 5 — Deployment Sequence Dry-Run Passes on a Clean Network

The 21-step deployment sequence must execute cleanly against a fresh local or testnet environment with no manual interventions. The existing rehearsal in the test suite counts if it covers the full 21-step sequence end-to-end.

#### Gate 6 — ISSUE-002 Acknowledged and Staged (not required to close Phase 1a, but must be in active progress)

ISSUE-002 (real execution logic) is explicitly required for mainnet MEV operation and for Phase 1b. It does not block contract deployment. However, it must have a defined resolution path and owner before Phase 1a is called "live" — otherwise the ecosystem has deployed routing infrastructure with no connected engine.

**Required output:** documented execution logic design for production-grade MEV, with a clear timeline for guarded-live activation.

---

## Proposed Gate Summary

| Gate | Criterion | Current Status | Required Before |
|------|-----------|----------------|-----------------|
| G1 | All 7 design invariants have passing tests | Likely met — confirm mapping | Contract deployment |
| G2 | ISSUE-001 threshold calibration resolved | OPEN | Contract deployment |
| G3 | ISSUE-003 price feed stable | OPEN | Step 9 (MEV wire-up), not contract deployment |
| G4 | Guarded-live profile document written and active | NOT STARTED | Contract deployment |
| G5 | Deployment sequence dry-run passes on clean network | Partially met (rehearsal exists) | Contract deployment |
| G6 | ISSUE-002 execution logic in active progress with timeline | OPEN | Phase 1a "live" declaration |

---

## Trade-off Analysis

This gate structure reflects a key architectural insight: **contract deployment and MEV live activation are distinct events**. The MOF treats "Phase 1a live" as requiring the full closed loop, but the deployment sequence itself has 21 steps — the first 16 are pure contract infrastructure that do not touch the MEV engine at all.

Separating the deployment gate into two checkpoints:
- **Checkpoint A:** Deploy the 11 contracts (Gates G1, G2, G4, G5)
- **Checkpoint B:** Wire MEV and prove closed loop (Gate G3 must be resolved before this; G6 in progress)

...allows progress to continue on contract deployment while ISSUE-003 and ISSUE-002 are being resolved in parallel, without claiming false progress. This is not a workaround — it is an honest reading of the dependency structure.

---

## Consequences

**What becomes easier:**
- Clear, unambiguous definition of "deployment-ready" eliminates the ambiguity that has kept Phase 1a in limbo
- Separating contract deployment from MEV wire-up allows parallel progress on infrastructure and execution issues
- Gate G4 (guarded-live profile) ensures the first capital exposure is controlled

**What becomes harder:**
- The gate requires ISSUE-001 to be resolved before contract deployment, which may still take time
- The guarded-live profile document (G4) is a new artifact not yet in the repo

**What to revisit:**
- After Phase 1a is fully live: define Phase 1b entry gate using the same structure
- Before Phase 2 (MEV Mainnet): define a separate, more rigorous deployment gate for mainnet capital exposure

---

## Action Items

1. [ ] Map each of the 13 current tests to the 7 design invariants — confirm G1 is met or identify gaps
2. [ ] Write the guarded-live profile document (G4): max bankroll disbursement cap, multisig composition, emergency pause conditions
3. [ ] Resolve ISSUE-001: document threshold calibration values and validation conditions
4. [ ] Confirm deployment sequence dry-run executes clean on a fresh environment (G5)
5. [ ] Resolve ISSUE-003 in parallel (see ADR-001) — this gates Step 9, not Step 1
6. [ ] Begin documenting ISSUE-002 execution logic design (G6) — not blocking deployment but must be in active progress before Phase 1a is declared live
7. [ ] Once G1–G2 and G4–G5 are met: execute Steps 1–16 of the deployment sequence
8. [ ] Once G3 resolved: execute Steps 17–21, wire MEV, and run closed-loop proof
9. [ ] Update MOF Section 9.2 with this gate definition and tick status as items close
