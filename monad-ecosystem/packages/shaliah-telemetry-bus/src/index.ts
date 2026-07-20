/**
 * @sovereign/shaliah-telemetry-bus
 *
 * Adapter to convert Shaliah Onboarding Arc telemetry events
 * to hcd-monitor BusEvent format for drift tracking.
 */

export { toBusEvent, toBusEvents } from './adapter.js';
export { parseShaliahTelemetry, parseShaliahLine, type ShaliahTelemetryParseResult } from './parser.js';