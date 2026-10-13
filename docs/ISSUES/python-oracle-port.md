# Issue: Port the Python shadow markout oracle

> **Source:** `docs/PROJECT_STATE.md` § "What did NOT change in the
> gap" — "Python oracle at `loop/python/shadow_markout_api.py` is still
> a TODO stub. The TS gate (`assessHalt`) is real; the oracle behind
> it is the heuristic in the stub. Real `shadow_markout_hardened.py`
> lives in the external MEV engine at `C:\Users\crisc\Dev\agents\monad-mev\`
> and has not been ported."
>
> **Why it matters:** The Hepar audit client in
> `@sovereign/cardia-activation-core` calls out to a Python oracle
> for the funding flow's last-mile risk verdict. Currently the oracle
> returns heuristic verdicts. **The TS gate is production-grade; the
> oracle behind it is the open production risk** for the wired
> funding engine.

## Problem

`monad-ecosystem/packages/organs/cardia/cardia-activation-core/python/shadow_markout_api.py`
is a TODO stub. It uses simple heuristics (price staleness > 60s,
sells > $10k = adverse selection, trades > $50k = capacity exceeded)
and returns 200 PASS for normal trades. The TS-side Hepar audit
client in `heparAuditClient.ts` calls this oracle and treats the
response as gospel — the funding engine proceeds when the oracle
says PASS.

The real oracle logic lives in the external MEV engine repo at
`C:\Users\crisc\Dev\agents\monad-mev\` (Windows path on the
developer's machine). The repo also has `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md`
documenting the relationship.

## Success criteria

- `loop/python/shadow_markout_api.py` runs the real
  `shadow_markout_hardened.py` logic (or its port equivalent).
- The TS-side `heparAuditClient.auditAddressForFunding()` consumes
  the real oracle and applies its verdict in `executeFunding()`.
- A vitest test in
  `monad-ecosystem/tests/integration/shadow-markout-oracle.test.ts`
  covers the integration: given a known oracle input, the TS gate
  applies the right decision.
- The "TODO" comment in the stub file is removed.
- The "Honest gate" section in `PROJECT_STATE.md` is updated to
  reflect this resolution.

## Action items

- [ ] **Locate `shadow_markout_hardened.py` in the external engine
  repo** (`C:\Users\crisc\Dev\agents\monad-mev\` or wherever it
  currently lives). The function name in the engine repo may be
  slightly different; the *behavior* is what's needed.
- [ ] **Read the existing `shadow_markout_api.py` interface** to
  understand the contract the TS side expects (request/response
  shape, error handling, latency). Likely a small FastAPI/Flask
  wrapper around the real logic.
- [ ] **Port the real logic** into the existing FastAPI skeleton in
  `shadow_markout_api.py`. Maintain the same `/audit` and `/shadow`
  endpoints so the TS client doesn't need to change.
- [ ] **Add an integration test** that exercises the round-trip:
  - `shadow_markout_hardened.py` returning a verdict
  - `shadow_markout_api.py` wrapping it via HTTP
  - `heparAuditClient.ts` consuming the response
  - The funding flow reacting correctly
- [ ] **Update the **Honest gate** section** of `PROJECT_STATE.md` to
  reflect that the oracle is now real. Re-link to the integration
  test.
- [ ] **(Optional, deeper)** Consider whether the oracle should live
  inside the Sovereign monorepo as a Python package
  (`packages/python-shadow-markout/` or similar) instead of being
  copied from the engine repo. This is a structural call — discuss
  with the founder before doing it.

## Related

- `monad-ecosystem/packages/organs/cardia/cardia-activation-core/python/shadow_markout_api.py` — the stub
- `monad-ecosystem/packages/organs/cardia/cardia-activation-core/src/heparAuditClient.ts` — the TS client
- `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md` — engine repo location + boundary
- `docs/P0_MONADMEV_DECISION_2026-10-11.md` — the engine/library distinction
- `C:\Users\crisc\Dev\agents\monad-mev\` (external) — where `shadow_markout_hardened.py` lives

## Priority

**This week** (per PROJECT_STATE.md "Honest gate"). Blocks
`CARDIA_FUNDING_LIVE=true` on any non-trivial wallet, because a
heuristic oracle can be fooled by adversarial inputs (a $100M trade
might "look normal" by current heuristic standards and pass).

## Out of scope

- Refactoring the oracle to live inside the monorepo (separate
  structural decision)
- Replacing the FastAPI skeleton with a different Python framework
- Building a GraphQL or gRPC interface (REST is fine for now)
