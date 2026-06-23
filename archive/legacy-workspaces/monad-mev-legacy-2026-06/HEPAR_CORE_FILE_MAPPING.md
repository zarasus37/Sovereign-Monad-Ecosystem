## Hepar-Core Integration: File Mapping & Origin Reference

### External Hepar Architecture Integration

This document traces where the external Hepar implementation files were integrated into the monad-mev repository.

---

### Stage A: Static Forensics

**Source**: External Hepar Stage A module
**Destination**: `organ-runtime/src/hepar-core/stages/stageA-static.ts`
**Status**: ✅ Integrated

**Core Exports**:
- `StageA` class
- `StageAConfig` interface
- `StageAResult` interface
- `StaticFinding` interface
- `analyze(protocolId, addresses)` method

**Capabilities**:
- Bytecode pattern matching
- Proxy admin detection
- LP unlock signal extraction
- Wallet taint heuristics
- Adversarial signal classification

---

### Stage B: Symbolic Proving

**Source**: External Hepar Stage B module
**Destination**: `organ-runtime/src/hepar-core/stages/stageB-symbolic.ts`
**Status**: ✅ Integrated

**Core Exports**:
- `StageB` class
- `StageBConfig` interface
- `StageBResult` interface
- `InvariantViolation` interface
- `SymbolicConstraint` interface
- `prove(protocolId, findingVectorIds)` method

**Capabilities**:
- Symbolic constraint formulation
- Invariant violation detection (AUTHORIZATION, UPGRADE, ACCOUNTING, REENTRANCY_STATE)
- Counterexample generation
- Proof term scoring (counterexample-found → 1, unknown/timeout → 0.5, proved-safe → 0)
- STUB and LIVE engine modes

---

### Stage C: Monte Carlo Execution

**Source**: External Hepar Stage C + Agents modules
**Destinations**:
- `organ-runtime/src/hepar-core/stages/stageC-montecarlo.ts` (main engine)
- `organ-runtime/src/hepar-core/stages/stageC-utils.ts` (utilities, RNG)
- `organ-runtime/src/hepar-core/agents/` (five agent implementations)
**Status**: ✅ Integrated

**Core Exports**:
- `StageC` class
- `StageCConfig` interface
- `StageCResult` interface
- `ExecutionTrace` interface
- `execute(protocolId, addressesToProbe)` method
- `SeededLCG` class (reproducible RNG)
- `deriveAgentSeed()` function
- Agent executor interface

**Agents Integrated**:
1. `HeparPrivilegeAgent` (privilege escalation)
2. `HeparArithmeticAgent` (arithmetic vulnerabilities)
3. `HeparReentrancyAgent` (reentrancy vectors)
4. `HeparEconomicAgent` (MEV/economic exploits)
5. `HeparStateAgent` (state consistency violations)

---

### Stage D: Consensus Fusion

**Source**: External Hepar Stage D module
**Destination**: `organ-runtime/src/hepar-core/stages/stageD-consensus.ts`
**Status**: ✅ Integrated

**Core Exports**:
- `StageD` class
- `StageDConfig` interface
- `StageDResult` interface
- `DecisionVote` interface
- `fuse(stageBResult, stageCResult, protocolId)` method

**Capabilities**:
- Vote aggregation from stages B and C
- Consensus threshold enforcement
- Final decision synthesis (BLOCK, ALLOW, WARN, INVESTIGATE)
- Attestation payload generation
- Action band mapping with escalation paths

---

### Types & Utilities

**Unified Type System**:
- **Source**: External Hepar type definitions
- **Destination**: `organ-runtime/src/hepar-core/types/hepar.types.ts`
- **Status**: ✅ Integrated
- **Types**:
  - `SymbolicResult` ('counterexample-found' | 'unknown/timeout' | 'proved-safe')
  - `ActionBand` (interface with band, score, confidence, escalationPath)
  - `FindingVector` (unified finding across stages)
  - `AttestationPayload` (final attestation structure)

**Utilities**:
- **Source**: External Hepar utility modules
- **Destination**: `organ-runtime/src/hepar-core/stages/stageC-utils.ts`
- **Status**: ✅ Integrated
- **Exports**:
  - `SeededLCG` class (reproducible pseudo-random generation)
  - `deriveAgentSeed()` function
  - `hashToNumber()` function
  - Finding template definitions
  - Agent executor interfaces

---

### Orchestration Layer

