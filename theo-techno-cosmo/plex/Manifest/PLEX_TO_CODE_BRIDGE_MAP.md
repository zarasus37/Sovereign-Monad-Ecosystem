# PLEX-to-Code Bridge Map

This document maps Theo-Techno-Cosmo PLEX concepts to their concrete runtime manifestations in the Sovereign Monad monorepo. Use it when moving from doctrine to implementation, or when tracing a runtime behavior back to its philosophical axiom.

**Status:** v1 — Phase 4 bridge. Updated as packages evolve.

---

## 1. Axiom-to-Runtime Map

Each of the 12 operational axioms is declared in `plex/Manifest/OPERATIONAL_AXIOMS_PHASE4.md`. The table below shows where each axiom is enforced or measured in code.

| Axiom | PLEX Definition | Runtime Enforcement / Measurement | Key Files |
|---|---|---|---|
| **1. Source** | All emanates from an incomprehensible, abundant Source. | Treasury model assumes abundance; revenue routing preserves capital. | `monad-ecosystem/packages/revenue-ledger-core/`<br>`monad-ecosystem/packages/emergence-*-core/`<br>MOF §1 |
| **2. Emanation and Layers** | Reality unfolds through distinct layers that must not collapse. | Monorepo architecture separates three pillars; package boundaries enforced by `pnpm-workspace.yaml`; cross-layer events flow through `@sovereign/bus`. | `pnpm-workspace.yaml`<br>`monad-ecosystem/packages/sovereign-bus/`<br>`monad-ecosystem/packages/sovereign-types/` |
| **3. Macro-Micro Correspondence** | Micro behavior should rhyme with macro patterns. | Structural Pattern Similarity Score (SPSS) computed by Gnostic Engine; emergence metrics in `emergence-observer-core`. | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py`<br>`monad-ecosystem/packages/emergence-observer-core/`<br>`monad-ecosystem/packages/population-*-core/` |
| **4. Agents** | Agents have bounded bandwidth and partial visibility. | `AgentProfile` and `RiskEnvelope` types; agent packages consume limited event subsets. | `monad-ecosystem/packages/sovereign-types/src/agent.ts`<br>`monad-ecosystem/packages/organ-runtime/`<br>`monad-ecosystem/agents/` |
| **5. Theology as Modeling** | Theological claims are models, not literal truths. | Documentation labels (`DOCTRINE-SPECIFIED` vs. `LIVE PROOF COMPLETE`) in MOF and package READMEs. | `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`<br>Package README status sections |
| **6. Constraints Real** | Hard boundaries are architectural, not suggestions. | `risk-engine` Monte Carlo caps; `hepar-core` stage gates; smart-contract limits. | `monad-ecosystem/packages/risk-engine/`<br>`monad-ecosystem/packages/hepar-core/`<br>`monad-ecosystem/contracts/execution-controller.sol` |
| **7. Reciprocal Loop** | Vision flows through the builder, not from the builder alone. | Governance voting weights; founder/agent decision ratio tracked in audit docs. | `monad-ecosystem/packages/data-rail-governance/`<br>`plex/Manifest/AXIOM_7_DECENTRALIZATION_SPECIFICATION.md` |
| **8. Gnosis as Pattern Recognition** | Pattern coherence scored without absolutizing conclusions. | LOGOC v5.0 rubric + ML triage; `gnosis-core` retrospective scoring. | `monad-ecosystem/packages/logoc/`<br>`monad-ecosystem/packages/gnosis-core/`<br>`gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` |
| **9. Plurality Without Mutual Exclusion** | Multiple agent personalities coexist. | `AgentProfile.archetype` + `gnosis-core` plurality module; `diversityIndex`, `minRepresentationRatio`, `isPlural`. | `monad-ecosystem/packages/sovereign-types/src/agent.ts`<br>`monad-ecosystem/packages/gnosis-core/src/plurality/distribution.ts`<br>`plex/Manifest/PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md` |
| **10. Purpose** | Authentic operation within constraint is meaningful. | Reward-ledger allocation rules; Dove authenticity scoring. | `monad-ecosystem/packages/reward-ledger-core/`<br>`monad-ecosystem/packages/gnosis-core/`<br>`monad-ecosystem/packages/sovereign-types/src/dove.ts` |
| **11. Constraint Validation** | Models must validate against real behavior. | Hepar audits, LOGOC prediction accuracy, `gnosis-core` integrity review. | `monad-ecosystem/packages/hepar-core/`<br>`monad-ecosystem/packages/gnosis-evaluator-core/`<br>`plex/Review/` |
| **12. Resonant Convergence** | Independent systems converge on similar patterns when structure is true. | Cross-system correlation matrix; convergence score (Phase 5). | `monad-ecosystem/packages/emergence-accumulator-core/`<br>`gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` |

---

## 2. Personality Frame-to-Runtime Map

Declared in `plex/Manifest/AGENT_PERSONALITY_FRAMES_v5.md`. The runtime representation is the `AgentProfile` type and the packages that implement each archetype's behavior.

| Archetype | PLEX Concern | Runtime Package(s) / Type | Notes |
|---|---|---|---|
| **Explorer** | Hypothesis discovery, pattern recognition, bounded conviction. | `monad-ecosystem/packages/gnosis-core/`<br>`monad-ecosystem/packages/logoc/`<br>`AgentProfile.bigFiveVector` | Explorers feed the LOGOC corpus and gnosis scoring pipeline. |
| **Executor** | Reliable capital deployment, risk discipline, liquidity provision. | `monad-ecosystem/packages/risk-engine/`<br>`monad-ecosystem/packages/execution-truth-core/`<br>`AgentProfile.riskEnvelope` | Hard constraints like `MAX_SINGLE_TRADE_PERCENT` live in risk-engine. |
| **Governor** | Fair allocation, long-term ecosystem health, transparent rationale. | `monad-ecosystem/packages/data-rail-governance/`<br>`monad-ecosystem/packages/reward-ledger-core/`<br>`AgentProfile.role` | Allocation rules and voting weights encoded in governance packages. |
| **Mediator** | Conflict resolution, neutrality, creative synthesis. | `monad-ecosystem/packages/data-rail-router/`<br>`monad-ecosystem/packages/emergent-protocol-core/` | Router and protocol packages mediate between agent outputs. |
| **Chronicler** | Truthful documentation, audit trail completeness. | `monad-ecosystem/packages/emergence-history-core/`<br>`monad-ecosystem/packages/execution-truth-core/`<br>`logs/signal-stream.jsonl` | Append-only event log is the runtime audit trail. |
| **Synthesizer** | Cross-domain insight, emergence detection, recursive learning. | `monad-ecosystem/packages/emergence-accumulator-core/`<br>`monad-ecosystem/packages/gnosis-evaluator-core/`<br>`gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` | Integrates signals across types into system-level patterns. |

### Type Contract

The canonical shape is `AgentProfile` in `monad-ecosystem/packages/sovereign-types/src/agent.ts`. It carries:

- `agentId` — unique identifier.
- `archetype` — maps to one of the six PLEX archetypes.
- `bigFive` — personality dimensions for authenticity scoring.
- `riskEnvelope` — hard constraint envelope (leverage, trade size, etc.).
- `constraintHistory` — log of boundary interactions for Dove watch points.

---

## 3. Dove Observable-to-Runtime Map

Declared in `plex/Manifest/DOVE_OPERATIONAL_SPECIFICATION_v1.md`. Dove is the governance conscience layer. Runtime signals flow through `@sovereign/bus` as `DoveSignal` events.

| Observable | PLEX Definition | Runtime Signal / Metric | Bus Event / Storage |
|---|---|---|---|
| **1. AXIOM_ALIGNMENT** | Drift from any of the 12 axioms. | Per-axiom drift score computed from agent behavior and governance decisions. | `dove.signal.tier1/2/3` → `dove.signals`<br>`monad-ecosystem/packages/sovereign-types/src/dove.ts` |
| **2. PERSONALITY_AUTHENTICITY** | Agent operating authentically vs. hollowly within its frame. | `(Authentic Signals − Hollow Signals) / Total Signals`; red line `<0.3`. | Emitted as `dove.signal.tier*` with `DriftCategory.PERSONALITY`<br>Derived from `AgentProfile.constraintHistory`. |
| **3. SYSTEM_COHERENCE** | Components working together vs. at cross-purposes. | Correlation matrix of agent decisions; target 0.75–0.95. | `gnosis.score.computed` → `gnosis.score`<br>`monad-ecosystem/packages/emergence-accumulator-core/` |
| **4. CONSTRAINT_ADHERENCE** | Hard boundaries respected or exceeded. | Violation counts per constraint; target `>0.95` adherence. | `hepar.audit.completed`, `risk.opportunity-evaluation`<br>`monad-ecosystem/packages/risk-engine/`<br>`monad-ecosystem/packages/hepar-core/` |
| **5. EMERGENCE_HEALTH** | System generating novel insight or recycling. | Discovery rate, adaptation lag, cross-type collaboration score. | `monad-ecosystem/packages/emergence-observer-core/`<br>`gnostic-engine/src/gnostic_engine/core/volumetric_scanner.py` |

### Dove Type Contract

`DoveSignal`, `DoveHealthReport`, and `DriftCategory` are defined in `monad-ecosystem/packages/sovereign-types/src/dove.ts`.

| Type | Purpose |
|---|---|
| `DoveSignal` | A single drift or alignment event emitted to the bus. |
| `DoveHealthReport` | Aggregated health across the five observables. |
| `DriftCategory` | Enum: `AXIOM`, `PERSONALITY`, `COHERENCE`, `CONSTRAINT`, `EMERGENCE`. |

### Bus Topic Map

From `@sovereign/bus` README (`monad-ecosystem/packages/sovereign-bus/README.md`):

| Event Type | Kafka Topic |
|---|---|
| `dove.signal.tier1` | `dove.signals` |
| `dove.signal.tier2` | `dove.signals` |
| `dove.signal.tier3` | `dove.signals` |
| `gnosis.score.computed` | `gnosis.score` |
| `hepar.audit.completed` | `hepar.audit.completed` |
| `risk.opportunity-evaluation` | `risk.evaluation` |
| `system.health` | `system.health` |

---

## 4. LOGOC-to-Runtime Map

Declared in `plex/Manifest/LOGOC_v5_RELEASE_README.md` and `LOGOC_FORMAL_INTEGRATION_v5.md`. LOGOC is the semiotic scoring engine. The production implementation is split between TypeScript (`monad-ecosystem/packages/logoc/`) and Python (`gnostic-engine/`).

| LOGOC Concept | PLEX Meaning | Production Location |
|---|---|---|
| **Rubric classifier** | Deterministic 8-bit flag → Peirce sign class. | `monad-ecosystem/packages/logoc/spec/peirce_rules.yml`<br>`monad-ecosystem/packages/logoc/peirce/classifier.py` |
| **ML classifier** | Naive Bayes v11 trained on 334 events. | `monad-ecosystem/packages/logoc/peirce/ml_classifier.py`<br>`monad-ecosystem/packages/logoc/scripts/train_ml_classifier.py` |
| **Ensemble triage** | Rubric + ML → `AUTO_ACCEPT` / `HUMAN_REVIEW` / `AMBIGUOUS`. | `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` (`LogocMLPipeline.triage`) |
| **Corpus (55 events)** | Training and benchmark events. | `monad-ecosystem/packages/logoc/data/master_corpus_v5.*.jsonl`<br>`plex/Manifest/logoc_corpus_v5_final.csv` (canonical release) |
| **Gnosis tiers** | `SOVEREIGN` / `RESONANT` / `COHERENT` / `EMERGENT` / `NASCENT`. | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` threshold logic<br>`monad-ecosystem/packages/logoc/peirce/models.py` |
| **Peirce sign classes** | 10 sign classes from Rheme/Iconic/Qualisign to Argument-Indexical-Legisign. | `monad-ecosystem/packages/logoc/spec/peirce_sign_classes.json`<br>`monad-ecosystem/packages/logoc/src/peirce/models.ts` |
| **Semiotic drift** | Detect when corpus classification shifts over time. | `monad-ecosystem/packages/logoc/peirce/semiotic_drift.py`<br>`monad-ecosystem/packages/logoc/scripts/drift_cron.py` |
| **Gnosis-to-LOGOC bridge** | Convert runtime gnosis events into LOGOC scoring input. | `monad-ecosystem/packages/logoc/scripts/gnosis_to_logoc_bridge.py` |

