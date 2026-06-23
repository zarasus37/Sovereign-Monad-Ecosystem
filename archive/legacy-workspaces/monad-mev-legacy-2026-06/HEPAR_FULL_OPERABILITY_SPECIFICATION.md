# HEPAR Full Operability Specification

## Institutional Depth Standards (MOF v2.4.0 Reference)

Hepar operates as the ecosystem's **opportunity refiner** and metabolic filter, analogous to the liver:
- Detoxifies harmful inputs
- Buffers and refines opportunities
- Rejects toxic strategies/counterparties
- Improves capital deployment quality

**Upgrade Goal:** Elevate from advisory-tier to institutional forensic intelligence.

## Current State (from organ-runtime/src/hepar.ts)
- Multi-factor risk scoring (bytecode, proxy, LP unlock, wallet taint, adversarial)
- Hard block logic for immediate rejection
- Score-based approval (threshold 35)
- Default forensics signals and normalization
- Reason code generation for auditability

## Institutional Depth Upgrades

### 1. Full Hepar-Core Integration
- Integrate complete 4-stage pipeline (A: Static, B: Symbolic, C: Monte Carlo, D: Consensus)
- 5 agents: Privilege, Arithmetic, Reentrancy, Economic, State
- Replace current heuristic scoring with orchestrator decisions

### 2. Live Telemetry (Post-STUB)
- Symbolic SMT solver integration
- Real execution tracing
- Cross-ecosystem wallet ledger sync

### 3. Output Enhancements
- Attestation payloads for downstream (Cardia, Synapse)
- Confidence scoring with evidence traces
- Escalation paths for WARN/INVESTIGATE decisions

### 4. Coordination Upgrades
- Fast-path for urgent signals (Synapse integration)
- Homeostasis band reporting (Cardia)
- Research synthesis triggers (Cortex)

## Dependencies
- MOF Section 5.6.1: Institutional depth accepted
- FIRST_ORGAN_SET.md: Hepar as opportunity refiner
- organ-runtime/src/hepar-core/: Complete pipeline ready

## Verification Criteria
- [ ] Full pipeline execution time < 30s for standard protocols
- [ ] Reproducible findings (seeded RNG)
- [ ] Backward compatibility with existing screenOpportunity()
- [ ] Integration with ecosystem-state-api
- [ ] Azure Functions pipeline consumes enhanced output

**Status:** Ready for implementation.

