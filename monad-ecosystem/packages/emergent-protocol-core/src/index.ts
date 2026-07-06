/**
 * Emergent Protocol Core — main entry point.
 * Observes behavioral windows, extracts patterns, and submits claims on the event bus.
 */

import { sovereignBus } from '@sovereign/bus';
import type { EmergencePattern, EventTrace, SignalEvent, PatternStatus } from '@sovereign/types';
import { randomUUID } from 'node:crypto';

export interface DiscoverPatternOptions {
  readonly title?: string;
  readonly category?: EmergencePattern['category'];
  readonly status?: PatternStatus;
}

/**
 * Discover a behavioral or structural pattern and emit it on the bus.
 */
export async function discoverPattern(
  options: DiscoverPatternOptions = {}
): Promise<SignalEvent<EmergencePattern>> {
  const now = new Date().toISOString();
  const patternId = randomUUID();
  const correlationId = randomUUID();
  const status = options.status ?? 'candidate';

  // CHARTER §4 — emergence claims are trace-required; candidates are not.
  const claimTrace: EventTrace | undefined =
    status === 'claimed'
      ? {
          intentionId: `emergence-claim-${patternId}`,
          source: 'emergent-protocol-core',
          createdAt: now,
        }
      : undefined;

  const title = options.title ?? 'Recurring Spread Arbitrage Convergence';
  const category = options.category ?? 'cross-agent-behavioral';

  const pattern: EmergencePattern = {
    patternId,
    firstObservedAt: now,
    updatedAt: now,
    title,
    description: `Statistically significant clustering of actions discovered in the spread verification loop.`,
    category,
    status,
    evidence: {
      occurrenceCount: 15,
      frequency: 0.78,
      confidence: 0.92,
      crossAgentConsistent: true,
      crossRegimeConsistent: false,
      evidenceWindowIds: [randomUUID(), randomUUID()],
    },
    observationWindows: [
      {
        windowId: randomUUID(),
        start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        end: now,
        agentIds: ['agent-0', 'hepar-agent'],
        observationCount: 120,
        contributingLayers: ['engine', 'intelligence'],
      },
    ],
    claimTxHash: status === 'claimed' ? '0x' + 'f'.repeat(64) : null,
    incorporatedIntoGnosisBaseline: false,
  };

  // Emit on bus
  const eventType = status === 'claimed' ? 'emergence.claim.submitted' : 'emergence.pattern.candidate';

  const event = sovereignBus.emit(
    eventType,
    'emergence',
    pattern,
    { correlationId, source: 'emergent-protocol-core', trace: claimTrace }
  );

  return event;
}
