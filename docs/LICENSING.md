# The Sovereign Monad Ecosystem Licensing Map

> Governing scope: the full The Sovereign Monad Ecosystem monorepo.
> Supersedes legacy licensing notes embedded in older subprojects unless a
> written agreement explicitly says otherwise.

## 1. Default Rule

Everything in this repository is proprietary by default.

Repository access means source visibility only. It does not grant production
use, redistribution, resale, sublicensing, hosted-service use, model training
rights, customer deployment rights, or rights to extract private strategy logic.

## 2. Ecosystem Layers

The project is one system with multiple integrated layers:

| Layer | Current location | Licensing posture |
|-------|------------------|-------------------|
| Theo-Techno-Cosmo / LOGOC / TTCL | `theo-techno-cosmo/`, `docs/` | Source-visible doctrine and specifications; proprietary by default |
| Gnostic Engine / Volumetric 4D Engine | `gnostic-engine/` | Internal runtime and API surface; proprietary by default |
| Succor / predecessor Gnosis materials | legacy docs and incorporated engine surfaces | Legacy/predecessor material; governed by this root map |
| Monad Ecosystem | `monad-ecosystem/` | Economic, agentic, execution, contract, and routing surfaces; proprietary by default |
| Control Center / dashboards | `monad-ecosystem/control-center/`, `infrastructure/` | Operational interfaces; proprietary by default |
| Commercial packaging | deployment templates, API/licensing/billing scaffolds | Licensable only when explicitly listed in a written agreement |
| Private alpha surfaces | strategy logic, live execution, capital routing, data routing, customer records, keys, secrets | Not licensed without explicit written permission |

## 3. Public Or Source-Visible Material

Some files are intended to be readable for orientation, diligence, or review:

- high-level README files
- architecture summaries
- public-facing decks or summaries
- doctrine and operating specifications
- non-secret runbooks
- stripped examples and demo scaffolds

Readable does not mean open source. These materials remain proprietary unless a
separate license grants broader rights.

## 4. Commercially Licensable Material

Commercial licenses may cover explicitly named modules or deliverables, such as:

- generic deployment scaffolds
- customer-facing dashboards
- API, billing, and license-service templates
- evaluation packages
- selected agent or engine modules with private logic removed
- operational runbooks intended for customer deployment

Commercial rights must be listed in the applicable order form, statement of
work, contract, or other written agreement. Anything not listed remains excluded.

## 5. Private And Excluded Material

The following are private unless explicitly granted in writing:

- live execution strategy logic
- venue-specific routing, timing, or fill-quality heuristics
- proprietary datasets, labels, and behavioral data products
- capital routing and revenue routing internals
- keys, secrets, deployment credentials, and customer records
- private alpha modules
- unpublished model, agent, or scoring improvements

## 6. Legacy Documents

Older licensing files from predecessor workspaces are retained for historical
context in `monad-ecosystem/legacy/`.

Those files do not govern the current monorepo unless they are incorporated by a
current written agreement or explicitly referenced by this root licensing map.

## 7. Governing Files

Root-level licensing authority lives here:

- `docs/LICENSE.md`
- `docs/LICENSING.md`
- `docs/LICENSE.commercial.md`

If an older subproject file conflicts with these root documents, the root
documents control.
