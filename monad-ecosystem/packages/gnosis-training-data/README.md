# @sovereign/gnosis-training-data

TTCL **Layer 7 — data-generation consumer**. The prose names the Layer 7
"next code priority" as *the data-generation consumer that turns a
`canonical_schedule` into Gnosis training events*
(`docs/PROJECT_STATE.json` `known_follow_ups`;
`docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md:2035`).
This package is that consumer.

It reads a `CanonicalSchedule` produced by `@sovereign/scheduler` (Layer 6),
iterates the accepted rotation steps, materializes each step's wheel composite
into a TTCL `Sign`, scores it with the **existing** `@sovereign/ttcl` `scoreSign`
constitution scorer (the L7.8 parity surface — reused, not reimplemented), and
emits **Gnosis training events** in the spec format
(`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:314-359`) as deterministic
NDJSON (JSONL). The output is the feedstock the future SFT→Reward→GRPO→Eval
pipeline will consume.

## Honesty posture (read this)

- **Local, deterministic data-generation.** No GPU, no model inference, no
  training. This package does **not** run any stage of SFT/Reward/PPO/Eval and
  does **not** claim live pipeline wiring. The full pipeline is a real
  HuggingFace-TRL job (`TTCL_v1_0_BREAKDOWN.md:275-311`) and remains unbuilt.
- **Deterministic + byte-reproducible.** `event_id` is a deterministic v5-style
  UUID (SHA-1 of namespace + `seed:stepIndex:compositeKey`), **not** random. No
  `Math.random`, no wall-clock, no `crypto.randomUUID`. Same `(schedule, config)`
  → byte-identical JSONL (the reproducibility gate, mirroring the scheduler).
- **Reuses `scoreSign`.** The `constitution_score` is a real `scoreSign` result on
  a `Sign` materialized from the step's composite — not a reimplementation. The
  wheel-state→`Sign` mapping is a **concretization** (the spec gives the event
  *format* but not how a rotation maps to a `Sign`); see `src/materialize.ts`.
- **Catalan slot labels are sourced from the registry.** The wheel registry
  (`shared/fixtures/layer6/wheel-registry.json`) now carries the sourced Llull
  register (8 generative + 3 domain wheels, from
  `theo-techno-cosmo/Wheel/8 wheels and 3 domains.docx`). `active_slots.*.label`
  is a real Catalan string for wheels that carry one (A + the 3 domain wheels
  Teologia/Kosmologia/Technologia + F + S), and `null` for the structured-label
  wheels (P/T/V/Q/E) pending a richer label shape. **Never fabricated** — every
  non-null label is a real entry present in some wheel's `labels` array. (At the
  PR #39 landing these were `null` pending the asset; the asset landed in PR #46.)
- **The `assistant` message is empty.** The deterministic consumer emits the
  prompt scaffold (`system` + `user`); the assistant response is the SFT training
  **target**, produced downstream — not synthesized here. The `constitution_score`
  is therefore the *structural* score of the prompt scaffold (tripartite coverage +
  modality + manifold band + provenance), not a per-response score.

## Usage

```ts
import { generateGnosisEvents, serializeEventsJsonl, validateGnosisEvent } from "@sovereign/gnosis-training-data";
import { generateSchedule, loadRegistry } from "@sovereign/scheduler";

const registry = loadRegistry("shared/fixtures/layer6/wheel-registry.json");
const schedule = generateSchedule("shared/fixtures/layer6/wheel-registry.json");
const events = generateGnosisEvents(schedule, registry);
if (!events.every(validateGnosisEvent)) throw new Error("schema violation");
const jsonl = serializeEventsJsonl(events); // NDJSON

// Optional: Enheduanna TempleGrid → temple_grid via nodeToEventPayload
import type { TempleGrid } from "@sovereign/ttcl";
import { readFileSync } from "node:fs";
const templeGrid = JSON.parse(
  readFileSync("shared/fixtures/layer6/enheduanna-temple-grid.json", "utf8"),
) as TempleGrid;
const withGrid = generateGnosisEvents(schedule, registry, { templeGrid });
```