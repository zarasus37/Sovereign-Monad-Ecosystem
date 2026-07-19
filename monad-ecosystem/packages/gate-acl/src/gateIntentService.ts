/**
 * intent.raised consumer → GateAclService → execution.approved | execution.rejected
 */

import type { Kafka } from 'kafkajs';
import { Executor } from './executor.js';
import { GateAclService } from './gateAcl.service.js';
import { consumeIntentRaised, TOPICS } from './kafkaBus.js';
import type { MandateIssuer } from './mandateIssuer.js';
import type { BusProducer } from './ports.js';
import type { IntentRaised } from './types.js';

export class GateIntentService {
  private readonly gate: GateAclService;
  private readonly executor: Executor;

  constructor(
    issuer: MandateIssuer,
    private readonly bus: BusProducer,
    private readonly executeOnApprove = false,
  ) {
    this.gate = new GateAclService(issuer);
    this.executor = new Executor(issuer);
  }

  async handleIntent(intent: IntentRaised, now: number = Date.now()): Promise<void> {
    const result = this.gate.gate(intent, now);
    if (result.status === 'approved') {
      await this.bus.publish(
        TOPICS.EXECUTION_APPROVED,
        intent.principalId,
        result.event,
      );
      if (this.executeOnApprove) {
        const exec = this.executor.execute(result.event, now);
        if (exec.status === 'refused') {
          await this.bus.publish(TOPICS.EXECUTION_REJECTED, intent.principalId, {
            intentId: intent.intentId,
            principalId: intent.principalId,
            domain: intent.domain,
            action: intent.action,
            rejectedAt: now,
            reasons: exec.reasons,
            quarantine: true as const,
          });
        }
      }
    } else {
      await this.bus.publish(
        TOPICS.EXECUTION_REJECTED,
        intent.principalId,
        result.event,
      );
    }
  }

  async run(
    kafka: Kafka,
    groupId = 'gate-acl-intent-gate',
    signal?: AbortSignal,
  ): Promise<void> {
    await this.bus.connect();
    await consumeIntentRaised(
      kafka,
      groupId,
      async (intent) => this.handleIntent(intent),
      { signal },
    );
  }
}
