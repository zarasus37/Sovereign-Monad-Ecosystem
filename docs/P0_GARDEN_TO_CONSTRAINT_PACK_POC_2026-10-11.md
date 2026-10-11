# P0 Garden → Constraint Pack PoC — 2026-10-11

> **Origin:** Concern #10 from the 2026-10-11 review. The MOF and
> `theo-techno-cosmo/THE COUNCILE/` describe an implicit doctrine: a
> Council **garden** is the source of a constraint pack. The PoC
> proves or disproves that doctrine with one concrete garden.
>
> **Verdict: PROVEN.** One garden (Aristotle) → a versioned constraint
> pack under `shared/constraints/v0.1.0-gardens/` that loads via the
> existing `load_constraint_pack` loader without modification.

## What the PoC ships

| Artifact | Purpose |
|---|---|
| `scripts/garden-to-constraint-pack.mjs` | Node.js generator. Parses a `*GNOSIS EVENT EXTRACTION.txt` file, emits a 3-domain constraint pack (matching the v1.0.0/v1.1.0 shape) + manifest. |
| `shared/constraints/v0.1.0-gardens/{theological,technological,cosmological}.json` | Generated pack for the Aristotle garden. 9 events, all in `theological` (priority order: theology → cosmology → technology; all of Aristotle's events have non-empty theology reading). |
| `shared/constraints/v0.1.0-gardens/manifest.json` | Points back to the source garden, the generator, and the existing v1.1.0 charter pack. |
| `gnostic-engine/tests/test_garden_constraint_pack.py` | 7 tests. Loads the new pack via the existing loader, asserts shape, asserts rule count, asserts `severity=soft`, asserts Three-Domain Reading preserved in params, asserts charter pack (v1.1.0) still loads alongside. |

## What the PoC proves

1. **The implicit contract is real, not aspirational.** A garden text
   (Aristotle, 9 events) **compiles** to the same shape as the charter
   pack (v1.1.0). No loader changes needed.
2. **The governance distinction holds.** Charter pack = hard rules
   (severity=hard). Garden pack = advisory rules (severity=soft). They
   co-exist; the charter pack still loads; the garden pack does not
   carry hard-fail authority. The `validity_rule` field in the manifest
   documents this explicitly.
3. **Provenance is preserved.** Each rule's `params` carries
   `source` (the original primary work + carrier), `confidence` (the
   garden's own rating, e.g. 0.99), and `three_domain_reading` (the
   garden's per-event Theology/Technology/Cosmology reading). Nothing
   is lost in compilation.

## The 9 Aristotle rules, one per Event

| ID | Title | Compressed Insight (description) |
|---|---|---|
| `ARISTOTLE-EVENT-01` | All men by nature desire to know | "All men by nature desire to know — sight most of all; art arises when many experiences yield one universal judgement." |
| `ARISTOTLE-EVENT-02` | Being said in many senses | "Being is said in many senses, related to one central point — substance — not by mere ambiguity." |
| `ARISTOTLE-EVENT-03` | Four causes | "Cause is said as matter, form, source of change, and end — several causes of the same thing, not in the same way." |
| `ARISTOTLE-EVENT-04` | Soul is first actuality | "Soul is the first actuality of a natural organized body — as meaningless to ask if soul and body are one as wax and stamp." |
| `ARISTOTLE-EVENT-05` | Every art aims at some good | "Every art and inquiry aims at some good — the chief good is desired for its own sake; politics is the master art." |
| `ARISTOTLE-EVENT-06` | Activity of soul in accordance with virtue | "Human good is activity of soul in accordance with virtue — in a complete life; one swallow does not make a summer." |
| `ARISTOTLE-EVENT-07` | Virtue is a mean | "Virtue is a state of choice lying in a mean relative to us — determined as the man of practical wisdom would determine it." |
| `ARISTOTLE-EVENT-08` | Man is by nature a political animal | "Man is by nature a political animal — speech sets forth the just and unjust; the state is prior to the isolated individual." |
| `ARISTOTLE-EVENT-09` | Something which moves without being moved | "Something moves without being moved — eternal, substance, actuality; the final cause moves as being loved; on such a principle depend the heavens." |

Each rule's `params.three_domain_reading` carries the per-event
Theology/Technology/Cosmology reading. The `params.source` points to
the original primary work (e.g. `*Metaphysics* I.1 Ross continuous.`).
The `params.confidence` is the garden's own rating (0.99 for all 9
Aristotle events).

## How to run the generator on a different garden

```bash
node scripts/garden-to-constraint-pack.mjs \
  --garden "theo-techno-cosmo/THE COUNCILE/<NAME> (<DATES>) GNOSIS EVENT EXTRACTION.txt" \
  --out shared/constraints/v0.1.0-gardens-<NAME> \
  --key <lowercase-name>
```

The generator:

- Splits the garden text on `## Event NN — *title*` markers.
- For each event, extracts `Compressed Insight`, `Confidence`,
  `Sources`, and the three-domain reading.
- Picks one domain per event by priority (theology → cosmology → technology;
  first non-empty wins).
- Emits all three domain files (empty for the two with no events) so
  the pack is self-contained.
- The manifest carries provenance: source garden path, key, generator
  script path, generation timestamp.

## Verification

- `pnpm check:layout` — green
- `pnpm check:numerics` / `check:sign-types` / `check:ttcl-artifacts` /
  `check:temple-grid` / `check:council` / `check:schedule-schema` — green
- `pnpm build` — all 32 packages build
- `pnpm typecheck` — 32 of 33 workspace projects (shim is the no-op)
- `pnpm test:integration` — **240/240 tests pass in 16 files (6.1s)**
- `uv run pytest tests/test_garden_constraint_pack.py` — **7/7 pass (0.37s)**
  - The charter pack (v1.1.0) still loads alongside the garden pack.
  - All rules have `severity=soft`.
  - All rules carry the source figure's `three_domain_reading` in `params`.

## What this PoC does NOT claim

- **It does not claim that all 73 gardens compile cleanly.** The
  generator's regex is tuned to the current file shape (the
  `## Event NN — *title*` marker, the `**Compressed Insight:**` field,
  the `**Three-Domain Reading:**` block with `- **Theology:** …` etc.).
  Gardens with non-conforming formatting may need per-garden
  adjustments. **The other 72 gardens have not been tested.**
