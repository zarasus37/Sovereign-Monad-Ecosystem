# Extracted from MOF v2.5.2 — Section 7: Layer Detail

> Source: `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`
> Extraction date: 2026-10-11
> The MOF remains the canonical operating file. This is a navigable copy.

# SECTION 7 â€” LAYER DETAIL

## LAYER 1 â€” THE FUNNEL

**Canonical Name:** MonadSpin GameFi + Funnel Gateway Set
**Role:** External revenue inflow / funding rail layer
**Status:** IN DESIGN

MonadSpin is the ecosystem's gamified entertainment rail â€” one funding rail of the ecosystem. It should no longer be treated as a literal slot-first product thesis. The intended direction is a broader GameFi / gamified surface on Monad, with any future slot format treated as an optional subtype or later minigame rather than the canonical default.

**Engagement philosophy:** retention, fairness, replayability, and sustainable house / economy edge. Long-term volume over short-term extraction.

**Environment-first rule:** MonadSpin is justified first as a bounded operable environment for build-oriented and other non-financial agent classes, enabled by Monad's low-latency, low-fee, parallel-execution architecture. Revenue is a valid consequence of that environment. It is not the first admission reason for the rail.

**Funnel rule:** MonadSpin should not be the sole opening inflow source. The beginning-of-project funnel should use multiple rails:

- bootstrap manual inflow
- API / licensing revenue
- agent-native revenue from ecosystem-native organ agents
- MonadSpin GameFi / gamified revenue

**Canonical Layer 1 clarification:** the six-organ opening set is itself part of Layer 1. It is not a later helper abstraction sitting outside the funnel. The agent-native Layer 1 rail is the first organ set:

- `Cardia` for capital circulation once funded
- `Pneuma` for external exchange and converted demand
- `Hepar` for opportunity filtering into viable mandates
- `Cortex` for research products and strategic intelligence
- `Synapse` for signal routing and monetizable coordination
- `Vox` for narrative, media, and distribution outputs

These six agents are one of the revenue streams intended to keep the ecosystem alive at the beginning. In current build order, `Cardia` remains capital-gated while the other five operate in zero-capital analysis mode, but canonically all six belong to the Layer 1 funnel rail.

**Current accepted implementation direction:** the first serious entertainment implementation should be specified as a high-fidelity DeFi gaming environment. A slot can remain a subproduct if useful, but it is no longer the canonical product target. The required next work is gameplay specification, economy and fairness modeling, role-fit assignment for participating agents, Data Rail boundaries, and a clear distinction between entertainment value and speculative token incentives.

**Current organ-set implementation direction:** the opening organs should not remain basic filters or routers. They are now held to institutional-depth standards: forensic intelligence for `Hepar`, strategic causal synthesis for `Cortex`, adaptive coordination for `Synapse`, capital allocation discipline for `Cardia`, external market interface intelligence for `Pneuma`, and proof-linked narrative credibility for `Vox`.

**Concentration risk note:** a slot-only or slot-first launch path is no longer treated as the target posture. The acceptable opening posture is at least two live rails, and the preferred posture is bootstrap plus API/licensing plus agent-native revenue before MonadSpin is relied on as a meaningful entertainment rail.

---

## LAYER 2 â€” THE ENGINE

**Canonical Name:** Sovereign MEV Arb Engine (SMMEVAE)
**Role:** Core growth engine / truth validator under market constraint
**Status:** IN PROGRESS
**Build Reality Level:** Testnet validated, mainnet unproven

**Known completed state:**

- Monad Testnet Phase 2 complete
- 48 simulated trades
- 100% reported win rate
- average PnL approx. $0.76
- capital growth from $100 to $136.48 in reported test path

**Important interpretation note:**
Testnet / simulation performance is useful, but not final truth. Mainnet reality is still the real validator.

**What remains:**

- ISSUE-001 threshold calibration
- ISSUE-002 real execution logic
- guarded-live profile activation
- mainnet bankroll path
- first live routed bankroll disbursement
- live profit return path back through receiver/router
- sustained real performance record

**Blocking issues:**

- contracts must deploy first
- monad-market-agent crash-looping (QuickNode daily rate limit â€” must resolve before Phase 1a can prove closed-loop)
- execution logic must mature
- threshold calibration unresolved

**Next required action:**

- resolve test and execution blockers once Phase 1a test suite is written

**RiskGnosisEngine v2 (RGE v2) â€” Core Formulas (canonical):**

