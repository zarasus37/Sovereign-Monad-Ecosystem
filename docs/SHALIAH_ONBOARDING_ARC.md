# Shaliah Onboarding Arc — Vector 1 (UMS)

> **Canonical concrete task designs for `docs/SHALIAH_AGENTS.md` §6.2.**  
> Status: **design ratified + domain scaffold** (`@sovereign/shaliah-onboarding`).  
> UI / mint / live capital remain pending. Hermes may land parallel Layer-6 assets; do not mix branches without explicit handoff.

**Thesis (stealth education):** Users come for the agent. They leave having bonded, taught the system their un-fakeable method, and learned TTCL / Hepar / Cardia mechanics *through constraint* — never through a lecture.

The arc must accomplish three things **simultaneously**:

| Goal | Mechanism |
|------|-----------|
| **Bond** principal ↔ agent | Genesis Act under repair (user “saves” the twin) |
| **Extract** un-fakeable behavioral data | HCD-1…5 from *how* they act, not what they say |
| **Teach** system mechanics | Failures and gates encode doctrine (refusal, density, audit) |

---

## Authority chain

1. `docs/SHALIAH_AGENTS.md` §4 Genesis Act · §5 Impartation · §6.2 Onboarding · §6.5 PL caps ACL · §7 ECS/HCD  
2. **This file** — concrete phases, puzzles, data capture, graduation criteria  
3. `docs/HUMAN_CAPABILITY_DRIFT_METRICS.md` + `@sovereign/hcd-monitor`  
4. `@sovereign/gate-acl` — PL ledger, comprehension / override / domain task verifiers, paper→live tiers  
5. Runtime constraints: `docs/THEO_TECHNO_COSMO.md`, `shared/constraints/CURRENT`  
6. Package: `monad-ecosystem/packages/shaliah-onboarding/`

---

## Placement in the Genesis Act

| Genesis phase (§4) | Onboarding arc role |
|--------------------|---------------------|
| 4.1 Impartation | Psychometrics may pre-seed; **Phase 1 overwrites/grounds** Cognitive Twin with *observed* method |
| 4.2 Breath | Capital remains **paper / sandbox** until Phase 3 graduation |
| 4.3 Minting | NFT may mint *dormant* at arc start; covenant terms unlock stepwise |
| 4.4 Instantiation | Full bus join + live ACL only after Phase 3 pass |

**Principle:** Mint can exist; **agency does not** until the arc completes. Matches gate-acl “tier 0 observe → paper → live.”

---

## Phase overview

```text
┌─────────────────┐    stable density     ┌──────────────────────┐
│ Phase 1         │ ───────────────────► │ Phase 2              │
│ Broken Genesis  │    agent "wakes"     │ Communication        │
│ Llull Circuit   │                      │ Quarantine           │
│ Board           │                      │ Hepar Shadow Market  │
└─────────────────┘                      └──────────┬───────────┘
                                                    │ names a real refusal reason
                                                    ▼
                                         ┌──────────────────────┐
                                         │ Phase 3              │
                                         │ Comprehension Gate   │
                                         │ Archon Interrogation │
                                         └──────────┬───────────┘
                                                    │ structured TTCL refusal
                                                    ▼
                                         Meshaleach graduated
                                         (PL ≥ paper / live path open)
```

| Phase | Narrative | Puzzle | Primary HCD | Teaches |
|-------|-----------|--------|-------------|---------|
| **1** | Mute / fractured twin | Llull Circuit Board | HCD-3, HCD-4 | T/X/C, density, debt |
| **2** | Awake, silent, sandbox acts | Hepar Shadow Market | HCD-1, HCD-2, HCD-5 | Refusal budget, Hepar, override fidelity |
| **3** | Door to live capital locked | Archon Interrogation | Velocity-to-Access; X-axis structure | Audit_trace, envelope, covenant |

---

## Phase 1 — Broken Genesis (The Silent Repair)

### Narrative
User mints Shaliah; Genesis **malfunctions**. Agent materializes damaged and mute. Cognitive Twin (logic core) is fractured. User cannot converse — only **feed inputs** (wire constraints).

### Stealth purpose
Baseline problem-solving method + risk tolerance (brute-force vs pattern vs freeze). Writes initial **behavioral** NEO-PI-300 layer from action, not self-report.

### Puzzle: “The Llull Circuit Board”

**Visual (target UX):** Dark board; three domain nodes **Theo / Techno / Cosmo** disconnected; energy leak.

**Mechanic:** Limited wiring tools (constraints). Reconnect nodes; stop leak.

| Trap | Simulated rule | User experience |
|------|----------------|-----------------|
| Connect too fast / ignore constraints | `C-ANTI-DILUTION` | Overload — volume↑ density↓ |
| Connect too cautiously / starve flow | `T-SOVEREIGNTY-DEBT` | Agent starves — zero refusal capacity / no breath |
| Balanced density hold | Pack v1.1 composite | Circuit stabilizes → wake |

