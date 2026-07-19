/**
 * @sovereign/gnosis-training-data — TTCL Layer 7 data-generation consumer.
 *
 * Reads a Layer 6 `CanonicalSchedule` (@sovereign/scheduler) and emits Gnosis
 * training events (JSONL) in the spec format (`TTCL_v1_0_BREAKDOWN.md:314-359`)
 * for the future SFT stage. Local + deterministic + byte-reproducible; reuses
 * `@sovereign/ttcl` `scoreSign` for the constitution score. Optional
 * Enheduanna TempleGrid binding attaches `temple_grid` via `nodeToEventPayload`.
 */

// Facade.
export { generateGnosisEvents, EVENT_FORMAT_VERSION } from "./consumer.js";
export { serializeEventsJsonl, jsonlHeader } from "./serialize.js";
export { validateGnosisEvent, lastGnosisEventErrors } from "./schema.js";

// Materialization primitives (exported for the L7.8-style parity test + downstream
// inspection; the consumer composes them, but they are reusable on their own).
export {
  materializeSign,
  materializeSignWithGrid,
  constitutionScore,
  deterministicUuid,
  fnv1a32,
  slotLetter,
  keyHash,
  wheelState,
  activeSlots,
  provenanceTokens,
  userPrompt,
  resolveTempleIdForStep,
  templePayloadForStep,
  LOGOC_SYSTEM_PROMPT,
} from "./materialize.js";

// Types.
export type {
  GnosisEvent,
  GnosisEventConfig,
  GnosisWheelState,
  GnosisActiveSlot,
  GnosisMessage,
  GnosisConstitutionScore,
  GnosisTempleGridPayload,
  GnosisTempleGridLogoc,
} from "./event.js";