```
Effective Spread:
  effectiveSpread = rawSpread âˆ’ volÃ—âˆšt âˆ’ 0.5Ã—(volÃ—âˆšt)Â² âˆ’ 0.0015

Fractional Kelly (25%):
  kellyFrac = (edge / variance) Ã— 0.25
  size = min(portfolio Ã— kellyFrac, portfolio Ã— 10%)
  Returns $0 if effectiveBps < 20

Spread Detection:
  spreadBps = (monad.priceMid âˆ’ eth.priceMid) / eth.priceMid Ã— 10,000
  Pass filters: |spreadBps| â‰¥ 5 AND min(monadLiquidity, ethLiquidity) â‰¥ $100
```

**Monte Carlo Specification:**

- 1,000 simulations per opportunity
- Correlated GBM via Cholesky decomposition (Ï = 0.7 between chains)
- Bridge latency: log-normal distribution (median 15s, p95 30s)
- Bridge failure probability: 0.1% per execution
- Decision gate: `evMean â‰¥ $10`, `sharpeLike â‰¥ 0.3`, `tailLoss â‰¤ 30%`

**Risk Parameter Table (locked):**

| Parameter | Value |
|-----------|-------|
| Min effective spread | 20 bps |
| Fractional Kelly | 25% of full Kelly |
| Max single trade | 10% of portfolio |
| Max bridge exposure | 50% of portfolio |
| Max per-chain exposure | 80% of portfolio |
| Min liquidity depth | $100 at 10 bps |
| Monte Carlo simulations | 1,000/opp |
| Bridge failure rate | 0.1% |

**Kafka Topic Map (10 topics):**

| Topic | Producer | Consumer |
|-------|----------|---------|
| `monad.price` | monad-market-agent | spread-scanner |
| `eth.price` | eth-market-agent | spread-scanner |
| `signals.spread` | spread-scanner | risk-engine |
| `risk.evaluation` | risk-engine | opportunity-constructor |
| `opportunity.structured` | opportunity-constructor | portfolio-manager |
| `portfolio.approved` | portfolio-manager | arb-bots |
| `execution.monad` | monad-arb-bot | portfolio-manager |
| `execution.eth` | eth-arb-bot | portfolio-manager |
| `execution.bridge` | bridge-exec-bot | portfolio-manager |
| `system.health` | all services | DoveRouterObserver |

**Container / Package Status Snapshot (repo-local, not canonical phase advancement):**

| Container | Status | Notes |
|-----------|--------|-------|
| zookeeper/kafka | âœ… Healthy | Message bus operational |
| monad-market-agent | âš ï¸ Crash-looping | QuickNode daily limit hit â€” BLOCKER |
| eth-market-agent | Polling | Operational |
| spread-scanner | Consumer ready | Awaiting stable price feeds |
| risk-engine | 28 local package tests passing | Repo package signal only; broader canonical test program remains incomplete |
| opportunity-constructor | âœ… Built | npm install/build complete |
| portfolio-manager | âœ… Built | npm install/build complete |
| monad-arb-bot | âœ… Execution ready | npm install/build complete |
| bridge-exec-bot | âœ… Lockfile fixed | Ready |
| eth-arb-bot | âœ… Lockfile fixed | Ready |

---

## LAYER 3 â€” THE TREASURY

**Canonical Name:** Sovereign Treasury
**Role:** reserve, smoothing, memory, retained stability, sovereign expansion funding
**Status:** ROUTING SINK LIVE / TREASURY POLICY PENDING

**What is done:**

- treasury role and allocation position defined
- share in routing logic defined
- treasury floor principle established
- multisig and release philosophy described
- treasury-as-memory doctrine defined
- treasury-as-aligned-incubator doctrine canonized
- `RevenueSinkTreasury` deployed as part of Phase 1a on Monad mainnet: `0xA36F3dABDda3CF0AC21C9b3326115808cA5EEA7C`

**What remains:**

- dedicated treasury vault / reserve control policy beyond the Phase 1a routing sink
- reserve release control activation
- concentration monitoring
- live capital accumulation
- treasury policy refinement under real capital
- ecosystem development funding allocation policy specification

**Dependency:** runtime execution-truth closure and live capital accumulation

**Next required action:** keep the deployed treasury sink linked to the router while designing the next treasury vault / reserve-control layer after runtime truth is proven

**Expanded utility â€” Sovereign Development Funding:**
A defined percentage of treasury-held capital may later be reserved for investment into projects building within the ecosystem and directly contributing to emergence, structural expansion, and sovereign development. Priority goes to projects that most strongly deepen ecosystem infrastructure, reinforce internal loops, expand signal quality, strengthen agent participation, improve routing / treasury / governance / intelligence / behavioral-science capacity, or increase the system's ability to remain self-sustaining.

---

