# Claim map — quick reference

Full doctrine: [README.md](./README.md) · Dual-pop placement locked 2026-08-04.

**Memory:** sealed vessel · **ZKP:** privacy layer (prove store/recall/export without dumping the soul).

| # | Claim | Visibility | Mechanism | Pop |
|---|--------|------------|-----------|-----|
| C1 | Agent action under policy | Public audit | Signature + log (**no ZK**) | Both (audit) |
| C2 | FG / Meshaleach domain held | Public boolean / tag | SD or ZK | **Shaliah** |
| C3 | PL band / human-bound / not banned | Public flags | ZK range / membership | **Shaliah** (+ auto standing) |
| C4 | Consent class + purpose active | Public class id | Attestation ± ZK | **Shaliah** |
| C5 | Lawful store / recall in envelope | Pass/fail | Commit + SD/ZK | **Shaliah primary** |
| C6 | Export policy-redacted | Pass/fail | SD/ZK on policy hash | **Shaliah primary** |
| C7 | Anti-grind integrity band | Public pass/fail | ZK optional | Shaliah |
| C8 | Autonomous pool / standing | Public flags | SD/ZK | **Autonomous secondary** |
| C9 | Steward veto quorum | Public outcome | Multisig; ZK ballots later | Governance |
| C10 | Training pair is gold | Provenance only | Hash / review — not circuit | Training |

## Non-claims (do not ZK)

- Human ↔ Shaliah normal memory access  
- Semantic “this answer is gold”  
- Hiding autonomous action from stewards when charter requires traces  
