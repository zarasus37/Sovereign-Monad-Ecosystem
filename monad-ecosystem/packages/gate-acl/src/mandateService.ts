/**
 * pl.state.updated consumer → issueMandate → Redis → mandate.reissued.
 *
 * TODO(multi-domain): currently issues **single-domain** mandates from one
 * PLState. A principal active in multiple domains needs a union-of-domains
 * issuance (see MandateIssuer.issueUnionFromPLs) before multi-domain is real.
 * Until then, each pl.state.updated for domain D only refreshes D's mandate.
 */

import type { Kafka } from 'kafkajs';
import { consumeTopic, TOPICS } from './kafkaBus.js';
import { MandateIssuer } from './mandateIssuer.js';
import type { BusProducer, MandateStore } from './ports.js';
import type { PLState } from './types.js';

export class MandateService {
  constructor(
    private readonly issuer: MandateIssuer,
    private readonly store: MandateStore,
    private readonly bus: BusProducer,
  ) {}

  /**
   * Re-issue mandate from a single-domain PL update.
   *
   * Multi-domain principals: this does **not** merge sibling domain scores yet.
   * Call issueUnionFromPLs when a full principal snapshot is available.
   */
  async onPlStateUpdated(state: PLState, now: number = Date.now()): Promise<void> {
    // TODO(multi-domain): load all domain PLStates for principal and use
    // issuer.issueUnionFromPLs(states) so domains[] is a true union and tier
    // is a coherent cross-domain policy — not only the latest domain event.
    const mandate = this.issuer.issueFromPL(state, now);
    await this.store.put(mandate);
    await this.bus.publish(TOPICS.MANDATE_REISSUED, mandate.principalId, mandate);
  }

  async run(
    kafka: Kafka,
    groupId = 'gate-acl-mandate-service',
    signal?: AbortSignal,
  ): Promise<void> {
    await this.bus.connect();
    await consumeTopic(
      kafka,
      TOPICS.PL_STATE_UPDATED,
      groupId,
      async (payload) => {
        const state = payload as PLState;
        if (!state?.principalId || !state.domain) return;
        await this.onPlStateUpdated(state);
      },
      { signal },
    );
  }
}
