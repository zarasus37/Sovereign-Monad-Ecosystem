# The Sovereign Monad Ecosystem — Unified Architecture

## Overview

This is an archived snapshot of the Sovereign Monad Ecosystem workspace. This replaces the previous fragmented folder structure with a unified directory that proves the system operates as one coherent organism—not three separate implementations.

**Historical entry point:** `main.py` — the unified orchestrator used by the legacy workspace.

---

## Architecture Layers

### Layer 1: `compiler/`
**The Peircean Triadic Gates & Type Checking System**

Refactored from `theo-techno-cosmo/plex/`. Implements constraint validation and semiotic transliteration.

**Core modules:**
- `target_gen.py` — **Level 0:** Peircean minimal gates (rejects dyads, validates triads)
- `sign_graph.py` — **Level 1-2:** Dependent type checking and PPS pass validation
- `semiotic_dialect.py` — **Level 3:** Transliteration between symbol dialects (celestial, Hebrew gematria, Latin)
- `provenance.py` — **Angelic wrapping:** Divine container for all compiler outputs

**Key concept:** Expressions must pass through triadic validation (len(set(perspective)) ∈ {1, 3}). Dyadic reduction is forbidden by design.

### Layer 2: `runtime_defense/`
**The 4D Polarization & Integrity Monitoring Layer**

Refactored from `gnostic-engine/`. Implements Stokes-Mueller polarization, health monitoring, and consensus logic.

**Core modules:**
- `polarization_filters.py` — Stokes-Mueller 4D coherence metrics (DoP, phase alignment, ellipticity)
- `branch_consensus.py` — Monte Carlo Tree Search consensus (3 branches, 2/3 majority required)
- `health_triage.py` — Real-time health: Truthiness, Coherence (Corsuccion), Hallucination Rate
- `pipeline_isolation.py` — Triple-lane isolation (Discovery/Lane A, Verification/Lane B, Width/Lane C)

**Key concept:** The runtime monitors three master loops (coherence, consensus, health) continuously. When coherence < 0.5, "Blink" recovery activates.

### Layer 3: `cognitive_agents/`
**The 12-Voice Council & Gnosis Evaluation**

The active intelligence core. Implements adversarial reflection, personality encoding, and authenticity evaluation.

**Submodules:**
- `council/voice_matrix.py` — 12-voice reflection matrix (majority consensus required)
- `profiles/personality_vectors.py` — NEO-PI-R trait encoding (OCEAN + HEXACO)
- `metrics/gnosis_evaluator.py` — Authenticity scoring (threshold: 0.72 approval, <0.72 triggers apoptosis)

**Key concept:** Agents operate authentically when personality traits align with observed actions. Hollow convergence (pattern-following without self-consistency) is detected and isolated.

### Layer 4: `state_registry/`
**The 144-Fold Llull Matrix & Cryptographic State Space**

Implements the macrocosmic state database using Ramon Llull's combinatorial logic.

**Core modules:**
- `alphabet_wheel.py` — 144-element matrix (B-set: 9 divine attributes × K-set: 16 principles)
- `cryptographic_extraction.py` — Boustrophedon parsing and AEAD token encoding
- `apoptosis_lifecycle.py` — 30-day isolation + review protocol for low-authenticity states

**Key concept:** All system states are enumerable within a finite 144-element matrix. States < 0.72 authenticity trigger 30-day review; after review, decision is DELETE, RECALIBRATE, or RESTORE.

### Layer 5: `capital_router/`
**The On-Chain Settlement & Programmatic Distribution**

Handles liquidity intake and canonical 40/25/10/5/5 distribution.

**Core modules:**
- `inbound_receiver.py` — Automated capital intake validation
- `revenue_router.py` — Programmatic distribution to treasury, ops, ecosystem development, delegates, founder

**Distribution formula:**
- 40% → Treasury (reserves & stability)
- 25% → MEV/Operations (engine execution)
- 10% → Ecosystem Development
- 5% → Delegate Pools
- 5% → Founder/Origination Attribution

---

## Running the Unified Ecosystem

### Quick Start

```bash
cd g:/My\ Drive/The_Sovereign/legacy-monad-ecosystem-workspace
python main.py
```

**Expected output:**
- Compiler layer validates expression through Peircean gates (PPS calculation)
- Runtime defense runs polarization checks and consensus voting
- Cognitive agents evaluate personality authenticity via 12-voice council
- State registry retrieves state from 144-fold matrix + cryptographic encoding
- Capital router ingests $5,000 and distributes across pools
- Final status: `FOCAL_LOCK` (authenticity > 0.72) with `KODESH_MAINNET_VERIFIED` blessing

### Customizing the Transaction

Edit `main.py` line ~460:

```python
transaction = {
    "input_expression": "Your custom expression here",
    "camera_perspective": "ABC",  # Must be triadic (AAA, ABC, XYZ, etc.) — never dyadic
    "capital_amount": 10000.0,
    "state_index": 42,  # 0-143 valid indices from 144-fold matrix
    "agent_id": "CUSTOM_AGENT_ID",
}
```

---

## Key Design Principles

### 1. **No Dead Layers**
Every component must generate value, protect value, route value, interpret signal, enforce constraints, preserve alignment, or improve the system's ability to do one of these. Decorative architecture is forbidden.

### 2. **Triadic Enforcement**
The system enforces triadic structures at the compiler level. Dyadic reduction is a hard failure. This preserves meaning and prevents collapse into false dichotomies.

### 3. **Authenticity Threshold (0.72)**
Agents must maintain authenticity > 0.72 (72%) or trigger 30-day apoptosis review. This prevents hollow convergence and ensures agents operate from their own decompressed nature.

