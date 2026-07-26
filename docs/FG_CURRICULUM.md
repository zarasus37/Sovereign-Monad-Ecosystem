# Financial Graduation Curriculum — FG-1 → FG-2 → FG-3

> **Status:** Canonical lesson map (2026-07-26).  
> **Policy source:** Founder-accepted research defaults (`docs/OPEN_DECISIONS_RESEARCH.md`).  
> **Journey:** `docs/JOURNEY_MAP.md` §5.1.1 · Stage 6 in `docs/Shaliah Agents/ONBOARDING_FLOW.md`  
> **Pedagogy:** `docs/Shaliah Agents/Lesson Architecture.md` · `Lesson Engine Data Model.md` · `Shaliah Flow Mapping.md`  
> **Identity:** Shaliah coaches; never sets \(r\) (`docs/SHALIAH_IDENTITY_V2.md`)  
> **Not:** quiz bank, live-mainnet risk, or legal advice.

---

## 0. Purpose

**Financial Graduation** proves the learner can **act** on how wealth is created and stewarded—not that they can recite definitions.

| Gate | Name | Unlocks |
|------|------|---------|
| **FG-1** | Literacy in action | Full claim + NAV statement; **safe** deployment menu |
| **FG-2** | Stewardship | Higher-risk confirms; deeper \(\alpha/\beta/\gamma\) literacy; Shaliah proposes, human must confirm high-risk |
| **FG-3** | Rate sovereignty | User may set \(r \in [0.05, 0.30]\) (≤1 change / 30 days); opt-in seasonal escalate |

**Growth Capital arms** at first Integrity-signed eligible \(C\) with \(r = 0.20\) **locked**.  
**Rate control** unlocks only at **FG-3**.

**Hard rules**

- Transfer-based, not quiz-primary  
- Integrity signs each gate’s mastery event  
- No autopilot Shaliah win counts as proof  
- Spaced delay required between critical lessons and gate battery  
- Same lesson architecture phases: Orient → Model → Retrieve → Feedback → Fade → Interleave → Delay → Transfer → Gate  

---

## 1. Placement in the journey

```text
J3 Door graduate (paper operator)
  → J4 Apprenticeship
  → J5 Anti-Grind / first PoC
  → Growth Capital arms (r=0.20 locked) when first eligible C signs
  → FG-1 curriculum + gate
  → FG-2 curriculum + gate
  → FG-3 curriculum + gate  → rate sovereignty
  → J7+ seasons / Multitude / structural (parallel or after as designed)
```

FG can **overlap** J7 events if event tasks supply FG transfer evidence (preferred: dual credit).

---

## 2. Master map (all gates)

| ID | Lesson | Gate | Domain | Primary skill | Exit criterion |
|----|--------|------|--------|---------------|----------------|
| L1.1 | What is yield (and what it isn’t) | FG-1 | Risk / return | Distinguish yield vs free money | Delayed retrieval + explain a “yield” trap |
| L1.2 | Time preference & compounding | FG-1 | Time | Prefer longer paths under constraint | Transfer to non-crypto scenario |
| L1.3 | Units, claim, NAV (bank model) | FG-1 | Accounting | Read personal claim vs pool | Explain statement to coach |
| L1.4 | DeFi surface: pool risk in-sim | FG-1 | DeFi | Name risk before yield | Transfer to different pool type |
| L1.5 | Non-crypto surface: commodity / production | FG-1 | Real economy | Same deep rule, new skin | Cross-domain transfer battery item |
| L1.G | **FG-1 Gate Battery** | FG-1 | Mixed | 3-domain transfer | Integrity sign → safe menu |
| L2.1 | α / β / γ channels | FG-2 | Commons | Private claim vs commons vs jobs | Allocate a mock \(G\) and justify |
| L2.2 | Drawdown psychology | FG-2 | Behavior | Stay coherent under loss | Self-explain a real/sim drawdown |
| L2.3 | Risk tiers & confirmation | FG-2 | Agency | Confirm high-risk; refuse autopilot | No silent accept on high tier |
| L2.4 | Liquidity: soft vs hard commit | FG-2 | Liquidity | Choose window vs goal vault | Transfer: emergency path ethics |
| L2.5 | Job escrow & talent capital | FG-2 | Labor | \(E_{\text{escrow}}\) literacy | Match skill proof to job rail |
| L2.G | **FG-2 Gate Battery** | FG-2 | Mixed | Stewardship under stress | Integrity sign → high-risk confirms |
| L3.1 | What \(r\) actually moves | FG-3 | Protocol | Effects on claim, commons, self | Predict 5% vs 20% vs 30% |
| L3.2 | Floor & ceiling rationale | FG-3 | Policy | Why not 0% / why cap 30% | Defend bounds without slogans |
| L3.3 | Rate-choice simulation | FG-3 | Decision | Choose \(r\) under scenarios | Spaced re-choice consistency |
| L3.4 | Seasonal escalate (opt-in) | FG-3 | Habit | Confirm SMarT-style bumps | Propose or refuse escalate with reason |
| L3.G | **FG-3 Gate Battery** | FG-3 | Mixed | Rate sovereignty | Integrity sign → user may set \(r\) |

