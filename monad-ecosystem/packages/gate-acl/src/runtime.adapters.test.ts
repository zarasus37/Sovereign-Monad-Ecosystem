/**
 * Adapter unit tests (no Kafka/Redis required).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { InMemoryBus } from './bus.js';
import { MandateIssuer } from './mandateIssuer.js';
import { MandateService } from './mandateService.js';
import { PLLedger } from './plLedger.js';
import { PlLedgerService } from './plLedgerService.js';
import { InMemoryMandateStore } from './redisMandateStore.js';
import { TOPICS } from './types.js';
import type { BusProducer } from './ports.js';

class MemoryBusProducer implements BusProducer {
  readonly published: { topic: string; key: string; payload: unknown }[] = [];
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async publish(topic: string, key: string, payload: unknown): Promise<void> {
    this.published.push({ topic, key, payload });
  }
}

describe('runtime adapters (in-memory)', () => {
  it('pl ledger service drops client events and publishes state for verified', async () => {
    const ledger = new PLLedger();
    const bus = new MemoryBusProducer();
    const svc = new PlLedgerService(ledger, bus);

    const dropped = svc.handleEvent({
      kind: 'comprehension_gate',
      eventId: randomUUID(),
      principalId: 'p1',
      domain: 'defi_execution',
      passed: true,
      gateId: 'g',
      verifiedBy: 'client',
      at: Date.now(),
    });
    assert.equal(dropped, null);

    const state = svc.handleEvent({
      kind: 'comprehension_gate',
      eventId: randomUUID(),
      principalId: 'p1',
      domain: 'defi_execution',
      passed: true,
      gateId: 'g',
      verifiedBy: 'comprehension-gate',
      at: Date.now(),
    });
    assert.ok(state);
    assert.ok(state!.score > 0);
    await svc.publishState(state!);
    assert.equal(bus.published.length, 1);
    assert.equal(bus.published[0]!.topic, TOPICS.PL_STATE_UPDATED);
  });

  it('mandate service stores signed mandate and publishes reissued', async () => {
    const issuer = new MandateIssuer({ secret: 'test-secret' });
    const store = new InMemoryMandateStore();
    const bus = new MemoryBusProducer();
    const svc = new MandateService(issuer, store, bus);
    const now = Date.now();
    await svc.onPlStateUpdated(
      {
        principalId: 'p1',
        domain: 'defi_execution',
        score: 40,
        lastUpdated: now,
        components: {
          comprehensionGates: [],
          validOverrides: [],
          domainTasksCompleted: [],
        },
      },
      now,
    );
    const m = await store.get('p1', 'defi_execution');
    assert.ok(m);
    assert.equal(m!.tier, 1);
    assert.equal(bus.published[0]!.topic, TOPICS.MANDATE_REISSUED);
  });

  it('issueUnionFromPLs unions domains (provisional multi-domain)', () => {
    const issuer = new MandateIssuer({ secret: 'test-secret' });
    const now = Date.now();
    const m = issuer.issueUnionFromPLs(
      [
        {
          principalId: 'p1',
          domain: 'defi_execution',
          score: 40,
          lastUpdated: now,
          components: {
            comprehensionGates: [],
            validOverrides: [],
            domainTasksCompleted: [],
          },
        },
        {
          principalId: 'p1',
          domain: 'agent_ops',
          score: 10,
          lastUpdated: now,
          components: {
            comprehensionGates: [],
            validOverrides: [],
            domainTasksCompleted: [],
          },
        },
      ],
      now,
    );
    assert.equal(m.tier, 1);
    assert.ok(m.domains.includes('defi_execution'));
    assert.ok(m.domains.includes('agent_ops'));
    assert.equal(m.domain, 'defi_execution'); // primary = highest score
  });

  it('in-memory bus still works with original demo path', () => {
    const bus = new InMemoryBus();
    bus.publish(TOPICS.INTENT_RAISED, { hello: true });
    assert.equal(bus.log.length, 1);
  });
});
