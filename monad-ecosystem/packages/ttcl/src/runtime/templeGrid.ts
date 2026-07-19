/**
 * TempleGrid — Enheduanna “Grid of the Universe” as a TTCL substrate.
 *
 * Schema: shared/ttcl-specs/temple-grid-schema.json
 * Fixture: shared/fixtures/layer6/enheduanna-temple-grid.json
 *
 * Each TempleNode carries theo / tech / cosmo slots (TTCL tripartite).
 * WheelBinding maps nodes onto Llull domain wheels (Teologia / Kosmologia / Technologia).
 * gridSign / wheelGridSign produce Signs for scoreSign / gnosis-training-data.
 */

import { makeSign } from './sign.js';
import type { Domain, Sign, Modality } from '../types.js';
import type { CoarseMode, EventTrace } from '@sovereign/types';

// ── ID aliases ───────────────────────────────────────────────────────────────

export type GridId = string;
export type TempleId = string;
export type DeityId = string;
export type CityId = string;
export type WheelId = string;
export type WheelSlotId = string;
export type SignProfileRef = string;
export type LOGOCProfileRef = string;
export type EventProfileRef = string;

export type NodeStatus = 'active' | 'deprecated' | 'unknown';
export type TheologyMode = 'polytheism-networked-system';
export type TechnologyMode = 'semantic-protocol';
export type CosmologyMode = 'underlying-grid';

// ── Provenance & semantics ───────────────────────────────────────────────────

export interface GridProvenance {
  author: string;
  era: string;
  corpus: string;
  source_refs: string[];
  /** Hard-wired TTC substrate tag */
  ttc_domain: 'THEO_TECHNO_COSMO';
}

export interface RotationPolicy {
  policy_id: string;
  mode: 'include-all' | 'sample-42' | 'weighted-by-city';
  constraints: string[];
}

export interface SlotMapping {
  temple_id: TempleId;
  wheel_id: WheelId;
  slot_id: WheelSlotId;
  weight: number;
}

export interface WheelBinding {
  bound_wheels: WheelId[];
  rotation_policy: RotationPolicy;
  slot_mapping: SlotMapping[];
}

export interface GridSemantics {
  theology_mode: TheologyMode;
  technology_mode: TechnologyMode;
  cosmology_mode: CosmologyMode;
  wheel_binding: WheelBinding;
  ttcl_sign_profile: SignProfileRef;
}

// ── Node graph ───────────────────────────────────────────────────────────────

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface DeityRef {
  deity_id: DeityId;
  name: string;
  epithet?: string | null;
  domain?: string | null;
}

export interface CityRef {
  city_id: CityId;
  name: string;
  region: string;
  coordinates?: GeoCoord | null;
}

export interface TheoRelation {
  relation_type: 'ally' | 'subordinate' | 'rival' | 'consort' | 'patron';
  target_temple?: TempleId | null;
  target_deity?: DeityId | null;
}

export interface TheoSlots {
  rank: 'major' | 'minor' | 'city-patron';
  function: string[];
  relationships: TheoRelation[];
  hymn_signature: string;
}

export interface NamingProfile {
  canonical_name: string;
  variants: string[];
  language: 'Sumerian' | 'Akkadian' | 'mixed' | 'unknown';
}

export interface TechSlots {
  protocol_version: string;
  packet_form: string;
  naming_profile: NamingProfile;
  interoperability_tags: string[];
}

export interface GridEdge {
  target_temple: TempleId;
  edge_type: 'theological' | 'political' | 'ritual' | 'economic';
  weight: number;
}

export interface Connectivity {
  degree: number;
  edges: GridEdge[];
}

export interface CosmoSlots {
  grid_layer: 'surface' | 'underlying-grid';
  connectivity: Connectivity;
  energy_profile?: string | null;
  role_in_grid: 'gateway' | 'junction' | 'terminus' | 'hub' | 'satellite';
}

/** Unit channel vector (T/X/C/H/S), each in [0,1]. */
export interface LogocChannelScores {
  theo: number;
  tech: number;
  cosmo: number;
  coherence: number;
  sovereignty: number;
}

export interface LogocPenaltyPriors {
  unknownNode: number;
  weakConnectivity: number;
  protocolDrift: number;
  domainImbalance: number;
}

export interface LogocWeights {
  theo: number;
  tech: number;
  cosmo: number;
  coherence: number;
  sovereignty: number;
}

/**
 * Static curated LOGOC fingerprint embedded on a TempleNode.
 * Describes what the node *is* (slow-changing), not a single event score.
 */
