import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHumanReviewQueue } from '../src/parsers/human-review-queue.js';
import { parseCorrectionLog } from '../src/parsers/correction-log.js';
import { parseBusLog } from '../src/parsers/bus-log.js';
import { computeHcd1 } from '../src/metrics/hcd1.js';
import { computeHcd2 } from '../src/metrics/hcd2.js';
import { computeHcd3 } from '../src/metrics/hcd3.js';
import { computeHcd4 } from '../src/metrics/hcd4.js';
import { computeHcd5 } from '../src/metrics/hcd5.js';

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf-8');

const loadQueue = () => parseHumanReviewQueue(fixture('human-review-queue.md'));
const loadLog = () => parseCorrectionLog(JSON.parse(fixture('correction-log.json')));
const loadBus = () => parseBusLog(fixture('bus-log.jsonl')).events;

describe('HCD-1', () => {
  it('computes burden rate from queue header', () => {
    const result = computeHcd1(loadQueue());
    expect(result.value).toBe(4 / 50);
    expect(result.sampleSize).toBe(50);
    expect(result.status).toBe('green');
  });
});

describe('HCD-2', () => {
  it('computes override fidelity from correction log', () => {
    const result = computeHcd2(loadLog());
    expect(result.value).toBe(1 / 3);
    expect(result.sampleSize).toBe(3);
    expect(result.status).toBe('red');
  });
});

describe('HCD-3', () => {
  it('computes normalized entropy for human-originated events', () => {
    const events = loadBus();
    const result = computeHcd3(events);
    expect(result.sampleSize).toBe(3);
    // Fixture control-center events share one coarse template, so entropy is 0.
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('reports insufficient data when no human events exist', () => {
    const events = loadBus().filter((e) => e.source !== 'control-center');
    const result = computeHcd3(events);
    expect(result.sampleSize).toBe(0);
    expect(result.status).toBe('insufficient-data');
  });
});

describe('HCD-4', () => {
  it('computes reasoning exposure for trace-required events', () => {
    const events = loadBus();
    const result = computeHcd4(events);
    expect(result.sampleSize).toBe(7);
    expect(result.value).toBe(4 / 7);
    expect(result.status).toBe('yellow');
  });
});

describe('HCD-5', () => {
  it('computes median latency from drift signals to correction log', () => {
    const events = loadBus();
    const log = loadLog();
    const result = computeHcd5(events, log);
    expect(result.sampleSize).toBe(2); // tier2 + tier1
    expect(result.unit).toBe('ms');
    expect(result.value).toBeGreaterThan(0);
    expect(result.notes?.join()).toMatch(/~[\d.]+ hours/);
  });

  it('rejects implausibly large latencies as insufficient data', () => {
    const log = loadLog();
    const events = loadBus().filter((e) => e.type !== 'dove.signal.tier1' && e.type !== 'dove.signal.tier2');
    events.push({
      id: 'old-signal',
      correlationId: 'c-old',
      timestamp: '2000-01-01T00:00:00.000Z',
      layer: 'dove',
      source: 'dove-router',
      type: 'dove.signal.tier1',
      payload: {},
    });
    const result = computeHcd5(events, log);
    expect(result.status).toBe('insufficient-data');
    expect(result.notes?.join()).toMatch(/plausible/i);
  });
});
