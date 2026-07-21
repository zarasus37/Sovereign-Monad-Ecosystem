/**
 * Prometheus metrics registry (Vector 6.3 Observability).
 *
 * Zero-dependency exposition format — no prom-client required.
 * Kafka consumer (metricsKafka.ts) and in-process hooks record into this registry.
 *
 * Scraped at GET /metrics (text/plain; version=0.0.4).
 */

export type MetricLabels = Record<string, string>;

function labelsKey(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels![k]}`)
    .join(',');
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatLabels(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${escapeLabelValue(String(labels![k]))}"`);
  return `{${parts.join(',')}}`;
}

class Counter {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  inc(labels?: MetricLabels, by = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + by);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  /** Test helper */
  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
      return lines.join('\n');
    }
    for (const [key, value] of this.values) {
      const labels =
        key === ''
          ? undefined
          : Object.fromEntries(
              key.split(',').map((pair) => {
                const i = pair.indexOf('=');
                return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
              }),
            );
      lines.push(`${this.name}${formatLabels(labels)} ${value}`);
    }
    return lines.join('\n');
  }
}

class Gauge {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  set(value: number, labels?: MetricLabels): void {
    this.values.set(labelsKey(labels), value);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
      return lines.join('\n');
    }
    for (const [key, value] of this.values) {
      const labels =
        key === ''
          ? undefined
          : Object.fromEntries(
              key.split(',').map((pair) => {
                const i = pair.indexOf('=');
                return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
              }),
            );
      lines.push(`${this.name}${formatLabels(labels)} ${value}`);
    }
    return lines.join('\n');
  }
}

/** Simple histogram with fixed buckets (seconds). */
class Histogram {
  private readonly buckets: number[];
  private readonly counts = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly totals = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    buckets: number[] = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(seconds: number, labels?: MetricLabels): void {
    const key = labelsKey(labels);
    let counts = this.counts.get(key);
    if (!counts) {
      counts = this.buckets.map(() => 0);
      this.counts.set(key, counts);
      this.sums.set(key, 0);
      this.totals.set(key, 0);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (seconds <= this.buckets[i]) counts[i] += 1;
    }
    this.sums.set(key, (this.sums.get(key) ?? 0) + seconds);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }

  reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    if (this.counts.size === 0) {
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join('\n');
    }
    for (const [key, counts] of this.counts) {
      const labelBase =
        key === ''
          ? {}
          : Object.fromEntries(
              key.split(',').map((pair) => {
                const i = pair.indexOf('=');
                return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
              }),
            );
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += counts[i];
        // Note: counts[i] already cumulative-style in our observe — fix: we increment all matching buckets
        // Actually we increment each bucket le if seconds <= b, so counts are already cumulative.
        lines.push(
          `${this.name}_bucket${formatLabels({ ...labelBase, le: String(this.buckets[i]) })} ${counts[i]}`,
        );
      }
      const total = this.totals.get(key) ?? 0;
      lines.push(
        `${this.name}_bucket${formatLabels({ ...labelBase, le: '+Inf' })} ${total}`,
      );
      lines.push(
        `${this.name}_sum${formatLabels(labelBase as MetricLabels)} ${this.sums.get(key) ?? 0}`,
      );
      lines.push(
        `${this.name}_count${formatLabels(labelBase as MetricLabels)} ${total}`,
      );
    }
    return lines.join('\n');
  }
}

// ── Domain metrics (organism vitals) ─────────────────────────────────────────

export const fundingEventsTotal = new Counter(
  'sovereign_funding_events_total',
  'Cardia funding events by status',
);

export const fundingLatencySeconds = new Histogram(
  'sovereign_funding_latency_seconds',
  'Latency from first funding event for a mandate to terminal status (seconds)',
);

export const heparAuditsTotal = new Counter(
  'sovereign_hepar_audits_total',
  'Hepar forensic audit outcomes (pass/fail/error)',
);

export const capacityEventsTotal = new Counter(
  'sovereign_capacity_events_total',
  'Capacity ceiling lifecycle events by kind',
);

export const capacityRemainingUsd = new Gauge(
  'sovereign_capacity_remaining_usd',
  'Last observed remaining capacity allocation in USD',
);

export const capacityBurnUsdTotal = new Counter(
  'sovereign_capacity_burn_usd_total',
  'Cumulative capital consumed from capacity ceiling (USD)',
);

export const yieldRoutedUsdTotal = new Counter(
  'sovereign_yield_routed_usd_total',
  'Router B yield routed by sink (principal/shaliah/vault)',
);

export const yieldGrossUsdTotal = new Counter(
  'sovereign_yield_gross_usd_total',
  'Gross yield observed from YIELD_ROUTED events (USD)',
);

export const shadowGateTotal = new Counter(
  'sovereign_shadow_gate_total',
  'Shadow Markout gate outcomes (pass/abort)',
);

export const loopEventsTotal = new Counter(
  'sovereign_loop_events_total',
  'Sovereign execution loop events by kind',
);

export const kafkaMessagesTotal = new Counter(
  'sovereign_metrics_kafka_messages_total',
  'Kafka messages consumed by the observability exporter',
);

export const metricsInfo = new Gauge(
  'sovereign_metrics_info',
  'Observability exporter build info (always 1)',
);

metricsInfo.set(1, { version: '6.3.0', component: 'observability' });

/** In-memory mandate first-seen timestamps for latency (process-local). */
const fundingFirstSeenMs = new Map<string, number>();

