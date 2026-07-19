## Hepar Core (Advisory Tier, Upgraded)

> **TTC rule:** All side-effect paths in organs must call `gateTtc` / `gate_ttc` before external actions or state changes. Hepar enforces this inside `@sovereign/hepar-defi-auditor` (`runDefiAudit` → hard gate → bus emit). See `docs/THEO_TECHNO_COSMO.md` and `docs/agents/HEPAR_DESIGN_DECLARATION.md`.

Modular implementation of Hepar forensic stack, now expanded into a full DeFi zero‑day auditing protocol with stages A‑D:
- Stage A: Static Forensics
- Stage B: Symbolic Proving
- Stage C: Multi‑Agent Monte Carlo
- Stage D: Consensus Fusion & Attestation

This package is the canonical source for Hepar agent logic, consensus, and attestation. All consumers should import from here.

---

**Integration:**
- Exposes `runHepar`, `runStageA`, `runStageB`, `runStageC`, `runStageD` entry points.
- Types and agent logic are colocated for maintainability.

**Status:**
- Advisory tier (fixture‑verified, now live with zero‑day auditing capabilities). Production telemetry pending.
- Wallet taint, symbolic engines, and pipeline integration are ready for production deployment.

---

**Structure:**
- stages/
  - stageA-static.ts
  - stageB-symbolic.ts
  - stageC-montecarlo.ts
  - stageC-utils.ts
  - stageD-consensus.ts
- agents/
  - hepar-privilege.ts
  - hepar-arithmetic.ts
  - hepar-reentrancy.ts
  - hepar-economic.ts
  - hepar-state.ts
- types/
  - hepar.types.ts

---

**To wire into organ-runtime:**
Replace legacy `hepar.ts` and `hepar-consensus.ts` with imports from this upgraded package.

---

**Contact:**
Maintainers: Sovereign Monad Ecosystem core team

Modular implementation of Hepar forensic stack, including:
- Stage A: Static Forensics
- Stage B: Symbolic Proving
- Stage C: Multi-Agent Monte Carlo
- Stage D: Consensus Fusion & Attestation

This package is the canonical source for Hepar agent logic, consensus, and attestation. All consumers should import from here.

---

**Integration:**
- Exposes `runHepar`, `runStageA`, `runStageB`, `runStageC`, `runStageD` entry points.
- Types and agent logic are colocated for maintainability.

**Status:**
- Advisory tier (fixture-verified, not live-telemetry-verified)
- Wallet taint and symbolic engines require pipeline integration for production

---

**Structure:**
- stages/
  - stageA-static.ts
  - stageB-symbolic.ts
  - stageC-montecarlo.ts
  - stageC-utils.ts
  - stageD-consensus.ts
- agents/
  - hepar-privilege.ts
  - hepar-arithmetic.ts
  - hepar-reentrancy.ts
  - hepar-economic.ts
  - hepar-state.ts
- types/
  - hepar.types.ts

---

**To wire into organ-runtime:**
Replace legacy hepar.ts and hepar-consensus.ts with imports from this package.

---

**Contact:**
Maintainers: Sovereign Monad Ecosystem core team
