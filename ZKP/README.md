# Zero-Knowledge Proofs in the Sovereign Monad Ecosystem

> **Status:** Design doctrine (not production circuits) — dual-pop placement **locked 2026-08-04**  
> **Scope:** Where ZKP has a **genuine** role vs where it is hollow theater  
> **Related:** Meshaleach / PoC (`docs/FG_CURRICULUM.md`), consent-graded data (`docs/Shaliah Agents/consent-graded-data-exchange-whitepaper.md`), dual-pop (`docs/SHALIAH_VS_AUTONOMOUS.md`), Steward veto + ZK Cognitive Shield sketch (`docs/SHALIAH_AGENTS.md` §11.3)

---

## 1. One-line rule

**Public: that a claim is true. Private: the cognition / identity / raw stream that made it true.**

**Memory line:** *Memory is the sealed vessel; ZKP is the privacy layer that proves lawful store/recall/export without dumping the soul.*

ZKP is for **sovereignty under verification** — not for hiding system law or agent action under the covenant, and **not** a substitute for private memory storage.

---

## 2. Dual-pop placement (locked)

ZKP is **not** one blanket for every agent. Placement follows dual population:

| Population | Role of ZK around memory | Priority |
|------------|--------------------------|----------|
| **Shaliah (human-bound)** | Outer privacy layer: protect the **human’s** soul from third parties while store/recall/export stay lawful | **Primary — implement first** |
| **Autonomous Multitude** | Multi-party standing / policy eligibility without full cognitive dump | **Secondary — reuse same claim machinery** |
| **Human ↔ their Shaliah** | Mutual knowing under covenant | **No ZK wall** between them |

### 2.1 Shaliah-side (primary)

- **Threat model:** markets, partners, scrapers, other agents, data rails — not the bound human.  
- **Memory container:** private store + consent ACL (encryption, purpose tags, revocable grants).  
- **ZKP layer:** prove *about* store/recall without opening the vessel, e.g.:  
  - consent class + purpose active, not revoked  
  - Meshaleach / FG gate held  
  - recall stayed inside authorized envelope  
  - export bundle is policy-redacted  
- **Must not:** hide memory from the human; wall coach/mirror from principal context.

### 2.2 Autonomous side (secondary)

- **Useful:** “allowed in pool X / not banned / under capacity,” “acted under sealed policy hash,” reputation / eligibility without twin dump.  
- **Must not:** use ZK to hide **agency actions** from stewards where charter requires audit (VOX / Steward teeth).  
- **Reuse** Shaliah-outward claim/proof formats so we don’t build two stacks.

### 2.3 Explicit non-placement

| Don’t | Why |
|-------|-----|
| ZK between human and their Shaliah for normal recall | Breaks mutual knowing / extension |
| ZK as the memory database | Wrong tool; circuits ≠ search/store |
| ZK to opaque autonomous will from governance | Capture risk; fights audit doctrine |

### 2.4 Build order (agreed)

1. Private memory + consent ACL + **signed** PoC/Meshaleach (works without circuits).  
2. Selective disclosure / commitments when **external** verifiers appear.  
3. True ZK circuits for hard claims (range, membership, redacted export).  
4. Autonomous standing proofs on the same machinery.

---

## 3. Alignment with existing doctrine

| Already in stack | ZKP relationship |
|------------------|------------------|
| **Proof of Cognition (PoC) / Meshaleach Seal** | Today: signed structured payload. ZKP: prove “seal held / gate passed” without revealing full lesson history or \(I_i\) components. |
| **Consent-graded data (Layers I–V)** | Prove “class Y consented + purpose-scoped” without shipping raw Layer II–V telemetry to every consumer. |
| **Growth Capital / escrow / rate sovereignty** | Prove eligibility (FG gate, PL band, not banned) without doxxing principal. |
| **Dual-pop (human-bound vs autonomous)** | Prove population class without revealing which human / full twin dump. |
| **ZK Cognitive Shield** (named in SHALIAH_AGENTS) | `Commit = Poseidon(Telemetry_LayerV, Salt)` — commitment now; open path to membership / range proofs later. |
| **zk-SNARK non-circularity** (semiotic drift gap) | Advanced: prove drift-detector inputs weren’t gamed circularly — **phase 3**, not v1. |
| **VOX / auditability** | **Not** ZK for agent actions under covenant — open traces + signatures. |

