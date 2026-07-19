/**
 * pl.events consumer → recompute decayed PL via PLLedger → publish pl.state.updated.
 * This is the only writer of PL state.
 *
 * Drops verifiedBy === 'client' as defense-in-depth even though topic ACLs
 * should make that impossible upstream.
 */

import type { Kafka } from 'kafkajs';
import { consumeTopic, TOPICS } from './kafkaBus.js';
import { PLLedger } from './plLedger.js';
import type { BusProducer } from './ports.js';
import type { PLEvent, PLState } from './types.js';

export class PlLedgerService {
  constructor(
    private readonly ledger: PLLedger,
    private readonly bus: BusProducer,
  ) {}

  /**
   * Handle one pl.events message. Returns updated state, or null if dropped.
   */
  handleEvent(raw: unknown, now: number = Date.now()): PLState | null {
    const event = raw as PLEvent;
    if (!event || typeof event !== 'object') return null;
    if (event.verifiedBy === 'client') {
      console.warn(
        `[pl-ledger] dropped client-emitted event ${String((event as PLEvent).eventId)} (defense-in-depth)`,
      );
      return null;
    }
    try {
      return this.ledger.append(event, now);
    } catch (err) {
      console.warn(
        `[pl-ledger] append failed:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  async publishState(state: PLState): Promise<void> {
    await this.bus.publish(TOPICS.PL_STATE_UPDATED, state.principalId, state);
  }

  /** Long-running consumer. */
  async run(kafka: Kafka, groupId = 'gate-acl-pl-ledger', signal?: AbortSignal): Promise<void> {
    await this.bus.connect();
    await consumeTopic(
      kafka,
      TOPICS.PL_EVENTS,
      groupId,
      async (payload) => {
        const state = this.handleEvent(payload);
        if (state) await this.publishState(state);
      },
      { signal },
    );
  }
}