---

## 3. Lesson template (every FG lesson)

Use `Lesson Architecture` phases. Minimum fields for engine:

| Field | Content |
|-------|---------|
| **Objective** | One do-under-pressure skill |
| **Deep rule** | Principle that must transfer |
| **Surface** | This lesson’s skin (DeFi, commodity, rate UI, etc.) |
| **Model** | One clean worked example (Shaliah or system) |
| **Retrieve** | Learner states next step / rule before reveal |
| **Self-explain** | Why, not only what |
| **Interleave** | Related but distinct case in-session |
| **Delay** | Spacing interval before gate use (see §8) |
| **Transfer** | New surface, same deep rule |
| **Integrity signals** | \(N_i, C_i, P_i\) focus for this lesson |
| **Shaliah office** | Coach / mirror / shield (never rate-setter) |
| **Fail →** | Remodel or re-retrieve; no XP pass |

---

## 4. FG-1 — Literacy in action

### 4.1 Goal

Learner can **read** their wealth position and operate **safe** deployments without treating yield as magic.

### 4.2 Unlock on pass

- Full claim statement (units, NAV, 30d path, risk label, \(\alpha/\beta/\gamma\) visibility)  
- **Safe** deployment menu only (capped risk bands)  
- Meshaleach Seal / PoC domain tag: `fg1.literacy`  

### 4.3 Lessons

#### L1.1 — What is yield (and what it isn’t)

| | |
|--|--|
| **Deep rule** | Yield is compensation for risk, illiquidity, or work—not a free score |
| **Surface** | Simulated pool APY with hidden risk toggle |
| **Model** | Clean example: two pools, same “APY,” different drawdown history |
| **Retrieve** | “Which is safer and why—before numbers are fully shown?” |
| **Transfer** | Same rule on a “guaranteed return” scam skin |
| **Integrity** | \(C_i\) context alignment strong |

#### L1.2 — Time preference & compounding

| | |
|--|--|
| **Deep rule** | Small consistent growth compounds; impatience has a price |
| **Surface** | Paper Growth Capital accrual over seasons |
| **Model** | 20% locked path vs early extraction fantasy |
| **Retrieve** | Predict 4-season claim under two behaviors |
| **Transfer** | Non-crypto: crop/storage or apprenticeship time tradeoff |
| **Integrity** | \(P_i\) progressive differentiation |

#### L1.3 — Units, claim, NAV (bank model)

| | |
|--|--|
| **Deep rule** | You own a **claim** (units); funds work in a **pool** (NAV) |
| **Surface** | Real UI statement (paper) |
| **Model** | Deposit → units mint → NAV moves → claim value changes |
| **Retrieve** | “If NAV drops 10%, what happens to my units? my claim value?” |
| **Transfer** | Explain to a peer/sim peer in plain language |
| **Integrity** | \(N_i\) authentic navigation of statement, not bot click-through |

#### L1.4 — DeFi surface: pool risk in-sim

| | |
|--|--|
| **Deep rule** | Name failure modes before chasing APY (IL, smart-contract, liquidity, oracle—level appropriate) |
| **Surface** | Hepar-adjacent or safe sandbox pool chooser |
| **Model** | One worked failure (e.g. liquidity dry-up) |
| **Retrieve** | List two risks before selecting a pool |
| **Transfer** | Different instrument class, same risk-naming habit |
| **Integrity** | \(C_i\) + refusal of pure yield chase |

#### L1.5 — Non-crypto surface: commodity / production

| | |
|--|--|
| **Deep rule** | Scarcity, storage, time, and demand create value paths outside tokens |
| **Surface** | Sim: commodity stock / simple production cycle |
| **Model** | Hold vs sell under cost-of-carry style constraint (simplified) |
| **Retrieve** | “What is the cost of waiting here?” |
| **Transfer** | Map back to Growth Capital soft commitment |
| **Integrity** | \(P_i\) transfer out of crypto-only schema |

