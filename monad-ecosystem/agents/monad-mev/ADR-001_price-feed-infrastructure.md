# ADR-001: Price Feed Infrastructure Architecture (Resolves ISSUE-003)

**Status:** Resolved
**Date:** 2026-04-03
**Resolved:** 2026-06-12 (Monad mainnet provider landscape confirmed; ProviderPool implemented)
**Deciders:** Founder / architect
**Linked Issue:** ISSUE-003 — monad-market-agent crash loop (QuickNode daily rate limit)
**MOF Section:** Layer 2, Section 10 (Step 4), Section 12

---

## Context

The `monad-market-agent` is crash-looping because it is hitting the QuickNode daily request rate limit. This agent is the producer of the `monad.price` Kafka topic, which feeds the `spread-scanner`, which feeds the `risk-engine`, which feeds the entire MEV execution pipeline.

Without a stable Monad price feed, the spread-scanner cannot function. Without the spread-scanner, no opportunities are constructed. Without constructed opportunities, the MEV engine produces nothing. Without MEV, the closed-loop proof required to close Phase 1a cannot be demonstrated.

**This is not a minor infrastructure hiccup. It is the single external dependency blocking Phase 1a from proving it works end-to-end.**

The MOF identifies three resolution paths:
- QuickNode tier upgrade
- Provider swap
- Fallback feed architecture

This ADR evaluates those options and proposes a decision.

---

## Constraints (from MOF)

- The price feed must be stable enough to demonstrate closed-loop operation: price → spread → risk → opportunity → execution → profit → router → sinks
- The solution must not introduce new infrastructure dependencies that delay Phase 1a further
- Phase 1b (InflowClassifier / SheathVault) requires a live MEV volatility baseline, which itself requires a stable feed. So the feed fix also unblocks Phase 1b entry.
- Speed-to-stable matters more than long-term architecture elegance at this phase

---

## Options Considered

### Option A: Upgrade QuickNode Tier

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — no code changes required |
| Cost | Medium — depends on tier; Growth plan ~$49/mo, Business ~$299/mo |
| Speed to unblock | Immediate — same day |
| Monad support | QuickNode has Monad Testnet support; mainnet coverage TBC |
| Operational risk | Rate limits shift upward but don't disappear; same single point of failure |
| Permanence | Not permanent — remains a single-provider dependency |

**Pros:**
- Fastest path to restoring feed stability
- Zero code changes, zero new dependencies
- Preserves the existing monad-market-agent implementation

**Cons:**
- Still a single point of failure
- Rate limits return at higher traffic
- Monthly cost scales with usage
- Does not address the underlying architectural fragility

---

### Option B: Provider Swap (replace QuickNode with alternative)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low-Medium — requires monad-market-agent config update, possible API adapter |
| Cost | Low — Alchemy, Infura, or public RPC endpoints may have free tiers adequate for Phase 1a |
| Speed to unblock | Fast — hours to 1 day depending on endpoint compatibility |
| Monad support | Variable — Monad is new; not all providers have mainnet coverage yet. Testnet coverage is the critical near-term need |
| Operational risk | Provider-specific limits and reliability characteristics are unknown until tested |
| Permanence | Same architectural fragility as Option A; just a different vendor |

**Pros:**
- May eliminate rate limits entirely on free tiers
- Reduces vendor lock-in to QuickNode
- Possibly lower cost

**Cons:**
- Still a single point of failure
- Monad-specific provider landscape is immature; coverage and latency characteristics need verification
- Introduces new unknowns at a point where stability is paramount

---

### Option C: Multi-Provider Fallback Architecture

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — requires a provider abstraction layer or retry/fallback logic inside monad-market-agent |
| Cost | Low-Medium — combines free tiers across providers, minimizes paid dependency |
| Speed to unblock | Medium — 1-2 days of implementation work |
| Monad support | Can combine available providers to achieve redundancy |
| Operational risk | Low once built — eliminates single point of failure |
| Permanence | Architecturally sound for all future phases |

**Design:**
The monad-market-agent adds a `ProviderPool` abstraction:
- Primary: QuickNode (existing, known to work)
- Fallback 1: Alchemy / Infura Monad endpoint (if available)
- Fallback 2: Public Monad RPC endpoint (for non-critical low-frequency polling)

