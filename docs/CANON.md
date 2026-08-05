# Canon index — single source map

> **P0:** If two docs disagree, follow this table’s **Authority** row and the higher-ranked file.  
> Archive exports and NotebookLM dumps are **not** canon.

## Authority order

1. `docs/CHARTER.md` — non-negotiable guardrails  
2. `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md` — operating backbone (**use 2.5.2, not archive 2.3.x**)  
3. Domain specs below  
4. Package READMEs / ADRs for implementation detail  
5. Historical copies under `archive/` — **reference only**

---

## Core product canon

| Topic | Canonical path |
|-------|----------------|
| Entry / live set | Root [`README.md`](../README.md) |
| Repo layout | [`REPO_STRUCTURE_MAP.md`](REPO_STRUCTURE_MAP.md) |
| Build map | [`ECOSYSTEM_BUILD_MAP.md`](ECOSYSTEM_BUILD_MAP.md) |
| Sync discipline | [`CANONICAL_SYNC_DISCIPLINE.md`](CANONICAL_SYNC_DISCIPLINE.md) |
| Project resume state | [`PROJECT_STATE.md`](PROJECT_STATE.md) + `PROJECT_STATE.json` |
| P0 hygiene | [`P0_MONOREPO_HYGIENE.md`](P0_MONOREPO_HYGIENE.md) |
| Golden topology | [`GOLDEN_TOPOLOGY.md`](GOLDEN_TOPOLOGY.md) + root `docker-compose.yml` |
| Live package STATUS | [`LIVE_PACKAGES.md`](LIVE_PACKAGES.md) |

## Doctrine & constraints

| Topic | Canonical path |
|-------|----------------|
| Master Operating File | [`SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`](SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md) |
| Theo-Techno-Cosmo (ops) | [`THEO_TECHNO_COSMO.md`](THEO_TECHNO_COSMO.md) |
| LOGOC dual-wheel | [`LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md`](LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md) |
| Constraint packs (machine) | `shared/constraints/` |
| Schemas | `shared/schemas/` |
| Council of Reflection | `theo-techno-cosmo/THE COUNCILE/` + `council-registry.json` |

## Shaliah & dual population

| Topic | Canonical path |
|-------|----------------|
| Identity v2 | [`SHALIAH_IDENTITY_V2.md`](SHALIAH_IDENTITY_V2.md) |
| Shaliah vs Autonomous | [`SHALIAH_VS_AUTONOMOUS.md`](SHALIAH_VS_AUTONOMOUS.md) |
| Vector 1 door | [`VECTOR1_ONBOARDING_REDESIGN.md`](VECTOR1_ONBOARDING_REDESIGN.md) |
| Journey / FG | [`JOURNEY_MAP.md`](JOURNEY_MAP.md), [`FG_CURRICULUM.md`](FG_CURRICULUM.md) |
| Agents overview | [`SHALIAH_AGENTS.md`](SHALIAH_AGENTS.md) |
| Collaboration charter | [`SHARED_AI_COLLABORATION_CHARTER.md`](SHARED_AI_COLLABORATION_CHARTER.md) |

## Runtime spine (code)

| Topic | Canonical path |
|-------|----------------|
| LOGOC pipeline | `gnostic-engine/src/gnostic_engine/core/logoc_pipeline.py` |
| TTCL runtime | `monad-ecosystem/packages/ttcl/src/runtime/index.ts` |
| Gate closed loop | `monad-ecosystem/packages/gate-acl/src/closedLoop.ts` |
| Types / bus / host | `monad-ecosystem/packages/sovereign-{types,bus,host}/` |
| HEPAR service | `monad-ecosystem/packages/hepar-service/` |
| Control center | `monad-ecosystem/control-center/` |

## Gnosis training

| Topic | Canonical path |
|-------|----------------|
| Scale plan | [`gnosis-training/SCALE_250_TO_25K.md`](gnosis-training/SCALE_250_TO_25K.md) |
| Provenance | [`gnosis-training/PREFERENCE_PROVENANCE.md`](gnosis-training/PREFERENCE_PROVENANCE.md) |
| Core resonance | [`gnosis-training/CORE_RESONANCE.md`](gnosis-training/CORE_RESONANCE.md) |
| Preference corpus | `gnosis-training/data/preference_pairs_ALL.jsonl` |

## Privacy / ZKP (design)

| Topic | Canonical path |
|-------|----------------|
| ZKP doctrine | [`../ZKP/README.md`](../ZKP/README.md) |
| Claim map | [`../ZKP/CLAIM_MAP.md`](../ZKP/CLAIM_MAP.md) |
| Dual-pop ZKP decision | [`../ZKP/DECISION_DUAL_POP.md`](../ZKP/DECISION_DUAL_POP.md) |
| Phase 0 schemas | `shared/schemas/meshaleach-poc.json`, `consent-grant.json`, `memory-epoch-commit.json` |
| Phase 0 types | `@sovereign/types` — `MeshaleachPoC`, `ConsentGrant`, `MemoryEpochCommit` |
| Consent-graded data | [`Shaliah Agents/consent-graded-data-exchange-whitepaper.md`](Shaliah%20Agents/consent-graded-data-exchange-whitepaper.md) |

## Explicitly non-canon

- `archive/generated/notebooklm-manifest-export/**` (including numbered README_*)  
- `archive/**` MOF or LOGOC copies older than paths in this file  
- `docs/Review/**` third-party reviews (input, not law)  
- `monad-ecosystem/legacy/**` except as historical reference  

When in doubt: **live package source + this index**, not archive prose.
