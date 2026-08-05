# @sovereign/meshaleach-zk

Phase 2 Groth16 SNARK: **gate_passed ∧ human_bound** (salt private).

## Artifacts

```bash
pnpm --filter @sovereign/meshaleach-zk build:circuit
```

Requires Circom 2 (`bin/circom.exe` or `circom` on PATH) and `snarkjs`.

Outputs (commit these for CI):

- `artifacts/gate_human_bound.wasm`
- `artifacts/gate_human_bound.zkey`
- `artifacts/verification_key.json`

**Note:** `build/` ptau is a **demo ceremony** — re-run a real powers-of-tau for production.

**Production runbook:** [PRODUCTION_PTAU.md](./PRODUCTION_PTAU.md) (public Phase-1 ptau + multi-party Phase-2, verify zkey, pin vkey).

## API

```ts
import { proveGateHumanBound, verifyGateHumanBound } from '@sovereign/meshaleach-zk';

const bundle = await proveGateHumanBound({
  gate_passed: 1,
  human_bound: 1,
  salt: 123456789n,
});
await verifyGateHumanBound(bundle); // true
```

Wire into FG mint: `FgMintOpts.withSnark: true` (server-side; needs artifacts).
