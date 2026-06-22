/**
 * logoc-api.ts
 *
 * Typed client for the LOGOC corpus REST endpoints.
 * Reads from the static corpus JSON built at deploy time.
 *
 * In production, this fetches from `/api/v1/logoc/corpus`.
 * In dev, it falls back to a Vite-inlined static JSON module.
 */

// ── Domain types ───────────────────────────────────────────────────────────────

export type PragmatismBand = "INSTINCT" | "EXPERIENCE" | "FORMAL_THOUGHT";

export interface PeirceBlock {
  mode: "ICON" | "INDEX" | "SYMBOL";
  sign_class_id: number;
  sign_class_label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: PragmatismBand;
}

export interface LogocEvent {
  schema_version: string;
  event_id: string;
  timestamp: string;
  narrative: string;
  semiotic_flags?: Record<string, boolean>;
  peirce?: PeirceBlock | null;
  peirce_migration_pending?: boolean;
  peirce_migration_source?: string | null;
  // Pipeline triage metadata (v2.5.0 production deployment)
  pipeline_triage_status?: "auto_accept" | "human_review" | null;
  pipeline_triage_reason?: string | null;
  pipeline_ml_confidence?: number | null;
  pipeline_rubric_method?: string | null;
  pipeline_rubric_class_id?: number | null;
  pipeline_ml_class_id?: number | null;
  // Backfill metadata (optional)
  _backfill_meta?: Record<string, unknown>;
  _gnosis_meta?: Record<string, unknown>;
  // PPS if computed externally
  pps?: number;
}

export interface LogocCorpusSnapshot {
  events: LogocEvent[];
  generated_at: string;
  total: number;
  accepted: number;
  pending: number;
  band_distribution: Record<PragmatismBand, number>;
  class_distribution: Record<string, number>;
}

