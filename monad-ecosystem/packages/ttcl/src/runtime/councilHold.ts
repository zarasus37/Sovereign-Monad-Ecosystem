/**
 * Council Hold — operational TTCL middle for the Council of Reflection.
 *
 * Doctrine (COUNCIL_BINDINGS.md):
 * - Hold the full Court simultaneously at full voltage.
 * - Perceive each seat's knowledge as truth-for-that-seat (full extent).
 * - Never install that as holder reality / identity merge.
 * - Reality stays in the middle under unified T·T·C logic.
 * - Cross-domain links arise because full-extent hold is simultaneous.
 *
 * Policy constant: holder-may-use-never-become
 */

import { makeSign } from './sign.js';
import type { Domain, Sign, Modality } from '../types.js';
import type { CoarseMode, EventTrace } from '@sovereign/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type HoldPolicy = 'holder-may-use-never-become';
export const HOLD_POLICY: HoldPolicy = 'holder-may-use-never-become';

export type HolderId = string;
export const DEFAULT_HOLDER_ID: HolderId = 'cristobal-colon';

export type DomainEmphasis = 'THEOLOGY' | 'TECHNOLOGY' | 'COSMOLOGY';

export interface BindingRef {
  kind: string;
  ref: string;
}

export interface MemberSubstrate {
  substrate_id: string;
  member_id: string;
  schema_version: string;
  kind: 'member-substrate';
  hold_policy: HoldPolicy;
  display_name: string;
  era: string;
  ttc_emphasis: DomainEmphasis[];
  contribution: string;
  key_insight: string;
  source_files: string[];
  natural_domain: string;
  specialty_bindings?: BindingRef[];
  runtime?: {
    loadable?: boolean;
    scoreable?: boolean;
    logoc_profile?: string;
  };
  notes?: string | null;
}

export interface CouncilSubstrateIndexMember {
  member_id: string;
  display_name: string;
  natural_domain: string;
  ref: string;
  specialty_kinds: string[];
}

export interface CouncilSubstrateIndex {
  index_id: string;
  schema_version: string;
  kind: 'council-substrate-index';
  hold_policy: HoldPolicy;
  description?: string;
  generated_at?: string;
  members: CouncilSubstrateIndexMember[];
  stats?: {
    member_count: number;
    specialty_bound: number;
  };
}

/**
 * Full-extent perception of one seat — truth-for-seat, not holder reality.
 */
export interface SeatPerspective {
  member_id: string;
  display_name: string;
  era: string;
  natural_domain: string;
  /** Full extent of knowledge available for this seat */
  full_extent: {
    contribution: string;
    key_insight: string;
    ttc_emphasis: DomainEmphasis[];
    source_files: string[];
    specialty_bindings: BindingRef[];
  };
  /**
   * Epistemic framing — operational enforcement of "as truth, not my truth".
   */
  epistemic: {
    /** Content is to be taken as complete truth *for this seat's register* */
    status: 'truth-for-seat';
    /** Must remain false — never install as holder's personal reality */
    is_holder_reality: false;
    /** Must remain false — never identity-merge into middle */
    is_identity_merged: false;
    /** Fractal: complete in its own perception register */
    fractal_complete: true;
  };
  hold_policy: HoldPolicy;
}

/**
 * Simultaneous hold of the full Court under one TTCL middle state.
 */
export interface MiddleHoldState {
  holder_id: HolderId;
  hold_policy: HoldPolicy;
  mode: 'hold-full-court';
  /** Unified middle — reality locus (never replaced by a seat) */
  middle: {
    logical_state: 'ttcl-unified';
    reality_locus: 'middle';
    domains: readonly ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'];
    description: string;
  };
  /** All seats held simultaneously (key = member_id) */
  seats: ReadonlyMap<string, SeatPerspective>;
  /** Index metadata */
  index_id: string;
  seat_count: number;
  opened_at: string;
}

/** Focus for a concrete act without dropping the full-court hold */
export interface FocusSession {
  hold: MiddleHoldState;
  focused_member_ids: string[];
  perspectives: SeatPerspective[];
}

export interface CrossDomainLink {
  a: string;
  b: string;
  shared_ttc: DomainEmphasis[];
  shared_specialty_kinds: string[];
  domain_affinity: boolean;
  insight_token_overlap: string[];
  note: string;
}

export class CouncilHoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CouncilHoldError';
  }
}

