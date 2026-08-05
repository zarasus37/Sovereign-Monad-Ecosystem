# Production Powers-of-Tau Ceremony

**Status:** Demo artifacts in `artifacts/` use a **local, single-contributor** ptau (unsafe for production).  
**Circuit:** `gate_human_bound` (Groth16 / bn128) — public: `out_gate`, `out_human`, `commit`.

This document is the runbook to replace the demo ceremony with a production-grade trusted setup before any production MeshaleachPoC SNARK (`FgMintOpts.withSnark: true` on the server path).

---

## Why this matters

Groth16 requires a **trusted setup**. If any single party retains toxic waste from the ceremony, they can forge proofs. Production must either:

1. Run a **multi-party ceremony** (MPC) where at least one honest participant is enough to destroy toxic waste, **or**
2. Reuse a **public, audited Phase-1 ptau** (e.g. Hermez / Perpetual Powers of Tau) and only run a circuit-specific Phase-2 with multi-party contribution.

The current `scripts/build-circuit.mjs` path:

```text
powersoftau new bn128 12 → single contribute → prepare phase2 → groth16 setup → single zkey contribute
```

is fine for **CI and demos only**. Do not ship those zkeys as production verification keys.

---

## Prerequisites

| Tool | Notes |
|------|--------|
| Circom 2 | `bin/circom.exe` or `circom` on PATH |
| snarkjs | Workspace dep of `@sovereign/meshaleach-zk` |
| Node ≥ 20 | For scripts |
| Optional | Remote ceremony coordinator (e.g. p0tion / semaphore-style tooling) |

Constraint size: demo uses **power 12** (`2^12` constraints). If the circuit grows past ~2^k constraints, choose **power k** such that `2^k > #constraints`. Re-check after every circuit change.

```bash
# From monorepo root
pnpm --filter @sovereign/meshaleach-zk build:circuit   # demo only
```

---

## Recommended production path

### A. Phase 1 — Universal SRS (preferred: reuse public)

Download a **finalized** public ptau for bn128 at sufficient power (Hermez / Perpetual Powers of Tau or equivalent).

Example (illustrative URL — pin hash in CI):

```bash
# Place under artifacts/build/ — do not commit multi-GB files; store in artifact registry
# snarkjs powersoftau verify potXX_final.ptau
```

Record:

- Source URL + checksum (SHA-256)
- Power (e.g. 14, 20, …)
- Ceremony name / beacon (if any)

### B. Phase 2 — Circuit-specific (multi-party)

After Circom emits `gate_human_bound.r1cs`:

```bash
# 1. Start phase2 from public ptau
node path/to/snarkjs/cli.cjs groth16 setup \
  artifacts/build/gate_human_bound.r1cs \
  artifacts/build/potXX_final.ptau \
  artifacts/build/gate_0000.zkey

# 2. Each contributor (N ≥ 2, preferably ≥ 3 independent orgs/people):
node path/to/snarkjs/cli.cjs zkey contribute \
  artifacts/build/gate_000N.zkey \
  artifacts/build/gate_000N+1.zkey \
  --name="contributor-name" -v
# Each contributor uses high-entropy -e=… or interactive entropy; never reuse demo strings.

# 3. Optional beacon (public randomness):
node path/to/snarkjs/cli.cjs zkey beacon \
  artifacts/build/gate_000N.zkey \
  artifacts/gate_human_bound.zkey \
  <beaconHex> <numIterationsExp>

# 4. Export verification key (commit this):
node path/to/snarkjs/cli.cjs zkey export verificationkey \
  artifacts/gate_human_bound.zkey \
  artifacts/verification_key.json

# 5. Verify zkey against r1cs + ptau:
node path/to/snarkjs/cli.cjs zkey verify \
  artifacts/build/gate_human_bound.r1cs \
  artifacts/build/potXX_final.ptau \
  artifacts/gate_human_bound.zkey
```

### C. Publish & pin

1. Publish **verification_key.json** + **wasm** (prover) via release assets or content-addressed storage.
2. Keep **zkey** available to the **issuer / prover** service only (not necessarily public if proving is server-side).
3. Update `artifacts/circuit_meta.json`:

```json
{
  "name": "gate_human_bound",
  "system": "groth16",
  "curve": "bn128",
  "public": ["out_gate", "out_human", "commit"],
  "builtAt": "<ISO-8601>",
  "ceremony": {
    "phase1": "<public ptau id + hash>",
    "phase2Contributors": ["…"],
    "beacon": "<hex or null>",
    "zkeyVerify": "ok",
    "note": "production"
  }
}
```

4. Bump any on-chain or config pointer to the new vkey hash.
5. **Invalidate** demo keys: do not accept proofs under the old vkey once prod is live.

---

## Security checklist

- [ ] No production traffic uses demo `pot12_*` or demo entropy strings  
- [ ] ≥ 2 independent Phase-2 contributors (or 1 + public beacon with clear policy)  
- [ ] Each contributor deletes local toxic waste after contribute  
- [ ] `zkey verify` green against r1cs + ptau  
- [ ] vkey hash pinned in deploy config / CANON  
- [ ] Circuit freeze: no silent r1cs change after ceremony (re-ceremony if circuit changes)  
- [ ] Issuer custody key (`MESHALEACH_ISSUER_*`) is independent of ceremony participants  

---

## Demo vs production in repo

| Item | Demo (current) | Production |
|------|----------------|------------|
| ptau | Local `powersoftau new` power 12 | Public audited ptau, power ≥ circuit need |
| zkey contribute | Single, fixed entropy | Multi-party + optional beacon |
| Artifacts commit | Yes (CI prove/verify) | vkey + wasm; zkey via secure store |
| `circuit_meta.note` | `Demo ptau — re-run trusted setup for production` | `production` + ceremony block |
| UI / mint | Browser EIP-191 + optional merkle-sd | Server `withSnark: true` only after prod ceremony |

---

## Wiring after ceremony

```ts
// Server / shaliah-onboarding
await attemptFg1Gate(session, answers, Date.now(), {
  signer, // or useIssuerCustody: true
  walletAddress,
  withMerkleDisclosure: true,
  withSnark: true, // requires prod artifacts
});
```

Browser FG UI (`/onboarding/financial-graduation`) uses **EIP-191 + merkle-sd** via `getFgMintOpts()`; SNARK prove remains server-side until a browser wasm prove path is intentionally enabled.

---

## Related

- Package README: `./README.md`
- ZKP doctrine: `../../../../ZKP/README.md`
- Dual-pop: `../../../../ZKP/DECISION_DUAL_POP.md`
- Build script: `./scripts/build-circuit.mjs`
