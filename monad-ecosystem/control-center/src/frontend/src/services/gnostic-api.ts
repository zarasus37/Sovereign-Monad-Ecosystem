/**
 * gnostic-api.ts
 *
 * Typed client for the Gnostic Engine REST + SSE endpoints.
 * All types are aligned with the Python live_state.py dataclasses
 * and the @sovereign/types GnosisScore / DoveSignal interfaces.
 *
 * Base URL is resolved from VITE_GNOSTIC_API_URL env var,
 * falling back to the Vite dev proxy path /gnostic-api.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const GNOSTIC_BASE_URL: string =
  import.meta.env.VITE_GNOSTIC_API_URL ?? "http://localhost:8001";

// ── Domain types ───────────────────────────────────────────────────────────────

export interface StokesCoherence {
  depth: number;
  truth: number;
  width: number;
}

export interface PulfrichParallaxResult {
  tilt_magnitude: number;
  tilt_threshold: number;
  blink_triggered: boolean;
}

/**
 * GnosisScore — output of one GnosticEngine evaluation cycle.
 * Aligns 1-to-1 with the Python GnosisScore dataclass and
 * the @sovereign/types GnosisScore TypeScript interface.
 */
export interface GnosisScore {
  agent_id: string;
  window_start: string;
  window_end: string;
  coherence: StokesCoherence;
  overall_score: number;
  parallax: PulfrichParallaxResult;
  /** SELF_NAVIGATING | ADJACENT_CONVERGENT | PATTERN_FOLLOWING */
  doctrine_state: string;
  /** LANE_A | LANE_B | LANE_C | UNCLASSIFIED */
  lane: string;
  quarantine_triggered: boolean;
  observation_count: number;
  sequence_number: number;
  /** FOCAL_LOCK | BLINK | QUARANTINE | MAGNITUDE_REJECT */
  verdict: string;
}

/**
 * DoveSignal — drift or misalignment condition flagged by the engine.
 * Tier 1 = monitoring, Tier 2 = governance required, Tier 3 = emergency.
 */
export interface DoveSignalRecord {
  signal_id: string;
  timestamp: string;
  tier: 1 | 2 | 3;
  layer: string;
  drift_category: string;
  observed_value: string;
  threshold: string;
  description: string;
  governance_proposal_generated: boolean;
  resolved: boolean;
}

export interface HealthSnapshot {
  status: "healthy" | "degraded" | "error";
  version: string;
  session_id: string;
  uptime_seconds: number;
  sequence_counter: number;
  score_buffer_size: number;
  dove_signal_buffer_size: number;
  active_dove_signal_count: number;
}

export interface LatestScoresResponse {
  scores: GnosisScore[];
  count: number;
  generated_at: string;
}

export interface DoveSignalsResponse {
  signals: DoveSignalRecord[];
  generated_at: string;
}

export interface ActiveDoveResponse {
  active_signals: DoveSignalRecord[];
  count: number;
  alignment_state: "aligned" | "monitoring" | "governance-required" | "emergency";
  generated_at: string;
}

export interface GnosticPacketRequest {
  agent_id: string;
  lane_a: number;
  lane_b: number;
  lane_c: number;
  v_mask?: boolean[];
  w_cong?: boolean;
  w_host_ratio?: number | null;
  w_user_ratio?: number | null;
}

// ── Internal HTTP helpers ──────────────────────────────────────────────────────

class GnosticApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GnosticApiError";
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${GNOSTIC_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new GnosticApiError(res.status, `GET ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function postJson<TBody, TResponse>(
  path: string,
  body: TBody,
  signal?: AbortSignal,
): Promise<TResponse> {
  const res = await fetch(`${GNOSTIC_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new GnosticApiError(res.status, `POST ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<TResponse>;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check if the gnostic engine is reachable and healthy.
 */
export async function fetchGnosticHealth(signal?: AbortSignal): Promise<HealthSnapshot> {
  return getJson<HealthSnapshot>("/api/v1/health", signal);
}

/**
 * Fetch the latest N GnosisScores (newest first).
 */
export async function fetchLatestScores(
  limit = 10,
  signal?: AbortSignal,
): Promise<LatestScoresResponse> {
  return getJson<LatestScoresResponse>(`/api/v1/gnosis/latest?limit=${limit}`, signal);
}

/**
 * Submit a raw packet to the GnosticEngine and receive the resulting GnosisScore.
 */
export async function processGnosticPacket(
  packet: GnosticPacketRequest,
  signal?: AbortSignal,
): Promise<GnosisScore> {
  return postJson<GnosticPacketRequest, GnosisScore>("/api/v1/gnosis/process", packet, signal);
}

/**
 * Fetch the latest N Dove signals.
 */
export async function fetchDoveSignals(
  limit = 20,
  signal?: AbortSignal,
): Promise<DoveSignalsResponse> {
  return getJson<DoveSignalsResponse>(`/api/v1/dove/signals?limit=${limit}`, signal);
}

/**
 * Fetch all currently unresolved (active) Dove signals.
 */
export async function fetchActiveDoveSignals(signal?: AbortSignal): Promise<ActiveDoveResponse> {
  return getJson<ActiveDoveResponse>("/api/v1/dove/active", signal);
}

/**
 * Build a fully-qualified SSE URL for the GnosisScore stream.
 * Use this with the EventSource API or the useSignalStream hook.
 */
export function gnosisStreamUrl(): string {
  return `${GNOSTIC_BASE_URL}/api/v1/gnosis/stream`;
}
