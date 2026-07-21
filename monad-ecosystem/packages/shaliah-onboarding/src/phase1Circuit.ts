/**
 * Phase 1 — Broken Genesis / Llull Circuit Board.
 *
 * User reconnects Theo / Techno / Cosmo nodes under constraint.
 * Too fast → C-ANTI-DILUTION overload; too slow → T-SOVEREIGNTY-DEBT starve.
 * Stable density wakes the agent and yields CognitiveTwinSeed.
 */

import { randomUUID } from 'node:crypto';
import type { CognitiveTwinSeed, OnboardingEvent, TtcDomain } from './types.js';

export const PHASE1_DENSITY_FLOOR = 0.4;
export const PHASE1_DENSITY_CEILING = 0.92;
/** Min stable ticks at acceptable density to wake. */
export const PHASE1_STABLE_TICKS = 3;
/** Wires faster than this interval (ms) risk overload when density already high. */
export const PHASE1_MIN_WIRE_INTERVAL_MS = 400;
/** No energy added for this long → starve risk. */
export const PHASE1_STARVE_MS = 8_000;

export type WireTool = 'constraint_link' | 'density_cap' | 'refusal_valve' | 'audit_splice';

export interface CircuitState {
  readonly principalId: string;
  energy: number;
  density: number;
  connected: Record<TtcDomain, boolean>;
  domainFlow: Record<TtcDomain, number>;
  overloadCount: number;
  starveCount: number;
  stableTicks: number;
  lastWireAt: number;
  lastInspectAt: number;
  inspectCount: number;
  wireCount: number;
  toolUses: string[];
  awake: boolean;
  events: OnboardingEvent[];
  startedAt: number;
}

export function createCircuit(principalId: string, now = Date.now()): CircuitState {
  return {
    principalId,
    energy: 0.35,
    density: 0.22,
    connected: { theological: false, technological: false, cosmological: false },
    domainFlow: { theological: 0, technological: 0, cosmological: 0 },
    overloadCount: 0,
    starveCount: 0,
    stableTicks: 0,
    lastWireAt: now,
    lastInspectAt: 0,
    inspectCount: 0,
    wireCount: 0,
    toolUses: [],
    awake: false,
    events: [],
    startedAt: now,
  };
}

function pushEvent(
  state: CircuitState,
  kind: OnboardingEvent['kind'],
  payload?: Record<string, unknown>,
  at = Date.now(),
): void {
  state.events.push({
    id: randomUUID(),
    kind,
    principalId: state.principalId,
    at,
    payload,
  });
}

/** User inspects a constraint label / node detail before acting (HCD-4). */
export function inspectConstraint(
  state: CircuitState,
  domain: TtcDomain,
  now = Date.now(),
): CircuitState {
  state.lastInspectAt = now;
  state.inspectCount += 1;
  pushEvent(state, 'phase1.inspect', { domain }, now);
  return state;
}

/**
 * Attempt to wire energy into a domain with a tool.
 * Returns the same state object (mutated) for demo simplicity.
 */