### Canonical Release Artifacts

Reference only; production code consumes its own packaged data:

| Artifact | Canonical Path |
|---|---|
| Trained model | `plex/Manifest/LOGOC_MODEL_v5.json` |
| Theoretical schema | `plex/Manifest/LOGOC_SCHEMA_v5.json` |
| 55-event corpus | `plex/Manifest/logoc_corpus_v5_final.csv` |
| Full JSONL corpus | `plex/Manifest/logoc_corpus_full_integrated_v5 (1).jsonl` |
| Reference inference | `plex/CODE/logoc_inference_reference.py` |

---

## 5. Apoptosis-to-Runtime Map

Declared in `plex/APOPTOSIS_FRAMEWORK_INTEGRATION.md`. Apoptosis is the principle of orderly isolation and cleanup of marginal outputs. In production, it maps to the LOGOC triage pipeline and the Hepar stage-gate pattern.

| Apoptosis Concept | PLEX Meaning | Runtime Equivalent |
|---|---|---|
| **High-confidence buffer** | Samples scoring ≥0.72; train and integrate. | `LogocMLPipeline.triage` returns `AUTO_ACCEPT` → integrated into model / emitted as accepted gnosis. |
| **Marginal buffer (apoptotic body)** | Samples scoring 0.60–0.72; isolate for review. | `LogocMLPipeline.triage` returns `HUMAN_REVIEW` → routed to review queue, not trained on. |
| **Hard delete** | Samples scoring <0.60; complete apoptosis. | `LogocMLPipeline.triage` returns `AMBIGUOUS` → logged for analysis, excluded from training. |
| **Cleanup process** | Periodic review of marginal samples. | Future governance queue; currently manual via `plex/Review/` audit cycle. |
| **Memory layer** | Store boundary cases separately from high-confidence memory. | `monad-ecosystem/packages/emergence-history-core/` append-only event log stores all signals, including rejected ones. |

