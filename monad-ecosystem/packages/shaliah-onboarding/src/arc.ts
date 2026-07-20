/**
 * Full onboarding arc state machine — phases 1 → 2 → 3 → graduated.
 */

import { randomUUID } from 'node:crypto';
import { createCircuit, seedFromCircuit, type CircuitState } from './phase1Circuit.js';
import {
  createShadowMarket,
  phase2Metrics,
  type ShadowMarketState,
} from './phase2ShadowMarket.js';
import { createArchon, type ArchonState } from './phase3Archon.js';
import type { ArcSession, GraduationResult, OnboardingEvent } from './types.js';

export interface ArcRuntime {
  session: ArcSession;
  circuit: CircuitState;
  market: ShadowMarketState;
  archon: ArchonState | null;
}

export function startArc(principalId: string, now = Date.now()): ArcRuntime {
  const session: ArcSession = {
    sessionId: randomUUID(),
    principalId,
    phase: 'phase1_circuit',
    events: [],
    phase2RefusalNamed: false,
    phase3Passed: false,
  };
  return {
    session,
    circuit: createCircuit(principalId, now),
    market: createShadowMarket(principalId),
    archon: null,
  };
}

function mergeEvents(session: ArcSession, more: OnboardingEvent[]): void {
  session.events.push(...more);
}

/** Advance phase when phase-local graduation criteria met. */
export function syncArcPhase(rt: ArcRuntime): ArcSession {
  const { session, circuit, market } = rt;

  if (session.phase === 'phase1_circuit' && circuit.awake) {
    session.twin = seedFromCircuit(circuit);
    mergeEvents(session, circuit.events);
    session.phase = 'phase2_shadow';
  }

  if (session.phase === 'phase2_shadow') {
    const m = phase2Metrics(market);
    session.phase2RefusalNamed = market.refuseNamed;
    if (m.graduated) {
      mergeEvents(session, market.events);
      session.phase = 'phase3_archon';
      if (!rt.archon) {
        rt.archon = createArchon(session.principalId);
      }
    }
  }

  if (session.phase === 'phase3_archon' && rt.archon?.passed) {
    session.phase3Passed = true;
    mergeEvents(session, rt.archon.events);
    session.phase = 'graduated';
    session.graduatedAt = Date.now();
    session.events.push({
      id: randomUUID(),
      kind: 'arc.graduate',
      principalId: session.principalId,
      at: session.graduatedAt,
      payload: {
        sessionId: session.sessionId,
        twin: session.twin,
        note: 'Meshaleach graduated — wire PL comprehension_gate in V1.3',
      },
    });
  }

  return session;
}

export function evaluateGraduation(session: ArcSession): GraduationResult {
  const missing: string[] = [];
  if (!session.twin) missing.push('phase1_twin_seed');
  if (!session.phase2RefusalNamed && session.phase !== 'graduated') {
    // allow correct green halt path: check events
    const halt = session.events.some(
      (e) =>
        e.kind === 'phase2.override' && e.payload?.classification === 'correct_green_halt',
    );
    if (!halt && !session.phase2RefusalNamed) missing.push('phase2_refusal_literacy');
  }
  if (!session.phase3Passed && session.phase !== 'graduated') {
    missing.push('phase3_structured_refusal');
  }
  const graduated = session.phase === 'graduated' || missing.length === 0;
  return {
    graduated: graduated && session.phase === 'graduated',
    phase: session.phase,
    missing: session.phase === 'graduated' ? [] : missing,
    twin: session.twin,
  };
}
