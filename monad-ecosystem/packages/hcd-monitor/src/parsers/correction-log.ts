/**
 * Parser for `logs/audit/correction_log_v*.json`.
 */

import type {
  CorrectionLog,
  CorrectionEntry,
  RemovedEntry,
  KeptAsIsEntry,
} from '../types.js';

export function parseCorrectionLog(
  json: unknown,
  sourcePath?: string
): CorrectionLog {
  if (!isRecord(json)) {
    throw new Error(
      `Correction log${sourcePath ? ` ${sourcePath}` : ''} is not a JSON object`
    );
  }

  return {
    version: requireString(json.version, 'version'),
    appliedAt: requireString(json.applied_at, 'applied_at'),
    sourceCorpus: requireString(json.source_corpus, 'source_corpus'),
    targetCorpus: requireString(json.target_corpus, 'target_corpus'),
    phase: requireString(json.phase, 'phase'),
    corrections: parseArray(json.corrections, 'corrections', parseCorrection),
    removed: parseArray(json.removed, 'removed', parseRemoved),
    keptAsIs: parseArray(json.kept_as_is, 'kept_as_is', parseKeptAsIs),
  };
}

function parseCorrection(value: unknown): CorrectionEntry {
  const r = requireRecord(value, 'correction item');
  return {
    eventId: requireString(r.event_id, 'event_id'),
    action: 'reclassify',
    oldClass: requireNumber(r.old_class, 'old_class'),
    newClass: requireNumber(r.new_class, 'new_class'),
    rationale: optionalString(r.rationale),
  };
}

function parseRemoved(value: unknown): RemovedEntry {
  const r = requireRecord(value, 'removed item');
  return {
    eventId: requireString(r.event_id, 'event_id'),
  };
}

function parseKeptAsIs(value: unknown): KeptAsIsEntry {
  const r = requireRecord(value, 'kept_as_is item');
  return {
    eventId: requireString(r.event_id, 'event_id'),
    oldClass: requireNumber(r.old_class, 'old_class'),
    rationale: optionalString(r.rationale),
  };
}

function parseArray<T>(
  value: unknown,
  field: string,
  parser: (item: unknown) => T
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${field} to be an array`);
  }
  return value.map(parser);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string, got ${typeof value}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected ${field} to be a number`);
  }
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected ${label} to be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
