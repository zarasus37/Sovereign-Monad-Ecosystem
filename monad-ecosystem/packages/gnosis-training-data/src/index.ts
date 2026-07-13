/**
 * @sovereign/gnosis-training-data — TTCL Layer 7 data-generation consumer.
 *
 * Reads a Layer 6 `CanonicalSchedule` (@sovereign/scheduler) and emits Gnosis
 * training events (JSONL) in the spec format (`TTCL_v1_0_BREAKDOWN.md:314-359`)
 * for the future SFT stage. Local + deterministic + byte-reproducible; reuses
 * `@sovereign/ttcl` `scoreSign` for the constitution score. See README for the
 * honesty posture (no GPU, no training, Catalan labels null, assistant target
 * empty, wheel-state→Sign mapping concretized + documented in materialize.ts).
 *
 * Naming: this is the TTCL/compiler-axis "Layer 7" (the working 9-layer model),
 * distinct from the MOF 15-layer Base Stack's Layer 7 (Behavioral Data
 * Aggregator, `SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md:869-895`)
 * and from the runtime `gnosis-evaluator-core` (a different "gnosis" — the
 * Stokes-coherence behavioral evaluator, not training events).
 */

// Facade.
export { generateGnosisEvents, EVENT_FORMAT_VERSION } from "./consumer.js";
export { serializeEventsJsonl, jsonlHeader } from "./serialize.js";
export { validateGnosisEvent, lastGnosisEventErrors } from "./schema.js";

// Materialization primitives (exported for the L7.8-style parity test + downstream
// inspection; the consumer composes them, but they are reusable on their own).
export {
  materializeSign,
  constitutionScore,
  deterministicUuid,
  fnv1a32,
  slotLetter,
  keyHash,
  wheelState,
  activeSlots,
  provenanceTokens,
  userPrompt,
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
} from "./event.js";