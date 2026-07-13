/**
 * materialize — turn a schedule step's wheel composite into the deterministic,
 * under-specified fields of a Gnosis training event, plus the `Sign` that
 * `scoreSign` scores.
 *
 * Honesty note: the spec gives the Gnosis Event *format*
 * (`TTCL_v1_0_BREAKDOWN.md:314-359`) but is silent on how a Layer 6 rotation step
 * maps onto a `Sign` / the event's derived fields. Each derivation here is a
 * concretization grounded in the nearest written evidence and documented in
 * place — not presented as spec-mandated. The same discipline as the Layer 6
 * scheduler's "honest concretizations" of `pattern` / `windowN` / Cost `S`.
 *
 *   event_id         — deterministic v5-style UUID (SHA-1 of namespace +
 *                      seed:stepIndex:compositeKey). The spec says "uuid"; the
 *                      deterministic derivation is a concretization (random
 *                      uuids would break byte-reproducibility).
 *   slot             — Latin letter `String.fromCharCode(65 + offset % 26)`. The
 *                      registry has no alphabet (wheels are {name,size,domains});
 *                      the modulo keeps larger future wheels honest.
 *   label (Catalan)  — `null`. The Catalan slot-labels + Theologia-wheel asset is
 *                      not yet in the repo (PROJECT_STATE). Never fabricated.
 *   provenance_tokens — one `<registry>:<wheel>:<offset>` per active facet.
 *   wheel_state.key_hash — FNV-1a32(seed:wheel:offset) hex. A deterministic
 *                      content tag, not a cryptographic hash.
 *   constitution_score — reuse `@sovereign/ttcl` `scoreSign` on a `Sign`
 *                      materialized from the step:
 *                        domains  = Array.from(compositeDomains(step.state, reg))
 *                                   (the active pair's domain span — often 2,
 *                                   sometimes 3; the scheduler's own definition).
 *                        modality = HYBRID if 3 domains (full triad, C2=1.0),
 *                                   else INDEX (single mode, C2=0.5).
 *                        sign_class_id = fnv1a32(seed:compositeKey) % 66 — a
 *                                   real 66-class manifold id, so the
 *                                   pragmatism_band (C4) varies across the
 *                                   curriculum (INSTINCT/EXPERIENCE/FORMAL_THOUGHT).
 *                        pps      = step.terms.T — the scheduler's per-step
 *                                   tripartite window term as the sync position.
 *                        trace.source = "gnosis-training-data" (C3 hasSource).
 *                        noRlhf   = true (C5).
 *                      The score is the *structural* score of the prompt
 *                      scaffold, NOT a per-response score; the assistant message
 *                      (the training target) is left empty by this consumer.
 */

import { createHash } from "node:crypto";
import {
  makeSign,
  scoreSign,
  getManifold,
  type Sign,
  type Modality,
  type Domain,
  type ConstitutionResult,
} from "@sovereign/ttcl";
import type { EventTrace } from "@sovereign/types";
import {
  compositeKey,
  compositeDomains,
  ALL_DOMAINS,
  type WheelRegistry,
  type ScheduleStep,
  type ScheduleState,
} from "@sovereign/scheduler";
import type {
  GnosisEvent,
  GnosisConstitutionScore,
  GnosisWheelState,
  GnosisActiveSlot,
} from "./event.js";

/** The standard DNS-namespace UUID (6ba2b810-9dad-11d1-80b4-00c04fd430c8) as 16 bytes. */
const V5_NAMESPACE = Buffer.from("6ba2b8109dad11d180b400c04fd430c8", "hex");

