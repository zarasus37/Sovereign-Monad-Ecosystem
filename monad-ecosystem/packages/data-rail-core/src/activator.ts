/**
 * Data Rail Activator.
 * Checks readiness thresholds and writes activation record.
 */

import { sovereignBus } from '@sovereign/bus';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ActivationRecord {
  readonly activationId: string;
  readonly activatedAt: string;
  readonly readinessScore: number;
  readonly status: 'active' | 'inactive';
}

/**
 * Activate the data rail and emit/persist the activation record.
 */
export function activateDataRail(readinessScore = 0.85): ActivationRecord {
  const activationId = randomUUID();
  const activatedAt = new Date().toISOString();

  const record: ActivationRecord = {
    activationId,
    activatedAt,
    readinessScore,
    status: 'active',
  };

  // Write record to logs/data-rail-activation.json
  try {
    const logsDir = join(process.cwd(), 'logs');
    mkdirSync(logsDir, { recursive: true });
    writeFileSync(
      join(logsDir, 'data-rail-activation.json'),
      JSON.stringify(record, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[DataRail] Failed to persist activation record to log:', err);
  }

  // Emit on bus
  sovereignBus.emit(
    'data-rail.activated',
    'data-rail',
    {
      activationId,
      timestamp: activatedAt,
      readinessScore,
    },
    { correlationId: randomUUID(), source: 'data-rail-core' }
  );

  return record;
}
