/**
 * JSONL parser for Shaliah Onboarding telemetry.
 *
 * Parses the line-delimited JSON output from the Shaliah Onboarding Arc
 * and converts each record to an hcd-monitor BusEvent.
 */

import type { OnboardingEvent } from '@sovereign/shaliah-onboarding';
import type { BusEvent } from '@sovereign/hcd-monitor';
import { toBusEvent } from './adapter.js';

/** Result of parsing Shaliah telemetry JSONL. */
export interface ShaliahTelemetryParseResult {
  /** Successfully converted BusEvents. */
  events: BusEvent[];
  /** Number of lines skipped due to parse errors. */
  skipped: number;
  /** Parse error messages for debugging. */
  errors: string[];
}

/**
 * Parse Shaliah Onboarding JSONL content into BusEvents.
 *
 * @param content - Raw JSONL string from Shaliah telemetry output
 * @returns Parsed events with error/skip counts
 */
export function parseShaliahTelemetry(content: string): ShaliahTelemetryParseResult {
  const events: BusEvent[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);

      // Validate minimal OnboardingEvent shape
      if (!isOnboardingEvent(parsed)) {
        skipped++;
        errors.push(`Invalid OnboardingEvent shape: ${trimmed.slice(0, 50)}...`);
        continue;
      }

      const busEvent = toBusEvent(parsed);
      events.push(busEvent);
    } catch (e) {
      skipped++;
      errors.push(`Parse error: ${trimmed.slice(0, 50)}...`);
    }
  }

  return { events, skipped, errors };
}

/**
 * Type guard to validate minimal OnboardingEvent shape.
 */
function isOnboardingEvent(value: unknown): value is OnboardingEvent {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.kind !== 'string') return false;
  if (typeof value.principalId !== 'string') return false;
  if (typeof value.at !== 'number') return false;
  return true;
}

/**
 * Type guard for generic record objects.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse a single JSONL line (utility for streaming).
 *
 * @param line - A single JSON line
 * @returns BusEvent if valid, null otherwise
 */
export function parseShaliahLine(line: string): BusEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!isOnboardingEvent(parsed)) return null;
    return toBusEvent(parsed);
  } catch {
    return null;
  }
}