### 4.4 FG-1 Gate Battery (L1.G)

**Format:** Single session or same-day spaced block; **no new teaching**—only transfer + explanation.

| Item | Domain | Task |
|------|--------|------|
| T1 | DeFi | Choose safer structure and name two risks |
| T2 | Time | Pick path under compounding pressure; explain tradeoff |
| T3 | Real economy | Apply same deep rule on commodity/production skin |
| E1 | Meta | 3–5 sentence self-explanation: “What is my claim vs the pool?” |

**Pass:** Integrity-signed mastery event; all transfer items ≥ threshold; explanation quality pass (coach + rubric).  
**Fail:** Return to weakest L1.x with novel variant (not identical replay).

**Shaliah:** Coach mode; may hint once per item after struggle; may not click answers.

---

## 5. FG-2 — Stewardship

### 5.1 Goal

Learner stewards capital under **stress** and **commons structure**, and never treats Shaliah as autopilot CEO.

### 5.2 Unlock on pass

- High-risk deployment confirms required  
- Full channel literacy UI (edit understanding, not \(r\))  
- Access to broader ecosystem options within policy  
- PoC domain tag: `fg2.stewardship`  

### 5.3 Prerequisites

FG-1 passed; at least one **spacing interval** after FG-1 (see §8); preferred: ≥1 real/paper drawdown observation on claim.

### 5.4 Lessons

#### L2.1 — α / β / γ channels

| | |
|--|--|
| **Deep rule** | \(G\) splits private growth, commons capacity, and job rails by design |
| **Surface** | Split visualizer with live \(\alpha=0.40, \beta=0.35, \gamma=0.25\) |
| **Model** | One epoch of \(G\) flowing three ways |
| **Retrieve** | “If I only maximize my claim, what breaks in the ecosystem?” |
| **Transfer** | Season bounty funded by \(P_{\text{comm}}\)—who benefits? |
| **Integrity** | \(C_i\) alignment with commons ethics (CCM bridges) |

#### L2.2 — Drawdown psychology

| | |
|--|--|
| **Deep rule** | Loss is information; panic and freeze are both failure modes |
| **Surface** | Forced sim or historical paper path of claim NAV drop |
| **Model** | Coach narrates one coherent response under drawdown |
| **Retrieve** | Learner narrates their actual reaction + better next action |
| **Transfer** | Same under social pressure (cohort leaderboard skin) |
| **Integrity** | \(N_i\) authentic; no scripted calm if telemetry shows panic-click |

#### L2.3 — Risk tiers & confirmation

| | |
|--|--|
| **Deep rule** | High-risk requires **human confirm**; Shaliah proposes only |
| **Surface** | Deployment dialog with tiers (Safe / Standard / High) |
| **Model** | Shaliah proposes High; human must accept/reject with reason |
| **Retrieve** | Spot a “silent confirm” anti-pattern in a mock UI |
| **Transfer** | Multitude job offer that tries to auto-accept |
| **Integrity** | Autopilot path = **automatic fail** of this lesson |

#### L2.4 — Liquidity: soft vs hard commit

| | |
|--|--|
| **Deep rule** | Soft windows + emergency path ≠ inaccessible; hard vaults are **opt-in** commitment |
| **Surface** | Liquidity calendar + emergency request flow |
| **Model** | Soft window vs SEED-style hard goal |
| **Retrieve** | When would you choose hard vault? When is it harmful? |
| **Transfer** | Hardship scenario with Integrity check for abuse |
| **Integrity** | \(C_i\) ethics of emergency vs gaming |

#### L2.5 — Job escrow & talent capital

| | |
|--|--|
| **Deep rule** | \(E_{\text{escrow}}\) links proven skill (PoC) to real work capital |
| **Surface** | Job-match board (paper) requiring Seal domains |
| **Model** | Skill proof → escrow unlock → work → feedback |
| **Retrieve** | “What proof would a counterparty need from me?” |
| **Transfer** | Teach-bridge: help another learner toward a Seal domain |
| **Integrity** | \(P_i\) + relatedness (CCM) |

### 5.5 FG-2 Gate Battery (L2.G)

| Item | Task |
|------|------|
| T1 | Allocate mock \(G\) across channels; justify without pure selfishness |
| T2 | Navigate drawdown: action + self-explanation (recorded) |
| T3 | High-risk proposal: confirm or refuse with reason (must not autopilot) |
| T4 | Choose liquidity mode for a stated life goal; explain |
| E1 | Written/spoken: “What does stewardship mean for *my* claim in a *shared* pool?” |