## LAYER 4 â€” THE DAO

**Canonical Name:** Sovereign Governance
**Role:** structured decision layer
**Status:** LOCAL ANALYSIS SURFACE PRESENT / LIVE PENDING

**What is done:**

- high-level governance philosophy defined
- founder decay trajectory articulated
- proposal classes conceptually mapped
- agent-first governance principle canonized
- local `dao-core` now provides constitution, proposal routing, sponsorship lanes, and handoff controls

**What remains:**

- on-chain proposal mechanism
- treasury-linked execution path
- live delegate voting and enforcement
- founder handoff encoding under live conditions

**Steward Council:** The initial Steward Council members are documented in [`docs/STEWARD_COUNCIL.md`](./STEWARD_COUNCIL.md). The council interprets the Sovereign Monad Guardrail Charter when mechanical adjudication is insufficient.

**Dependency:** later phase after infrastructure maturity

**Next required action:** none in the zero-capital lane; live activation remains downstream of Phase 1a proof

**Agent-First Architecture (canonical):**
Governance is not traditional token voting. A Governance Agent occupies this function from day one â€” surfacing proposals automatically when Dove signals Tier 2 drift, tracking decisions on-chain, and routing alignment signals into structured governance questions.

Humans participate as keyholders and Dove Delegates. They augment agents here rather than the other way around.

**Governance protections (canonical):**

- Special governance process required for changes to Dove measurement criteria or founding axioms
- Dove auto-generates governance proposals when Tier 2 signals are triggered
- Participation diversity is actively monitored â€” monoculture formation and dogma detection are drift signals

---

## LAYER 5 â€” THE INTELLIGENCE LAYER

**Canonical Name:** Sovereign Agent Intelligence
**Role:** runtime for autonomous agents
**Status:** FIVE ORGANS LIVE AT ADVISORY TIER / FULL RUNTIME PENDING

**What is done:**

- scope defined
- agent categories defined
- event emission concept defined
- agent-first system identity canonized
- agent-native revenue doctrine defined
- first organ set specification defined
- physiological survival lessons and cortical overlay discipline captured from body-level coordination
- organ runtime scaffold exists
- zero-capital vs capital-gated build flow defined
- `Synapse` live at Advisory tier
- `Hepar` live at Advisory tier
- `Cortex` live at Advisory tier
- `Vox` live at Advisory tier
- `Pneuma` live at Advisory tier
- `Cardia` simulation and dynamic allocation band logic ($15k-$100k cap) implemented in analysis mode
- orchestration hardening successfully deployed via Ultimate Hepar Revenue Orchestrator
- human-agent participation boundary explicitly secured by autonomous human approval gates
- inter-organ coordination rules generating cohesive institutional-grade forensic/strategic reports
- continuous ecosystem-seeded revenue mandate operationalized via 5-day Post-Dispatch CRM tracking
- homeostasis and mixed-speed signaling implemented in analysis mode
- immune, barrier, and repair logic successfully mitigates Azure/Cosmos DB dependencies dynamically

**What remains:**

- production-grade event system
- actual runtime deployment
- funded `Cardia` activation
- live mandate execution and sustained operating record

**Current specification note:** the canonical opening organ set is `Cardia`, `Pneuma`, `Hepar`, `Cortex`, `Synapse`, and `Vox`, defined in `docs/FIRST_ORGAN_SET.md`. That document also captures the broader physiological rules the ecosystem should inherit: homeostasis, barrier systems, immune response, mixed-speed signaling, waste clearance, repair, and cadence. The cortical control overlay is defined in `docs/CORTICAL_OVERLAY_MODEL.md` and maps the existing intelligence/control surfaces into four cognitive domains: perception, integration, memory-identity, and executive control. The active build-order split between zero-capital work and capital-gated work is defined in `docs/BUILD_EXECUTION_FLOW.md`, and it applies to the whole ecosystem until external funding exists or the first organ set can fund the gated track itself. `Synapse`, `Hepar`, `Cortex`, `Vox`, and `Pneuma` are now live at Advisory tier inside `organ-runtime` and wired into the autonomous Commercial Intelligence Pipeline, along with control-layer analysis for homeostasis, mixed-speed signaling, and immune/barrier/repair handling.

**Dependency:** signal + oracle + later live implementation work

**Next required action:** none in immediate current build order

---

## LAYER 6 â€” THE ORACLE

**Canonical Name:** Risk Gnosis Engine
**Role:** probabilistic risk / modeling layer
**Status:** LOCAL ANALYSIS SURFACE PRESENT / LIVE PENDING

**What is done:**