export function resetAllMetricsForTests(): void {
  fundingEventsTotal.reset();
  fundingLatencySeconds.reset();
  heparAuditsTotal.reset();
  capacityEventsTotal.reset();
  capacityRemainingUsd.reset();
  capacityBurnUsdTotal.reset();
  yieldRoutedUsdTotal.reset();
  yieldGrossUsdTotal.reset();
  shadowGateTotal.reset();
  loopEventsTotal.reset();
  kafkaMessagesTotal.reset();
  fundingFirstSeenMs.clear();
  metricsInfo.set(1, { version: '6.3.0', component: 'observability' });
}

/**
 * Record a Cardia funding Kafka payload.
 */
export function recordFundingEvent(event: {
  mandateId?: string;
  status?: string;
  timestamp?: string;
  auditTrace?: string[];
}): void {
  const status = event.status ?? 'unknown';
  fundingEventsTotal.inc({ status });

  // Hepar from status or auditTrace
  const trace = (event.auditTrace ?? []).join(' ');
  if (
    status === 'AUDIT_PASSED' ||
    /hepar:audit:PASS|hepar:gate:passed|hepar:audit:pass/i.test(trace)
  ) {
    heparAuditsTotal.inc({ verdict: 'PASS' });
  } else if (
    status === 'AUDIT_FAILED' ||
    /hepar:audit:FAIL|hepar:audit:fail|ERROR_SERVICE_UNAVAILABLE/i.test(trace)
  ) {
    heparAuditsTotal.inc({
      verdict: /ERROR_SERVICE_UNAVAILABLE|fail_closed/i.test(trace)
        ? 'ERROR'
        : 'FAIL',
    });
  }

  const id = event.mandateId ?? 'unknown';
  const now = event.timestamp ? Date.parse(event.timestamp) : Date.now();
  if (!fundingFirstSeenMs.has(id)) {
    fundingFirstSeenMs.set(id, Number.isFinite(now) ? now : Date.now());
  }
  const terminal = [
    'TX_CONFIRMED',
    'TX_FAILED',
    'TX_SYNTHESIZED',
    'AUDIT_FAILED',
    'YIELD_ROUTED',
  ].includes(status);
  if (terminal) {
    const start = fundingFirstSeenMs.get(id) ?? now;
    const latencySec = Math.max(0, (now - start) / 1000);
    fundingLatencySeconds.observe(latencySec, { status });
    fundingFirstSeenMs.delete(id);
  }
}

/**
 * Record a capacity ceiling event.
 */
export function recordCapacityEvent(event: {
  kind?: string;
  remainingAllocationUsd?: number;
  reason?: string;
}): void {
  const kind = event.kind ?? 'UNKNOWN';
  capacityEventsTotal.inc({ kind });
  if (typeof event.remainingAllocationUsd === 'number') {
    capacityRemainingUsd.set(event.remainingAllocationUsd);
  }
  // Approximate burn: TRADE_RECORDED with remaining drop is not always present;
  // use explicit capital if encoded in reason later. For now count throttle only.
  if (kind === 'THROTTLE_ACTIVE') {
    // no burn amount — counter already labels throttle volume
  }
}

/**
 * Record capacity burn from a TRADE_RECORDED style payload when notional known.
 */
export function recordCapacityBurn(usd: number): void {
  if (usd > 0) capacityBurnUsdTotal.inc(undefined, usd);
}

/**
 * Record Router B / loop yield routing.
 */
export function recordLoopEvent(event: {
  kind?: string;
  grossYield?: number;
  distribution?: {
    splits?: {
      principal?: number;
      shaliahTreasury?: number;
      ecosystemVault?: number;
    };
  };
  reason?: string;
  auditTrace?: string[];
}): void {
  const kind = event.kind ?? 'UNKNOWN';
  loopEventsTotal.inc({ kind });

  if (kind === 'YIELD_ROUTED') {
    const g = event.grossYield ?? 0;
    if (g > 0) yieldGrossUsdTotal.inc(undefined, g);
    const s = event.distribution?.splits;
    if (s) {
      if (s.principal) yieldRoutedUsdTotal.inc({ sink: 'principal' }, s.principal);
      if (s.shaliahTreasury)
        yieldRoutedUsdTotal.inc({ sink: 'shaliah' }, s.shaliahTreasury);
      if (s.ecosystemVault)
        yieldRoutedUsdTotal.inc({ sink: 'vault' }, s.ecosystemVault);
    }
  }

  // Shadow from auditTrace / reason
  const blob = `${event.reason ?? ''} ${(event.auditTrace ?? []).join(' ')}`;
  if (/shadow:gate:PASS|shadow:gate_passed/i.test(blob)) {
    shadowGateTotal.inc({ verdict: 'PASS' });
  } else if (
    /SHADOW_FAIL|shadow:gate:FAIL|SHADOW_VERDICT_FAIL|SHADOW_FAIL_ABORTED/i.test(
      blob,
    )
  ) {
    shadowGateTotal.inc({ verdict: 'ABORT' });
  }
}

/**
 * Explicit shadow verdict (when engines call metrics directly).
 */
export function recordShadowVerdict(verdict: 'PASS' | 'ABORT' | string): void {
  const v =
    verdict === 'PASS' || /PASS/i.test(verdict)
      ? 'PASS'
      : 'ABORT';
  shadowGateTotal.inc({ verdict: v });
}

/** Prometheus text exposition. */
export function renderPrometheusText(): string {
  return [
    fundingEventsTotal.render(),
    fundingLatencySeconds.render(),
    heparAuditsTotal.render(),
    capacityEventsTotal.render(),
    capacityRemainingUsd.render(),
    capacityBurnUsdTotal.render(),
    yieldRoutedUsdTotal.render(),
    yieldGrossUsdTotal.render(),
    shadowGateTotal.render(),
    loopEventsTotal.render(),
    kafkaMessagesTotal.render(),
    metricsInfo.render(),
    '',
  ].join('\n\n');
}