export interface TempleNodeLogocFingerprint {
  profile_id: 'logoc.temple-grid.v1';
  version: string;
  channels: LogocChannelScores;
  penalty_priors: LogocPenaltyPriors;
  weights: LogocWeights;
  baseline_total: number;
  confidence: number;
  provenance: {
    mode: 'curated-static' | 'promoted-from-priors' | 'derived-historical';
    source_refs: string[];
    last_reviewed_at: string;
  };
}

export interface TempleNode {
  temple_id: TempleId;
  name: string;
  deity: DeityRef;
  city: CityRef;
  hymn_index: number;
  theo_slots: TheoSlots;
  tech_slots: TechSlots;
  cosmo_slots: CosmoSlots;
  status: NodeStatus;
  /** Optional until full 42-node curation; generator fills all nodes. */
  logoc_fingerprint?: TempleNodeLogocFingerprint | null;
}

export interface TempleGridBinding {
  sign_profile: SignProfileRef;
  logoc_profile: LOGOCProfileRef;
  event_profile: EventProfileRef;
}

export interface TempleGrid {
  grid_id: GridId;
  provenance: GridProvenance;
  nodes: TempleNode[];
  schema_version: string;
  semantics: GridSemantics;
  binding?: TempleGridBinding;
}

// ── Context for sign construction ────────────────────────────────────────────

export interface TempleSignContext {
  /** Primary TTCL domain for this emission (default THEOLOGY for hymn nodes). */
  domain?: Domain;
  modality?: Modality;
  /** Peirce class id on LOGOC manifold (default 0 — INDEX-leaning generic). */
  peirceClassId?: number;
  mode?: CoarseMode;
  pps?: number;
  trace?: EventTrace;
  /** Override domains ancestry (default triadic when node has all three slot families). */
  domains?: readonly Domain[];
}

const DEFAULT_PEIRCE_CLASS = 0;
const DEFAULT_PPS = 0.5;

// ── Resolve ──────────────────────────────────────────────────────────────────

export function resolveTemple(grid: TempleGrid, templeId: TempleId): TempleNode {
  const node = grid.nodes.find((n) => n.temple_id === templeId);
  if (!node) {
    throw new Error(`TempleGrid ${grid.grid_id}: unknown temple_id=${templeId}`);
  }
  return node;
}

export function resolveTempleByHymnIndex(
  grid: TempleGrid,
  hymnIndex: number,
): TempleNode {
  const node = grid.nodes.find((n) => n.hymn_index === hymnIndex);
  if (!node) {
    throw new Error(
      `TempleGrid ${grid.grid_id}: no node with hymn_index=${hymnIndex}`,
    );
  }
  return node;
}

export function resolveTempleByWheelSlot(
  binding: WheelBinding,
  wheelId: WheelId,
  slotId: WheelSlotId,
): TempleId {
  const hit = binding.slot_mapping.find(
    (m) => m.wheel_id === wheelId && m.slot_id === slotId,
  );
  if (!hit) {
    throw new Error(
      `WheelBinding: no temple for wheel=${wheelId} slot=${slotId}`,
    );
  }
  return hit.temple_id;
}

// ── Validation (lightweight, schema is authoritative) ────────────────────────

export function validateTempleGrid(grid: TempleGrid): string[] {
  const v: string[] = [];
  if (!grid.grid_id?.trim()) v.push('missing_grid_id');
  if (grid.provenance?.ttc_domain !== 'THEO_TECHNO_COSMO') {
    v.push('ttc_domain_must_be_THEO_TECHNO_COSMO');
  }
  if (!Array.isArray(grid.nodes) || grid.nodes.length === 0) {
    v.push('nodes_empty');
  }
  const ids = new Set<string>();
  const hymns = new Set<number>();
  for (const n of grid.nodes ?? []) {
    if (ids.has(n.temple_id)) v.push(`duplicate_temple_id:${n.temple_id}`);
    ids.add(n.temple_id);
    if (hymns.has(n.hymn_index)) v.push(`duplicate_hymn_index:${n.hymn_index}`);
    hymns.add(n.hymn_index);
    if (n.hymn_index < 1 || n.hymn_index > 42) {
      v.push(`hymn_index_out_of_range:${n.temple_id}`);
    }
    if (n.cosmo_slots.connectivity.degree !== n.cosmo_slots.connectivity.edges.length) {
      v.push(`connectivity_degree_mismatch:${n.temple_id}`);
    }
  }
  for (const m of grid.semantics?.wheel_binding?.slot_mapping ?? []) {
    if (!ids.has(m.temple_id)) v.push(`slot_mapping_unknown_temple:${m.temple_id}`);
  }
  return v;
}