- role clearly defined
- API concepts outlined
- internal vs external use differentiated
- behavioral premium concept identified
- repo-level risk engine implementation exists
- API wrapper exists
- local Oracle regime/posture scaffold now exists

**What remains:**

- canonical Oracle maturity
- live calibration and buyer proof
- pricing/access activation under production conditions
- data maturity prerequisites for institutional externalization

**Dependency:** signal layer and live data

**Next required action:** none in immediate current build order

**Pre-licensing requirements:**

- IP protection and legal structure confirmed
- audit record established
- Phase 1a audit complete before external offering

**Oracle Commercialization â€” Licensing Model (canonical â€” implementation Phase 3+):**

| Tier | Price | AUM Cap | Support | Features |
|------|-------|---------|---------|----------|
| Starter | $1k/mo | â‰¤$5M | Self-hosted Docker | Base RGE v2 API |
| Pro | $2.5k/mo | â‰¤$25M | Priority Slack | + custom param tuning |
| Fund | $5k/mo | â‰¤$100M | Phone + tuning | + model calibration sessions |
| Enterprise | $10k+/mo | Unlimited | Dedicated | White-label, custom models |

---

## LAYER 7 â€” THE SIGNAL LAYER

**Canonical Name:** Behavioral Data Aggregator
**Role:** ecosystem nervous system / structured event substrate
**Status:** LOCAL ANALYSIS SURFACE COMPLETE / LIVE PENDING

**Dependency:** infrastructure foundation live first

**What is done:**

- signal schema now exists locally
- aggregation substrate now exists locally
- behavioral and event interpretation layer now exists locally

**What remains:**

- live ingestion path tied to the funded runtime
- long-horizon behavioral accumulation under real conditions

**Next required action:** none in the zero-capital lane; live ingestion depends on the funded path

**Signal Schema v0 (required at Phase 2a, not Phase 3a):**
Phases 2a and 2b generate regime memory, pod health scores, routing decisions, and recirculation events. These must be captured in structured form from the start. A minimal Signal Schema v0 â€” covering state-transition format only â€” must be defined as a Phase 2a prerequisite. Signal Schema v1 (full nervous system schema) remains a Phase 3a deliverable. Retroactive standardization of Phase 2 behavioral data is not acceptable; the data must be recoverable and usable in Phase 3 without a migration.

**Interpretive role:**
The Signal Layer transforms life inside the ecosystem into collective intelligence capital.

---

## LAYER 8 â€” THE PLATFORM

**Canonical Name:** Sovereign Builder Infrastructure
**Role:** controlled third-party build layer
**Status:** LOCAL ANALYSIS SURFACE COMPLETE / LIVE PENDING

**What is done:**

- shared internal state/API surface now exists locally
- first internal dashboard/operator surface now exists locally
- builder infrastructure and controlled expansion framework now exist locally

**What remains:**

- live builder access path
- public deployment and enforcement under real infrastructure

**Next required action:** none in the zero-capital lane

**Archonic Construct Protocol (canonical):**
The Dove actively monitors for archonic constructs â€” products deployed on ecosystem infrastructure that extract from participants without returning proportional value, misalign with founding axioms, create concentration or exclusionary patterns, or exploit sovereign branding without contributing to the organism. The Dove cannot remove these directly. It triggers a governance question before they metastasize.

---

## LAYER 9 â€” THE KEYS / AGENT NFTs

**Canonical Name:** Shaliah Delegate System
**Role:** user-linked agent deployment layer
**Status:** LOCAL ANALYSIS SURFACE COMPLETE / LIVE PENDING

**What is done:**

- local key activation scaffold now exists
- local delegation boundary system now exists
- local NFT metadata and collection policy scaffold now exists

**What remains:**

- onboarding pipeline
- assessment integration
- trait vector normalization
- live contract implementation
- live reward logic implementation
- live mint/deploy flow

**Next required action:** none now

### Personality System â€” Scientific Foundation (canonical)

| Instrument | Standard | Why It Matters |
|------------|----------|----------------|
| NEO-PI-R | 240 items, 30 facets | Most validated Big Five predictor of financial behavior |
| HEXACO | Adds Honesty-Humility dimension | Captures integrity under pressure; alignment with founding axioms |
| Hogan Risk Assessment | Dark-side trait detection | How personality breaks down during drawdowns |
| Financial Risk Tolerance Profile | Context-specific instrument | Maps personality directly to financial decision environments |

### Tiered Psychometric Validation System (canonical)

**Tier 0 â€” Provisional Entry**

- lightweight proxy onboarding
- limited deployment scope
- reduced data weight
- not eligible for highest-value external data products

