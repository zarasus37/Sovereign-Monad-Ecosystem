/**
 * Tests for the hardened KafkaBridge.
 *
 * Strategy: drive the bridge with an in-memory mock producer. We never
 * spin up a real broker, so these tests run in <100ms and exercise
 * the retry/DLQ/observability paths that the stub never could.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KafkaBridge, type KafkaBridgeConfig, type KafkaProducerLike, type KafkaBridgeLogger } from './kafka-bridge.js';
import { EventBus } from './EventBus.js';

class MockProducer implements KafkaProducerLike {
  sendMock = vi.fn();
  connectMock = vi.fn().mockResolvedValue(undefined);
  disconnectMock = vi.fn().mockResolvedValue(undefined);
  listeners: Record<string, Array<(e: unknown) => void>> = {};

  async connect(): Promise<void> {
    return this.connectMock();
  }
  async disconnect(): Promise<void> {
    return this.disconnectMock();
  }
  async send(record: Parameters<KafkaProducerLike['send']>[0]) {
    return this.sendMock(record);
  }
  on(event: string, listener: (e: unknown) => void) {
    this.listeners[event] = this.listeners[event] ?? [];
    this.listeners[event].push(listener);
  }
  fire(event: string, payload: unknown) {
    for (const l of this.listeners[event] ?? []) l(payload);
  }
}

function silentLogger(): KafkaBridgeLogger {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function makeBridge(producer: KafkaProducerLike, overrides: Partial<KafkaBridgeConfig> = {}): KafkaBridge {
  return new KafkaBridge({
    brokers: 'localhost:9092',
    clientId: 'test',
    maxRetries: 2,
    initialBackoffMs: 1,
    maxBackoffMs: 5,
    logger: silentLogger(),
    producer,
    ...overrides,
  });
}

describe('KafkaBridge', () => {
  let producer: MockProducer;
  let bus: EventBus;

  beforeEach(() => {
    process.env['KAFKA_ENABLED'] = 'true';
    producer = new MockProducer();
  });

  it('forwards mapped events to the canonical topic', async () => {
    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer);
    await bridge.attach(bus);

    bus.emit('price.updated', 'oracle', { pair: 'MON/USD', price: 1.23 });

    // Wait one microtask for the async forward.
    await new Promise((r) => setTimeout(r, 5));

    expect(producer.sendMock).toHaveBeenCalledTimes(1);
    const call = producer.sendMock.mock.calls[0][0];
    expect(call.topic).toBe('monad.price');
    expect(call.messages[0].headers!['event-type']).toBe('price.updated');
    expect(call.messages[0].key).toBeDefined();
    expect(JSON.parse(call.messages[0].value)).toMatchObject({
      type: 'price.updated',
      layer: 'oracle',
    });
  });

  it('falls back to defaultTopic for unmapped types', async () => {
    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer, { defaultTopic: 'sovereign.events' });
    await bridge.attach(bus);

    bus.emit('price.updated', 'oracle', { ok: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(producer.sendMock).toHaveBeenCalled();
    // Topic should be the canonical one, not the default.
    expect(producer.sendMock.mock.calls[0][0].topic).toBe('monad.price');
  });

  it('retries on transient send failures, then succeeds', async () => {
    producer.sendMock
      .mockRejectedValueOnce(new Error('broker down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValueOnce({ recordMetadata: [] });

    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer, { maxRetries: 3 });
    await bridge.attach(bus);

    bus.emit('spread.detected', 'oracle', { spread: 0.01 });
    await new Promise((r) => setTimeout(r, 30));

    expect(producer.sendMock).toHaveBeenCalledTimes(3);
    expect(producer.sendMock.mock.calls[2][0].topic).toBe('signals.spread');
  });

  it('routes to DLQ when all retries are exhausted', async () => {
    producer.sendMock.mockRejectedValue(new Error('permanent failure'));

    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer, { maxRetries: 2 });
    await bridge.attach(bus);

    bus.emit('trade.approved', 'treasury', { id: 'p1' });
    await new Promise((r) => setTimeout(r, 30));

    // 1 primary call + maxRetries (2) retries = 3 primary calls,
    // then 1 DLQ call = 4 total.
    expect(producer.sendMock).toHaveBeenCalledTimes(4);
    const last = producer.sendMock.mock.calls[3][0];
    expect(last.topic).toBe('portfolio.approved.dlq');
    expect(last.messages[0].headers!['dlq-reason']).toBe('max-retries-exhausted');
    expect(last.messages[0].headers!['dlq-source-topic']).toBe('portfolio.approved');
  });

  it('detaches cleanly and disconnects the producer', async () => {
    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer);
    const detach = await bridge.attach(bus);

    bus.emit('system.health', 'platform', { ok: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(producer.sendMock).toHaveBeenCalledTimes(1);

    await detach();
    expect(producer.disconnectMock).toHaveBeenCalledTimes(1);
    expect(bridge.isInitialized).toBe(false);

    // Post-detach emissions should not be forwarded.
    bus.emit('system.health', 'platform', { ok: false });
    await new Promise((r) => setTimeout(r, 5));
    expect(producer.sendMock).toHaveBeenCalledTimes(1);
  });

  it('refuses to forward when KAFKA_ENABLED is not "true"', async () => {
    process.env['KAFKA_ENABLED'] = 'false';
    bus = new EventBus({ source: 't', persistLogs: false });
    const bridge = makeBridge(producer);
    const detach = await bridge.attach(bus);

    bus.emit('price.updated', 'oracle', { ok: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(producer.sendMock).not.toHaveBeenCalled();

    await detach();
  });

  it('static topic map lookup', () => {
    expect(KafkaBridge.getTopicFor('price.updated')).toBe('monad.price');
    expect(KafkaBridge.getTopicFor('system.health')).toBe('system.health');
    expect(KafkaBridge.getTopicMap()).toMatchObject({
      'price.updated': 'monad.price',
      'spread.detected': 'signals.spread',
    });
  });
});
