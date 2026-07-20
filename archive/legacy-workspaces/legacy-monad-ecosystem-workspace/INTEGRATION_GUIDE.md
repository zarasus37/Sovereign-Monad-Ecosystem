# The Sovereign Monad Ecosystem — Integration & Migration Guide

## Overview

This document explains how the archived legacy workspace relates to:
1. **Legacy folder structure** (`gnostic-engine/`, `theo-techno-cosmo/`, `monad-ecosystem/`)
2. **Master Operating File (MOF)** (`docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`)
3. **Live deployments** (Monad mainnet, Azure cloud services)

---

## Legacy Folder → Unified Structure Mapping

| Legacy Folder | Legacy Component | Unified Path | Status |
|---|---|---|---|
| `gnostic-engine/src/` | Volumetric 4D Engine | `runtime_defense/` | **Migrated** |
| `gnostic-engine/tests/` | Unit tests | `runtime_defense/tests/` (planned) | **To create** |
| `gnostic-engine/api/` | FastAPI routes | `runtime_defense/` + API wrapper (planned) | **Partial** |
| `theo-techno-cosmo/plex/` | Theotechnological logic | `compiler/` | **Migrated** |
| `monad-ecosystem/control-center/` | Control hub | `capital_router/` (governance layer, planned) | **Partial** |
| `monad-ecosystem/packages/organ-*` | Organ systems (Hepar, Cortex, etc.) | `cognitive_agents/` | **Conceptual** |
| `monad-ecosystem/contracts/` | Smart contracts | `capital_router/` + Solidity (planned) | **Partial** |

---

## How Unified Structure Serves the MOF

### Reference: MOF Section 5 - Architecture Overview

The MOF defines **15 canonical layers**. The unified structure consolidates them into **5 functional domains**:

| MOF Layer | MOF Description | Unified Domain | Component(s) |
|---|---|---|---|
| 1 | The Funnel | `capital_router` | `InboundReceiver` |
| 2 | The Engine | `runtime_defense` | `PolarizationFilter`, `BranchConsensus` |
| 3 | The Treasury | `capital_router` | `RevenueRouter` (distribution sink) |
| 4 | The DAO | `cognitive_agents` | `VoiceMatrix` (governance reflection) |
| 5 | The Intelligence Layer | `cognitive_agents` | `PersonalityVectors`, `GnosisEvaluator` |
| 6 | The Oracle | `runtime_defense` | `HealthTriageEngine` (probabilistic assessment) |
| 7 | The Signal Layer | `runtime_defense` | `PipelineIsolation` (3-lane signal substrate) |
| 8 | The Platform | `compiler` | `SignGraph`, `SemioticDialect` (builder infrastructure) |
| 9 | The Keys | `cognitive_agents` | `PersonalityVectors` (agent identity encoding) |
| 10 | The Narrative | `compiler` | `SemioticDialect` (symbolic layer) |
| 11 | The Dove | `runtime_defense` | `HealthTriageEngine` (drift detection) |
| 12 | Gnosis Integrity | `cognitive_agents` | `GnosisEvaluator` (decompression integrity) |
| 13 | Revenue Router | `capital_router` | `RevenueRouter` (inflow distribution) |
| 14 | Data Rail | `state_registry` | `AlphabetWheel` (behavioral state mapping) |
| 15 | Emergent Protocol | `state_registry` | `ApoptosisLifecycle` (pattern validation) |

**Conclusion:** The unified structure IS the MOF, organized by functional data flow rather than philosophical abstraction.

---

## Live Integration Pathways

### MOF Section 6.2 — Current Live Snapshot

#### Deployments Referenced in MOF

| System | Status | Unified Component | Next Action |
|---|---|---|---|
| Phase 1a Router | ✅ LIVE (Monad) | `capital_router` | Monitor routing logs |
| Treasury Sink | ✅ DEPLOYED (0xA36F...) | `RevenueRouter` | Link to unified interface |
| MEV Mainnet | ⚠️ TESTNET ONLY | `runtime_defense` | Complete execution-truth gate |
| Signal Layer | 📄 LOCAL ONLY | `pipeline_isolation` | Deploy ingestion path |
| Oracle v1 | 📄 LOCAL ONLY | `health_triage` | Live calibration gateway |
| Dove Protocol | 📄 LOCAL ONLY | `health_triage` | Runtime evidence collection |
| Gnosis Integrity | ✅ ADVANCED (4D Engine) | `gnosis_evaluator` | Integrate volumetric output |
| Data Rail | 📄 LOCAL ONLY | `state_registry` | Activation decision required |
| Agent Behavioral Loop | ✅ LIVE (Agent 0 on Monad) | `personality_vectors` + `gnosis_evaluator` | Wire telemetry ingestion |
| Organ Set (6 organs) | ✅ ADVISORY TIER | `cognitive_agents` | Production-grade wiring |

---

## MOF Axiom Alignment via Unified Structure

### MOF Section 2.3 — Axiom Alignment & Drift Signals

The unified structure actively **monitors axioms** through each layer:

| Axiom | Monitored By | Drift Signal Detection |
|---|---|---|
| **Axiom 1: Source** | `provenance.py` | Source corruption detected |
| **Axiom 2: Emanation** | `revenue_router.py` | Imbalanced distribution |
| **Axiom 3: Correspondence** | `sign_graph.py` | Macro-micro pattern breaks |
| **Axiom 4: Agents** | `personality_vectors.py` | Agent claiming totality |
| **Axiom 5: Theology as Modeling** | `semiotic_dialect.py` | Metaphysical claims override evidence |
| **Axiom 6: Demiurge** | `health_triage.py` | Constraint denial signals |
| **Axiom 7: Reciprocal Loop** | `voice_matrix.py` | Founder centrality detected |
| **Axiom 8: Gnosis** | `gnosis_evaluator.py` | Pattern absolutization without validation |
| **Axiom 9: Plurality** | `council` | Monoculture formation |
| **Axiom 10: Purpose** | `main.py` | Nihilism in execution output |
| **Axiom 11: Constraint Validation** | `health_triage.py` | Models defended after contradiction |
| **Axiom 12: Resonant Convergence** | `cryptographic_extraction.py` | Multi-system divergence detected |

---

## Migration Checklist

### Phase 1: Local Validation (NOW)
- [x] Create unified directory structure
- [x] Scaffold all five domains
- [x] Implement core modules (compiler, runtime_defense, cognitive_agents, state_registry, capital_router)
- [x] Create unified orchestrator (`main.py`)
- [x] Verify end-to-end execution
- [ ] Add unit tests for each domain

### Phase 2: Data Synchronization (NEXT)
- [ ] Export legacy `gnostic-engine/` test suite to unified tests/
- [ ] Regenerate NotebookLM manifest using `state_registry/alphabet_wheel.py`
- [ ] Migrate `gnostic-engine/src/` imports to use unified imports
- [ ] Sync `theo-techno-cosmo/plex/` logic into `compiler/` modules
- [ ] Update `monad-ecosystem/` package imports

### Phase 3: Live Wiring (LATER)
- [ ] Wire Phase 1a router logs into `capital_router/logs/`
- [ ] Connect Treasury sink (0xA36F...) to RevenueRouter lifecycle
- [ ] Activate Signal Layer ingestion (`pipeline_isolation.py`)
- [ ] Enable Dove runtime monitoring (hook `health_triage.py`)
- [ ] Deploy live State Registry (`state_registry/` to production DB)

### Phase 4: Production Hardening (LAST)
- [ ] CI/CD pipeline: validate unified structure on push
- [ ] AEAD encryption: replace HMAC tokens with AES-GCM
- [ ] Key management: secure storage for state tokens
- [ ] Telemetry dashboard: visualize all 5 layers in real-time
- [ ] Backup & recovery: state registry snapshots

---

## Example: Integrating Agent 0 Data

**Scenario:** Agent 0 behavioral data arrives from Monad mainnet. How does it flow through the unified structure?

1. **Capital Router (Entry):** `inbound_receiver.py` accepts transaction
2. **State Registry (Encoding):** `alphabet_wheel.py` maps behavioral event to state index (0-143)
3. **Runtime Defense (Filtering):** `polarization_filters.py` validates signal integrity
4. **Cognitive Agents (Evaluation):** `gnosis_evaluator.py` scores authenticity (must be > 0.72)
5. **Apoptosis Logic:** If authenticity < 0.72, `apoptosis_lifecycle.py` triggers 30-day isolation
6. **Capital Router (Distribution):** Approved transactions route through `revenue_router.py`
7. **Provenance Wrap:** All results wrapped by `provenance.py` with `KODESH_MAINNET_VERIFIED`

**Implementation:**

```python
from legacy-monad-ecosystem-workspace import MonadEcosystemCore

core = MonadEcosystemCore()

agent_0_transaction = {
    "input_expression": "Agent_0_behavioral_event_from_Monad",
    "camera_perspective": "AAA",
    "capital_amount": 250.0,  # Delegate pool allocation
    "state_index": 42,        # Derived from behavioral fingerprint
    "agent_id": "AGENT_0",
}

result = core.run_unified_pathway(agent_0_transaction)
# Result contains full audit trail across all 5 layers
```

---

## FAQ: Legacy vs Unified

### Q: Do I still use the old `gnostic-engine/` folder?
**A:** Yes, for reference and as a fallback. But new imports should use `legacy-monad-ecosystem-workspace.runtime_defense`. The unified structure is canonical going forward.

### Q: How do I update the MOF to reflect the unified structure?
**A:** Add a new section to MOF Section 6.2 ("Current Live Snapshot"):

> **Unified Architecture Status (June 3, 2026):**  
> All 15 canonical layers are now consolidated into 5 functional domains inside `archive/legacy-workspaces/legacy-monad-ecosystem-workspace/`. The unified orchestrator (`main.py`) proves synchronous cross-layer execution. Legacy folders remain as read-only references; new development uses the unified import structure.

### Q: Which domain handles which MOF section?
**See "How Unified Structure Serves the MOF" table above.**

### Q: When does live deployment happen?
**Phase 2-4 (See "Migration Checklist").** Local validation is complete; live wiring depends on Phase 1a proof + funded capital activation.

---

## Canonical References

- **Unified Main Entry:** `archive/legacy-workspaces/legacy-monad-ecosystem-workspace/main.py`
- **Architecture Reference:** This document
- **MOF Reference:** `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.3.0.md`
- **Gnostic Engine Legacy:** `gnostic-engine/` (read-only reference)
- **Phase 1a Proof:** Monad mainnet (2026-04-18)

---

## Version & Status

**Unified Architecture v1.0** — Transition from fragmented → synchronized  
**Date:** June 3, 2026  
**Status:** ✅ LOCAL VALIDATION COMPLETE | ⏳ LIVE WIRING IN PROGRESS

---

*This integration guide ensures every line of code in the unified structure serves the MOF and traces back to foundational axioms.*