Rotation logic: on rate limit error (HTTP 429), rotate to next provider. Track request counts per provider per time window. Emit health metrics to `system.health` Kafka topic.

**Pros:**
- Permanently resolves rate limit vulnerability
- Aligns with Dove observation requirement for `system.health` — provider health becomes a proper signal
- No single provider can crash the feed
- Cost-optimizable over time (use free tiers until exhausted, then fall to paid)
- Architecturally appropriate for a system that must run continuously

**Cons:**
- More implementation work than Options A or B
- Risk of introducing provider-rotation bugs that themselves destabilize the feed
- Slightly delays Phase 1a if done carelessly

---

## Trade-off Analysis

Option A is the fastest unblock but buys time rather than solving the problem. If QuickNode is the only Monad provider at Phase 1a, it may be the only viable option right now — but it should be treated as a temporary fix, not a resolution.

Option B is essentially the same trade-off as Option A with additional unknowns. It only makes sense if a clearly superior provider is available with confirmed Monad support and adequate free-tier limits for Phase 1a volumes.

Option C is the right long-term architecture and is not significantly more expensive to build than Option B. The `ProviderPool` abstraction is ~50-100 lines of logic. The real question is whether the Monad provider ecosystem is mature enough to make Option C viable right now — specifically, whether a second provider with Monad endpoint coverage exists.

**Recommended decision path:**

1. **Immediately:** Verify whether a second Monad-compatible RPC endpoint exists (Alchemy, Infura, or public Monad testnet RPC).
2. **If yes:** Implement Option C. 1-2 days of work. Permanently unblocks this class of failure.
3. **If no second provider exists yet:** Upgrade QuickNode tier (Option A) as a bridge, and schedule Option C for Phase 1b when Monad mainnet provider coverage is expected to be broader.

**The key principle from the MOF applies here:** constraint acknowledgment, not constraint denial. If Option C is not available today due to the Monad provider ecosystem being immature, that is the honest answer — and Option A is the correct immediate action.

---

## Decision

**Proposed:** Option C (Multi-Provider Fallback) if a second Monad RPC endpoint is available. Option A as a bridge if not.

**Not Option B alone** — swapping providers without adding redundancy solves nothing architecturally.

---

## Consequences

**What becomes easier:**
- Closed-loop Phase 1a proof becomes possible
- `system.health` Kafka topic gains a meaningful early signal
- Phase 1b InflowClassifier can begin establishing a volatility baseline
- The infrastructure is robust enough for MEV mainnet operation

**What becomes harder:**
- None materially — ProviderPool is a contained module

**What to revisit:**
- At Phase 1b: formalize provider health monitoring as a proper Dove observation signal
- At Phase 2a: extend provider redundancy to `eth-market-agent` under the same pattern
- Before mainnet: confirm QuickNode (or primary provider) has confirmed Monad mainnet coverage and sufficient rate limits for production volumes

---

## Action Items

1. [x] Audit available Monad RPC endpoints — confirmed mainnet (November 2025 launch):
   - Alchemy: `rpc1.monad.xyz` (official Monad docs, Alchemy-hosted)
   - QuickNode: managed endpoints, Mainnet + Testnet confirmed
   - dRPC: public + NodeCloud, ready since launch day
   - Chainstack, BlockPI, Triton: all confirmed on official Monad docs
2. [x] Implement `ProviderPool` abstraction — see `scripts/monad_price_fetcher.py`
   - Round-robin rotation on 429, 3-provider pool, 5s per-provider timeout
   - Drop-in `price_fetcher` for `shadow_markout_hardened.py`
3. [x] ADR-001 Option A (QuickNode upgrade) superseded by Option C (ProviderPool)
4. [ ] Set `MONAD_RPC_PRIMARY`, `MONAD_RPC_SECONDARY`, `MONAD_RPC_TERTIARY` in environment
5. [ ] Set `PRICE_FEED_MON_USDC` (and other pairs) to deployed contract addresses
6. [ ] Run `python scripts/monad_price_fetcher.py` smoke test — verify zero None results
7. [ ] Run `shadow_markout_hardened.py` with `monad_price_fetcher` wired — verify zero WARNING lines
8. [ ] That output = Operator Review evidence. Submit for Explicit Operator Review.
9. [ ] Update MOF Section 12 ISSUE-003 status once Operator Review is complete
10. [ ] Update MOF Change Log with patch version bump
