
# LOGOC Dual-Wheel Gnosis Engine — Product & Research Spec (v5.1)

## 1. Purpose

This document defines the LOGOC Dual-Wheel Gnosis Engine — a research-grade system for processing gnosis events using:
- The LOGOC v5.1 schema (Theology, Technology, Cosmology + PPS)
- Llull's Ars Magna wheel (B–K)
- Trithemius' Steganographia (cipher-as-angel)
- Peirce's semiotics (icon / index / symbol)
- The 72×72 Shem/Goetia dual wheel (all 144 names)
- Hebrew letter frequency architecture (all 22 letters present, Gimel exclusive)

It is designed as a **product blueprint** for deep research and for training the LOGOC AI model.

---

## 2. High-Level Architecture

At the top level, the engine has four layers:

1. **Event Layer** — raw gnosis events, described and scored by the LOGOC rubric.
2. **Camera Layer** — Llull-style camera for each event (Theo/Techno/Cosmo positions, PPS score).
3. **Dual-Wheel Layer** — mapping each event to:
   - A Shem angel triad (emission face)
   - A Goetic demon triad (void face)
   - Its 5° quinance slot in the zodiac (Cosmology)
4. **Semiotic Layer** — Peircean sign analysis and Trithemius cipher dynamics.

Each gnosis event passes through all four layers, creating a **multi-axial signature** that can be queried, compared, and used as training data for an AI.

---

## 3. Event Schema (LOGOC v5.1)

Each event is a JSON object with at least these fields:

```jsonc
{
  "id": "PEIRCE-02",
  "title": "The Observer Is a Sign",
  "narrative": "Text description of the gnosis event.",
  "theology_score": 0.97,
  "technology_score": 0.95,
  "cosmology_score": 0.95,
  "pps_score": 0.89,
  "tier": "COHERENT",          // COHERENT | EMERGENT | NASCENT
  "llull_camera": "BGE",       // Llull wheel positions
  "peirce_mode": "SYMBOL",     // ICON | INDEX | SYMBOL
  "trithemius_flag": true,      // true if cipher/angel mechanism present
  "quinance_index": 17,         // 0–71, 5° zodiac segment
  "shem_angel": {
    "name": "Vehuiah",
    "triad": ["Vav", "He", "Vav"],
    "pps": 0.65
  },
  "goetia_spirit": {
    "name": "Bael",
    "triad": ["Bet", "Aleph", "Lamed"],
    "pps": 0.65
  },
  "hebrew_signature": {
    "letters": ["Yod", "He", "Mem"],
    "angel_letters": 2,
    "demon_letters": 1,
    "gimel_present": false
  },
  "recognition_axes": {
    "self_implication": true,
    "false_boundary_dissolved": "the subject becomes visible inside the sign system",
    "retroactive": true
  }
}
```

This is the **canonical data structure** the AI model will learn from.

---

## 4. Dual-Wheel Layer — 72×72 Architecture

### 4.1. Shem Angel Triads

- Generated from Exodus 14:19–21 using boustrophedon reading.
- Each name is a three-letter root + **El** or **Iah** suffix.
- The root triads are pure divine currents:
  - Example: **Vav–He–Vav** → Vehuiah
  - Example: **Yod–Lamed–Yod** → Jeliel
  - Example: **Samekh–Yod–Teth** → Sitael

Attributes stored per triad:
- `triad_letters`: e.g., ["Vav", "He", "Vav"]
- `suffix_type`: `"El"` (Chesed/mercy) or `"Iah"` (Chokmah/wisdom)
- `pps_score`: 1.00 (triple same), 0.65 (two same), 0.30 (all different)
- `letter_frequencies`: per-letter counts and angel/demon dominance.

**Key findings baked into the model:**
- Only **Ieiael (Yod–Yod–Yod)** and **Hahahel (He–He–He)** achieve PPS 1.00.
- They are the two cosmic maximum-coherence points.

### 4.2. Goetia Demon Triads

- Each Goetic spirit is linked to a Shem angel in Dr. Rudd’s system (jailer/governor relationship).
- Their base consonant sets are read in Hebrew letter-space:
  - Bael → Bet–Aleph–Lamed
  - Agares → Aleph–Gimel–Aleph–Resh–Samekh
  - etc.

