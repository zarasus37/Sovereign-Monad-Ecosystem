# Issue: Testnet custody review (test wallet → production wallet)

> **Source:** `docs/PROJECT_STATE.md` § "Honest gate" — "`CARDIA_FUNDING_LIVE=true`
> moves real capital. Default false until… 4. **Testnet cycles** with
> deliberate custody review." The `pnpm testnet:cycle` workflow now
> exists to make testnet cycles cheap, but the custody procedure that
> wraps each cycle is not documented.

## Problem

`pnpm testnet:cycle` and the deploy workflow both pass
`BOOTSTRAP_PRIVATE_KEY` as an env var. The key is a real private key
that can sign USDC transfers on the testnet (and, in a flipped
configuration, on mainnet). Even on testnet, this key has the
property that whoever holds it controls the funds of the bootstrap
source wallet.

There is no documented custody procedure for:
1. How the testnet key is generated and stored
2. Who has access to it
3. How it's rotated
4. When testnet custody cross over to production (the moment of
   `CARDIA_FUNDING_LIVE=true` on production)
5. Where the production key lives (env var is **not** appropriate)

Without a written procedure, "deliberate custody review" is
subjective and ad-hoc — exactly the failure mode the honest gate
is trying to prevent.

## Success criteria

A custody procedure document that answers every question above
concretely. Specifically:
- Testnet key: generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` or
  equivalent, stored in a single named GitHub Actions secret
  (`AZURE_TESTNET_BOOTSTRAP_KEY`), rotated every N testnet cycles.
- Testnet cycle: every cycle's GitHub Actions run is auditable
  (who triggered it, when, what the funding result was). The
  workflow's output is captured as a workflow artifact.
- Testnet → production crossover: the production key is **not** the
  testnet key. It's a fresh key, stored in **Azure Key Vault**
  (managed identity, not env var), and rotated on a defined schedule
  (e.g. monthly, with N-day overlap for in-flight transactions).
- Production flip: requires explicit Steward Council sign-off in
  writing (a decision log entry in `docs/COUNCIL_DECISIONS.md` or
  similar), not just an env var toggle.
- Audit: every live transfer is logged on chain (monad testnet
  explorer / mainnet explorer). The txHash is captured in the
  workflow output and committed to a `docs/AUDIT-LOG/` ledger.

## Action items

- [ ] **Generate a fresh testnet bootstrap key**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  - DO NOT use any prior key. Treat this as production-grade.
  - Add to GitHub repo secrets as `AZURE_TESTNET_BOOTSTRAP_KEY`
    (separate from any existing secret).
  - Delete the key after each successful testnet cycle, OR rotate
    between cycles (choose one and document).
- [ ] **Document the testnet cycle procedure** in
  `docs/CUSTODY.md` (create the file):
  - Key generation
  - Storage (which secret, which environment)
  - Access (who, when)
  - Rotation cadence
  - Deletion procedure after the testnet phase
  - Sign-off chain (founder + at least one Steward Council member)
- [ ] **Document the production crossover** in the same file:
  - New key, fresh (not the testnet key, ever)
  - Azure Key Vault (managed identity) — not env var
  - Rotation schedule (e.g. monthly)
  - In-flight transaction overlap window
  - Emergency rotation procedure (key compromise)
- [ ] **Create a decision log**: `docs/COUNCIL_DECISIONS.md`
  - Each `CARDIA_FUNDING_LIVE=true` decision is recorded with
    date, deciding party, supporting evidence (testnet cycle
    results, custody verification), and a hash of the key
    fingerprint (not the key itself).
- [ ] **Audit log**: `docs/AUDIT-LOG/` directory with one file per
  transfer (or per batch), capturing mandateId, status, txHash,
  testnet or mainnet, and the cycle workflow run URL.
- [ ] **Steward Council sign-off on the procedure** before the first
  testnet cycle with real chain activity. The Council reviews
  `docs/CUSTODY.md` and either signs off or sends back for revision.
- [ ] **Re-verify PROJECT_STATE.md "Honest gate"** — once custody is
  documented, the gate becomes: 1) testnet cycle 1 (dry-run, no real
  chain), 2) testnet cycle 2 (real transfer, small amount), 3)
  testnet cycle 3 (real transfer, full TIER_1 amount), 4) custody
  review, 5) Steward Council sign-off, 6) `CARDIA_FUNDING_LIVE=true`
  on production.

## Related

- `docs/PROJECT_STATE.md` § "Honest gate" — the source of these requirements
- `.github/workflows/testnet-deploy.yml` — the workflow that passes
  `BOOTSTRAP_PRIVATE_KEY=${{ secrets... }}` (this is the leak surface
  to think about)
- `scripts/testnet-cycle.mjs` — the verification cycle
- `monad-ecosystem/packages/sovereign-host/src/lib/keyCustody.ts` —
  the **production** key custody code (uses Azure Key Vault with
  managed identity; this is the right pattern for prod, not testnet)

## Priority

**This week** (the honest gate explicitly lists custody review as
a precondition for `CARDIA_FUNDING_LIVE=true`). The testnet key
itself is fine; the procedure wrapping it isn't.

## Out of scope

- Building a multi-sig key management solution (overkill for the
  current scale; revisit if the project grows)
- Switching the testnet cycle to a remote-attested execution
  environment (consider only if a real adversary threatens the
  CI environment)
