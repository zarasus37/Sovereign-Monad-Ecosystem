import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHumanReviewQueue } from '../src/parsers/human-review-queue.js';
import { parseCorrectionLog } from '../src/parsers/correction-log.js';
import { parseBusLog } from '../src/parsers/bus-log.js';

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf-8');

describe('parseHumanReviewQueue', () => {
  it('extracts header statistics and entries', () => {
    const queue = parseHumanReviewQueue(fixture('human-review-queue.md'));
    expect(queue.totalEvents).toBe(50);
    expect(queue.humanReviewCount).toBe(4);
    expect(queue.autoAcceptCount).toBe(46);
    expect(queue.autoAcceptRate).toBe(0.92);
    expect(queue.entries).toHaveLength(4);
    expect(queue.entries[0].eventId).toBe('gnosis_Akhenaten_ev04');
    expect(queue.entries[0].actualClass).toBe(2);
    expect(queue.entries[0].mlConfidence).toBe(0.961);
  });
});

describe('parseCorrectionLog', () => {
  it('parses corrections, removals, and kept-as-is records', () => {
    const raw = JSON.parse(fixture('correction-log.json'));
    const log = parseCorrectionLog(raw);
    expect(log.version).toBe('v5.10');
    expect(log.corrections).toHaveLength(1);
    expect(log.keptAsIs).toHaveLength(2);
    expect(log.corrections[0].eventId).toBe(
      'gnosis_Gnostic Jesus (The Historical Figur_ev13'
    );
    expect(log.corrections[0].newClass).toBe(2);
  });
});

describe('parseBusLog', () => {
  it('parses valid signal events and skips malformed lines', () => {
    const { events, skipped } = parseBusLog(fixture('bus-log.jsonl'));
    expect(events).toHaveLength(7);
    expect(skipped).toBe(1);
    expect(events[0].type).toBe('agent.action.taken');
    expect(events[0].trace?.intentionId).toBe('int-1');
  });
});