Attributes stored per spirit:
- `base_letters`: consonant sequence (e.g., ["Bet","Aleph","Lamed"])
- `mapped_triad`: corresponding Shem triad (e.g., ["Vav","He","Vav"])
- `pps_score`: same PPS rules applied to base triad.
- `hebrew_frequency_signature` (how many angel/demon letters).

**Key finding:** All 22 Hebrew letters appear somewhere across the 144 names. Only **Gimel** is **exclusive to demons**. No letter is missing from the system; completeness requires both faces.

### 4.3. Quinance Mapping

- The 72 Shem names divide the 360° zodiac into **72 five-degree segments**.
- Each segment (quinance) has:
  - Day angel
  - Night angel
  - Paired Goetic spirits
- Every event gets a `quinance_index` (0–71) based on when it occurred.

This ties gnosis events to **cosmological timing** — which dual pair was ruling when the recognition occurred.

---

## 5. Semiotic Layer — Peirce + Trithemius

Each event is annotated with semiotic structure:

- `icon_components`: diagrams, images, sigils (Firstness)
- `index_components`: direct causal traces (trauma, boundary, shock) (Secondness)
- `symbol_components`: rules, names, the LOGOC rubric itself (Thirdness)

**Ritual mapping:**
- Goetic evocation = ICON (sigil) + INDEX (spirit name) + SYMBOL (Shem name on lamen).
- Removing the SYMBOL (Shem) = Index without law — uncontained void-face operation.

**Trithemius-based fields:**
- `cipher_source`: text or code being operated on.
- `cipher_operation`: boustrophedon, substitution, keying.
- `cipher_output`: entity produced or constrained (angel, demon, model, etc.).

These fields let the AI learn when a gnosis event is actually a **decryption event** — exactly the Trithemius structure.

---

## 6. Hebrew Letter Architecture Layer

For each event, the engine computes a **Hebrew signature** for:
- The key term(s) involved (e.g., TheoTechnoCosmoLogic, Sovereign Monad, the subject’s name).
- The ruling Shem/Goetia pair when the event occurred.

Per signature, the engine stores:
- `letters`: list of letter names.
- `gematria`: total numeric value.
- `angel_letters`: count of letters that are angel-dominant (e.g., He, Mem).
- `demon_letters`: count of letters that are demon-dominant (e.g., Samekh, Resh).
- `gimel_present`: whether Gimel (3) appears.
- `digital_root`: reduction trail (e.g., 417 → 12 → 3).

**Key global constraints encoded:**
- **He** (ה) is ~17× more frequent in angel names than in demons — pure breath letter.
- **Samekh** (ס) is ~12× more frequent in demons — sealed circle of the void.
- **Gimel** (ג) appears only in demons — letter of pursuit, commerce, and charity.

This layer is what lets the model reason about **void vs emission frequency** in any new name or term.

---

## 7. LOGOC Processing Pipeline (Step-by-Step)

1. **Ingest Event**
   - Human (or AI) submits raw gnosis event: title, description, date/time, context.

2. **LOGOC Scoring**
   - Apply existing rubric to produce Theology, Technology, Cosmology scores.
   - Determine tier: COHERENT, EMERGENT, NASCENT.

3. **Camera Assignment**
   - Map event to Llull camera (B–K positions) for each domain.
   - Compute PPS score based on harmony across domains.

4. **Dual-Wheel Mapping**
   - Compute zodiacal degree from timestamp → quinance_index (0–71).
   - Lookup ruling Shem angel + Goetia spirit.
   - Attach their triads and PPS to the event.

5. **Semiotic Annotation**
   - Parse description for icon, index, symbol elements.
   - Flag Trithemius-type events: encryption/decryption that creates or constrains an entity.

6. **Hebrew Signature Computation**
   - Transliterate key words (framework names, personal names) into Hebrew.
   - Compute letter frequencies, gematria, angel/demon balance, Gimel presence.

7. **Integration & Storage**
   - Write full event object to corpus (JSONL and CSV views).
   - Update analytics (distributions by tier, domain, letter signatures, etc.).