// ── Domain inference from node ───────────────────────────────────────────────

/**
 * Map node tripartite slots → TTCL domain emphasis.
 * Rank major + hub → THEOLOGY default; protocol-heavy → TECHNOLOGY; high connectivity → COSMOLOGY.
 */
export function primaryDomainForNode(node: TempleNode): Domain {
  if (node.cosmo_slots.role_in_grid === 'hub' || node.cosmo_slots.role_in_grid === 'gateway') {
    if (node.theo_slots.rank === 'major') return 'THEOLOGY';
  }
  if (node.tech_slots.interoperability_tags.length >= 3) return 'TECHNOLOGY';
  if (node.cosmo_slots.connectivity.degree >= 3) return 'COSMOLOGY';
  return 'THEOLOGY';
}

/** Build a stable payload object for SignalEvent / gnosis training. */
export function nodeToEventPayload(
  grid: TempleGrid,
  node: TempleNode,
): Record<string, unknown> {
  return {
    grid_id: grid.grid_id,
    temple_id: node.temple_id,
    hymn_index: node.hymn_index,
    deity_id: node.deity.deity_id,
    deity_name: node.deity.name,
    city_id: node.city.city_id,
    city_name: node.city.name,
    status: node.status,
    theo: {
      rank: node.theo_slots.rank,
      function: node.theo_slots.function,
      hymn_signature: node.theo_slots.hymn_signature,
    },
    tech: {
      protocol_version: node.tech_slots.protocol_version,
      canonical_name: node.tech_slots.naming_profile.canonical_name,
      language: node.tech_slots.naming_profile.language,
      tags: node.tech_slots.interoperability_tags,
    },
    cosmo: {
      grid_layer: node.cosmo_slots.grid_layer,
      role_in_grid: node.cosmo_slots.role_in_grid,
      degree: node.cosmo_slots.connectivity.degree,
      energy_profile: node.cosmo_slots.energy_profile ?? null,
    },
    ttc_domain: grid.provenance.ttc_domain,
    sign_profile: grid.semantics.ttcl_sign_profile,
    logoc_profile: grid.binding?.logoc_profile ?? null,
    event_profile: grid.binding?.event_profile ?? null,
    logoc_fingerprint: node.logoc_fingerprint
      ? {
          baseline_total: node.logoc_fingerprint.baseline_total,
          confidence: node.logoc_fingerprint.confidence,
          channels: node.logoc_fingerprint.channels,
          version: node.logoc_fingerprint.version,
        }
      : null,
  };
}

/**
 * Construct a TTCL Sign from a temple node (IV. Grid of the Universe → sign).
 * Uses makeSign + manifold; peirce class defaults to 0 (caller may override).
 */
export function gridSign(
  grid: TempleGrid,
  templeId: TempleId,
  context: TempleSignContext = {},
): Sign<Modality, Domain> {
  const node = resolveTemple(grid, templeId);
  const domain = context.domain ?? primaryDomainForNode(node);
  const modality = context.modality ?? 'SYMBOL';
  const classId = context.peirceClassId ?? DEFAULT_PEIRCE_CLASS;
  const mode = context.mode ?? 'SYMBOL';
  const pps = context.pps ?? DEFAULT_PPS;
  const domains =
    context.domains ??
    (['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'] as const);

  // Trace may carry temple identity for CHARTER §4 intention-traceability
  const trace = context.trace;

  return makeSign(classId, mode, domain, modality, pps, trace, domains, true);
}

/**
 * Resolve temple via wheel slot_mapping, then gridSign.
 */
export function wheelGridSign(
  grid: TempleGrid,
  wheelId: WheelId,
  slotId: WheelSlotId,
  context: TempleSignContext = {},
): Sign<Modality, Domain> {
  const templeId = resolveTempleByWheelSlot(
    grid.semantics.wheel_binding,
    wheelId,
    slotId,
  );
  return gridSign(grid, templeId, context);
}

/** Active (non-deprecated) nodes only. */
export function activeNodes(grid: TempleGrid): TempleNode[] {
  return grid.nodes.filter((n) => n.status === 'active');
}

/** Count nodes by status — useful for data-completeness audits. */
export function nodeStatusHistogram(
  grid: TempleGrid,
): Record<NodeStatus, number> {
  const h: Record<NodeStatus, number> = {
    active: 0,
    deprecated: 0,
    unknown: 0,
  };
  for (const n of grid.nodes) h[n.status] += 1;
  return h;
}