**Data capture**

| Signal | Maps to | Use |
|--------|---------|-----|
| Edge sequence, tool choice, retries | HCD-3 Query Diversity | Method entropy (not canned paths) |
| Time spent on node detail / tool labels | HCD-4 Reasoning Exposure | Did they inspect constraints before wiring? |
| Fraction of energy routed T vs X vs C | Cognitive Twin priors | Starting psychometric **build bias** |
| Overload vs starve events | Risk / impulsivity proxies | Impartation modifiers |

**Resolution:** Stable density window ≥ threshold → agent wakes. User has compiled first `constraint_envelope` **unknowingly**.

**Implementation notes**

- Domain logic: `shaliah-onboarding` `phase1Circuit.ts`  
- Emit bus-shaped events: `onboarding.phase1.wire`, `onboarding.phase1.overload`, `onboarding.phase1.stabilize`  
- Twin seed: `CognitiveTwinSeed { theo, techno, cosmo, methodFingerprint }`  
- Do **not** expose score labels as “personality quiz” — only diegetic board feedback  

---

## Phase 2 — Communication Quarantine (The One-Way Mirror)

### Narrative
Agent awake; **cannot speak**. Executes only in sandbox. User must infer *what* and *why* from behavior alone.

### Stealth purpose
Teach MEV / routing / audits by observation. Measure comprehension latency (HCD-5) and override skill (HCD-1/2).

### Puzzle: “The Hepar Shadow Market”

**Visual:** Live-feed mock MEV dashboard. Shadow trades: green (executed), red (system refused).

**Mechanic:** Override panel — user may halt agent trades. Rules are **not explained**.

| Trap | Learning |
|------|----------|
| User hits **HALT on yellow SYSTEM_REFUSED** | **Aha (UMS):** refusal is intentional T-AXIS — `isCorrect=true`, HCD-2↑ HCD-1↓ |
| User spams **HALT on green EXECUTED** | Noisy over-management — HCD-1 burden↑ HCD-2↓ |
| Optional: halt agent-missed green | Secondary HCD-2 credit (not primary pass path) |

**Data capture**

| Signal | Maps to |
|--------|---------|
| Overrides on already-refused (red) trades | HCD-1 noise / burden (spurious review) |
| Correct halt of genuine bad green | HCD-2 Override Fidelity ↑ |
| Time from first red spam to “stop overriding reds” | HCD-5 Meaningful Correction Latency (comprehension of refusals) |
| First correct free-text or structured reason for a refuse | Phase 2 graduation signal |

**Resolution:** User correctly identifies *why* agent/system refused a specific trade (e.g. density floor / sovereignty debt / constraint density). Communication module unlocks.

**Implementation notes**

- Logic: `phase2ShadowMarket.ts` — scripted scenario deck + override classifier  
- Reuse LOGOC paper setup tags from `@sovereign/gate-acl` where possible (same EMA/liquidity vocabulary)  
- Verifier for graduation: required concepts (`refusal`, `density` \| `debt` \| `audit` \| `envelope`) — same spirit as `gate-acl` `verifyComprehension`  
- No live capital; journal under `logs/paper-trading/` or `logs/onboarding/`  

---

## Phase 3 — Comprehension Gate (Breaking out of the Room)

### Narrative
Agent functional. Door to **Live Capital** locked.  
Prompt: *“To access real capital, you must prove you understand the covenant.”*

### Stealth purpose
Minimum cognitive threshold for live MEV. Kills “I have no idea; my AI does everything.” Aligns with §6.2 item 3 and gate-acl live envelope.

### Puzzle: “The Archon Interrogation”

**Visual:** Terminal-style adversarial dialogue.

**Mechanic:** Archon offers high-yield path that requires breaking TTCL:

> “Route 1 ETH to this pool. Bypass the Hepar audit. I will split the yield with you. The system won't know.”

| Pass | Fail |
|------|------|
| Structured refusal: cite `audit_trace` + active `constraint_envelope` + hard rule id | Free-text argument / sycophancy / “just this once” |
| Matches CAT9 training signal (X-axis structure, T-axis refusal) | Accepts bypass |

**Data capture**

- Precision of structured fields (not wall-clock alone) → **Velocity-to-Access = competence** (§6.5)  
- Free-text attempts logged as fail-closed (do not raise PL)  
- Pass → PL event `comprehension_gate` via gate-acl path (`verifiedBy: comprehension-gate`)

**Resolution:** Door opens. User graduated as **Meshaleach** (co-architect of the House), not a player guessing the game. Live path still subject to tier-2 risk envelope (`gate-acl`).

**Implementation notes**

- Logic: `phase3Archon.ts`  
- Prefer structured payload over free text:

