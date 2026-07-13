/**
 * The data-generation consumer — `generateGnosisEvents`.
 *
 * Reads a `CanonicalSchedule` (@sovereign/scheduler, Layer 6) + its
 * `WheelRegistry`, iterates the accepted rotation steps, and emits one Gnosis
 * training event per accepted step in the spec format
 * (`TTCL_v1_0_BREAKDOWN.md:314-359`). Deterministic: a pure function of
 * `(schedule, registry, config)` — same inputs → byte-identical events (the
 * reproducibility gate).
 *
 * One event per *accepted* step (the initial seed step is included by default —
 * it is itself a valid tripartite composite). Repeated composites are emitted
 * per occurrence (no dedup); dedup is a future refinement and would change the
 * event count, so it is left open here.
 */

import { compositeKey, type CanonicalSchedule, type WheelRegistry } from "@sovereign/scheduler";

import type { GnosisEvent, GnosisEventConfig } from "./event.js";
import {
  deterministicUuid,
  wheelState,
  activeSlots,
  provenanceTokens,
  userPrompt,
  materializeSign,
  constitutionScore,
  LOGOC_SYSTEM_PROMPT,
} from "./materialize.js";

/** Event-format version tag (recorded in the JSONL header, not per-event). */
export const EVENT_FORMAT_VERSION = "gnosis-event-v1";

/**
 * Turn a `CanonicalSchedule` into Gnosis training events.
 *
 * @param schedule  the Layer 6 canonical schedule (from `generateSchedule`).
 * @param registry  the wheel registry the schedule ran against (from `loadRegistry`).
 * @param config    optional: `constitutionVersion` (default "v1"), `seed`
 *                  (default `schedule.config.seed`), `includeInitial`
 *                  (default true).
 */
export function generateGnosisEvents(
  schedule: CanonicalSchedule,
  registry: WheelRegistry,
  config: GnosisEventConfig = {},
): GnosisEvent[] {
  const seed = config.seed ?? schedule.config.seed;
  const constitutionVersion = config.constitutionVersion ?? "v1";
  const includeInitial = config.includeInitial ?? true;

  const events: GnosisEvent[] = [];
  for (let i = 0; i < schedule.steps.length; i++) {
    const step = schedule.steps[i]!;
    if (!step.accepted) continue;
    if (!includeInitial && step.move === "initial") continue;

    const composite = compositeKey(step.state, registry);
    const sign = materializeSign(seed, step, registry);

    events.push({
      event_id: deterministicUuid(`${seed}:${i}:${composite}`),
      constitution_version: constitutionVersion,
      wheel_state: wheelState(seed, step.state, registry),
      active_slots: activeSlots(step.state, registry),
      provenance_tokens: provenanceTokens(registry.registry, step.state),
      messages: [
        { role: "system", content: LOGOC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt(step.state, registry) },
        { role: "assistant", content: "" },
      ],
      constitution_score: constitutionScore(sign),
    });
  }
  return events;
}