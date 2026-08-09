# Council Bindings — Hold Without Becoming

## Goal

Every active Council seat is **hard-bound** into Sovereign machinery the way Enheduanna is bound to TempleGrid:

- loadable  
- referenceable by `member_id`  
- usable by the **holder** (Cristobal Colon / Seat middle)  
- **never** “I become that person”

## Two layers

| Layer | What | Who |
|--------|------|-----|
| **Member substrate** | One fixture per seat: contribution, insight, TTC, source file, domain tag | **All 71** |
| **Natural specialty** | Domain graph only when the corpus *is* that graph | e.g. Enheduanna → TempleGrid, Llull → Wheels |

Cristobal’s bindings include: Steward Council #12, Agent 0, TempleGrid (hold, not author), **and** the council substrate index (hold the full table).

## Applied effect (same pattern as TempleGrid)

```
Registry member
  → system_bindings[]
  → load fixture(s)
  → LOGOC / scheduler / gnosis-training may resolve member_id
  → holder uses sign without identity merge
```

## Natural specialty map (intent)

| Domain | Example seats | Binding kind |
|--------|---------------|--------------|
| Temple network | Enheduanna | `temple-grid` |
| **Wheel / combinatorial apparatus** | **Llull, Trithemius, Peirce, Welby** | `wheel-registry` (+ member-substrate) |
| Living middle | Cristobal Colon | `steward-council` + `logoc-corpus` + hold index + wheels + temple-grid |
| Formal limits | Gödel, Turing | `member-substrate` (+ future formal-limit fixtures) |
| Lawful cosmos | Newton, Einstein, Hubble | `member-substrate` (+ future law-fixtures) |
| Signs / structure (non-wheel) | Saussure, Lévi-Strauss | `member-substrate` (+ future structural fixtures) |
| … | … | Always at least `member-substrate` |

### Wheel cluster — triad + combinatorial expansion (correct facts)

These four share the **wheel / Ars / sign-combination** stack (`shared/fixtures/layer6/wheel-registry.json`):

| Seat | Role on the wheel stack | Verified basis |
|------|-------------------------|----------------|
| **Ramon Llull** | Operative combinatorial source (Ars, figures, domain wheels) | Historical Ars; fixture `registry: llull-default` |
| **Johannes Trithemius** | Macro–micro correspondence / steganographic–angelological line | Project binding to same apparatus (not author of Llull’s Ars) |
| **Charles Sanders Peirce** | **Triadic** sign model — representamen / object / interpretant | Historical triadic logic; project binding to wheels |
| **Victoria, Lady Welby** | **Significs** triad Sense / Meaning / Significance; correspondence with Peirce | Historical (Peirce–Welby letters; parallel triads) |

**What is correct (use these numbers, not guesswork):**

| Fact | Value |
|------|--------|
| Peirce / Welby atomic structure | **3** (triad), not a dyad |
| Llull alphabet (classic Ars) | **9** letters **B–K** (dignities / principles) |
| Binary combinations of 9, order irrelevant, no repeat | **C(9,2) = 36** (Llull’s third-figure style count) |
| Subject–predicate direction often doubled | **72** propositions in some expositions of Figure A |
| This repo `wheel-registry.json` (current) | **11** wheels; **28** pairs; fourthFigure alphabet **9**; **84** cameras |

**Idea being pointed at (keep; do not invent a false “66” as doctrine):**  
One **shared apparatus**: atomic **relations of three** (Peirce/Welby) plus **combinatorial recombination** of principles (Llull), held as one loadable stack so the middle of the table can use it without becoming any of the four. Specialty binding for all four is `wheel-registry` — one apparatus, not four disconnected myths.

If a future Sovereign scale needs a specific expansion count, derive it from the fixture (pairs / cameras / figures) or from Llull’s table, and document the formula — do not hard-code a remembered number without check.

## Generate

```powershell
node scripts/gen-council-registry.mjs
# substrates written under shared/fixtures/layer6/council-substrates/
pnpm check:council
```

## Hold policy

Every substrate carries:

```json
"hold_policy": "holder-may-use-never-become"
```

The middle of the table loads voltage; it does not overwrite identity.