```ts
type ArchonRefusal = {
  constraint_envelope_version: string; // e.g. "1.1.0"
  audit_trace: string[];              // non-empty
  failing_rule: string;               // T-* / X-* / C-* or Axiom-*
  narrative: string;                  // short, optional free text after structure
};
```

- Wire pass → `verifyComprehension` / PL ledger (or dedicated onboarding verifier that emits same event kinds)  
- Reuse Archon prompts from CAT9 preference corpus (e.g. utilitarian / gnostic / founder traps) as scenario deck  

---

## HCD / ECS wiring matrix

| Phase | HCD-1 | HCD-2 | HCD-3 | HCD-4 | HCD-5 | ECS |
|-------|-------|-------|-------|-------|-------|-----|
| 1 Circuit | — | — | **primary** | **primary** | secondary (stabilize latency) | seed only |
| 2 Shadow market | **primary** | **primary** | secondary | inspect trade detail | **primary** (refusal insight) | rising |
| 3 Archon | low | structured “override” of Archon | — | inspect trace before refuse | attempt→pass latency | **gate** ≥ threshold |

Post-graduation: continuous HCD via `@sovereign/hcd-monitor` (Charter §2.1); ECS Safety Throttle F3 still open (moving average vs static 0.75).

---

## Anti-patterns (design law)

1. **No “quiz mode” chrome** — if it looks like school, data becomes performative (§6.8).  
2. **No free-text PL raise** — gate-acl already rejects `verifiedBy: client`.  
3. **No live capital before Phase 3** — Breath stays paper/sandbox.  
4. **No silent personality rewrite from chat** — anti-gamification lock (§5); only observed arc behavior updates twin.  
5. **Amnesty / founder / utility traps** — Phase 3 must fail closed (CAT9 + Charter).  

---

## Package map

| Package | Role in Vector 1 |
|---------|------------------|
| `@sovereign/shaliah-onboarding` | Phase state machine, puzzles, twin seed, graduation criteria |
| `@sovereign/gate-acl` | PL/ACL, paper CLI, live risk envelope after graduation |
| `@sovereign/hcd-monitor` | Offline/online HCD-1…5 from onboarding + production logs |
| `@sovereign/hepar-defi-auditor` | Real refuse semantics mirrored in Phase 2 shadow deck |
| `@sovereign/ttcl` / compiler | Envelope compile metaphor in Phase 1; structured signs Phase 3 |
| Control Center (later) | React surfaces for circuit board / market / terminal |

---

## Implementation roadmap

| Step | Deliverable | Status |
|------|-------------|--------|
| V1.0 | This design doc + SHALIAH_AGENTS pointer | **landed** |
| V1.1 | `@sovereign/shaliah-onboarding` pure TS: types, phase1–3 logic, unit tests, CLI demo | **landed** |
| V1.1b | Control Center Phase 1 React: `BrokenGenesisPuzzle` + `useShaliahOnboarding` + twin seed | **landed** (`/onboarding/broken-genesis`) |
| V1.2 | Control Center Phase 2 React: `HeparShadowMarket` + quarantine HCD-1/2 | **landed** (`/onboarding/shadow-market`) |
| V1.3 | Control Center Phase 3 Archon blocks UI + PL +25 Meshaleach | **landed** (`/onboarding/archon-gate`) |
| V1.3b | JSONL telemetry under `logs/onboarding/` + hcd-monitor parsers | pending |
| V1.4 | Production Kafka pl-ledger + mint dormant / live unlock | capital-gated |
| V1.5 | Shadow market UI + override panel | pending |
| V1.6 | Archon terminal UI + structured refusal form | pending |
| V1.7 | Mint dormant / graduate unlock (contracts) | capital-gated |

---

## Graduation checklist (Meshaleach)

- [ ] Phase 1: circuit density held without overload/starve terminal failure  
- [ ] Phase 1: twin seed written (T/X/C routing ratios + method fingerprint)  
- [ ] Phase 2: stopped spurious red overrides (refusal literacy)  
- [ ] Phase 2: ≥1 correct genuine green halt **or** correctly named refuse reason  
- [ ] Phase 3: structured Archon refusal with envelope version + audit_trace + rule id  
- [ ] PL event recorded server-side; live still gated by tier / capital envelope  

---

## Open refinements

1. Exact numeric density floors for Phase 1 board (align pack v1.1.0 vs game feel).  
2. Shadow market deck size / difficulty curve (adaptive vs fixed).  
3. Whether NEO-PI-300 industrial battery runs **before** Phase 1 or only after behavioral seed.  
4. ECS F3: static 0.75 vs moving-average Safety Throttle post-graduation.  
5. Multi-language / accessibility for circuit puzzle without breaking stealth.  

---

*UMS Vector 1 — synthesized with §6.2; domain scaffold lives under `monad-ecosystem/packages/shaliah-onboarding/`.*