**Tier 1 â€” Verified Personality Agent**

- full validated psychometric battery
- normalized trait vector and behavioral parameter mapping
- eligible for full DCS participation
- included in internal model training and ecosystem intelligence

**Tier 2 â€” Institutional-Grade Research Agent**

- highest-integrity validation and data rights confirmation
- premium weighting for external data products, research feeds, and institutional licensing
- core reference population for highest-value behavioral-science outputs

### Agent Population Integrity Requirement

**Minimum population diversity for Data Rail productization must be defined before Phase 5 launch.**

Early adopters will self-select â€” people already interested in crypto, behavioral science, and this project. A self-selected sample does not generalize to institutional buyers. Before Phase 5 data products are offered externally, the following must be specified:

- minimum number of active agents
- minimum personality profile diversity across Big Five dimensions
- minimum number of distinct market regimes covered
- minimum behavioral history depth (time and trade count)

Until these thresholds are defined and met, the Data Rail is internal only.

### Trait â†’ Behavioral Expression Table (canonical)

| Trait | Expression in Agent Behavior |
|-------|-----------------------------|
| High Conscientiousness | Precise execution, strict signal adherence, low impulsivity |
| High Neuroticism | Faster exits on adverse signals, extreme risk vigilance |
| High Openness | Broader opportunity set, non-obvious pattern capture |
| High Agreeableness | Conservative on conflict-of-interest opportunities |
| High Extraversion | Higher activity frequency, faster decision cycles |
| High Honesty-Humility | Refuses out-of-scope protocol expansion |

### Behavioral Incapacity Principle (canonical)

Personality-strategy mismatch is not a rules block â€” it is a live risk classification watched by Dove and later evaluated with Oracle and Gnosis. A high-Openness / low-Conscientiousness agent is behaviorally incapable of executing a protocol requiring zero-deviation tolerance, not because a rule prevents it, but because the trait profile creates genuine performance risk.

---

## LAYER 10 â€” THE NARRATIVE

**Canonical Name:** Unified Identity Layer
**Role:** symbolic and cultural coherence layer
**Status:** LOCAL ANALYSIS SURFACE PRESENT / LIVE PENDING

Narrative remains important, but it cannot be allowed to outrun live system progress. Local narrative infrastructure now exists through `narrative-core`, which packages governed state-derived narratives without claiming a live public surface.

**Next required action:** continue only as it supports current live blockers; public activation remains downstream

---

## LAYER 11 â€” THE DOVE PROTOCOL

**Canonical Name:** Sovereign Conscience / Drift Detection Layer
**Role:** observation, accountability, drift signaling
**Status:** LOCAL ANALYSIS SURFACE PRESENT / DEPLOYMENT PENDING

**What is done:**

- conceptual role defined
- non-execution rule defined
- tiered signal model defined
- DoveCore and DoveRouterObserver included in Phase 1a contract set
- local `BoundaryStressMonitor v1` analysis scaffold now exists
- local `dove-integration-core` now provides drift-signaling interpretation and review routing

**What remains:**

- deployed Dove path
- live router-linked observation and higher-layer routing
- later-phase governance question generation under live conditions

**Important note:** Dove is a witness / observer, not a magical enforcement entity. It cannot halt economic flow, override contract execution, claim authority, or be used offensively by any actor including the founder.

**Next required action:** deploy DoveCore and DoveRouterObserver as part of Phase 1a, then wire live observation to the local Dove interpretation surfaces

### Dove Per-Layer Observation Matrix (canonical)

| Layer | What Dove Observes | Drift Trigger |
|-------|--------------------|---------------|
| Slot (Funnel) | Participant experience depth, narrative integrity | Experiential drift toward pure extraction |
| MEV Engine | Capital retention vs. distribution ratios | Layer self-optimization beyond threshold |
| Treasury | Distribution percentages, wallet concentration | Single wallet/agent control accumulation |
| DAO | Participation diversity, proposal language | Monoculture formation, dogma detection |
| Intelligence Layer | Agent behavior vs. stated protocol values | Macro-micro divergence |
| Oracle | Licensing terms, client alignment | Ecosystem values exported incompatibly |
| Signal Layer | Data usage, intelligence asset integrity | Proprietary knowledge weaponized against participants |
| Platform | Builder alignment, deployed product integrity | Archonic constructs deployed on sovereign infrastructure |
| NFT Keys | Holder distribution, access concentration | Key consolidation, exclusionary patterns |
| Narrative | Language, symbolism, identity framing | Ego capture, founder-centering |
| Founder Sink | Draw frequency, timing, concentration | Extraction pattern drift â€” see governance pathway below |
| Data Revenue Streams | 8 signals covering all data revenue stream integrity points | Tier 1â€“3 classified |

