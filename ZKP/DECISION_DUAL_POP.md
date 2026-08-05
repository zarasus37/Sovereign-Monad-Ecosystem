# Decision: ZKP dual-pop placement

**Status:** Accepted  
**Date:** 2026-08-04  
**Canon:** [README.md](./README.md) §2

## Decision

Use ZKP as a **privacy layer around memory and credentials**, not as a memory store.

| Order | Surface | Intent |
|-------|---------|--------|
| 1 | **Shaliah outward** | Protect human-linked soul from third parties; prove lawful store/recall/export / PoC / consent |
| 2 | **Autonomous standing** | Multi-party eligibility without full cognitive dump |
| — | **Human ↔ Shaliah** | Open under covenant — **no ZK wall** |

## Consequences

- Phase 0–2 engineering prioritizes Shaliah/PoC/consent/memory commits.  
- Autonomous agents reuse the same claim formats later.  
- Action audit remains signature/trace where doctrine requires it.  
- Private memory = encryption + ACL + purpose tags; ZK only when an external verifier needs a claim without the witness.

## Alternatives rejected

- ZK-only for autonomous agents (ignores human privacy vs world).  
- ZK between human and their Shaliah (breaks mutual knowing).  
- ZK as the memory container (wrong abstraction).  
- Unnecessary entirely (needed when external “trust without seeing” appears; until then signed claims + ACL suffice).
