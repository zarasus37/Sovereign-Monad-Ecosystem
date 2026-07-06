/**
 * Gnosis Evaluator Core — main entry point.
 * Evaluates agent operations, computes integrity scores, and emits SignalEvents.
 */

import { sovereignBus } from '@sovereign/bus';
import type { EventTrace, GnosisScore, SignalEvent } from '@sovereign/types';
import { randomUUID } from 'node:crypto';

export interface EvaluationOptions {
  readonly depth?: number;
  readonly truth?: number;
  readonly width?: number;
  readonly tiltMagnitude?: number;
}

let sequenceCounter = 0;

/**
 * Run gnosis integrity evaluation for a specific agent and emit the result.
 */
export async function evaluateAgent(
  agentId: string,
  options: EvaluationOptions = {}
): Promise<SignalEvent<GnosisScore>> {
  const windowEnd = new Date().toISOString();
  // 5 minutes window
  const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const correlationId = randomUUID();
  const evaluationId = randomUUID();

  // CHARTER §4 — integrity interventions are trace-required.
  const trace: EventTrace = {
    intentionId: `gnosis-eval-${evaluationId}`,
    source: 'gnosis-evaluator-core',
    createdAt: windowEnd,
  };

  const depth = options.depth ?? 0.85;
  const truth = options.truth ?? 0.9;
  const width = options.width ?? 0.8;
  const overallScore = Math.pow(depth * truth * width, 1 / 3);

  const tiltMagnitude = options.tiltMagnitude ?? 0.15;
  const tiltThreshold = 0.4;
  const blinkTriggered = tiltMagnitude > tiltThreshold;

  const doctrineState = overallScore >= 0.8 ? 'SELF_NAVIGATING' :
                       overallScore >= 0.65 ? 'ADJACENT_CONVERGENT' : 'PATTERN_FOLLOWING';

  const lane = overallScore >= 0.8 ? 'LANE_A' :
               overallScore >= 0.65 ? 'LANE_B' : 'LANE_C';

  const quarantineTriggered = lane === 'LANE_C' && blinkTriggered;

  const scoreResult: GnosisScore = {
    agentId,
    windowStart,
    windowEnd,
    coherence: { depth, truth, width },
    overallScore,
    parallax: {
      tiltMagnitude,
      tiltThreshold,
      blinkTriggered,
    },
    doctrineState,
    lane,
    quarantineTriggered,
    observationCount: 42,
    sequenceNumber: ++sequenceCounter,
  };

  // Emit on bus
  const event = sovereignBus.emit(
    'gnosis.score.computed',
    'gnosis',
    scoreResult,
    { correlationId, source: 'gnosis-evaluator-core' }
  );

  if (blinkTriggered) {
    sovereignBus.emit(
      'gnosis.blink.triggered',
      'gnosis',
      { agentId, tiltMagnitude, threshold: tiltThreshold },
      { correlationId, source: 'gnosis-evaluator-core', severity: 'warning', trace }
    );
  }

  if (quarantineTriggered) {
    sovereignBus.emit(
      'gnosis.quarantine.triggered',
      'gnosis',
      { agentId, rationale: `Lane C classification and temporal parallax blink triggered` },
      { correlationId, source: 'gnosis-evaluator-core', severity: 'critical', trace }
    );
  }

  return event;
}