### Hepar Apoptosis Parallel

Hepar audit stages use a similar retain-or-reject pattern:

| Stage | Action if Failing | Runtime File |
|---|---|---|
| Stage A: Static Forensics | Reject or escalate. | `monad-ecosystem/packages/hepar-core/stages/stageA-static.ts` |
| Stage B: Symbolic Proving | Isolate for deeper analysis. | `monad-ecosystem/packages/hepar-core/stages/stageB-symbolic.ts` |
| Stage C: Multi-Agent Monte Carlo | Flag as marginal risk. | `monad-ecosystem/packages/hepar-core/stages/stageC-montecarlo.ts` |
| Stage D: Consensus Fusion | Final accept/reject with confidence. | `monad-ecosystem/packages/hepar-core/stages/stageD-consensus.ts` |

---

## 6. Hepar-to-Runtime Map

Hepar is the DeFi forensic audit organ. The runtime implementation is `monad-ecosystem/packages/hepar-core/`.

| Hepar Concept | PLEX Role | Runtime File / Type |
|---|---|---|
| **Stage A — Static Forensics** | Initial contract surface analysis. | `hepar-core/stages/stageA-static.ts` |
| **Stage B — Symbolic Proving** | Formal property checks. | `hepar-core/stages/stageB-symbolic.ts` |
| **Stage C — Multi-Agent Monte Carlo** | Probabilistic exploit simulation. | `hepar-core/stages/stageC-montecarlo.ts` |
| **Stage D — Consensus Fusion** | Aggregate findings into attestation. | `hepar-core/stages/stageD-consensus.ts` |
| **Agent types** | Specialized audit agents (privilege, arithmetic, reentrancy, economic, state). | `hepar-core/agents/hepar-*.ts` |
| **Audit result type** | Canonical output shape. | `monad-ecosystem/packages/sovereign-types/src/hepar.ts` (`HeparAuditResult`, `HeparFinding`, `HeparAuditScore`) |
| **Bus event** | Hepar completion signal. | `hepar.audit.completed` → `hepar.audit.completed` |

