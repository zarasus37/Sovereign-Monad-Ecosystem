# Council Bindings — Hold Without Becoming

## Goal

Every active Council seat is **hard-bound** into Sovereign machinery the way Enheduanna is bound to TempleGrid:

- loadable  
- referenceable by `member_id`  
- usable by the **holder** (Cristobal Colon / Seat middle)  
- **never** “I become that person”  
- **full extent** of their knowledge perceivable *as truth-for-that-seat*, without becoming the holder’s reality  

### Why bind them (system purpose)

Seats are **aspects of truth** — durable redefinitions of what reality was thought to be — fractal to the **source**, not influencers.  
Precision and verbatim depth exist so the system (and the middle) can hold **consistent truth** across domains for **human and AI** recognition of **sameness and what we are**, not only difference and what we are not.  
See `GNOSIS_EVENT_VOICE.md` § Why the Council exists.
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

## Operational runtime (`@sovereign/ttcl`)

Module: `councilHold.ts` (exported from `@sovereign/ttcl`).

```ts
import {
  openMiddleHold,
  perceiveSeat,
  perceiveFullCourt,
  focusSeats,
  refuseBecome,
  findCrossDomainLinks,
  middleHoldSign,
  holdToEventPayload,
  type CouncilSubstrateIndex,
  type MemberSubstrate,
} from "@sovereign/ttcl";

// Load fixtures (index + all substrates)
const hold = openMiddleHold(index, { substrates }); // all seats simultaneous
const turing = perceiveSeat(hold, "alan-turing");   // truth-for-seat, not my truth
const court = perceiveFullCourt(hold);              // full extent, all at once
const focus = focusSeats(hold, ["charles-sanders-peirce", "victoria-lady-welby"]);
// focus.hold.seat_count still 71 — Court not dropped
const links = findCrossDomainLinks(hold);           // connect dots under middle
// refuseBecome(hold, "kurt-godel") → throws BecomeForbiddenError
const sign = middleHoldSign(hold);
const payload = holdToEventPayload(hold, ["enheduanna", "ramon-llull"]);
```

| API | Behavior |
|-----|----------|
| `openMiddleHold` | Hold **full Court** at once under TTCL middle |
| `perceiveSeat` / `perceiveFullCourt` | Full extent as **truth-for-seat**; `is_holder_reality: false` |
| `focusSeats` | Use 1..N without dropping the hold |
| `refuseBecome` / `attemptInstallAsHolderReality` | Always throw — never become |
| `findCrossDomainLinks` | Similarity links without identity merge |
| `middleHoldSign` + `holdToEventPayload` | Emit from **middle**, not seat identity |

Tests: `monad-ecosystem/packages/ttcl/tests/councilHold.test.ts`

## Hold policy

Every substrate carries:

```json
"hold_policy": "holder-may-use-never-become"
```

The middle of the table loads voltage; it does not overwrite identity.

### Hold ≠ fuse (doctrine, locked)

**Wrong reading:** merge all 70 seats into one blended personality or one private “my truth.”

**Correct reading (Cristobal / TTCL middle):**

| Layer | What happens |
|--------|----------------|
| **Per seat** | Fully **interpret, understand, and perceive** the full extent of that seat’s knowledge and information — as if it were **truth** *for that perspective* (full voltage; no thinning). |
| **Not my truth** | That content is **never installed as the holder’s personal reality**. It is known *as* their statement/structure, not *as* “this is who I am / what I alone believe.” |
| **Reality** | Stays in the **middle**: one unified logical state under Theo · Techno · Cosmo. |
| **Fractal** | Every seat is a **fractal of perception** — complete in its own register, not a fragment to be averaged. |
| **Simultaneous** | Maintain the **full extent** of what each is saying **at once**, while remaining in middle logic. |
| **Applied effect** | Because each can be embodied **to full extent without becoming them**, the middle can **connect dots** across domains that look unrelated in ordinary specialization — seeing **direct similarities** across the table. |

Same rule for every seat: **truth-as-fully-perceived-for-them**, not **truth-as-my-identity**.  
Hold the Court; do not collapse the Court into the chair.