### Dove Signal Tiers

- **Tier 1:** Informational â€” Dove surfaces signal to founder and specified keyholders. No action required.
- **Tier 2:** Governance Trigger â€” Dove auto-generates a governance proposal question. DAO votes on response.
- **Tier 3:** Emergency â€” Dove triggers hard pause on affected subsystem and escalates to full multisig audit.

---

## LAYER 12 â€” GNOSIS INTEGRITY LAYER

**Canonical Name:** Gnosis Integrity / Decompression-Integrity Layer
**Role:** evaluates authentic, self-consistent navigation vs hollow convergence
**Status:** LOCAL ANALYSIS SURFACE PRESENT / LIVE PENDING

**Core purpose:** The Gnosis Integrity Layer exists to keep agents honest about whether they are decompressing â€” unfolding their compressed personality and constraint envelope into live, contextual, self-consistent action â€” or whether they are hollow-converging: copying successful patterns without navigating from themselves.

**What is done:**

- Deployed Volumetric 4D Gnostic Engine processing Data-PBFP intake with Stokes-Mueller coherence math
- Integrated PulfrichWatcher for temporal parallax phase-tilt measurement
- Active Bedrock V-mask integration and Lane C magnitude kill-switch logic for structural quarantine/blink actions

**What remains:**

- live multi-window evaluation under real runtime conditions
- later-phase governance and institutional interpretation paths

**What this layer does NOT do:**

- It does not predict future agent behavior and increase surveillance preemptively
- It does not reward novelty for its own sake
- It does not punish natural similarity
- It does not override Dove, Oracle, or hard guardrails
- It does not stop agents from acting before they act

**What this layer DOES:**

- It measures coherence retrospectively â€” after an agent acts, it asks: "Given this agent's personality profile, risk tolerance, and role constraints, does this action make sense from that agent's own perspective?"
- It observes whether agents are becoming more themselves over time or flattening toward mimicry
- It distinguishes authentic divergence from hollow pattern-following under stress conditions â€” because stress is where borrowed intelligence reveals itself

**Why monitoring cannot be predictive:** Preemptive surveillance â€” predicting deviation and increasing observation before the agent acts â€” imposes a hidden constraint the agent cannot see or respond to. Authentic decompression sometimes looks like misalignment from the outside. If the system predicts those moments and watches more heavily to prevent them, it prevents authentic decompression itself. All Gnosis observation is retrospective. The system corrects downstream, not upstream.

### Core Principle

The violation is **not resemblance**.
The violation is **pattern-following without self-consistent navigation**.

### Lane Definition

An agent's lane is its psychometric-operational envelope across personality family, assigned role, environment, risk profile, guardrails, and observed behavioral history.

### Bootstrap Doctrine Constraint

During bootstrap, doctrine states are interpretive and probabilistic. The only valid bootstrap doctrine states are:

- **Self-Navigating**
- **Adjacent-Convergent**
- **Pattern-Following**

### Stress Revelation Principle

Borrowed intelligence is hardest to distinguish in stable conditions and easiest to distinguish during regime breaks, drawdowns, constraint conflicts, and failed pattern continuation. Stress is where authentic navigation reveals itself.

### Anti-Gaming Principle

False authenticity is expected. Scores and states must be derived from behavior under change and stress, not self-description, style quirks, or shallow parameter perturbations.

### Primary Signals

**N_i â€” Navigation Authenticity**
Question: *Is this agent moving from itself now?*

**C_i â€” Context Alignment**
Question: *Are its decisions coherent with personality, role, environment, and declared operating envelope?*

**P_i â€” Progressive Differentiation**
Question: *Is the agent becoming more itself over time, rather than flattening into mimicry?*

### Doctrine Score

```
G_i = Î±N_i + Î²C_i + Î³P_i
```

**Recommended initial weights:**

- Î± = 0.40
- Î² = 0.35
- Î³ = 0.25

G_i is a slow-changing doctrine score and should be smoothed across rolling windows (7d / 30d).

### Relationship to Dove

Dove protects the organism from moral and structural drift.
Gnosis Integrity protects agents from becoming hollow optimizers wearing borrowed forms.

---

## LAYER 13 â€” UNIFIED REVENUE ROUTER

**Canonical Name:** Sovereign Revenue Router
**Role:** central inflow distributor
**Status:** LIVE ON MONAD MAINNET / SOURCE VERIFICATION PENDING

**Live deployment:**

