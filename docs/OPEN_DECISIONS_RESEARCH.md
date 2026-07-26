# Open Decisions — Research Recommendations (v1)

> **Status:** **FOUNDER-ACCEPTED** research defaults (2026-07-26). Promoted into journey/economy/architecture as v1 policy.  
> **Companions:** `docs/GROWTH_ECONOMY_SOCIETAL_EVENTS.md`, `docs/JOURNEY_MAP.md`, `docs/SOVEREIGN_COGNITION_ARCHITECTURE.md`  
> **Date:** 2026-07-26

---

## 0. Method

For each open process we:

1. State the decision  
2. Summarize external evidence / industry patterns  
3. Map to Sovereign constraints (coach-not-captain, Anti-Grind, dual populations, bank-style Growth Capital)  
4. Recommend a **default** + **why** + **what to measure** + **when to revise**

---

## 1. Default rate \(r\) and post–Financial Graduation bounds

### Decision

- What is the locked default before graduation?  
- After the user may change \(r\), what floor/ceiling (if any)?  
- Should \(r\) ever auto-escalate?

### Evidence

| Finding | Implication |
|---------|-------------|
| **Defaults dominate.** Auto-enrollment at a positive rate beats “opt-in and educate” for savings outcomes (Madrian & Shea; Thaler & Benartzi lineage). | Lock a **strong default**; do not rely on literacy lectures alone. |
| **People stick to defaults.** Many accept 3% even when higher would be better; higher defaults (e.g. 12% studies) still work for a large share. | A **20% default on ecosystem yield** is ambitious but defensible *if* \(C\) is only Integrity-signed productive yield—not 20% of all life income. |
| **Save More Tomorrow / auto-escalation** raises rates over time with less pain than one big jump. | Prefer **escalation paths** after graduation over binary “set once.” |
| **Commitment devices** (SEED accounts, hard/soft locks) raise savings when people *choose* commitment; forced total illiquidity can backfire if needs hit. | Capital should **work and stay claim-visible**; hard lock of *all* funds is worse than gating **rate control** + optional hard-commit vaults. |
| **Financial education alone has modest effects** vs structural defaults (Hastings et al. reviews). | Financial Graduation must be **behavioral proof (transfer)**, not a quiz. |

**Rule-of-thumb context:** Personal-finance heuristics often cite ~15–20% of income toward long-term wealth when including retirement. Your 20% applies to **eligible ecosystem \(C\)**, which is stricter and fairer than 20% of all wages.

### Recommendation (optimal for this product)

| Parameter | Recommended v1 | Rationale |
|-----------|----------------|-----------|
| \(r_{\text{default}}\) | **0.20** | Matches founder wealth-while-learning intent; strong default under status-quo bias |
| Pre-graduation | **Locked** at 0.20 | Prevents premature self-sabotage and rate-gaming before literacy |
| Post-graduation floor \(r_{\min}\) | **0.05** (5%) | Near-zero destroys the institution’s wealth + commons flywheel; 5% keeps skin in the pool while restoring autonomy |
| Post-graduation ceiling \(r_{\max}\) | **0.30** (30%) | Allows aggressive builders; above ~30% of eligible yield risks liquidity stress and “extractive” feel even if voluntary |
| Change cadence | At most **1 rate change per 30 days** (or per Integrity epoch) | Stops thrashing / gaming; mirrors real plan admin rules |
| Escalation option | **Opt-in “Grow More Next Season”**: +1–2 pp per season up to \(r_{\max}\) | SMarT-style; coach can propose, human confirms |
| Emergency / hardship | Soft path: **claim-visible** emergency draw from *personal claim* under policy + coach + cooling-off; not silent drain of collective | Commitment research: pure hard lock harms welfare in shocks |

**Do not allow \(r = 0\)** as a normal post-grad choice in v1. If needed later, make 0% a **hard second graduation** (prove understanding of *why* zero is usually bad) — optional v2.

### What to measure

- Opt-out / rate-change distribution after graduation  
- Hardship draw rate  
- Correlation of lower \(r\) with later outcomes (skill, retention, wealth)  
- Feelings of autonomy vs coercion (SDT: autonomy must rise post-grad)

### Revise when

- >25% of graduates slam to floor and churn → lower default or improve communication  
- Default 20% causes mass early abandonment → consider paper-only 15% then live 20%

---

## 2. How Financial Graduation should work

### Decision

What process proves “required understanding of how wealth is created” so the user may control \(r\)?

### Evidence

