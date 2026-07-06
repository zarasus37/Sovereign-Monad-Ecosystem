import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHumanReviewQueue } from '../src/parsers/human-review-queue.js';
import { parseCorrectionLog } from '../src/parsers/correction-log.js';
import { parseBusLog } from '../src/parsers/bus-log.js';
import { buildReport } from '../src/report.js';

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf-8');

describe('buildReport', () => {
  it('produces a report with all five metrics', () => {
    const queue = parseHumanReviewQueue(fixture('human-review-queue.md'));
    const correctionLog = parseCorrectionLog(
      JSON.parse(fixture('correction-log.json'))
    );
    const busEvents = parseBusLog(fixture('bus-log.jsonl')).events;

    const report = buildReport({
      queue,
      correctionLog,
      busEvents,
      queuePath: 'fixtures/human-review-queue.md',
      correctionLogPath: 'fixtures/correction-log.json',
      busLogPath: 'fixtures/bus-log.jsonl',
    });

    expect(report.metrics).toHaveLength(5);
    expect(report.metrics.map((m) => m.id)).toEqual([
      'HCD-1',
      'HCD-2',
      'HCD-3',
      'HCD-4',
      'HCD-5',
    ]);
    expect(report.warnings).toHaveLength(0);
    expect(report.generatedAt).toMatch(/\d{4}-/);
  });

  it('warns when optional inputs are missing', () => {
    const report = buildReport({});
    expect(report.metrics).toHaveLength(2); // HCD-3 and HCD-4 can still run
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('warns about human-event and trace gaps in bus data', () => {
    const correctionLog = parseCorrectionLog(
      JSON.parse(fixture('correction-log.json'))
    );
    const report = buildReport({
      correctionLog,
      busEvents: [
        {
          id: 'no-trace',
          correlationId: 'c1',
          timestamp: '2026-06-23T08:00:00.000Z',
          layer: 'intelligence',
          source: 'agent-alpha',
          type: 'trade.approved',
          payload: { symbol: 'ETH' },
        },
      ],
    });
    expect(report.warnings.some((w) => w.includes('HCD‑3'))).toBe(true);
    expect(report.warnings.some((w) => w.includes('HCD‑4'))).toBe(true);
  });
});