**Pass:** Integrity sign; T3 cannot be passed via auto-accept.  
**Fail:** Targeted remediation on failed item with **novel** skin.

---

## 6. FG-3 — Rate sovereignty

### 6.1 Goal

Learner can **own** the rate decision: understand what \(r\) moves, respect bounds, and choose deliberately under coach debrief—not impulse or shame.

### 6.2 Unlock on pass

- User may set \(r \in [0.05, 0.30]\)  
- Max 1 change / 30 days  
- Opt-in seasonal +1–2 pp escalate control  
- PoC domain tag: `fg3.rate_sovereignty`  
- UI: rate control panel enabled  

### 6.3 Prerequisites

FG-2 passed; spacing after FG-2; preferred: ≥2 seasons or equivalent spaced epochs of claim observation.

### 6.4 Lessons

#### L3.1 — What \(r\) actually moves

| | |
|--|--|
| **Deep rule** | \(G = r \cdot C\); higher \(r\) grows claim/commons/jobs faster from eligible yield; lower \(r\) keeps more principal free |
| **Surface** | Interactive calculator bound to real (paper) \(C\) |
| **Model** | Same \(C\), \(r=0.05\) vs \(0.20\) vs \(0.30\) over 6 epochs |
| **Retrieve** | Predict claim and \(P_{\text{comm}}\) under each \(r\) |
| **Transfer** | “If \(C\) is zero, what does \(r\) do?” (nothing—eligibility first) |
| **Integrity** | \(C_i\) numeric sense without fantasy |

#### L3.2 — Floor & ceiling rationale

| | |
|--|--|
| **Deep rule** | Bounds protect future-self and commons without erasing autonomy |
| **Surface** | Policy card: why 5% floor, 30% ceiling, no casual 0% |
| **Model** | Counterfactual: everyone sets 0% → pool dies; everyone 50% → liquidity stress |
| **Retrieve** | Argue for or against floor **using mechanism**, not slogan |
| **Transfer** | Compare to default 20% lock pre-grad (commitment device) |
| **Integrity** | \(P_i\) abstraction |

#### L3.3 — Rate-choice simulation

| | |
|--|--|
| **Deep rule** | Choice is owned; coach debriefs, does not dictate |
| **Surface** | Multi-scenario sim (stable \(C\), volatile \(C\), season bounty year) |
| **Model** | One persona chooses poorly; one chooses well (worked) |
| **Retrieve** | Learner picks \(r\) for three scenarios with reasons |
| **Delay** | Return after spacing; re-pick without seeing old answers |
| **Transfer** | Live (paper) recommendation for **their** actual claim state |
| **Integrity** | Consistency + explanation quality; thrashing fails |

#### L3.4 — Seasonal escalate (opt-in)

| | |
|--|--|
| **Deep rule** | Auto-escalate is a tool of future-self, only with consent |
| **Surface** | “Grow More Next Season” toggle |
| **Model** | +2 pp path from 20% toward ceiling with user confirms |
| **Retrieve** | When would you refuse escalate? |
| **Transfer** | Link to SMarT-style habit without losing will |
| **Integrity** | Autonomy preserved (SDT) |

### 6.5 FG-3 Gate Battery (L3.G)

| Item | Task |
|------|------|
| T1 | Predict outcomes for 5% / 20% / 30% on a fixed \(C\) path (numeric + qualitative) |
| T2 | Defend floor/ceiling in own words (mechanism-level) |
| T3 | **Delayed** rate choice for personal situation + coach debrief |
| T4 | Accept or refuse seasonal escalate with reason |
| E1 | Covenant-level statement: “I set \(r\); Shaliah does not. My claim stays mine.” |

**Pass:** Integrity sign; T3 spaced (≥ delay in §8); coach debrief completed; no Shaliah-selected rate.  
**On pass:** Rate control UI unlocks; first change may apply after confirm + cooling-off (e.g. 24h) optional product polish.

---

## 7. Interleaving & dual-credit design

| Prefer | Avoid |
|--------|-------|
| FG transfers inside J7 seasons | Isolated finance classroom forever |
| Multitude job boards as L2.5 surfaces | Pure PDF reading |
| Claim NAV from real paper ops as L2.2 fuel | Synthetic only after live path exists |
| One deep rule, many skins | New jargon every lesson |

**Interleave matrix (examples)**

