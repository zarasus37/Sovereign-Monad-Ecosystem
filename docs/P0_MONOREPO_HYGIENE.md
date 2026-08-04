# P0 monorepo hygiene

From the 2026-08 project review (`docs/Review/project review.docx`).  
Implements **policy and guardrails** first; **bulk archive deletion is deferred**.

---

## What “without touching archive bulk” means

| Do now (P0) | Defer (later P2/P3) |
|-------------|---------------------|
| Declare `archive/` and `monad-ecosystem/legacy/` **frozen** | Delete or submodule multi‑GB `archive/generated/` |
| **Forbid live imports** from archive in new code | Rewrite git history for old secrets |
| Point contributors at **live spine** only | Move 144 slot profiles out of tree |
| Tighten `.gitignore` so new secrets/logs don’t land | Full LFS migration of corpora |
| Untrack a **few** secret-adjacent files surgically | Mass `git rm` of entire legacy MEV forests |

**Why defer bulk:** archive is large, already in history, and mixed with material you may still want to *read*. Blowing it away in one commit is high risk (accidental loss, broken links, day-long reviews). Freezing it costs almost nothing and stops entropy growth.

---

## Live spine (import allowlist)

```text
gnostic-engine/
gnosis-training/
monad-ecosystem/packages/ttcl/
monad-ecosystem/packages/gate-acl/
monad-ecosystem/packages/sovereign-bus/
monad-ecosystem/packages/sovereign-types/
monad-ecosystem/packages/sovereign-host/
monad-ecosystem/packages/hepar-service/
monad-ecosystem/packages/logoc/
monad-ecosystem/packages/hcd-monitor/
monad-ecosystem/control-center/
shared/
theo-techno-cosmo/   # doctrine + Councile sources
docs/                # via CANON.md
scripts/
```

Everything else is either supporting tooling or frozen history.

---

## Secret-adjacent inventory (tracked as of P0 scan)

**Do not add new ones.** Review offline if any ever held real keys.

| Pattern | Example paths | P0 action |
|---------|---------------|-----------|
| `local.settings.json` | `archive/infrastructure/api/…`, `monad-ecosystem/legacy/…` | Ignore + untrack when present |
| `*scout-key*.json` | `monad-ecosystem/legacy/.../scout-key.json` | Ignore + untrack |
| Deploy / mainnet proof JSON | under `archive/.../monad-mev-legacy*` | Frozen; do not copy into live packages |
| `.runtime_state/` | archive legacy workspace slot dumps | Ignore going forward; bulk leave in place |

Placeholders (e.g. `UseDevelopmentStorage=true`) still teach a bad pattern if re-committed.

---

## Contributor rules

1. New features land only in the live spine.  
2. Need something from archive? **Copy or promote** into a live package with a PR note — never `import … from '../../../archive/…'`.  
3. Preference pairs and small fixtures may stay git-tracked under explicit allowlists in `.gitignore`.  
4. Prefer `docs/CANON.md` over searching `archive/` for specs.

---

## Done checklist (this P0)

- [x] Root README live set + 15-minute path + Monad L1 disambiguation  
- [x] `docs/CANON.md`  
- [x] `.gitignore` tightened  
- [x] This hygiene note  
- [x] Surgical untrack of known `local.settings.json` / `scout-key.json` (if present)  
- [x] Optional later: gitleaks CI workflow (`.github/workflows/gitleaks.yml`)  
- [ ] Optional later: archive submodule / release artifact split  
- [x] P1 started: golden topology + LIVE_PACKAGES (see `GOLDEN_TOPOLOGY.md`)  