**New Integration Layer**:
- **File**: `organ-runtime/src/hepar-core/HeparOrchestrator.ts`
- **Purpose**: Coordinates Stages A–D in sequence or partial execution
- **Status**: ✅ Created
- **Methods**:
  - `executeFullPipeline()` - Run all stages A→B→C→D
  - `executeUpToStage()` - Run partial pipeline up to specified stage
  - `createDefaultHeparOrchestrator()` - Factory with sensible defaults

---

### Module Organization

**New Directory Structure**:
```
organ-runtime/src/hepar-core/
├── index.ts                      # Main export surface (NEW)
├── HeparOrchestrator.ts          # Pipeline orchestration (NEW)
├── README.md                     # Documentation (NEW)
├── types/
│   └── hepar.types.ts            # Unified types (INTEGRATED)
├── stages/
│   ├── stageA-static.ts          # INTEGRATED
│   ├── stageB-symbolic.ts        # INTEGRATED
│   ├── stageC-montecarlo.ts      # INTEGRATED
│   ├── stageC-utils.ts           # INTEGRATED (utilities subset)
│   └── stageD-consensus.ts       # INTEGRATED
├── agents/
│   ├── index.ts                  # Agent factory (NEW)
│   ├── HeparPrivilegeAgent.ts    # INTEGRATED
│   ├── HeparArithmeticAgent.ts   # INTEGRATED
│   ├── HeparReentrancyAgent.ts   # INTEGRATED
│   ├── HeparEconomicAgent.ts     # INTEGRATED
│   └── HeparStateAgent.ts        # INTEGRATED
├── examples/
│   └── full-pipeline.ts          # Usage example (NEW)
└── __tests__/
    └── structure.test.ts         # Module validation (NEW)
```

---

### Integration Checkpoint: organ-runtime Main Index

**File**: `organ-runtime/src/index.ts`
**Change**: Added new line 27
```typescript
// Hepar-core: modular forensic stack (Stages A–D)
export * from './hepar-core';
```
**Status**: ✅ Updated
**Backward Compatibility**: ✅ Maintained (existing hepar exports unchanged)

---

### Reference: External Files → Integration Location

| External File | Integration Location | Stage | Type |
|---|---|---|---|
| `hepar-stage-A` | `stageA-static.ts` | A | Forensics |
| `hepar-stage-B` | `stageB-symbolic.ts` | B | Proving |
| `hepar-stage-C` | `stageC-montecarlo.ts` | C | Execution |
| `hepar-stage-C-utils` | `stageC-utils.ts` | C | Utilities |
| `hepar-stage-D` | `stageD-consensus.ts` | D | Fusion |
| `hepar-privilege-agent` | `HeparPrivilegeAgent.ts` | C | Agent |
| `hepar-arithmetic-agent` | `HeparArithmeticAgent.ts` | C | Agent |
| `hepar-reentrancy-agent` | `HeparReentrancyAgent.ts` | C | Agent |
| `hepar-economic-agent` | `HeparEconomicAgent.ts` | C | Agent |
| `hepar-state-agent` | `HeparStateAgent.ts` | C | Agent |
| `hepar-types` | `hepar.types.ts` | Types | Unified |
| (None) | `HeparOrchestrator.ts` | Control | NEW |
| (None) | `index.ts` | Export | NEW |

---

### Integration Notes

#### Structural Decisions

1. **Modular Stages**: Each stage is independent; can be used alone or in sequence
2. **Advisory-Tier Compliance**:
   - No live telemetry claims in default STUB mode
   - Wallet taint requires full pipeline
   - Symbolic engine defaults to STUB (live integration optional)
3. **Reproducible Agents**: All agents use seeded RNG for deterministic findings
4. **Extensible**: New agents can be added to the registry; live engines can replace STUB implementations

#### Compatibility

- **Backward**: Existing `organ-runtime` exports unchanged
- **Forward**: New code uses `HeparOrchestrator` or direct stage imports
- **Interop**: hepar-core exports available as `@organ-runtime/hepar-core`

#### Testing

- Module structure validation in `__tests__/structure.test.ts`
- Example usage in `examples/full-pipeline.ts`
- Individual stages can be tested in isolation

---

### Future Extensions

- **Live Execution**: Replace STUB agents with real-time engines
- **Formal Verification**: Wire in symbolic execution frameworks
- **Parallel Execution**: Async Stage C with true agent parallelism
- **Custom Agents**: Plugin architecture for domain-specific detectors
- **Witness Generation**: Output proofs and execution traces

---

**Integration Date**: 2024
**Status**: Complete and ready for testing
**Next Phase**: Live engine development and integration testing