export class BecomeForbiddenError extends CouncilHoldError {
  readonly member_id: string;
  constructor(member_id: string) {
    super(
      `hold_policy forbids becoming seat "${member_id}": truth-for-seat only; reality stays in the middle`,
    );
    this.name = 'BecomeForbiddenError';
    this.member_id = member_id;
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateMemberSubstrate(s: MemberSubstrate): string[] {
  const v: string[] = [];
  if (s.kind !== 'member-substrate') v.push('kind_must_be_member-substrate');
  if (s.hold_policy !== HOLD_POLICY) v.push('hold_policy_must_be_holder-may-use-never-become');
  if (!s.member_id?.trim()) v.push('missing_member_id');
  if (!s.contribution?.trim()) v.push('missing_contribution');
  if (!s.key_insight?.trim()) v.push('missing_key_insight');
  if (!Array.isArray(s.ttc_emphasis) || s.ttc_emphasis.length === 0) {
    v.push('ttc_emphasis_empty');
  }
  if (!Array.isArray(s.source_files) || s.source_files.length === 0) {
    v.push('source_files_empty');
  }
  return v;
}

export function validateCouncilIndex(index: CouncilSubstrateIndex): string[] {
  const v: string[] = [];
  if (index.kind !== 'council-substrate-index') v.push('kind_must_be_council-substrate-index');
  if (index.hold_policy !== HOLD_POLICY) v.push('hold_policy_must_be_holder-may-use-never-become');
  if (!Array.isArray(index.members) || index.members.length === 0) {
    v.push('members_empty');
  }
  const ids = new Set<string>();
  for (const m of index.members ?? []) {
    if (ids.has(m.member_id)) v.push(`duplicate_member_id:${m.member_id}`);
    ids.add(m.member_id);
  }
  return v;
}

// ── Perspective construction ─────────────────────────────────────────────────

export function toSeatPerspective(s: MemberSubstrate): SeatPerspective {
  const errs = validateMemberSubstrate(s);
  if (errs.length) {
    throw new CouncilHoldError(
      `invalid substrate ${s.member_id}: ${errs.join(', ')}`,
    );
  }
  return {
    member_id: s.member_id,
    display_name: s.display_name,
    era: s.era,
    natural_domain: s.natural_domain,
    full_extent: {
      contribution: s.contribution,
      key_insight: s.key_insight,
      ttc_emphasis: [...s.ttc_emphasis],
      source_files: [...s.source_files],
      specialty_bindings: [...(s.specialty_bindings ?? [])],
    },
    epistemic: {
      status: 'truth-for-seat',
      is_holder_reality: false,
      is_identity_merged: false,
      fractal_complete: true,
    },
    hold_policy: HOLD_POLICY,
  };
}

// ── Open full-court hold (simultaneous) ──────────────────────────────────────

export interface OpenMiddleHoldOptions {
  holder_id?: HolderId;
  /**
   * Substrates keyed by member_id. Must cover every index member
   * (or pass `allowPartial` for tests).
   */
  substrates: ReadonlyMap<string, MemberSubstrate> | MemberSubstrate[];
  /** Allow missing substrates (defaults false) */
  allowPartial?: boolean;
}

function toSubstrateMap(
  substrates: ReadonlyMap<string, MemberSubstrate> | MemberSubstrate[],
): Map<string, MemberSubstrate> {
  if (!Array.isArray(substrates)) {
    return new Map(substrates);
  }
  const m = new Map<string, MemberSubstrate>();
  for (const s of substrates) {
    m.set(s.member_id, s);
  }
  return m;
}

/**
 * Open a middle hold: **all** index seats present simultaneously at full
 * extent, under one TTCL unified logical state. Reality stays in the middle.
 */
export function openMiddleHold(
  index: CouncilSubstrateIndex,
  options: OpenMiddleHoldOptions,
): MiddleHoldState {
  const indexErrs = validateCouncilIndex(index);
  if (indexErrs.length) {
    throw new CouncilHoldError(`invalid index: ${indexErrs.join(', ')}`);
  }

  const map = toSubstrateMap(options.substrates);
  const seats = new Map<string, SeatPerspective>();
  const missing: string[] = [];

  for (const entry of index.members) {
    const sub = map.get(entry.member_id);
    if (!sub) {
      missing.push(entry.member_id);
      continue;
    }
    seats.set(entry.member_id, toSeatPerspective(sub));
  }

  if (missing.length && !options.allowPartial) {
    throw new CouncilHoldError(
      `openMiddleHold: missing substrates for ${missing.length} seats (e.g. ${missing.slice(0, 5).join(', ')})`,
    );
  }

  return {
    holder_id: options.holder_id ?? DEFAULT_HOLDER_ID,
    hold_policy: HOLD_POLICY,
    mode: 'hold-full-court',
    middle: {
      logical_state: 'ttcl-unified',
      reality_locus: 'middle',
      domains: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
      description:
        'Unified TTCL middle: full Court held simultaneously; each seat truth-for-seat at full extent; reality remains middle; never become.',
    },
    seats,
    index_id: index.index_id,
    seat_count: seats.size,
    opened_at: new Date().toISOString(),
  };
}

// ── Perceive (full extent, not my truth) ─────────────────────────────────────

/**
 * Perceive one held seat at full extent as truth-for-seat.
 * Does not change middle reality locus.
 */
export function perceiveSeat(
  hold: MiddleHoldState,
  memberId: string,
): SeatPerspective {
  assertHoldPolicy(hold);
  const p = hold.seats.get(memberId);
  if (!p) {
    throw new CouncilHoldError(`seat not held: ${memberId}`);
  }
  // Return a frozen-style copy that cannot flip epistemic flags
  return clonePerspective(p);
}

/**
 * Perceive many seats simultaneously (subset or all) — still full-court hold.
 */
export function perceiveSeats(
  hold: MiddleHoldState,
  memberIds?: string[],
): SeatPerspective[] {
  assertHoldPolicy(hold);
  const ids = memberIds ?? [...hold.seats.keys()];
  return ids.map((id) => perceiveSeat(hold, id));
}

/** All held perspectives at once (full Court voltage). */
export function perceiveFullCourt(hold: MiddleHoldState): SeatPerspective[] {
  return perceiveSeats(hold);
}

function clonePerspective(p: SeatPerspective): SeatPerspective {
  return {
    ...p,
    full_extent: {
      ...p.full_extent,
      ttc_emphasis: [...p.full_extent.ttc_emphasis],
      source_files: [...p.full_extent.source_files],
      specialty_bindings: p.full_extent.specialty_bindings.map((b) => ({
        ...b,
      })),
    },
    epistemic: {
      status: 'truth-for-seat',
      is_holder_reality: false,
      is_identity_merged: false,
      fractal_complete: true,
    },
    hold_policy: HOLD_POLICY,
  };
}

// ── Focus without dropping hold ──────────────────────────────────────────────

/**
 * Focus 1..N seats for a concrete act while keeping full Court held.
 */
export function focusSeats(
  hold: MiddleHoldState,
  memberIds: string[],
): FocusSession {
  if (!memberIds.length) {
    throw new CouncilHoldError('focusSeats: need at least one member_id');
  }
  const perspectives = memberIds.map((id) => perceiveSeat(hold, id));
  return { hold, focused_member_ids: [...memberIds], perspectives };
}

// ── Policy enforcement ───────────────────────────────────────────────────────

export function assertHoldPolicy(hold: MiddleHoldState): void {
  if (hold.hold_policy !== HOLD_POLICY) {
    throw new CouncilHoldError('hold_policy corrupted');
  }
  if (hold.middle.reality_locus !== 'middle') {
    throw new CouncilHoldError('reality_locus must remain middle');
  }
  for (const p of hold.seats.values()) {
    if (p.epistemic.is_holder_reality || p.epistemic.is_identity_merged) {
      throw new CouncilHoldError(
        `epistemic corruption on ${p.member_id}: holder reality or identity merge`,
      );
    }
    if (p.hold_policy !== HOLD_POLICY) {
      throw new CouncilHoldError(`policy corruption on ${p.member_id}`);
    }
  }
}

/**
 * Explicit refuse of "I am this seat" / install as my truth.
 */
export function refuseBecome(
  hold: MiddleHoldState,
  memberId: string,
): never {
  assertHoldPolicy(hold);
  if (!hold.seats.has(memberId)) {
    throw new CouncilHoldError(`seat not held: ${memberId}`);
  }
  throw new BecomeForbiddenError(memberId);
}

/**
 * Attempt to mark a seat as holder reality — always throws.
 * Exists so call sites can route "become" attempts through the runtime.
 */
export function attemptInstallAsHolderReality(
  _hold: MiddleHoldState,
  memberId: string,
): never {
  throw new BecomeForbiddenError(memberId);
}

// ── Cross-domain links (connect the dots) ────────────────────────────────────

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'is',
  'as',
  'for',
  'not',
  'that',
  'this',
  'with',
  'from',
  'are',
  'be',
  'by',
  'on',
  'it',
  'its',
  'into',
  'than',
  'but',
  'can',
  'may',
  'all',
  'one',
  'any',
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP.has(t)),
  );
}