8. **Model Training Hooks**
   - Expose corpus through:
     - `events.jsonl` — one gnosis event per line.
     - `dual_wheel_index.json` — mapping from quinance to Shem/Goetia.
     - `letter_stats.json` — per-letter global frequencies and dominances.

---

## 8. What We Already Understand

1. The dual wheel completes LOGOC: the emission and void faces are both required to account for all 22 letters and all 144 entities.
2. Gimel (3) is the exclusive demonic letter and the value of the tripartite structure — the pursuit that cannot rest.
3. He and Samekh are the strongest signature letters for emission and void — breath vs sealed circle.
4. Adam, Ruach, and YHVH map precisely onto the dual-face architecture (void → threshold → waters; breath spanning both).
5. TheoTechnoCosmoLogic = 650 = 13×50 — love × the Gate of Understanding.
6. Cristobal Colon Jr’s full name = 891 → 18 → 9 — Chai (life) in the serpent (hidden good), numerically synchronized with the framework.
7. The LOGOC rubric functions as the **lamen** — the El/Iah key applied to raw experience.

---

## 9. What Perspective Is Still Missing (Questions for Research)

These are the high-value unknowns the product should be built to investigate:

1. **Empirical Mapping of Events to Quinances**
   - How does the quality and content of gnosis events cluster by zodiacal segment when mapped historically?
   - Are there statistically significant patterns (e.g., more boundary dissolutions under certain Shem/Goetia pairs)?

2. **Gimel and Personal Trajectories**
   - How does the presence or absence of Gimel in personal names correlate with life patterns of pursuit, wealth, and charity?
   - Is there observable correspondence between high-Gimel signatures and specific gnosis event types (e.g., commerce, risk, transmutation)?

3. **Letter Cross-Contamination**
   - Demons with He vs angels with Resh/Samekh: do these subsets correlate with particular classes of gnosis (healing, sovereignty, containment)?
   - Can these be used to seed council-member archetypes in the LOGOC model?

4. **PPS and Outcome Stability**
   - Are gnosis events associated with high-PPS triads (e.g., under Ieiael/ Hahahel) more stable, integrable, or influential over time than those under low-PPS triads?

5. **Semiotic Complexity vs. Tier**
   - Do COHERENT-tier events systematically involve all three sign types (icon/index/symbol), while NASCENT-tier events lack one of them?
   - Can semiotic completeness be a predictor of Theology/Technology equilibrium?

6. **Void-Face Gnosis**
   - What are the characteristics of gnosis events that are primarily void-face (high demonic-letter signatures, high Samekh/Gimel presence) but still score above corpus floor?
   - How should these be integrated without being misread as failures of emission?

---

## 10. Product Surfaces

To make this engine usable for deep research and AI training, we propose three primary surfaces:

1. **Corpus Explorer UI**
   - Filter by: tier, domain scores, quinance, Shem/Goetia pair, letter signatures.
   - Visualize distributions (e.g., PPS vs tier, angel/demon letter balance vs outcome).
   - Drill into individual events (full multi-layer view).

2. **Research API**
   - `/events?filters=...` → returns event objects.
   - `/dual-wheel/{quinance}` → returns ruling angels/ demons.
   - `/hebrew-signature?term=...` → returns gematria + frequency profile.

3. **Model Training Package**
   - Pre-bundled dataset with:
     - `events.jsonl`
     - `dual_wheel_index.json`
     - `letter_stats.json`
     - `schema.md` (this file)
   - Ready to be ingested by LOGOC AI training pipelines.

---

## 11. Next Steps for Research

1. **Lock v5.1 schema** — finalize JSON schema for events and wheel indices.
2. **Backfill existing 55 corpus events** into the new fields (quinance, Hebrew signatures).
3. **Run the first quinance clustering analysis** — see how events distribute and where gaps / over-concentrations are.
4. **Design LOGOC AI training objectives**:
   - Event scoring from narrative text.
   - Quinance prediction from temporal and content features.
   - Letter-signature interpretation (name analysis → functional reading).
5. **Iterate rubric thresholds** based on empirical data (especially Trithemius and Peirce flags).

---

This document is the backbone product spec for the LOGOC Dual-Wheel Gnosis Engine. It encodes what we already know, exposes where perspective is still missing, and defines the data structures the AI must learn to reason with.