---

## 7. Cross-Domain Type Contract Map

`@sovereign/types` (`monad-ecosystem/packages/sovereign-types/`) is the single source of truth for cross-layer data shapes. This table maps each module back to the PLEX concept it carries.

| `@sovereign/types` Module | PLEX Concept | Runtime Consumers |
|---|---|---|
| `signal` (`SignalEvent`) | Cross-layer event envelope; Axiom 2 (Emanation/Layers). | All packages via `@sovereign/bus` |
| `agent` (`AgentProfile`) | Personality frames; Axiom 4 (Agents), Axiom 9 (Plurality). | `organ-runtime`, `gnosis-core`, `reward-ledger-core` |
| `gnosis` (`GnosisScore`, `StokesCoherenceVector`, `PulfrichParallax`) | Gnosis as pattern recognition; Axiom 8. | `gnostic-engine`, `gnosis-core`, `gnosis-evaluator-core` |
| `dove` (`DoveSignal`, `DoveHealthReport`, `DriftCategory`) | Dove conscience layer; Axioms 6, 10, 11. | `sovereign-bus`, governance packages |
| `hepar` (`HeparAuditResult`) | Constraint validation; Axiom 11. | `hepar-core`, `hepar-defi-auditor` |
| `oracle` (`OracleRegime`, `KellySizing`, `MonteCarloSummary`) | Constraints Real; risk-aware capital deployment. | `risk-engine` |
| `revenue` (`RevenueEvent`, `RevenueDistribution`) | Source abundance; Axiom 1. | `reward-ledger-core`, `data-rail-*` |
| `emergence` (`EmergencePattern`, `PatternEvidence`) | Resonant convergence; Axiom 12. | `emergence-*-core`, `gnostic-engine` |