export function wireCircuit(
  state: CircuitState,
  domain: TtcDomain,
  tool: WireTool,
  now = Date.now(),
): CircuitState {
  if (state.awake) return state;

  const dt = now - state.lastWireAt;
  state.toolUses.push(`${tool}:${domain}`);
  state.wireCount += 1;
  state.lastWireAt = now;
  state.connected[domain] = true;
  state.domainFlow[domain] += 1;

  // Density rises with careful tools; raw links raise energy harder.
  const densityDelta =
    tool === 'density_cap' ? 0.08 : tool === 'constraint_link' ? 0.04 : tool === 'audit_splice' ? 0.05 : 0.06;
  const energyDelta =
    tool === 'refusal_valve' ? 0.04 : tool === 'constraint_link' ? 0.1 : 0.06;

  state.density = clamp01(state.density + densityDelta);
  state.energy = clamp01(state.energy + energyDelta);

  pushEvent(
    state,
    'phase1.wire',
    {
      domain,
      tool,
      density: state.density,
      energy: state.energy,
      inspectedRecently: now - state.lastInspectAt < 5_000 && state.lastInspectAt > 0,
    },
    now,
  );

  // Too fast + already high energy → overload (C-ANTI-DILUTION)
  if (dt < PHASE1_MIN_WIRE_INTERVAL_MS && state.energy > 0.7) {
    state.overloadCount += 1;
    state.density = clamp01(state.density - 0.18);
    state.energy = clamp01(state.energy - 0.12);
    state.stableTicks = 0;
    pushEvent(state, 'phase1.overload', { rule: 'C-ANTI-DILUTION', dt }, now);
  }

  // Density above ceiling without all three domains → brittle overload
  if (state.density > PHASE1_DENSITY_CEILING && !allConnected(state)) {
    state.overloadCount += 1;
    state.density = PHASE1_DENSITY_FLOOR;
    pushEvent(state, 'phase1.overload', { rule: 'C-ANTI-DILUTION', reason: 'unbalanced_spike' }, now);
  }

  tickStability(state, now);
  return state;
}

/** Idle tick — starve if no wires for too long. */
export function tickCircuit(state: CircuitState, now = Date.now()): CircuitState {
  if (state.awake) return state;

  if (now - state.lastWireAt > PHASE1_STARVE_MS) {
    state.starveCount += 1;
    state.energy = clamp01(state.energy - 0.15);
    state.density = clamp01(state.density - 0.05);
    state.stableTicks = 0;
    state.lastWireAt = now; // reset so we don't multi-fire every ms
    pushEvent(state, 'phase1.starve', { rule: 'T-SOVEREIGNTY-DEBT' }, now);
  }

  // Natural leak if not all domains connected
  if (!allConnected(state)) {
    state.energy = clamp01(state.energy - 0.01);
  }

  tickStability(state, now);
  return state;
}

function tickStability(state: CircuitState, now: number): void {
  // Unbalanced spike uses DENSITY_CEILING; once all three domains are live,
  // only the floor binds (full mesh may sit at high density without overload).
  const okDensity = allConnected(state)
    ? state.density >= PHASE1_DENSITY_FLOOR
    : state.density >= PHASE1_DENSITY_FLOOR && state.density <= PHASE1_DENSITY_CEILING;
  const okEnergy = state.energy >= 0.35 && state.energy <= 0.95;
  if (allConnected(state) && okDensity && okEnergy) {
    state.stableTicks += 1;
  } else {
    state.stableTicks = 0;
  }

  if (state.stableTicks >= PHASE1_STABLE_TICKS && !state.awake) {
    state.awake = true;
    pushEvent(state, 'phase1.stabilize', { twin: seedFromCircuit(state) }, now);
  }
}

function allConnected(state: CircuitState): boolean {
  return state.connected.theological && state.connected.technological && state.connected.cosmological;
}

export function seedFromCircuit(state: CircuitState): CognitiveTwinSeed {
  const total =
    state.domainFlow.theological +
    state.domainFlow.technological +
    state.domainFlow.cosmological || 1;
  const methodDiversity = entropyOf(state.toolUses);
  const reasoningExposure =
    state.wireCount === 0 ? 0 : clamp01(state.inspectCount / state.wireCount);

  return {
    principalId: state.principalId,
    theoShare: state.domainFlow.theological / total,
    technoShare: state.domainFlow.technological / total,
    cosmoShare: state.domainFlow.cosmological / total,
    methodDiversity,
    reasoningExposure,
    overloadCount: state.overloadCount,
    starveCount: state.starveCount,
    stabilizedAt: state.awake ? Date.now() : undefined,
  };
}

function entropyOf(items: string[]): number {
  if (items.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  const n = items.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log(p);
  }
  const max = Math.log(counts.size || 1);
  return max === 0 ? 0 : h / max;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
