# Hepar-Core: Modular Forensic Stack (Stages A–D)

## Overview

`hepar-core` is a TypeScript-based forensic analysis framework integrated into `organ-runtime`. It implements a four-stage pipeline for comprehensive smart contract security analysis:

- **Stage A**: Static Forensics (bytecode patterns, proxy detection, admin signals)
- **Stage B**: Symbolic Proving (invariant violation detection, constraint solving)
- **Stage C**: Monte Carlo Execution (agent-based path exploration, reproducible findings)
- **Stage D**: Consensus Fusion (decision integration, attestation generation)

## Architecture

### Directory Structure

```
organ-runtime/src/hepar-core/
├── index.ts                    # Main export surface
├── HeparOrchestrator.ts        # Pipeline orchestration (A→B→C→D)
├── types/
│   └── hepar.types.ts          # Core types (SymbolicResult, ActionBand, etc.)
├── stages/
│   ├── stageA-static.ts        # Static forensics implementation
│   ├── stageB-symbolic.ts      # Symbolic proving implementation
│   ├── stageC-montecarlo.ts    # Monte Carlo execution engine
│   ├── stageC-utils.ts         # Utilities, RNG, agent interfaces
│   └── stageD-consensus.ts     # Consensus and decision fusion
└── agents/
    ├── index.ts                # Agent factory and registry
    ├── HeparPrivilegeAgent.ts  # Privilege escalation detector
    ├── HeparArithmeticAgent.ts # Arithmetic vulnerability detector
    ├── HeparReentrancyAgent.ts # Reentrancy detector
    ├── HeparEconomicAgent.ts   # Economic/MEV detector
    └── HeparStateAgent.ts      # State consistency detector
```

## Quick Start

### Basic Usage

```typescript
import { createDefaultHeparOrchestrator } from '@organ-runtime/hepar-core';

// Create orchestrator with sensible defaults
const orchestrator = createDefaultHeparOrchestrator();

// Execute full pipeline
const result = await orchestrator.executeFullPipeline(
  'uniswap-v3',
  ['0xE592427A0AEce92De3Edee1F18E0157C05861564']  // addresses to probe
);

console.log(result.stageD?.decision);      // 'BLOCK' | 'ALLOW' | 'WARN' | 'INVESTIGATE'
console.log(result.stageD?.confidence);    // 0.0–1.0
```

### Step-by-Step Execution

```typescript
// Execute up to a specific stage
const partialResult = await orchestrator.executeUpToStage(
  'C',  // Execute A, B, and C only
  'compound-v3',
  ['0x1234...']
);

console.log(`Stage A findings: ${partialResult.stageA?.findings.length}`);
console.log(`Stage C execution time: ${partialResult.stageC?.executionTime}ms`);
```

### Custom Configuration

```typescript
import { HeparOrchestrator } from '@organ-runtime/hepar-core';

const orchestrator = new HeparOrchestrator({
  stageA: {
    bytecodeThreshold: 500,
    patternMatchingDepth: 3,
  },
  stageB: {
    timeoutPerInvariant: 5000,
    allowStubMode: true,
  },
  stageC: {
    pathsPerAgent: 100,
    agentsToRun: ['PRIVILEGE', 'ARITHMETIC', 'REENTRANCY'],
    masterSeed: 'custom-seed-123',
    timeoutMs: 60000,
    allowStubMode: true,
  },
  stageD: {
    consensusThreshold: 0.6,
    severityWeights: { BLOCK: 2.0, WARN: 1.0, ALLOW: 0.5 },
    allowPartialConsensus: true,
  },
});
```

## Stage Details

### Stage A: Static Forensics

Analyzes bytecode patterns without execution:

- Proxy admin detection
- LP unlock signals
- Wallet taint patterns
- Adversarial signal classification
- Bytecode feature extraction

**Input**: Protocol ID, contract addresses
**Output**: `StaticFinding[]` (patterns, severity scores)

```typescript
const stageA = new StageA({ bytecodeThreshold: 500, patternMatchingDepth: 3 });
const result = await stageA.analyze('protocol-id', ['0x...', '0x...']);
```

### Stage B: Symbolic Proving

Proves invariant violations using symbolic constraint solving:

- Invariant extraction from Stage A findings
- Constraint formulation (STUB or LIVE mode)
- Proof generation or inconclusive verdict
- Severity and confidence scoring

**Input**: Stage A finding vector IDs
**Output**: `InvariantViolation[]` (proven or unproven)

```typescript
const stageB = new StageB({ timeoutPerInvariant: 5000, allowStubMode: true });
const result = await stageB.prove('protocol-id', ['finding-1', 'finding-2']);
```

### Stage C: Monte Carlo Execution

Runs reproducible agent-based path exploration:

- Five dedicated agents: PRIVILEGE, ARITHMETIC, REENTRANCY, ECONOMIC, STATE
- Seeded pseudo-random path generation (reproducible)
- Parallel or serial agent execution
- Coverage ratio and branch tracking
- Aggregated finding deduplication

