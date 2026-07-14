# Capital Budget — Capital-Gated Live Activation (Layer 9)

> **What this is:** the costed plan for the live-activation frontiers the repo
> previously named as "capital-gated" **without writing down a number**
> (Cardia, Live Keys, Public Data Rail, the Layer 7 GPU run). It is a
> **reusable system**, not a one-shot figure: dated assumptions, per-gate
> optimal choice, one-time activation cost vs. ongoing OPEX vs. capital-under-
> management, and a re-estimation rule for when prices move.
>
> **Status:** draft v1 (2026-07-13). Numbers marked **[EST]** are engineering
> estimates (documented reasoning, not repo-sourced); numbers marked
> **[SRC]** are sourced from the repo or a live market quote (dated). This is
> a planning artifact, not a spend authorization.

---

## 1. The structural finding (why this doc exists)

`docs/PROJECT_STATE.md` and the MOF repeatedly name four frontiers as
"capital-gated": funded **Cardia**, **live Keys**, **public Data Rail**, and
the **Layer 7 GPU run**. Until this doc, **only one (the x402 Base Sepolia
wallet) had a concrete dollar/token figure written down** — and that one is
already funded (smoke test GREEN 2026-07-10). The other three plus the GPU run
were *gated but uncosted*. This doc closes that gap.

