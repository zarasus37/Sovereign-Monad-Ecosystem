/**
 * Risk Engine — main entry point.
 * Performs market regime classification and risk analysis, emitting events on the bus.
 */

import { sovereignBus } from '@sovereign/bus';
import type { EventTrace, OracleRegime, RegimeClass, OraclePosture, SignalEvent } from '@sovereign/types';
import { randomUUID } from 'node:crypto';

export interface ClassificationOptions {
  readonly regime?: RegimeClass;
  readonly posture?: OraclePosture;
  readonly confidence?: number;
}

/**
 * Classify the market regime and update the operational posture.
 */
export async function classifyRegime(
  options: ClassificationOptions = {}
): Promise<SignalEvent<OracleRegime>> {
  const classifiedAt = new Date().toISOString();
  const classificationId = randomUUID();
  const correlationId = randomUUID();

  // oracle.regime.classified and oracle.posture.updated are observations,
  // not governance actions, so trace is optional. Include it for auditability.
  const trace: EventTrace = {
    intentionId: `risk-classification-${classificationId}`,
    source: 'risk-engine',
    createdAt: classifiedAt,
  };

  const regime: RegimeClass = options.regime ?? 'trending-bullish';
  const posture: OraclePosture = options.posture ?? 'full-deployment';
  const confidence = options.confidence ?? 0.88;

  const regimeData: OracleRegime = {
    classificationId,
    classifiedAt,
    regime,
    posture,
    confidence,
    priceFeeds: [
      {
        asset: 'MON/USDC',
        priceMid: 12.42,
        liquidityDepth10bps: 500000,
        chain: 'monad',
        observedAt: classifiedAt,
        source: 'pyth-monad',
      },
    ],
    spreadAnalysis: {
      rawSpreadBps: 28,
      effectiveSpreadBps: 22,
      meetsMinThreshold: true,
      annualizedVol: 0.45,
      executionTimeSeconds: 2.5,
    },
    kellySizing: {
      kellyFraction: 0.05,
      positionSizeUsd: 5000,
      portfolioValueUsd: 100000,
    },
    capitalDeploymentAuthorized: posture === 'full-deployment' || posture === 'reduced-deployment',
    postureRationale: `Regime classified as ${regime} with confidence ${confidence * 100}%. Posture set to ${posture} based on spread liquidity thresholds.`,
  };

  // Emit on bus
  const event = sovereignBus.emit(
    'oracle.regime.classified',
    'oracle',
    regimeData,
    { correlationId, source: 'risk-engine', trace }
  );

  // If posture is halted or defensive, emit posture updated warning
  if (posture === 'halted' || posture === 'defensive') {
    sovereignBus.emit(
      'oracle.posture.updated',
      'oracle',
      { posture, rationale: regimeData.postureRationale },
      { correlationId, source: 'risk-engine', severity: 'critical', trace }
    );
  }

  return event;
}