**Input**: Protocol ID, addresses, stage config
**Output**: `AgentCampaignResult[]`, aggregated findings

```typescript
const stageC = new StageC(config, agents);
const result = await stageC.execute('protocol-id', ['0x...']);
```

### Stage D: Consensus Fusion

Merges Stage B and Stage C results into final decision:

- Vote aggregation (BLOCK, WARN, ALLOW, INVESTIGATE)
- Confidence computation from individual votes
- Attestation payload generation
- Action band mapping (escalation paths, severity)

**Input**: `StageBResult`, `StageCResult`
**Output**: `StageDResult` with final decision and attestation

```typescript
const stageD = new StageD({
  consensusThreshold: 0.5,
  severityWeights: { BLOCK: 2.0, WARN: 1.0, ALLOW: 0.5 },
});
const result = stageD.fuse(stageBResult, stageCResult, 'protocol-id');
```

## Agent Details

### HeparPrivilegeAgent

Detects privilege escalation and unauthorized state mutations:
- Unchecked caller patterns
- Role-based access control bypass
- Admin function exposure

**Reproducibility**: Seeded from config and agent index

### HeparArithmeticAgent

Detects integer arithmetic vulnerabilities:
- Overflow/underflow in calculations
- Precision loss in scaled division
- Rounding bias exploitation

### HeparReentrancyAgent

Detects reentrancy attack vectors:
- Classic reentrancy (call before state update)
- Delegatecall callbacks
- ERC-721 onERC721Received hooks

### HeparEconomicAgent

Detects economic exploits and MEV attacks:
- Frontrunning opportunities
- Flash loan exploits
- Oracle price manipulation

### HeparStateAgent

Detects state consistency violations:
- Invariant breaks (e.g., total supply)
- Locked/unretrievable tokens
- Balance ledger desynchronization

## Integration with organ-runtime

`hepar-core` exports are re-exported from the main `organ-runtime` index:

```typescript
// From organ-runtime
import {
  HeparOrchestrator,
  createDefaultHeparOrchestrator,
  StageA,
  StageB,
  StageC,
  StageD,
  createAgentRegistry,
} from '@organ-runtime';

// Backward compatibility: existing hepar exports still work
import { buildHeparSnapshot, screenOpportunity } from '@organ-runtime';
```

## Advisory and Limitations

### Stage Constraints

1. **Stage A (Static)**: Pattern-matching only; no execution semantics
2. **Stage B (Symbolic)**: STUB mode by default; full SMT solving requires live configuration
3. **Stage C (Monte Carlo)**: Agent findings are seeded synthetic by default (STUB); live execution requires agent implementation
4. **Stage D (Consensus)**: Fusion is deterministic given inputs; depends on Stage B/C completeness

### Wallet Taint Pipeline

Advisory-tier wallet taint detection requires a pipeline:
- Stage A cannot directly attest wallet reputation
- Use attestation payload from Stage D for downstream integrations
- Cross-ecosystem ledger synchronization is asynchronous

### No Live Telemetry Claims

- Confidence scores represent model agreement, not live execution guarantee
- STUB mode paths are reproducible but synthetic
- Live mode requires full agent implementation and external data sources

## Reproducing Findings

All agents use **seeded RNG** for reproducible exploration:

```typescript
import { SeededLCG, deriveAgentSeed } from '@organ-runtime/hepar-core';

const masterSeed = 'my-campaign-seed';
const agentSeed = deriveAgentSeed(masterSeed, 0, 'protocol-id');
const rng = new SeededLCG(agentSeed);

// Same seed → same findings, same execution trace
```

## Types

### Core Types

- `SymbolicResult`: Proof results from Stage B
- `ActionBand`: Decision categorization (BLOCK, WARN, ALLOW)
- `FindingVector`: Unified finding representation across stages
- `AttestationPayload`: Signed/attestable decision output

### Agent Types

- `AgentId`: 'PRIVILEGE' | 'ARITHMETIC' | 'REENTRANCY' | 'ECONOMIC' | 'STATE'
- `AgentFinding`: Individual agent discovery
- `AgentCampaignResult`: Aggregated agent run results
- `AgentExecutor`: Interface for pluggable agent implementations

## Future Extensions

- **Live Agent Mode**: Replace STUB agents with real-time execution engines
- **Custom Agents**: Plugin architecture for domain-specific agents
- **Witness Generation**: Output execution traces and proofs for verification
- **Parallel Execution**: Full async/await coordination across stages
- **ML Integration**: Learned severity scoring and pattern classification

## References

- [ADR-001: Price-Feed Infrastructure](../../ADR-001_price-feed-infrastructure.md)
- [ADR-002: Phase 1A Deployment Gate](../../ADR-002_phase1a-deployment-gate.md)
- [Ecosystem Build Map](../../docs/ECOSYSTEM_BUILD_MAP.md)

## License

Commercial. See the root ecosystem commercial license template:
[LICENSE.commercial.md](../../../../../../docs/LICENSE.commercial.md).