---

## 4. Claim map (public / private / proof)

| Claim | Public? | Raw evidence private? | Proof type | Pop |
|-------|---------|------------------------|------------|-----|
| Agent took action \(A\) under policy \(P\) | **Yes** (audit) | No — logs/signatures | EIP-191 / receipt — **not ZKP** | Both (esp. autonomous) |
| Principal passed FG-2 / holds Meshaleach domain tag | Eligibility yes | Lesson path, scores, chat | **Selective disclosure or ZK** | Shaliah |
| PL ≥ threshold / human-bound / not on ban list | Boolean yes | Wallet graph, full record | **ZK range / set membership** | Shaliah (+ auto standing) |
| Consent class III enabled for purpose \(U\) | Class + purpose yes | Stream contents | **Attestation + optional ZK** | Shaliah memory outward |
| Lawful store / recall stayed in envelope | Pass/fail yes | Episode text / vectors | **Commitment + ZK/SD** | Shaliah primary |
| Export bundle policy-redacted | Pass/fail yes | Full twin | **ZK/SD on policy hash** | Shaliah primary |
| \(I_i\) integrity in band (anti-grind) | Pass/fail yes | Component vector | **ZK range / hash preimage** | Shaliah |
| Autonomous pool eligibility / not banned | Flags yes | Full cognition | **ZK/SD** | Autonomous secondary |
| “This preference pair is gold gnosis” | Provenance hash maybe | Pair text until licensed | Hash / signature — **not circuit** | Training only |
| Steward Council 8/12 veto fired | **Yes** | Deliberation optional | Multi-sig; ZK ballots later | Governance |
| Council member “said” \(X\) for training | N/A offline | Literature sources | **Not ZKP** — identity factory | Training only |

Quick table: [CLAIM_MAP.md](./CLAIM_MAP.md).

---

## 5. Genuine roles (do these)

### R1 — Credential / PoC selective disclosure (Shaliah)
**Prove:** “principal holds valid seal for `fg2.stewardship` at time \(t\).”  
**Hide:** full `lesson_ids`, raw \(I_i\), session transcripts.  
**Consumers:** Growth Capital escrow, rate gates, partner APIs.

### R2 — Eligibility without identity dump (Shaliah → markets)
**Prove:** human-bound ∧ PL ≥ \(\theta\) ∧ ¬banned.  
**Hide:** principal_id mapping, full journey map.  
**Consumers:** dual-pop surfaces, markets, collective pools.

### R3 — Consent-graded export + memory envelope (Shaliah outward)
**Prove:** Layer \(n\) authorized for purpose \(U\), not revoked; optional “recall used only class set \(S\).”  
**Hide:** payload / episode contents.  
**Consumers:** data rail / BehavioralData path / external verifiers.

### R4 — Anti-grind integrity (optional ZK)
**Prove:** integrity components in acceptable ranges / not grind-only.  
**Hide:** fine-grained telemetry used to compute \(I_i\).  
**Consumers:** mastery mint, PoC issuers.

### R5 — Autonomous standing (secondary)
**Prove:** pool membership, ban non-membership, capacity/policy hash satisfied.  
**Hide:** full agent cognition.  
**Do not:** replace action audit with a proof when stewardship requires traces.

### R6 — Cross-steward process (later)
**Prove:** process constraints satisfied (quorum, no self-deal).  
**Hide:** full deliberation text.  
**Consumers:** external partners / public governance mirror.

---

## 6. Non-roles (do not ZK-wash)

| Anti-pattern | Why |
|--------------|-----|
| ZK every internal call “because crypto” | Complexity tax; no adversary model |
| Hide agent decisions from the bound human | Violates coach/mirror/extension covenant |
| ZK wall between human and their Shaliah | Breaks mutual knowing |
| ZK *as* the memory store | Wrong tool; use encrypted private vessel + ACL |
| Replace LOGOC/TTC inspectability with opacity | Capture risk; hollow “alignment” |
| Hide autonomous actions from stewards via ZK | Fights VOX / Steward audit doctrine |
| Prove “answer quality is gold” in a circuit | Semantic; use provenance + Council factory |
| Product agents “as historical Council” | Out of scope (training corpus only) |

---

## 7. Phased implementation