- **It does not claim the garden pack has runtime consumers yet.** The
  charter pack (v1.1.0) is consumed by `hepar-defi-auditor` and the
  TTC gate; the garden pack exists as a new layer alongside it.
  Wiring garden rules into the TTC scoring is a separate scope.
- **It does not claim soft-severity garden rules are "real" sovereignty
  rules.** They are advisory — a model can be checked against them but
  they do not trigger hard-fail. The Charter §3.1 deadline
  (2027-07-06) for the original Theo-Techno-Cosmo constraint packs is
  unrelated.

## What this PoC enables

- A second garden can be generated in ~10 minutes by re-running the
  script with `--key <name>`. Cost: one human minute to pick the
  garden + one CLI invocation + one test run.
- A second PoC (different garden, different distribution across
  domains) will quickly reveal whether the priority assignment
  (theology first) is right or whether some gardens are dominated by
  technological readings and need a different priority.
- The same generator can be re-targeted at `gnostic-training-data`
  once that package is wired as a constraint source (Layer 7 in the
  MOF).

## Next steps (out of PoC scope)

1. Run the generator on 2-3 more gardens to verify the regex is robust
   to the wider corpus (Aristotle is well-formatted; others may be less so).
2. Wire one soft garden rule into the TTC scorer as a 4th-axis
   "historical-figure" tie-breaker (charter axiom + scoring + council
   figure + penalty absence). This is a one-day change in
   `gnostic-engine/src/gnostic_engine/constraints/scorer.py`.
3. Define a `v0.2.0-gardens` pack that aggregates multiple gardens
   (e.g. `aristotle` + `plato` + `aquinas`) into a single pack
   asserting convergence on a particular axiom.
4. Mark `shared/constraints/v0.1.0-gardens/immutable=false` permanently
   in the loader's contract — currently we just trust the manifest
   field. A loader-level check would close that gap.

## Sign-off

Per Charter §3.1, this is a **non-immutable** experimental pack
(`immutable: false`). The shape is correct; the governance status is
"advisory / experimental." Promoting to immutable requires a
Steward Council review.

— Mavis (2026-10-11)