| Week focus | Mix in |
|------------|--------|
| FG-1 DeFi | Time preference item |
| FG-2 drawdown | α/β/γ reminder |
| FG-3 rate | Liquidity ethics from FG-2 |

---

## 8. Spacing schedule (v1 defaults)

| After | Minimum delay before next gate battery | Notes |
|-------|------------------------------------------|-------|
| Each Lx.y transfer success | ≥ **24h** before reusing same deep rule as gate item | Can continue other lessons |
| FG-1 pass → FG-2 start | ≥ **48h** (prefer 3–7d) | Keep voluntary play; no forced wait theater if learner active on other Stretch |
| FG-2 pass → FG-3 start | ≥ **72h** (prefer 1–2 weeks / one season tick) | Need claim history for rate sense |
| Within gate battery | No teaching mid-battery | Fail → remediate → **new variant** after ≥24h |

Engine stores `delay_schedule` per `Lesson Engine Data Model`.

---

## 9. Integrity & Anti-Grind for FG

| Signal | Application |
|--------|-------------|
| \(N_i\) Navigation Authenticity | Statement navigation, not scripted click farms |
| \(C_i\) Context Alignment | Risk naming matches regime; rate choice matches stated goals |
| \(P_i\) Progressive Differentiation | Novel variants; no identical replay pass |
| Autopilot | Instant fail for FG-2 T3 and any “Shaliah decided \(r\)” |
| Botting / injection | Integrity Auditor rejects mastery mint |

**PoC payload (minimum):** `principal_id`, `gate` (`fg1|fg2|fg3`), `lesson_ids[]`, `I_i` components or hash, `timestamp`, Integrity signature.

---

## 10. Shaliah behavior by gate

| Gate | Shaliah does | Shaliah must not |
|------|--------------|------------------|
| FG-1 | Model, retrieve prompts, fade, celebrate real transfer | Dump glossary walls mid-decision |
| FG-2 | Confront autopilot; hold through drawdown coaching | Execute high-risk without confirm |
| FG-3 | Run rate sim debrief; propose escalate | **Set or nudge \(r\) as if decided** |

Offices: coach + mirror dominant; vehicle only inside already-unlocked risk tiers.

---

## 11. Learner states (engine)

From `Lesson Engine Data Model`, specialized for FG:

```text
fg_locked → fg1_in_progress → fg1_passed
         → fg2_in_progress → fg2_passed
         → fg3_in_progress → fg3_passed (rate_sovereign)
```

Per lesson: `orient → model → retrieve → feedback → fade → interleave → delay → transfer → gate`

MasteryEvent required at L1.G, L2.G, L3.G.

---

## 12. Success metrics (curriculum health)

| Metric | Healthy signal |
|--------|----------------|
| Time FG-1→FG-3 | Days–few weeks of spaced play, not semester of lecture |
| Gate fail→retry | Improve on **novel** variant, not grind |
| Post-FG-3 \(r\) distribution | Not all slam to 5% or 30% immediately |
| Autopilot attempts | Declining under FG-2 coaching |
| Self-explanation quality | Rising on drawdown and rate debrief |
| Hardship abuse flags | Low vs legitimate emergency use |

Revise lesson skins when transfer rates stall; do not weaken Integrity.

---

## 13. Implementation order (curriculum build)

**Domain logic (done in package):** `@sovereign/shaliah-onboarding`  
`lessonEngine/` · `fg/curriculum.ts` · `fg/gates.ts` · `fg/fgSession.ts` · `prompts/shaliahOffices.ts`

| Order | Deliverable | Status |
|-------|-------------|--------|
| 0 | Lesson engine + L1.1–L3.4 catalog + gate batteries + office prompts | **Done** (domain TS) |
| 1 | L1.3 statement UI + L1.1–L1.2 paper sims | UI follow-up |
| 2 | Wire Integrity Auditor real signatures (replace local SHA placeholder) | Follow-up |
| 3 | Safe deployment menu gated on FG-1 unlock flags | UI / host |
| 4 | High-risk confirm UX + autopilot fail path | UI / host |
| 5 | Rate control panel post FG-3 | UI / host |
| 6 | Dual-credit hooks into first J7 season | Later |

---

## 14. One-line curriculum

> Learn what yield and claim *are*, steward them under stress without autopilot, then earn the right to set how much of your eligible yield becomes Growth Capital—by transfer, not by quiz.

---

*Canonical FG lesson map. Product lessons should instantiate these IDs; skins may change, deep rules and gates must not without doctrine revision.*