### Phase 0 — Now (no circuits) — **Shaliah-first**
- Structured **PoC payload** + Integrity signature (FG curriculum minimum).
- Meshaleach Seal as **signed claim** (EIP-191 / equivalent).
- Consent registry: class × purpose × expiry × revocable.
- Private memory vessel + ACL (store/recall under purpose tags).

### Phase 1 — Selective disclosure (often enough before SNARKs)
- Merkle commitments over credential attributes; reveal paths for needed fields only.
- Or SD-JWT / BBS+ style credentials for “show seal, hide history.”
- Poseidon/Keccak **commitments** for Layer V (matches ZK Cognitive Shield sketch).
- Memory epoch commits: prove membership / consent without opening blobs.

### Phase 2 — True ZK (when verifiers are external / hostile)
- Circuits for: PL range, seal membership, ban-list non-membership, consent class flags, export policy.
- Stack options (pick at implementation, not doctrine): Groth16/Plonk (gas), Halo2/Nova (recursion), or L2-native verifiers.
- Proof artifacts attach to the same PoC envelope: `proof`, `public_inputs`, `verifier_id`.

### Phase 3 — Advanced integrity + autonomous standing
- Non-circularity / drift proofs (named in SHALIAH_AGENTS gap table).  
- Autonomous pool/standing circuits reusing Phase 1–2 formats.

---

## 8. PoC envelope (target shape)

```json
{
  "principal_commitment": "0x…",
  "gate": "fg2",
  "domain_tag": "fg2.stewardship",
  "issued_at": "2026-07-30T00:00:00Z",
  "issuer": "meshaleach-v1",
  "public_claims": {
    "gate_passed": true,
    "human_bound": true
  },
  "proof": {
    "system": "none|merkle-sd|groth16|plonk",
    "bytes": null,
    "public_inputs": []
  },
  "signature": "0x…"
}
```

Phase 0: `proof.system = "none"`, signature carries trust.  
Phase 1–2: fill `proof` without expanding private attributes into the public JSON.

---

## 9. Threat model (why not “sign everything”)

| Verifier | Trust | Tool |
|----------|-------|------|
| Bound human ↔ Shaliah | Covenant trust | Open memory under envelope — **not ZK** |
| Same app backend | High | Signature + DB |
| Other ecosystem services | Medium | Selective disclosure |
| External capital / partners / public | Low | **ZKP or strong SD credentials** |
| Adversarial grinder | Low | Integrity circuits + rate limits |
| Steward / audit of autonomous action | Charter audit | Traces + signatures — **not ZK opacity** |

Use the lightest tool that matches the verifier’s hostility.

---

## 10. Explicit non-goals for ZKP folder (v1)

- No production circuits in this directory yet.
- No change to gnosis-training identity factory (offline literature pairs).
- No product “talk to historical Council” personas.
- No ZK memory *database* — only privacy layer around memory.

---

## 11. Decision log

| Date | Decision |
|------|----------|
| 2026-07-28 | ZKP has genuine role for **credential / eligibility / consent** privacy; not for covenant action audit. |
| 2026-07-30 | `ZKP/` opened as design home; Phase 0 = signed PoC; Phase 1 = selective disclosure; Phase 2 = circuits. |
| 2026-08-04 | **Dual-pop locked:** Shaliah-outward memory privacy **primary**; autonomous standing **secondary**; no ZK wall human↔Shaliah; ZK ≠ memory store. |
| — | Colon / founder seat is the 12th of the onboarding Council set (already in registry); identity-factory batch covers the other 11 historical windows. |

---

## 12. Next concrete engineering (when greenlit)

1. Formalize **Meshaleach / PoC JSON schema** (Phase 0) in `shared/` or `monad-ecosystem`.  
2. Consent + **memory epoch commit** model (Phase 0 vessel, Phase 1 prove-about).  
3. Implement **commitment + reveal** for domain tags (Phase 1).  
4. One **reference circuit**: “gate_passed ∧ human_bound” public, principal salt private (Phase 2 spike).  
5. Wire FG mint path to attach proof artifact without breaking current signature flow.  
6. Autonomous standing proofs — only after Shaliah-outward path is real.

---

*Doctrine: compression and decompression are how life works — ZKP compresses evidence into a checkable claim without decompressing the person into a public dossier. Memory stays the vessel; the proof is the outer seal.*