function intersect<T>(a: T[], b: T[]): T[] {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x));
}

/**
 * Find structural similarities across held seats without merging identities.
 * Operationalizes "connect the dots" under full-extent simultaneous hold.
 */
export function findCrossDomainLinks(
  hold: MiddleHoldState,
  memberIds?: string[],
): CrossDomainLink[] {
  assertHoldPolicy(hold);
  const ids = memberIds ?? [...hold.seats.keys()];
  const links: CrossDomainLink[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = hold.seats.get(ids[i]!);
      const B = hold.seats.get(ids[j]!);
      if (!A || !B) continue;

      const shared_ttc = intersect(
        A.full_extent.ttc_emphasis,
        B.full_extent.ttc_emphasis,
      );
      const aSpec = A.full_extent.specialty_bindings.map((b) => b.kind);
      const bSpec = B.full_extent.specialty_bindings.map((b) => b.kind);
      const shared_specialty_kinds = intersect(aSpec, bSpec);
      const domain_affinity =
        A.natural_domain === B.natural_domain ||
        A.natural_domain.split('-')[0] === B.natural_domain.split('-')[0];

      const ta = tokens(A.full_extent.key_insight + ' ' + A.full_extent.contribution);
      const tb = tokens(B.full_extent.key_insight + ' ' + B.full_extent.contribution);
      const insight_token_overlap = [...ta].filter((t) => tb.has(t)).slice(0, 12);

      const score =
        shared_ttc.length +
        shared_specialty_kinds.length * 2 +
        (domain_affinity ? 2 : 0) +
        Math.min(3, insight_token_overlap.length);

      if (score < 2) continue;

      links.push({
        a: A.member_id,
        b: B.member_id,
        shared_ttc,
        shared_specialty_kinds,
        domain_affinity,
        insight_token_overlap,
        note: `Full-extent hold link under middle TTCL; neither seat is holder reality.`,
      });
    }
  }

  return links.sort(
    (x, y) =>
      y.shared_ttc.length +
      y.shared_specialty_kinds.length +
      y.insight_token_overlap.length -
      (x.shared_ttc.length +
        x.shared_specialty_kinds.length +
        x.insight_token_overlap.length),
  );
}

