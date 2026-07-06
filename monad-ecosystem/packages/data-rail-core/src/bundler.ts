/**
 * Data Rail Bundler.
 * Bundles behavioral signal windows into exportable products.
 */

import { sovereignBus } from '@sovereign/bus';
import type { EventTrace } from '@sovereign/types';
import { randomUUID } from 'node:crypto';

export interface DataBundle {
  readonly bundleId: string;
  readonly createdAt: string;
  readonly signalCount: number;
  readonly observationWindowIds: readonly string[];
}

/**
 * Bundle signal windows and emit a notification event.
 */
export function bundleSignals(windowIds: readonly string[]): DataBundle {
  const bundleId = randomUUID();
  const createdAt = new Date().toISOString();

  const bundle: DataBundle = {
    bundleId,
    createdAt,
    signalCount: windowIds.length * 10,
    observationWindowIds: windowIds,
  };

  // Emit on bus
  // data-rail.bundle.ready is not currently trace-required; include trace anyway for auditability.
  const trace: EventTrace = {
    intentionId: `data-rail-bundle-${bundleId}`,
    source: 'data-rail-core',
    createdAt,
  };
  sovereignBus.emit(
    'data-rail.bundle.ready',
    'data-rail',
    bundle,
    { correlationId: randomUUID(), source: 'data-rail-core', trace }
  );

  return bundle;
}