export interface LogocFilters {
  band?: PragmatismBand | "all";
  mode?: "ICON" | "INDEX" | "SYMBOL" | "all";
  signClassId?: number | "all";
  migrationPending?: boolean | "all";
  source?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LOGOC_BASE_URL: string =
  import.meta.env.VITE_LOGOC_API_URL ?? "";

// ── Internal helpers ───────────────────────────────────────────────────────────

class LogocApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LogocApiError";
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${LOGOC_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new LogocApiError(res.status, `GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch the full LOGOC corpus snapshot.
 * Tries the live API endpoint first (`/api/v1/logoc/corpus`),
 * which is served by the Vite dev-server plugin or a production backend.
 * Falls back to the static JSON (`/logoc-corpus.json`) if the API is unavailable.
 */
export async function fetchCorpusSnapshot(
  signal?: AbortSignal,
): Promise<LogocCorpusSnapshot> {
  // 1. Try the live API endpoint (Vite plugin in dev, real backend in prod)
  const apiPath = LOGOC_BASE_URL
    ? `${LOGOC_BASE_URL}/api/v1/logoc/corpus`
    : "/api/v1/logoc/corpus";
  try {
    return await getJson<LogocCorpusSnapshot>(apiPath, signal);
  } catch (err) {
    // 2. Fallback to the static JSON built at deploy time
    if (signal?.aborted) throw err;
    return getJson<LogocCorpusSnapshot>("/logoc-corpus.json", signal);
  }
}

/**
 * Filter events client-side (no backend round-trip for simple filters).
 */
export function filterEvents(
  events: LogocEvent[],
  filters: LogocFilters,
): LogocEvent[] {
  return events.filter((ev) => {
    if (filters.band && filters.band !== "all") {
      if (ev.peirce?.pragmatism_band !== filters.band) return false;
    }
    if (filters.mode && filters.mode !== "all") {
      if (ev.peirce?.mode !== filters.mode) return false;
    }
    if (filters.signClassId !== undefined && filters.signClassId !== "all") {
      if (ev.peirce?.sign_class_id !== filters.signClassId) return false;
    }
    if (filters.migrationPending !== undefined && filters.migrationPending !== "all") {
      if ((ev.peirce_migration_pending ?? false) !== filters.migrationPending) return false;
    }
    if (filters.source) {
      const source = String(
        ev._backfill_meta?.["original_source"] ??
        ev._gnosis_meta?.["source_file"] ??
        ""
      );
      if (!source.toLowerCase().includes(filters.source.toLowerCase())) return false;
    }
    return true;
  });
}

/**
 * Compute PPS (if not present) from firstness_weight as a heuristic.
 * PPS = 1 - firstness_weight (higher = more structured/compressed).
 */
export function computePps(event: LogocEvent): number {
  if (event.pps !== undefined) return event.pps;
  const fw = event.peirce?.firstness_weight ?? 0.33;
  return 1 - fw;
}

/**
 * Build distribution data for recharts from a list of events.
 */
export function buildBandDistribution(
  events: LogocEvent[],
): { band: PragmatismBand | "PENDING"; count: number }[] {
  const counts: Record<string, number> = { INSTINCT: 0, EXPERIENCE: 0, FORMAL_THOUGHT: 0, PENDING: 0 };
  for (const ev of events) {
    if (ev.peirce_migration_pending) {
      counts["PENDING"]++;
    } else if (ev.peirce) {
      counts[ev.peirce.pragmatism_band] = (counts[ev.peirce.pragmatism_band] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([band, count]) => ({ band: band as PragmatismBand | "PENDING", count }));
}

/**
 * Build top-N class distribution for recharts.
 */
export function buildClassDistribution(
  events: LogocEvent[],
  topN = 10,
): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const ev of events) {
    if (ev.peirce) {
      const label = ev.peirce.sign_class_label;
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count }));
}

/**
 * Build scatter data for PPS vs. pragmatism_band.
 */
export function buildPpsBandScatter(
  events: LogocEvent[],
): { event_id: string; pps: number; band: PragmatismBand; label: string }[] {
  return events
    .filter((ev) => ev.peirce && !ev.peirce_migration_pending)
    .map((ev) => ({
      event_id: ev.event_id,
      pps: computePps(ev),
      band: ev.peirce!.pragmatism_band,
      label: ev.peirce!.sign_class_label,
    }));
}

/**
 * Filter events that need human review (pipeline flagged or migration pending).
 */
export function getHumanReviewEvents(events: LogocEvent[]): LogocEvent[] {
  return events.filter((ev) => {
    // Pipeline-flagged events (v2.5.0 production triage)
    if (ev.pipeline_triage_status === "human_review") return true;
    // Legacy migration-pending events (pre-v2.5.0)
    if (ev.peirce_migration_pending === true) return true;
    return false;
  });
}

/**
 * Build triad alternatives for a given set of flags.
 * Returns the canonical path and the alternative paths that would result
 * from changing one triad decision at a time.
 */
export function buildTriadAlternatives(flags: Record<string, boolean>): {
  canonical: { vehicle: string; object: string; interpretant: string; path: string[] };
  alternatives: Array<{ changed: string; vehicle: string; object: string; interpretant: string; path: string[] }>;
} {
  const vehicle = flags["rule_based"]
    ? "Legisign"
    : flags["single_occurrence"]
      ? "Sinsign"
      : "Qualisign";
  const object = flags["convention"]
    ? "Symbol"
    : flags["causality"]
      ? "Index"
      : "Icon";
  const interpretant = flags["reason"]
    ? "Argument"
    : flags["fact"]
      ? "Dicent"
      : "Rheme";
  const canonical = { vehicle, object, interpretant, path: [vehicle, object, interpretant] };

  const altFlags: Record<string, Record<string, boolean>> = {
    vehicle: { ...flags, rule_based: false, single_occurrence: false, similarity: true, possibility: true },
    object: { ...flags, convention: false, causality: false, similarity: true },
    interpretant: { ...flags, reason: false, fact: false, possibility: true },
  };

  const alternatives = [
    {
      changed: "vehicle",
      vehicle: "Qualisign",
      object,
      interpretant,
      path: ["Qualisign", object, interpretant],
    },
    {
      changed: "object",
      vehicle,
      object: "Icon",
      interpretant,
      path: [vehicle, "Icon", interpretant],
    },
    {
      changed: "interpretant",
      vehicle,
      object,
      interpretant: "Rheme",
      path: [vehicle, object, "Rheme"],
    },
  ];

  return { canonical, alternatives };
}

