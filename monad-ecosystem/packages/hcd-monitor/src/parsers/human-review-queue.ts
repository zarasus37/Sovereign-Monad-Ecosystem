/**
 * Parser for `logs/audit/human_review_queue.md`.
 *
 * Extracts the header statistics and the per-event table so that HCD‑1
 * and HCD‑2 can be computed from the queue itself.
 */

import type { HumanReviewQueue, HumanReviewQueueEntry } from '../types.js';

const HEADER_RE =
  /^\*\*Date:\*\*\s+(.+?)\s+\*\*Corpus:\*\*\s+(\d+)\s+events[\s\S]*?\*\*Pipeline:\*\*\s+(.+?)\s+\*\*Auto-accept rate:\*\*\s+([\d.]+)%\s+\((\d+)\/(\d+)\)[\s\S]*?\*\*Human review rate:\*\*\s+([\d.]+)%\s+\((\d+)\/(\d+)\)/im;

const EVENT_RE =
  /^### \d+\.\s+`([^`]+)`\s+—\s+Actual:\s+Class\s+(\d+)\s+\|\s+Rubric:\s+(\d+|null)\s+\|\s+ML:\s+(\d+)\s+\(([\d.]+)%\)/gm;

/**
 * Parse a human-review queue markdown document.
 *
 * @param markdown - full document content
 * @param sourcePath - optional path for diagnostics
 */
export function parseHumanReviewQueue(
  markdown: string,
  sourcePath?: string
): HumanReviewQueue {
  const header = HEADER_RE.exec(markdown);
  if (!header) {
    throw new Error(
      `Could not parse human-review queue header${sourcePath ? ` in ${sourcePath}` : ''}`
    );
  }

  const [, dateStr, totalStr, , autoAcceptRateStr, autoAcceptCountStr, , _humanReviewRateStr, humanReviewCountStr, totalCheckStr] =
    header;

  const totalEvents = parseInt(totalStr, 10);
  const humanReviewCount = parseInt(humanReviewCountStr, 10);
  const autoAcceptCount = parseInt(autoAcceptCountStr, 10);
  const autoAcceptRate = parseFloat(autoAcceptRateStr) / 100;

  // Sanity check: the two denominators should agree.
  if (parseInt(totalCheckStr, 10) !== totalEvents) {
    throw new Error(
      `Human review queue total mismatch: ${totalStr} vs ${totalCheckStr}`
    );
  }

  const entries: HumanReviewQueueEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = EVENT_RE.exec(markdown)) !== null) {
    const rubricRaw = match[3];
    entries.push({
      eventId: match[1],
      actualClass: parseInt(match[2], 10),
      rubricClass: rubricRaw === 'null' ? null : parseInt(rubricRaw, 10),
      mlClass: parseInt(match[4], 10),
      mlConfidence: parseFloat(match[5]) / 100,
    });
  }

  return {
    date: parseDateString(dateStr),
    totalEvents,
    humanReviewCount,
    autoAcceptCount,
    autoAcceptRate,
    entries,
  };
}

function parseDateString(value: string): string | undefined {
  const clean = value.trim();
  const parsed = Date.parse(clean);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}
