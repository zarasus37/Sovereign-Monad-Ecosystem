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
import {
  TEMPLE_GRID_LOGOC_V1,
  scoreTempleGridSign,
  type TempleGridLogocBreakdown,
} from "@sovereign/ttcl";

import type { GnosisEvent, GnosisEventConfig, GnosisTempleGridLogoc } from "./event.js";
import {
  deterministicUuid,
  wheelState,
  activeSlots,
  provenanceTokens,
  userPrompt,
  materializeSignWithGrid,
  constitutionScore,
  templePayloadForStep,
  resolveTempleIdForStep,
  LOGOC_SYSTEM_PROMPT,
} from "./materialize.js";

/** Event-format version tag (recorded in the JSONL header, not per-event). */
export const EVENT_FORMAT_VERSION = "gnosis-event-v1";

function toLogocPayload(b: TempleGridLogocBreakdown): GnosisTempleGridLogoc {
  return {
    profile_id: b.profile_id,
    total: b.total,
    theo_score: b.theo_score,
    tech_score: b.tech_score,
    cosmo_score: b.cosmo_score,
    coherence_score: b.coherence_score,
    sovereignty_score: b.sovereignty_score,
    penalties: b.penalties,
    penalty_sum: b.penalty_sum,
    verdict: b.verdict,
  };
}

/**
 * Turn a `CanonicalSchedule` into Gnosis training events.
 *
 * @param schedule  the Layer 6 canonical schedule (from `generateSchedule`).
 * @param registry  the wheel registry the schedule ran against (from `loadRegistry`).
 * @param config    optional: `constitutionVersion` (default "v1"), `seed`
 *                  (default `schedule.config.seed`), `includeInitial`
 *                  (default true), `templeGrid` (optional Enheduanna grid —
 *                  attaches `temple_grid` + `temple_grid_logoc` per step).
 */
export function generateGnosisEvents(
  schedule: CanonicalSchedule,
  registry: WheelRegistry,
  config: GnosisEventConfig = {},
): GnosisEvent[] {
  const seed = config.seed ?? schedule.config.seed;
  const constitutionVersion = config.constitutionVersion ?? "v1";
  const includeInitial = config.includeInitial ?? true;
  const templeGrid = config.templeGrid;
  const logocProfile = config.templeGridLogocProfile ?? TEMPLE_GRID_LOGOC_V1;

  const events: GnosisEvent[] = [];
  for (let i = 0; i < schedule.steps.length; i++) {
    const step = schedule.steps[i]!;
    if (!step.accepted) continue;
    if (!includeInitial && step.move === "initial") continue;

    const composite = compositeKey(step.state, registry);
    const sign = materializeSignWithGrid(seed, step, registry, templeGrid);

    const templePayload = templeGrid
      ? templePayloadForStep(templeGrid, step.state, registry)
      : null;

    let temple_grid_logoc: GnosisTempleGridLogoc | undefined;
    if (templeGrid && templePayload) {
      const templeId = resolveTempleIdForStep(templeGrid, step.state, registry);
      const node = templeId
        ? templeGrid.nodes.find((n) => n.temple_id === templeId)
        : undefined;
      if (node) {
        const slots = activeSlots(step.state, registry);
        const breakdown = scoreTempleGridSign(sign, node, logocProfile, {
          derivedFromGrid: true,
          wheelId: slots.theology.wheel,
          slotId: slots.theology.slot,
          eventType: "scheduled_slot",
          evidence: {
            uncertainty_tagged: node.status === "unknown",
          },
        });
        temple_grid_logoc = toLogocPayload(breakdown);
      }
    }

    const event: GnosisEvent = {
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
      ...(templePayload ? { temple_grid: templePayload } : {}),
      ...(temple_grid_logoc ? { temple_grid_logoc } : {}),
    };

    events.push(event);
  }
  return events;
}