**The decisive fact that re-frames the whole budget:** the ecosystem runs on
**Monad mainnet**, where gas is **sub-cent** (ERC-20 transfer ≈ $0.00013) and
**MON ≈ $0.023**. So *turning these organs on* is nearly free. The real
capital is **not a cost** — it is the **capital Cardia manages** (the
$15k–$100k allocation band) and the **per-agent operating capital** ("The
Breath"). Those are *assets under management*, not expenses. Confusing the two
would make the project look 1000× more expensive to finish than it is.

---

## 2. Dated assumptions (repriced 2026-07-13)

| Assumption | Value | Source / date |
|---|---|---|
| MON / USD | **$0.02286** (baseline) | CoinGecko, 2026-07-13 |
| MON sensitivity band | $0.0164 (ATL) – $0.025 (recent high) | market range |
| Monad base fee | 100 gwei (floor) | Monad docs / MonadScan |
| Monad ERC-20 transfer cost | ≈ $0.00013 | MonadScan gas tracker, 2026-07-13 |
| Monad swap cost | ≈ $0.00041 | MonadScan gas tracker, 2026-07-13 |
| Cardia recommended first funding | 10 MON | `cardia-activation-core/config/policy.json` [SRC] |
| Cardia allocation band | $15k – $100k per protocol (0.05–0.2% TVL) | MOF §480/2854 [SRC] |
| x402 required balance | ≥0.5 USDC + ~0.01 ETH (gas) | `PROJECT_STATUS_2026-06-22.md` [SRC] |
| x402 actual funded balance | 0.0005 ETH + 3.00 USDC | `x402-bridge/README.md:407` [SRC] |
| GPU rental (optimal pick) | RTX A6000 48GB ≈ $0.60/hr | RunPod/Lambda market, 2026-07 [EST] |
| GPU run length (first run) | ~40 GPU-hours | 8B QLoRA SFT+Reward+GRPO+Eval [EST] |
| Data Rail hosting (optimal pick) | small VM + object storage ≈ $10/mo | Hetzner/Backblaze market [EST] |

**Re-estimation rule:** repriced whenever MON moves >±25% from baseline, and on
a fixed quarterly review. The one-time activation totals are gas/MON-sensitive
(tiny); the AUM figures are USD-denominated (MON-stable only via the gas
replenishment line).

---

## 3. Per-gate optimal choice + cost

### 3.1 Cardia activation — **optimal: activate on Monad mainnet, seed 10 MON**

- **Optimal chain:** Monad mainnet (ecosystem home; gas sub-cent; MON is the
  native gas + reserve token). No reason to deploy the allocation organ
  anywhere else.
- **Activation (turn it on):** deploy contracts (if not already) + fund the
  wallet with the **10 MON recommended seed** + a gas reserve.
  - 10 MON × $0.02286 = **$0.23** [SRC→EST]
  - Gas reserve for on-chain allocation actions: 100 MON = **$2.29** (covers
    tens of thousands of sub-cent tx) [EST]
  - **Cardia one-time activation ≈ $2.50**
- **Operating meaningfully (capital UNDER MANAGEMENT, not a cost):** Cardia
  allocates within the **$15k–$100k per-protocol band** [SRC]. To run on one
  protocol at the band floor requires **$15,000 of deployable capital**. This
  is AUM Cardia holds and deploys — it is **not** an expense; it returns to
  the treasury minus allocation PnL.
- **Verdict:** *activation* ≈ **$2.50**. The "capital gate" is really the
  **$15k+ of AUM** to operate at the band floor — a treasury allocation, not a
  burn.

### 3.2 Live Keys — **optimal: agent NFTs on Monad mainnet, gas-only**

- **Optimal chain:** Monad mainnet (cohesion with Cardia; mint gas is
  negligible). Fallback: Base if a specific NFT standard/tooling is needed
  there.
- **Activation:** deploy the agent-NFT/key contract (one-time gas ≈ $0.001
  [EST]) + mint N agent keys (≈ $0.0001–0.001 each [EST]). For 10 agents:
  **< $0.05 in gas**.
- **Per-agent capital (the real gate):** each agent needs **"The Breath"** —
  initial operating capital (gas + operating funds) per the Shaliah Genesis
  Act (`docs/SHALIAH_AGENTS.md` §4.2). This is **per-mandate variable**, not a
  fixed line. Sized to the agent's bounded mandate; replenished from its own
  proceeds under self-sufficiency (`SHALIAH_AGENTS.md` §3.3).
- **Verdict:** *activation* ≈ **$0.05**. The "capital gate" is the
  **per-agent Breath capital**, sized per mandate — a treasury allocation per
  agent, not a one-time project cost.

### 3.3 Public Data Rail — **optimal: small always-on VM + object storage**

- **Optimal hosting:** a small always-on cloud VM (Hetzner CX-series ≈
  $5–7/mo) running the `data-rail-core` organ as a public API + Backblaze B2
  object storage for rail data (≈ $0.005/GB, ~$0.50/mo at modest volume) + a
  domain (~$10/yr) + Let's Encrypt TLS (free). Total ≈ **$10/mo ongoing**.
- **One-time:** setup labor is in-house ($0); domain ≈ $10/yr.
- **Scaling note:** bandwidth and storage scale with public usage; budget
  reviewed if the rail exceeds ~100 GB storage or sustained high traffic.
  (The MOF's $28k setup + $9k/mo figure is the *revenue* price for *selling*
  Data Rail access — the opposite direction, not a cost here.)
- **Verdict:** *activation* ≈ **$10 (domain, one-time)**; ongoing **≈
  $10/mo** [EST].

### 3.4 Layer 7 GPU training run — **optimal: rented A6000 48GB, ~40 GPU-hr first run**

- **Optimal hardware:** a rented **RTX A6000 48GB** (~$0.60/hr [EST]). Reasoning:
  the run is LLaMA 3.1 8B + 4-bit QLoRA + GRPO with `num_generations=8`. 8B in
  4-bit ≈ 5 GB weights; GRPO holds 8 completions in memory simultaneously, so
  24 GB (RTX 4090, cheaper at ~$0.40/hr) is **feasible but OOM-risky**; 48 GB
  (A6000) is the optimal price/VRAM balance — comfortable headroom without
  paying A100 premiums. Alternatives: RTX 4090 24 GB (cheaper, risky), A100 80
  GB (~$1.30/hr, safe-premium overkill for 8B).
- **Run length:** SFT (small Gnosis corpus, a few hrs) + Reward (small, ~1–2
  hr) + GRPO (the expensive stage; 8× forward passes, ~10–20 hr) + Eval
  (~1 hr) ≈ **20–60 GPU-hours**, budget **40** [EST].
- **Cost:** 40 hr × $0.60 = **$24**, budget **$30** with checkpoint storage
  [EST]. Range $15 (minimum, 4090, fast) – $50 (comfortable, A6000, full).
- **Prerequisite (not a cost, but gating):** human-judged preference pairs
  (spec line 478) must be authored first — the reward model trains on those.
  This is labor, not capital.
- **Verdict:** *first run* ≈ **$30**; ad-hoc re-runs ~$30 each [EST].

### 3.5 x402-bridge wallet — **ALREADY FUNDED (no open gate)**

- Required: ≥0.5 USDC + ~0.01 ETH; actually funded with 0.0005 ETH + 3.00 USDC
  (smoke GREEN 2026-07-10) [SRC].
- **Ongoing:** per-call pricing $0.001–$1.00 USDC/req; 1M credits/mo free tier
  covers light traffic. Top up by expected production traffic — variable.
- **Verdict:** *activation* = **$0** (done). Ongoing variable OPEX.

---

## 4. Totals — the three distinct kinds of "money"

### 4.1 One-time activation (turn everything live) ≈ **$45**

| Gate | One-time |
|---|---|
| Cardia (seed 10 MON + gas reserve) | $2.50 |
| Live Keys (deploy + mint 10 agents) | $0.05 |
| Public Data Rail (domain) | $10 |
| Layer 7 GPU run (first run) | $30 |
| x402 wallet | $0 (done) |
| **Total one-time activation** | **≈ $45** |

This is tiny **because the project lives on Monad** (sub-cent gas, MON ~$0.023).
The GPU run and a domain dominate; everything on-chain is essentially free.

### 4.2 Ongoing OPEX ≈ **$10–15/mo baseline + ad-hoc GPU**

| Item | Ongoing |
|---|---|
| Public Data Rail hosting | ~$10/mo |
| Cardia gas replenishment | negligible (sub-cent tx) |
| GPU retraining runs | ~$30 each, ad hoc |
| x402 wallet top-up | variable by traffic |
| **Baseline OPEX** | **≈ $10–15/mo** |

### 4.3 Capital under management (the REAL money — assets, not costs)

| Item | Capital |
|---|---|
| Cardia AUM (operate at allocation-band floor) | **$15,000** (per protocol; up to $100k ceiling) |
| Per-agent "Breath" operating capital | **variable**, sized per mandate |
| **Substantive capital to operate meaningfully** | **$15k+ (Cardia floor) + per-agent Breath** |

**This is the line that matters.** It is not a burn — it is treasury deployed
into Cardia's mandate and into each agent, returning to the treasury minus
PnL. The project's real "capital gate" is having **$15k of Cardia AUM** to
operate at the band floor on one protocol (plus per-agent Breath), not the
$45 activation cost.

---

## 5. Sensitivity

- **MON price ±50%** (to ~$0.011 or ~$0.034): the $2.50 Cardia activation
  moves to ~$1.25–$3.75. Immaterial — activation stays under $50 total. The
  AUM figures are USD-denominated and unaffected.
- **GPU rate ±50%** ($0.30–$0.90/hr): the first run moves $15–$45. Still the
  single largest one-time line.
- **Data Rail usage growth**: hosting is the only line that scales with
  public adoption; review at ~100 GB storage or sustained high bandwidth.

---

## 6. Decision-ready summary

> **To fully activate every capital-gated frontier: ~$45 one-time +
> ~$10–15/mo OPEX.** The headline capital requirement is not a cost — it is
> **$15k+ of treasury capital deployed as Cardia AUM** (to operate at the
> allocation-band floor) **plus per-agent Breath capital** sized to each
> mandate. Activation is cheap because the ecosystem runs on Monad; the
> substance is the capital under management.

---

## Sources

- MON price: [CoinGecko — Monad](https://data.coingecko.com/en/coins/monad),
  [Kraken](https://www.kraken.com/prices/monad),
  [CryptoRank](https://cryptorank.io/price/monad/usd) (2026-07-13)
- Monad gas: [MonadScan Gas Tracker](https://monadscan.com/gastracker),
  [Monad Gas Pricing Docs](https://docs.monad.xyz/developer-essentials/gas-pricing)
- Repo-sourced: `cardia-activation-core/config/policy.json`,
  `cardia-activation-core/config/activation-record.json`, MOF §480/542/548/816,
  `x402-bridge/README.md`, `PROJECT_STATUS_2026-06-22.md`,
  `docs/SHALIAH_AGENTS.md` §4.2