| Finding | Implication |
|---------|-------------|
| Lectures/quizzes → weak behavior change | **No quiz-as-graduation** |
| Scaffolded autonomy (cognitive apprenticeship) | Unlock **deployment options first**, then **rate control** |
| Deliberate practice + transfer | Graduation = **delayed transfer** across money domains |
| Pure “learn-to-earn” token for content fails | Pay/power only after **Integrity-signed** Stretch + Transfer (your Anti-Grind already) |

### Recommendation: **three-gate Financial Graduation**

Not one ceremony—**three progressive unlocks**:

| Gate | Name | Proof required | Unlocks |
|------|------|----------------|---------|
| **FG-1** | **Literacy in action** | Integrity-signed transfer tasks across ≥3 domains: (a) DeFi risk/yield basics in-sim, (b) time preference / compounding scenario, (c) one non-crypto surface (commodities, FX, or real-economy production sim) | View full claim statement; choose among **safe** ecosystem deployment menus (capped risk) |
| **FG-2** | **Stewardship** | Spaced re-performance + self-explanation of a loss/drawdown event; no autopilot Shaliah win | Shaliah may propose strategies; user **must confirm** high-risk moves; community/job channel literacy |
| **FG-3** | **Rate sovereignty** | Second delayed transfer battery + explicit “rate choice” simulation (user predicts effects of 5% vs 20% vs 30% on claim, commons, self) with coach debrief | User may set \(r \in [r_{\min}, r_{\max}]\) |

**Shaliah role:** coach through gates; **never** sets \(r\) for the human.  
**Integrity role:** signs each FG gate.  
**Anti-Grind:** novel variants; no farmable quiz bank.

### Curriculum domains (minimum map)

1. What yield is and is not (risk-adjusted, not free money)  
2. Pooled capital vs individual claim (your bank model)  
3. DeFi primitives used in-ecosystem (as **situated** play, not textbook only)  
4. Broader markets sketch: rates, commodities, inflation intuition  
5. Time preference and drawdown psychology  
6. Commons vs private claim (why \(\beta\) and \(\gamma\) exist)  
7. Job/talent capital (\(E_{\text{escrow}}\)) as real economy interface  

### What to measure

- Time-to-FG-3 vs quality of later rate choices  
- Post-FG-3 regret / reversal rate  
- Correlation of FG depth with long-term retention

---

## 3. Bank-style collective: operational best shape

### Decision

How to implement “individual amount tracked, funds collective, capital grows.”

### Evidence

Pooled vehicles (mutual funds, pensions, ETFs) standard pattern:

- **Unitized claim:** person owns units/shares of a pool, not a pile of earmarked coins under the mattress  
- **NAV / mark:** claim value updates with pool performance  
- **Professional or rule-based deployment** at pool level  
- **Statements** for trust  

### Recommendation

| Design | Spec |
|--------|------|
| **Accounting** | Double-entry: **Personal Growth Claim (units)** + **Collective Pool NAV** |
| **Deployment engine** | Momentum + policy-as-code; Shaliah proposes **personal strategy tilt** within pool risk bands after FG-1 |
| **Transparency** | Always-visible: units, NAV, 30d performance, fee/risk label, channel split \(\alpha/\beta/\gamma\) |
| **Liquidity** | Default: capital **works continuously**; withdrawals of claim subject to pool rules + cooling-off (soft commitment). Optional **SEED-style hard goal vault** as opt-in |
| **Fees** | Protocol fee (if any) transparent and tiny; never hide cut inside performance |
| **Failure isolation** | One strategy loss socializes per pool rules but **cannot wipe identity or PoC** |

This matches founder intent without pretending to be a regulated bank on day one—**bank-like UX and accounting**, legal wrapper later.

---

## 4. Credential product brand

### Decision

What portable proof do we name and ship?

### Evidence / practice

- External passport brands (e.g. OC-ID class) create **partner dependency** and slow shipping  
- Native credentials that later bridge to W3C VCs / partners are industry-standard sequence  
- Learners need a **legible name**; employers need a **verifiable object**

### Recommendation

| Layer | v1 choice |
|-------|-----------|
| **Public brand** | **Proof of Cognition (PoC)** — plain language, doctrine-aligned |
| **Product seal** | **Meshaleach Seal** — visual/status object in UI after Integrity sign |
| **Technical object** | SME-native attestation: principal id + domains + \(I_i\) hash + Integrity signature + timestamp |
| **Federation** | **None required in v1**; design schema so a later bridge (OC-ID / W3C VC) can wrap the same payload |
| **What it unlocks** | FG gates, job escrow eligibility, ACL-relevant proof surfaces—not vanity XP |