### 4. **Unified Execution**
All five layers operate in a single synchronized pathway. `main.py` coordinates them sequentially:
1. Compiler validates and wraps
2. Runtime defense checks coherence
3. Cognitive agents evaluate authenticity
4. State registry verifies and encodes state
5. Capital router distributes liquidity

### 5. **Provenance & Divine Container**
All outputs are wrapped in a provenance envelope with source attribution and blessing signature (`KODESH_MAINNET_VERIFIED`).

---

## Integration with Existing Projects

### Migration from Legacy Folders

**Old structure:**
- `gnostic-engine/` → now lives in `archive/legacy-workspaces/legacy-monad-ecosystem-workspace/runtime_defense/`
- `theo-techno-cosmo/plex/` → now lives in `archive/legacy-workspaces/legacy-monad-ecosystem-workspace/compiler/`
- `monad-ecosystem/` (portions) → now lives in `archive/legacy-workspaces/legacy-monad-ecosystem-workspace/capital_router/`

**Next steps:**
1. Keep legacy folders as read-only references
2. Import from unified structure: `from legacy-monad-ecosystem-workspace.compiler import TargetGenerator`
3. Run migration scripts to sync manifest files and state registries
4. Update the MOF (Master Operating File) to reflect new structure

---

## Module Imports

Use the unified import pattern:

```python
# Import any layer
from legacy-monad-ecosystem-workspace.compiler import TargetGenerator, SignGraph, SemioticDialect, ProvenanceWrapper
from legacy-monad-ecosystem-workspace.runtime_defense import PolarizationFilter, BranchConsensus, HealthTriageEngine
from legacy-monad-ecosystem-workspace.cognitive_agents import VoiceMatrix, PersonalityVectors, GnosisEvaluator
from legacy-monad-ecosystem-workspace.state_registry import AlphabetWheel, CryptographicExtraction, ApoptosisLifecycle
from legacy-monad-ecosystem-workspace.capital_router import InboundReceiver, RevenueRouter

# Or instantiate the master orchestrator
from legacy-monad-ecosystem-workspace import MonadEcosystemCore

core = MonadEcosystemCore()
result = core.run_unified_pathway(transaction_dict)
```

---

## Testing

### Unit Tests

Each layer includes unit tests (to be added):

```bash
python -m pytest archive/legacy-workspaces/legacy-monad-ecosystem-workspace/compiler/test_*.py
python -m pytest archive/legacy-workspaces/legacy-monad-ecosystem-workspace/runtime_defense/test_*.py
# ... etc
```

### Integration Tests

Run the full unified pathway:

```bash
python archive/legacy-workspaces/legacy-monad-ecosystem-workspace/main.py
```

### Custom Validation

```python
from legacy-monad-ecosystem-workspace.compiler import TargetGenerator

gen = TargetGenerator()

# Valid: triadic
assert gen.validate_camera_perspective("AAA") == True
assert gen.validate_camera_perspective("ABC") == True

# Invalid: dyadic
assert gen.validate_camera_perspective("AB") == False
```

---

## Next Steps

1. **Manifest & Token System:** Regenerate the NotebookLM manifest with cryptographic extraction from the unified structure
2. **CI/CD Pipeline:** Add GitHub Actions to validate the unified structure on every commit
3. **Secure Key Management:** Implement AEAD token encryption (AES-GCM) for state tokens
4. **Live Runtime:** Deploy capital router and state registry to Monad mainnet
5. **Documentation:** Generate API documentation from the unified module structure

---

## Files & Structure

```
archive/legacy-workspaces/legacy-monad-ecosystem-workspace/
├── main.py                          ← Unified orchestrator (START HERE)
├── compiler/
│   ├── __init__.py
│   ├── target_gen.py               (Level 0: Peircean gates)
│   ├── sign_graph.py               (Level 1-2: Type checking)
│   ├── semiotic_dialect.py         (Level 3: Transliteration)
│   └── provenance.py               (Angelic wrapping)
├── runtime_defense/
│   ├── __init__.py
│   ├── polarization_filters.py     (4D Stokes-Mueller)
│   ├── branch_consensus.py         (MCTS consensus)
│   ├── health_triage.py            (Truthiness, coherence, hallucination)
│   └── pipeline_isolation.py       (3-lane isolation)
├── cognitive_agents/
│   ├── __init__.py
│   ├── council/
│   │   ├── __init__.py
│   │   └── voice_matrix.py         (12-voice reflection)
│   ├── profiles/
│   │   ├── __init__.py
│   │   └── personality_vectors.py  (NEO-PI-R encoding)
│   └── metrics/
│       ├── __init__.py
│       └── gnosis_evaluator.py     (Authenticity @ 0.72 threshold)
├── state_registry/
│   ├── __init__.py
│   ├── alphabet_wheel.py           (144-fold Llull matrix)
│   ├── cryptographic_extraction.py (Boustrophedon + AEAD tokens)
│   └── apoptosis_lifecycle.py      (30-day isolation + review)
└── capital_router/
    ├── __init__.py
    ├── inbound_receiver.py         (Capital intake)
    ├── revenue_router.py           (40/25/10/5/5 distribution)
    └── logs/                       (Ledger archiving)
```

---

## Canonical References

- **Master Operating File:** `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.3.0.md`
- **Phase 1a Deployment:** Phase 1a router proof complete (2026-04-18)
- **Gnostic Engine Original:** `gnostic-engine/src/` (legacy, now unified)
- **Llull Matrix Spec:** `state_registry/alphabet_wheel.py` (144-element B×K)

---

## Version

**Unified Monad Ecosystem v1.0** — June 3, 2026

Transitions from fragmented folder structure to a single, synchronized project architecture.

---

## License & Attribution

The Sovereign Monad Ecosystem © 2026. All layers synchronized under unified theological-technical framework.

"And there was light, and it was whole." — Genesis Protocol


