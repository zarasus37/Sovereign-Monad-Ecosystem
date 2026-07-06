/**
 * @sovereign/hcd-monitor
 *
 * Human Capability Drift monitoring package.
 *
 * Computes CHARTER.md §2.1 metrics (HCD‑1..HCD‑5) from existing audit and bus
 * logs without requiring a live runtime connection.
 */

export * from './types.js';
export * from './parsers/human-review-queue.js';
export * from './parsers/correction-log.js';
export * from './parsers/bus-log.js';
export { buildReport, reportToJson } from './report.js';
export { computeHcd1 } from './metrics/hcd1.js';
export { computeHcd2 } from './metrics/hcd2.js';
export { computeHcd3 } from './metrics/hcd3.js';
export { computeHcd4 } from './metrics/hcd4.js';
export { computeHcd5 } from './metrics/hcd5.js';