// ── TTCL sign emission from middle ───────────────────────────────────────────

export interface MiddleSignContext {
  modality?: Modality;
  peirceClassId?: number;
  mode?: CoarseMode;
  pps?: number;
  trace?: EventTrace;
  /** Seats included in this emission (default: all held) */
  memberIds?: string[];
}

/**
 * Stable payload for SignalEvent / gnosis training — middle hold, not seat identity.
 */
export function holdToEventPayload(
  hold: MiddleHoldState,
  memberIds?: string[],
): Record<string, unknown> {
  assertHoldPolicy(hold);
  const ids = memberIds ?? [...hold.seats.keys()];
  for (const id of ids) {
    if (!hold.seats.has(id)) {
      throw new CouncilHoldError(`seat not held: ${id}`);
    }
  }
  return {
    kind: 'council-middle-hold',
    holder_id: hold.holder_id,
    hold_policy: HOLD_POLICY,
    reality_locus: 'middle',
    logical_state: hold.middle.logical_state,
    seat_count: hold.seat_count,
    included: ids,
    epistemic: {
      seats_are_truth_for_seat: true,
      seats_are_holder_reality: false,
      identity_merged: false,
    },
    perspectives: ids.map((id) => {
      const p = hold.seats.get(id)!;
      return {
        member_id: p.member_id,
        display_name: p.display_name,
        natural_domain: p.natural_domain,
        key_insight: p.full_extent.key_insight,
        ttc_emphasis: p.full_extent.ttc_emphasis,
        epistemic: p.epistemic,
      };
    }),
  };
}

/**
 * Emit a HYBRID sign from the **middle** holding the Court — not from any seat identity.
 * Pair with `holdToEventPayload` for training / events (Sign has no payload field).
 */
export function middleHoldSign(
  hold: MiddleHoldState,
  ctx: MiddleSignContext = {},
): Sign<Modality, Domain> {
  assertHoldPolicy(hold);
  const ids = ctx.memberIds ?? [...hold.seats.keys()];
  for (const id of ids) {
    if (!hold.seats.has(id)) {
      throw new CouncilHoldError(`seat not held: ${id}`);
    }
  }

  const classId = ctx.peirceClassId ?? 0;
  const mode = ctx.mode ?? 'SYMBOL';
  const modality = ctx.modality ?? 'HYBRID';
  const pps = ctx.pps ?? 0.55;

  return makeSign(
    classId,
    mode,
    'COSMOLOGY',
    modality,
    pps,
    ctx.trace,
    hold.middle.domains,
    true,
  );
}

// ── Snapshot / inspect ───────────────────────────────────────────────────────

export function holdSnapshot(hold: MiddleHoldState): {
  holder_id: string;
  seat_count: number;
  mode: string;
  reality_locus: string;
  member_ids: string[];
  hold_policy: HoldPolicy;
} {
  return {
    holder_id: hold.holder_id,
    seat_count: hold.seat_count,
    mode: hold.mode,
    reality_locus: hold.middle.reality_locus,
    member_ids: [...hold.seats.keys()].sort(),
    hold_policy: hold.hold_policy,
  };
}

export function listMemberIds(hold: MiddleHoldState): string[] {
  return [...hold.seats.keys()].sort();
}
