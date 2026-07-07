/**
 * Manifold-derived LOGOC tier producer — TS parity mirror of the canonical
 * Python producer `gnostic_engine/logoc_tier.py:produce_logoc_tier` (Layer 7.4).
 *
 * Produces a TTCL tier (COHERENT / EMERGENT / DIVERGENT) from the neighbor
 * density around the classified `sign_class_id` on the Peirce manifold, then
 * maps it to a Lane B intensity weight. This is the TS side of the Layer 7.8
 * tier-parity surface: both runtimes read the same canonical numerics
 * (`ttcl_logoc_tier` section) and walk the same pure-Python/TS manifold, so
 * the produced tier string must agree bit-for-bit.
 *
 * Density = `neighbors(classId, TIER_NEIGHBOR_RADIUS).length / 65` (65 = the
 * 66-class manifold minus self). Thresholds + Lane B weights come from
 * `@sovereign/types` (flattened from `shared/schemas/ttcl-numerics.json`):
 *     COHERENT  ≥ 0.20 → lane_b_weight 1.00 (full Truth intensity)
 *     EMERGENT  ≥ 0.08 → lane_b_weight 0.70 (attenuated)
 *     DIVERGENT  else  → lane_b_weight 0.40 (hard attenuation)
 *
 * The TS producer is parity-only: the live Gnostic Engine pipeline produces
 * the tier in Python (`routes.py` → `produce_logoc_tier`). This mirror exists
 * so the cross-runtime parity CI can assert agreement rather than assume it.
 */
import { getManifold } from "./manifold.js";
import {
  LOGOC_TIER_NEIGHBOR_RADIUS,
  LOGOC_TIER_COHERENT_DENSITY_THRESHOLD,
  LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD,
  LOGOC_TIER_COHERENT_LANE_B_WEIGHT,
  LOGOC_TIER_EMERGENT_LANE_B_WEIGHT,
  LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT,
} from "@sovereign/types";

export type LogocTier = "COHERENT" | "EMERGENT" | "DIVERGENT";

export interface LogocTierResult {
  /** Tier label — the parity-asserted string both runtimes must agree on. */
  readonly tier: LogocTier;
  /** Lane B intensity weight the tier maps to. */
  readonly weight: number;
  /** Raw neighbor density (neighbors / 65) — exposed for observability/tests. */
  readonly density: number;
}

// The manifold has 66 classes; a class's neighbor set excludes itself, so the
// density denominator is 65 (max possible neighbors at any radius).
const MANIFOLD_SIZE_MINUS_SELF = 65;

/**
 * Produce the manifold-derived LOGOC tier for a sign class.
 *
 * Throws on an unknown `classId` (via `getManifold().get(classId)`) — this is a
 * producer, not a predicate. The Python orchestrator that calls it wraps the
 * whole enrichment in a try/except so an unclassifiable packet degrades
 * gracefully; the TS parity caller (the integration test) only feeds known
 * class ids from the corpus, so the throw is the correct loud failure here.
 */
export function produceLogocTier(classId: number): LogocTierResult {
  const manifold = getManifold();
  // Validate the class id (throws on unknown — caller's try/except in Python).
  manifold.get(classId);
  // Tier density uses its own radius (TIER_NEIGHBOR_RADIUS = 1.0), broader
  // than the classifier's tight MAX_DISTANCE (0.5) — see the canonical numerics
  // rationale for the calibration.
  const neighbors = manifold.neighbors(classId, LOGOC_TIER_NEIGHBOR_RADIUS);
  const density = neighbors.length / MANIFOLD_SIZE_MINUS_SELF;

  if (density >= LOGOC_TIER_COHERENT_DENSITY_THRESHOLD) {
    return { tier: "COHERENT", weight: LOGOC_TIER_COHERENT_LANE_B_WEIGHT, density };
  }
  if (density >= LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD) {
    return { tier: "EMERGENT", weight: LOGOC_TIER_EMERGENT_LANE_B_WEIGHT, density };
  }
  return { tier: "DIVERGENT", weight: LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT, density };
}

/**
 * Raw neighbor density for observability / tests (not on the hot path).
 * Mirrors `gnostic_engine/logoc_tier.py:neighbor_density`.
 */
export function neighborDensity(classId: number): number {
  const manifold = getManifold();
  manifold.get(classId);
  return (
    manifold.neighbors(classId, LOGOC_TIER_NEIGHBOR_RADIUS).length /
    MANIFOLD_SIZE_MINUS_SELF
  );
}