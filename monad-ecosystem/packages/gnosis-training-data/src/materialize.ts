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
 *   slot             — the wheel's explicit per-slot `alphabet[offset]` (Llull's
 *                      B..R alphabet skips J, so it is carried explicitly, not
 *                      derived from a baseLetter+offset formula); the A.. fallback
 *                      only for wheels whose alphabet is not yet sourced.
 *   label (Catalan)  — the wheel's per-slot `labels[offset]` when the registry
 *                      carries one (sourced from the Llull register for A + the 3
 *                      domain wheels + F + S), else null for structured-label
 *                      wheels (P/T/V/Q/E) pending a richer label shape.
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
  gridSign,
  nodeToEventPayload,
  type Sign,
  type Modality,
  type Domain,
  type ConstitutionResult,
  type TempleGrid,
  type TempleId,
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
  GnosisTempleGridPayload,
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

/**
 * Offset → single slot letter. If the wheel carries an explicit per-slot
 * `alphabet` (the Llull 16-letter alphabet skips J, so a baseLetter+offset
 * formula cannot represent the gap), index into it directly; otherwise fall
 * back to A.. (legacy, for wheels whose letters are not yet sourced). The
 * modulo guards against a size mismatch defensively.
 */
export function slotLetter(alphabet: string | null, offset: number): string {
  if (alphabet) {
    return alphabet[offset % alphabet.length]!;
  }
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

/**
 * The three active facet slots. The `slot` letter comes from the wheel's
 * explicit `alphabet` (Llull's B..R, J skipped) when sourced, else the A..
 * fallback. The `label` is the wheel's per-slot Catalan label when sourced,
 * else null (wheels whose labels are structured — two-ring / virtue+vice /
 * 4-part relational — carry labels:null pending a richer shape).
 */
export function activeSlots(state: ScheduleState, registry: WheelRegistry): GnosisEvent["active_slots"] {
  const slot = (domain: Domain): GnosisActiveSlot => {
    const wheel = state.facets[domain];
    const offset = state.offsets[wheel] ?? 0;
    const asset = registry.wheels.get(wheel)!;
    const label = asset.labels ? (asset.labels[offset] ?? null) : null;
    return { wheel, slot: slotLetter(asset.alphabet, offset), label };
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

/**
 * Resolve a temple_id from the schedule step's active facet slots via the
 * grid's WheelBinding.slot_mapping. Prefer theology → technology → cosmology.
 * Returns null when no mapping hits (grid incomplete or facet not bound).
 */
export function resolveTempleIdForStep(
  grid: TempleGrid,
  state: ScheduleState,
  registry: WheelRegistry,
): TempleId | null {
  const slots = activeSlots(state, registry);
  const candidates: Array<{ wheel: string; slot: string }> = [
    { wheel: slots.theology.wheel, slot: slots.theology.slot },
    { wheel: slots.technology.wheel, slot: slots.technology.slot },
    { wheel: slots.cosmology.wheel, slot: slots.cosmology.slot },
  ];
  const map = grid.semantics.wheel_binding.slot_mapping;
  for (const c of candidates) {
    const hit = map.find((m) => m.wheel_id === c.wheel && m.slot_id === c.slot);
    if (hit) return hit.temple_id;
  }
  // Fallback: map by hymn_index from theology slot letter position in B–R
  const alph = "BCDEFGHIKLMNOPQR";
  const idx = alph.indexOf(slots.theology.slot);
  if (idx >= 0) {
    const node = grid.nodes.find((n) => n.hymn_index === idx + 1);
    if (node) return node.temple_id;
  }
  return null;
}

/**
 * Attach nodeToEventPayload for the step, or null if unresolved.
 */
export function templePayloadForStep(
  grid: TempleGrid,
  state: ScheduleState,
  registry: WheelRegistry,
): GnosisTempleGridPayload | null {
  const templeId = resolveTempleIdForStep(grid, state, registry);
  if (!templeId) return null;
  const node = grid.nodes.find((n) => n.temple_id === templeId);
  if (!node) return null;
  return nodeToEventPayload(grid, node);
}

/**
 * Materialize a Sign preferentially via gridSign when a TempleGrid binds the
 * step; otherwise fall back to the standard wheel composite materializeSign.
 * Deterministic: pure function of (seed, step, registry, grid?).
 */
export function materializeSignWithGrid(
  seed: number,
  step: ScheduleStep,
  registry: WheelRegistry,
  grid?: TempleGrid,
): Sign<Modality, Domain> {
  if (grid) {
    const templeId = resolveTempleIdForStep(grid, step.state, registry);
    if (templeId) {
      const domains = Array.from(compositeDomains(step.state, registry)) as Domain[];
      const modality: Modality = domains.length === 3 ? "HYBRID" : "INDEX";
      const classCount = getManifold().allClasses().length;
      const classId = fnv1a32(`${seed}:${compositeKey(step.state, registry)}`) % classCount;
      const trace: EventTrace = {
        intentionId: "gnosis-training-data",
        source: "gnosis-training-data",
      };
      try {
        return gridSign(grid, templeId, {
          domain: domains[0] ?? "THEOLOGY",
          modality,
          peirceClassId: classId,
          mode: "INDEX",
          pps: step.terms.T,
          trace,
          domains,
        });
      } catch {
        // fall through to composite materialize
      }
    }
  }
  return materializeSign(seed, step, registry);
}