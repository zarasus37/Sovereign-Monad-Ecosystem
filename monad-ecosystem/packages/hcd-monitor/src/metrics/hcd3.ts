/**
 * HCD‑3 — Human-Initiated Query Diversity.
 *
 * Normalized Shannon entropy over human-originated event templates in a bus
 * log window. Higher entropy = more diverse human-initiated activity.
 */

import type { BusEvent, MetricResult } from '../types.js';
import { DEFAULT_HUMAN_SOURCES } from '../types.js';

/**
 * Normalize an event into a template by stripping variable literals.
 *
 * For now the template is `layer:type` plus a coarse payload shape. This
 * avoids overfitting to unique IDs, timestamps, and numeric values while still
 * distinguishing different kinds of human action.
 */
export function eventTemplate(event: BusEvent): string {
  const payloadShape = coarsePayloadShape(event.payload);
  return `${event.layer}:${event.type}:${payloadShape}`;
}

export function computeHcd3(
  events: BusEvent[],
  humanSources: Set<string> = DEFAULT_HUMAN_SOURCES
): MetricResult {
  const humanEvents = events.filter(
    (e) =>
      humanSources.has(e.source) ||
      (e.trace?.source && humanSources.has(e.trace.source))
  );

  if (humanEvents.length === 0) {
    return {
      id: 'HCD-3',
      name: 'Human-Initiated Query Diversity',
      value: 0,
      unit: 'normalized_entropy',
      sampleSize: 0,
      status: 'insufficient-data',
      notes: [
        'No human-originated events found in the provided bus window.',
        'Human sources considered: ' + Array.from(humanSources).join(', ') + '.',
      ],
    };
  }

  const counts = new Map<string, number>();
  for (const event of humanEvents) {
    const template = eventTemplate(event);
    counts.set(template, (counts.get(template) ?? 0) + 1);
  }

  const n = humanEvents.length;
  const distinct = counts.size;

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / n;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const maxEntropy = Math.log2(distinct || 1);
  const normalizedEntropy = maxEntropy === 0 ? 0 : entropy / maxEntropy;

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top3Share =
    sorted
      .slice(0, 3)
      .reduce((sum, [, count]) => sum + count, 0) / n;

  const notes: string[] = [
    `${distinct} distinct templates from ${n} human-originated events.`,
    `Top-3 template share: ${(top3Share * 100).toFixed(1)}%.`,
  ];

  let status: MetricResult['status'] = 'green';
  if (normalizedEntropy < 0.4 && top3Share > 0.6) status = 'red';
  else if (normalizedEntropy < 0.5) status = 'yellow';

  return {
    id: 'HCD-3',
    name: 'Human-Initiated Query Diversity',
    value: normalizedEntropy,
    unit: 'normalized_entropy',
    sampleSize: n,
    status,
    notes,
  };
}

/**
 * Return a coarse shape signature for a payload.
 */
function coarsePayloadShape(payload: unknown): string {
  if (payload === undefined || payload === null) return 'empty';
  if (typeof payload !== 'object') return typeof payload;
  if (Array.isArray(payload)) return `array:${payload.length}`;
  const keys = Object.keys(payload as Record<string, unknown>).sort();
  if (keys.length === 0) return 'empty-object';
  if (keys.length <= 5) return `object:{${keys.join(',')}}`;
  return `object:{${keys.slice(0, 5).join(',')},+${keys.length - 5}}`;
}