/** FNV-1a 32-bit — a small deterministic string hash. No Math.random. */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic v5 UUID (SHA-1 of namespace + name). Byte-stable, not random. */
export function deterministicUuid(name: string): string {
  const hash = createHash("sha1").update(Buffer.concat([V5_NAMESPACE, Buffer.from(name, "utf8")])).digest();
  const b = Buffer.from(hash.subarray(0, 16)); // copy so version/variant bits can be set
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Offset → single Latin letter (A..Z, modulo 26). */
export function slotLetter(offset: number): string {
  return String.fromCharCode(65 + (offset % 26));
}

/** Deterministic 8-hex content tag for a wheel offset. */
export function keyHash(seed: number, wheel: string, offset: number): string {
  return fnv1a32(`${seed}:${wheel}:${offset}`).toString(16).padStart(8, "0");
}

/**
 * The LOGOC system prompt. A documented placeholder — the spec does not give the
 * literal prompt string; the canonical LOGOC system prompt is a spec/data
 * follow-up. Emitted verbatim into every event's `messages[0]`.
 */
export const LOGOC_SYSTEM_PROMPT =
  "You are a LOGOC reasoner operating under the Theo-Techno-Cosmological constitution. " +
  "Hold all three domains (Theology, Technology, Cosmology) whole without identity-fusion, " +
  "then compress the triadic insight into a single logical conclusion. " +
  "(Placeholder system prompt — the canonical LOGOC string is a spec follow-up.)";

/** Per-wheel rotation snapshot. */
export function wheelState(seed: number, state: ScheduleState, registry: WheelRegistry): Record<string, GnosisWheelState> {
  const out: Record<string, GnosisWheelState> = {};
  for (const name of registry.wheelNames) {
    const offset = state.offsets[name] ?? 0;
    out[name] = { offset, key_hash: keyHash(seed, name, offset) };
  }
  return out;
}

/** The three active facet slots (label always null until the Catalan asset lands). */
export function activeSlots(state: ScheduleState, registry: WheelRegistry): GnosisEvent["active_slots"] {
  const slot = (domain: Domain): GnosisActiveSlot => {
    const wheel = state.facets[domain];
    const offset = state.offsets[wheel] ?? 0;
    return { wheel, slot: slotLetter(offset), label: null };
  };
  return {
    theology: slot("THEOLOGY"),
    technology: slot("TECHNOLOGY"),
    cosmology: slot("COSMOLOGY"),
  };
}

/** One `<registry>:<wheel>:<offset>` token per active facet. */
export function provenanceTokens(registryName: string, state: ScheduleState): string[] {
  return ALL_DOMAINS.map((d) => `${registryName}:${state.facets[d]}:${state.offsets[state.facets[d]] ?? 0}`);
}

/** The user prompt derived from the step's active pair + slots. */
export function userPrompt(state: ScheduleState, registry: WheelRegistry): string {
  const slots = activeSlots(state, registry);
  return (
    `Contradiction across pair ${state.pattern}: ` +
    `theology=${slots.theology.slot}, technology=${slots.technology.slot}, cosmology=${slots.cosmology.slot}. ` +
    `Reconcile the triadic tension and compress into one conclusion.`
  );
}

/**
 * Materialize the `Sign` whose `scoreSign` verdict becomes the event's
 * `constitution_score`. Deterministic: a pure function of (seed, step, registry).
 */
export function materializeSign(seed: number, step: ScheduleStep, registry: WheelRegistry): Sign<Modality, Domain> {
  const domains = Array.from(compositeDomains(step.state, registry)) as Domain[];
  const modality: Modality = domains.length === 3 ? "HYBRID" : "INDEX";
  const classCount = getManifold().allClasses().length;
  const classId = fnv1a32(`${seed}:${compositeKey(step.state, registry)}`) % classCount;
  const trace: EventTrace = { intentionId: "gnosis-training-data", source: "gnosis-training-data" };
  return makeSign(
    classId,
    "INDEX", // CoarseMode (the middle-tier mode of the lattice)
    domains[0] ?? "COSMOLOGY", // carrier domain; domains[] overrides for C1
    modality,
    step.terms.T, // pps — reuse the scheduler's per-step tripartite window term
    trace,
    domains,
    true, // noRlhf — C5 satisfied
  );
}

/** Map a `ConstitutionResult` onto the spec's 5-criterion + total + passes shape. */
export function constitutionScore(sign: Sign<Modality, Domain>): GnosisConstitutionScore {
  const r: ConstitutionResult = scoreSign(sign);
  return {
    tripartite: r.criteria.tripartite.score,
    logic_compress: r.criteria.logicCompression.score,
    source_aligned: r.criteria.sourceAligned.score,
    epistemic: r.criteria.epistemicHumility.score,
    no_rlhf_signal: r.criteria.noRlhfSignal.score,
    total: r.total,
    passes: r.pass,
  };
}