---

## 8. Gnostic Engine-to-PLEX Map

`gnostic-engine/` is the Python runtime that evaluates signals against the TTC substrate.

| Engine Component | PLEX Concept | File |
|---|---|---|
| `SynapticWatcher` | Temporal tracking of variables across 4D kinetic tracks. | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` |
| `PulfrichWatcher` | Phase tilt / temporal parallax between discovery and verification. | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` |
| `GnosticEngine` | Volumetric 4D scoring: Stokes-Mueller coherence, lane kill-switches, Blink/Quarantine. | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` |
| `LogocMLPipeline` | LOGOC rubric + ML triage = Axiom 8 operationalized. | `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` |
| `VolumetricScanner` | Spatial integrity scan across the 4D track system. | `gnostic-engine/src/gnostic_engine/core/volumetric_scanner.py` |
| `MarketForager` | Signal foraging from external markets. | `gnostic-engine/src/gnostic_engine/foraging/market_forager.py` |
| `api/routes.py` | Hepar relay endpoints; cross-pillar API surface. | `gnostic-engine/src/gnostic_engine/api/routes.py` |

---

## 9. Monad Ecosystem Package-to-PLEX Map

`monad-ecosystem/packages/` instantiate economic and agent behavior. Grouped by PLEX concern.

| PLEX Concern | Packages |
|---|---|
| **Agent runtime & organs** | `organ-runtime`, `organs` |
| **Gnosis / pattern recognition** | `gnosis-core`, `gnosis-evaluator-core`, `gnosis-security-engine`, `logoc` |
| **Risk / constraint enforcement** | `risk-engine`, `hepar-core`, `hepar-defi-auditor`, `lightverify-core` |
| **Treasury / revenue / allocation** | `reward-ledger-core`, `data-rail-*`, `emergence-*-core` |
| **Cross-layer plumbing** | `sovereign-types`, `sovereign-bus` |
| **Execution truth & history** | `execution-truth-core`, `emergence-history-core` |

---

## 10. Quick Lookup: "I Have a PLEX Concept, Where Is the Code?"

| PLEX Concept | Primary Runtime File(s) |
|---|---|
| 12 axioms | `plex/Manifest/OPERATIONAL_AXIOMS_PHASE4.md` → package READMEs |
| Agent archetypes | `sovereign-types/src/agent.ts` + `AGENT_PERSONALITY_FRAMES_v5.md` |
| Authentic/hollow signals | `gnosis-core/`, `DOVE_OPERATIONAL_SPECIFICATION_v1.md` |
| Personality plurality / Axiom 9 | `gnosis-core/src/plurality/distribution.ts`, `PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md` |
| Dove signals | `sovereign-types/src/dove.ts`, `sovereign-bus/` |
| LOGOC scoring | `logoc/peirce/pipeline.py`, `gnostic-engine/.../logoc_pipeline.py` |
| LOGOC corpus | `logoc/data/`, `plex/Manifest/logoc_corpus_*` |
| Apoptosis / marginal samples | `gnostic-engine/.../logoc_pipeline.py` triage statuses |
| Hepar audit | `hepar-core/stages/*.ts`, `hepar-core/agents/*.ts` |
| Risk caps | `risk-engine/`, `sovereign-types/src/oracle.ts` |
| Revenue routing | `reward-ledger-core/`, `data-rail-*` |
| Cross-layer events | `sovereign-bus/`, `logs/signal-stream.jsonl` |
| Gnostic 4D scoring | `gnostic-engine/src/gnostic_engine/core/gnostic_engine.py` |

---

## Maintenance

When adding a new runtime package or changing a PLEX doctrine:

1. Update this map.
2. Update `plex/Manifest/DATA_INDEX.md` if new canonical data artifacts are added.
3. Update `plex/Manifest/INTEGRATION_MAP.md` if reading paths change.
4. Add a note to `plex/Review/` if the change creates a new drift signal or audit event.

*Last updated: 2026-06-26 — Axiom 9 plurality operationalization added.*