**Avoid:** launching as “Open Campus ID product.” Use as optional future *interop*, not identity.

---

## 5. L4 (spatial) schedule

### Decision

When to run physical “game vacation” residencies.

### Evidence / product risk

Shipping IRL before digital middle works produces hollow events and burns capital. Network-state residencies succeed when a **shared practice** already exists online.

### Recommendation

| Posture | **Gated, unscheduled** |
|---------|------------------------|
| **Digital launch** | **Does not depend on L4** |
| **First pilot allowed only if** | (1) J5 Anti-Grind live for cohort, (2) J6 Growth Capital paper/testnet real, (3) ≥1 full J7 season completed, (4) Integrity + Efficiency stable for multi-user, (5) legal/safety owner assigned |
| **Pilot shape** | 12–40 people, 2–4 weeks, one guild theme synced to a season; not a permanent campus |
| **Calendar** | No public date until checklist green; internal “earliest thoughtful window” can be tracked privately |

---

## 6. Related process choices (you also need defaults)

### 6.1 Who deploys capital day to day?

| Option | Verdict |
|--------|---------|
| User micro-manages every trade | Reject early — overload, Anti-Grind violation |
| Shaliah full autopilot | Reject — co-captain / atrophy |
| **Recommended:** Policy bands + Shaliah proposals + human confirm on risk tiers; pool-level Momentum for base deployment | Aligns coach agency + bank collective |

### 6.2 Hardship / access to claim

| Option | Verdict |
|--------|---------|
| Never accessible | Reject — founder said not inaccessible; welfare risk |
| Instant full cashout always | Weakens commitment + pool |
| **Recommended:** Soft commitment — scheduled liquidity windows + emergency path with coach + delay + Integrity check for abuse | Best of commitment research + your accessibility intent |

### 6.3 When Growth Capital arms

| Option | Verdict |
|--------|---------|
| Day 1 of bind | Too early; no PoC |
| Only after FG-3 | Too late; misses “wealth *while* learning” |
| **Recommended:** Arm at **first Integrity-signed eligible \(C\)** (J5/J6), with safe default deployment; FG unlocks control depth | Matches journey map |

---

## 7. Accepted freezes (founder 2026-07-26)

```text
[x] r_default = 0.20 locked until Financial Graduation
[x] Post-grad r ∈ [0.05, 0.30], max 1 change / 30 days
[x] Opt-in seasonal auto-escalate +1–2 pp (user confirm)
[x] Financial Graduation = FG-1 → FG-2 → FG-3 (transfer-based, not quiz)
[x] Bank model = unitized personal claim + collective NAV pool
[x] Credential = “Proof of Cognition” / Meshaleach Seal; native attestation; no OC-ID dependency v1
[x] L4 = gated unscheduled; digital-first checklist before any pilot
[x] Deployment = pool base + Shaliah propose + human confirm by risk tier
[x] Liquidity = soft commitment + emergency path; optional hard goal vault
```

Promoted into: `JOURNEY_MAP.md`, `GROWTH_ECONOMY_SOCIETAL_EVENTS.md`, `SOVEREIGN_COGNITION_ARCHITECTURE.md`, product pack Stage 6.

---

## 8. What remains genuinely experimental

These need **live telemetry**, not more theory (policy may be retuned from data):

1. Exact emotional tolerance for 20% on first live cohorts  
2. Whether 5% floor feels fair post-grad  
3. How long FG-1→FG-3 takes in real play (target: days–weeks of spaced practice, not months of lecture)  
4. Legal classification of collective pool in each jurisdiction (counsel later)

---

## 9. Sources (indicative)

- Thaler & Benartzi — Save More Tomorrow / auto-escalation savings  
- Madrian & Shea — automatic enrollment defaults  
- Beshears et al. — high default contribution rates  
- Bryan, Karlan, Nelson — commitment devices survey  
- Ashraf, Karlan, Yin — SEED commitment savings (Philippines)  
- Hastings, Madrian, Skimmyhorn — financial literacy / education evidence reviews  
- Scaffolding / cognitive apprenticeship literature (fading support → autonomy)  
- Standard pooled vehicle practice (unitized claims, NAV)  

---

*If founder accepts §7 checkboxes, promote into JOURNEY_MAP + GROWTH_ECONOMY as frozen policy and leave only experimental knobs in §8.*