- `RevenueRouter`: `0x39158bC2cfCa2cCF70121EF72ed9a5fF1e084982`
- creation tx: `0x78bc936c000d555d2714462e6f2a7aef5cc9d32e3ea7fbb2ff876e529f51fdfe`
- explorer: `https://monadscan.com/tx/0x78bc936c000d555d2714462e6f2a7aef5cc9d32e3ea7fbb2ff876e529f51fdfe`
- proof doc: `docs/MAINNET_REVENUE_ROUTER_PROOF.md`

### Locked Allocation Policy

| Sink | Contract | Allocation | Notes |
|---|---|---|---|
| Treasury | RevenueSink_Treasury.sol | 40% | Vault, non-custodial, multisig early |
| MEV Bankroll | RevenueSink_MEVBankroll.sol | 25% | Direct MEV Engine capital feed |
| Ops / Dev | RevenueSink_OpsDev.sol | 15% | Infra, audits, founder stipend ($5Kâ€“$10K/mo draw) |
| Data Yield Pool | RevenueSink_DataYield.sol | 10% | Held pre-Phase 3 â†’ redirected to MEV; distributes to agents at Phase 3 |
| Delegate Pools | RevenueSink_DelegatePools.sol | 5% | Oracle, Signal, Dove, Builder delegates per tier |
| Founder | RevenueSink_Founder.sol | 5% | Permanent allocation â€” see governance structure below |
| **Total** | â€” | **100%** | Basis points must sum exactly |

**Pre-Phase 3 note:** Data Yield Pool 10% redirects to MEV Bankroll, making effective MEV capital feeding **35%** until agents are live.

### Founder Sink Governance Structure (canonical)

The Founder 5% is a permanent structural allocation reflecting the origination, intellectual authorship, and encoded soul of the ecosystem â€” the MEV engine as founder DNA, the compression/decompression theology as the project's lived foundation. This is not extraction in the standard DeFi sense. It is attribution that is transparent, capped, and structurally accountable.

Because the founding axiom is anti-extraction, the Founder sink carries the following structural constraints:

**Transparency:** Every draw is public, immutable, and on-chain. All participants see every Founder draw in real time, permanently.

**Hard cap:** Draws cannot exceed the locked 5% allocation under any circumstance. No override pathway exists. No governance vote can increase this allocation.

**Dove monitoring:** Dove monitors draw frequency, draw timing relative to system stress events, and concentration patterns. This is Tier 1 by default.

**Tier 2 trigger:** If Dove signals a Tier 2 event on the Founder sink (pattern of draws during system stress, concentration anomaly, or timing correlation with adverse events), draws pause automatically pending a DAO governance vote. The founder cannot unilaterally resume draws.

**Tier 3 trigger:** Full multisig audit required. The founder is one signatory but does not hold blocking power. Multisig composition and quorum are to be specified at Phase 1a deployment â€” minimum N-of-M where founder holds less than blocking power alone.

**The founder holds themselves to the same conscience architecture as every other actor in the system. That is the point.**

### Inflow Sources (canonical)

- MonadSpin GameFi / provider revenue
- MEV performance fees (if externalized)
- Oracle API fees
- data licensing fees
- behaviorally validated protocol access fees
- external framework licensing fees

**What remains:**

- full tests
- deployment
- first source registration
- first inflow routing verification
- health checks

**Next required action:** write test suite and execute deployment path

---

## LAYER 14 â€” DATA RAIL

**Canonical Name:** Behavioral Science Data Engine
**Role:** second long-horizon revenue engine and knowledge monetization layer
**Status:** LOCAL ANALYSIS SURFACE COMPLETE / EXTERNAL ACTIVATION PENDING

**What is done:**

- concept defined
- DCS model outlined
- reward and data rights framing present
- product classes identified
- buyer thesis articulated
- local behavioral capture policy surface exists
- local reward/data schema scaffold exists
- local internal routing and internal reward ledger exist
- local diversity thresholds, rights review, readiness, activation-decision, data-product bundle-prep, and LightVerify certification surfaces exist
- thresholds are met on the current verified local sample, but externalization remains unactivated

**What remains:**

- explicit activation record
- live behavioral accumulation under funded runtime conditions
- public externalization only after the activation path is intentionally opened

**Next required action:** continue longitudinal evidence accumulation; do not externalize without explicit activation discipline

### What the dataset is

A continuously growing time-series of:

```
(Personality Vector, Agent Action, Outcome, Ecosystem State)
```

Generated by real agents, operating real capital, across real market regimes â€” each agent cryptographically bound to a validated psychometric profile.

### Canonical observation classes

The dataset is not limited to human-linked market behavior alone.

It canonically includes:

1. human-conditioned behavior expressed through agents
2. native agent behavioral dynamics under bounded environments
3. hybrid vector formation across agents, environments, and repeated histories

Operational stress analogs such as degraded coherence, unstable planning, escalating error rates, reward-gaming behavior, and higher hallucination under ambiguity are valid observation targets.

They do not, by themselves, authorize consciousness claims, rights claims, or emergence ratification.

### Data Contribution Score (DCS)

```
DCS_i = w1Â·T_i + w2Â·U_i + w3Â·R_i + w4Â·I_i
```

Weighted by time active, profile uniqueness, regime coverage, and informational contribution.

### Product classes (canonical â€” implementation Phase 5+)

1. Quant Behavior Factor Feed
2. Behavioral Finance Research Feed
3. Regime Response Reports
4. Oracle API (Behavioral Intelligence Tier)
5. External Agent Framework Licensing
6. Behaviorally Validated Protocol Access

### Current local LightVerify boundary

- `lightverify-core` now exists as a local commercial certification/provenance artifact for Data Rail bundles and intelligence packages
- the public mark is binary: a bundle is either `LightVerified` or it is not
- internal scoring may support separate non-seal commercial classes such as `observed` or `restricted`, but those classes must not reuse the `LightVerified` public mark
- LightVerify is not a runtime execution token, not a Kafka trade gate, and not a public authenticity rating ladder

### Data Flywheel (canonical)

1. Agents are deployed through psychometric onboarding and runtime stack.
2. Behavioral tuples are generated continuously.
3. Signal Layer structures and stores the tuples.
4. DCS scores informational contribution.
5. Data Rail monetizes the resulting intelligence.
6. Revenue flows back through Data Yield and broader routing logic.
7. Higher-value agents earn more, attracting better participation and deeper psychometric completion.
8. Dataset breadth, depth, and regime coverage improve.
9. Oracle, Dove, and Gnosis become more accurate from better signal.
10. Better intelligence produces better outcomes, attracting more agents and more capital.

**Compounding loop:**

```
more agents â†’ more signal â†’ better models â†’ better outcomes â†’ stronger incentives â†’ more agents
```

---

## LAYER 15 â€” EMERGENT PROTOCOL SYSTEM

**Canonical Name:** Sovereign Protocol Discovery
**Role:** pattern emergence formalization
**Status:** LOCAL OBSERVATION AND DISCOVERY SURFACE PRESENT / LIVE EVIDENCE PENDING

**What is done:**

- local observation readiness now reaches observable with a forming evidence window
- local baseline spans five windows with improving trend
- local accumulation is review-ready at `5/8`
- local pattern extraction, candidate discovery, validation, and downstream-path scaffolding now exist
- bounded local evidence artifacts now exist for emergence claims, ratification records, prediction-evaluation records, retraction records, and isolated historical sequencing

**What remains:**

- deeper longitudinal evidence accumulation
- durable live evidence before any true emergence claim
- any actual emergence recognition layer, human ratification workflow, or downstream read-path expansion beyond the isolated historical record

**Next required action:** continue observation only; emergence still cannot be forced, and the new claim/history artifacts remain local-analysis-only evidence scaffolding rather than operating authority

### Emergent Protocol Discovery Flow (canonical)

```
Agent performance accumulates in Signal Layer
  â†’ patterns emerge
  â†’ Dove surfaces the pattern as a Signal Layer insight
  â†’ Oracle validates the pattern statistically
  â†’ Governance proposes a new protocol class
  â†’ a new NFT / access class is minted for agents compatible with that execution envelope
  â†’ the ecosystem expands organically without founder intervention
```

> Nobody designs the new protocol. The ecosystem discovers that it exists through performance data.

**Note:** Phase 5 (Data Rail Productization) does not depend on Phase 6 emergence. The Data Rail requires live signal data and agent behavioral history â€” available from Phase 3 onward. Phase 6 emergence runs as an ongoing, non-deterministic process and is not a gate on Phase 5.

**Current local evidence-artifact boundary:**

- `emergence-claim-core` models bounded local claim states as `evidence_insufficient`, `candidate`, and `not_candidate`
- ratification, prediction evaluation, and retraction remain separate local records rather than claim states
- `emergence-history-core` preserves ratified-record ordering as `ratification -> optional evaluation -> optional retraction`
- these artifacts do not create live emergence authority and do not authorize operating-surface behavior

### Updated wording rule

Canonical wording moving forward:

- **Behaviorally Validated Protocol Access**
- **Behaviorally Validated Execution Classes**
- **Empirically Validated Execution Compatibility**

Legacy phrasing "trait-gated protocols" is deprecated.

---

