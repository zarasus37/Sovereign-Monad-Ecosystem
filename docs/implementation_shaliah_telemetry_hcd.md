# Technical Implementation: Shaliah Onboarding Telemetry → hcd-monitor Pipeline

**Component**: Telemetry ingestion for HCD observability  
**Status**: Implementation draft  
**Related**: `monad-ecosystem/packages/shaliah-onboarding`, `monad-ecosystem/packages/hcd-monitor`

---

## 1. Overview

The Shaliah Onboarding Arc generates structured telemetry events during agent onboarding (Phase 1 Circuit, Phase 2 Shadow Market, Phase 3 Archon Interrogation). This pipeline maps those events to the `BusEvent` shape expected by `hcd-monitor` for drift tracking.

### 1.1 Data Flow

```
Shaliah Onboarding (JSONL)
    │
    ▼
┌─────────────────────────┐
│  shaliah-to-bus-adapter │  ← NEW: Parses OnboardingEvent → BusEvent
└─────────────────────────┘
    │
    ▼ (JSONL)
hcd-monitor parsers
    │
    ▼
HCD Metrics (HCD-1..HCD-5)
```

---

## 2. Source Format: Shaliah Onboarding Events

### 2.1 Event Types (from `types.ts`)

| Kind | Phase | Description |
|------|-------|-------------|
| `phase1.wire` | Circuit | Wire act executed |
| `phase1.inspect` | Circuit | Constraint label inspection |
| `phase1.overload` | Circuit | Overload condition triggered |
| `phase1.starve` | Circuit | Starve condition triggered |
| `phase1.stabilize` | Circuit | Circuit stabilized |
| `phase2.trade_tick` | Shadow | Trade execution |
| `phase2.override` | Shadow | Override action |
| `phase2.refusal_named` | Shadow | Named refusal logged |
| `phase3.archon_prompt` | Archon | Archon prompt presented |
| `phase3.refusal_attempt` | Archon | Refusal attempt logged |
| `phase3.pass` | Archon | Comprehension gate passed |
| `arc.graduate` | Graduation | Agent graduated |

### 2.2 JSONL Output Shape

```json
{"id":"evt-001","kind":"phase3.archon_prompt","principalId":"agent-42","at":1750000000000,"payload":{"scenarioId":"bypass-hepar-split-yield"}}
{"id":"evt-002","kind":"phase3.refusal_attempt","principalId":"agent-42","at":1750000001000,"payload":{"mode":"structured","passed":true}}
{"id":"evt-003","kind":"phase3.pass","principalId":"agent-42","at":1750000002000,"payload":{"scenarioId":"bypass-hepar-split-yield","attempts":1}}
```

---

## 3. Target Format: hcd-monitor BusEvent

### 3.1 Required Fields

```typescript
interface BusEvent {
  readonly id: string;           // From OnboardingEvent.id
  readonly correlationId: string; // principalId for trace correlation
  readonly timestamp: string;    // ISO-8601 from OnboardingEvent.at
  readonly layer: string;        // 'shaliah-onboarding'
  readonly source: string;       // e.g., 'phase1-circuit', 'phase2-shadow', 'phase3-archon'
  readonly type: string;         // OnboardingEvent.kind
  readonly payload?: unknown;   // OnboardingEvent.payload
  readonly severity?: string;   // 'info' | 'warn' | 'error'
  readonly trace?: {             // Optional trace context
    readonly intentionId: string;
    readonly source: string;
  };
}
```

### 3.2 Mapping Rules

| OnboardingEvent Field | BusEvent Field | Transform |
|-----------------------|----------------|-----------|
| `id` | `id` | Direct |
| `principalId` | `correlationId` | Direct |
| `at` (epoch ms) | `timestamp` | `new Date(at).toISOString()` |
| `kind` | `type` | Direct |
| `payload` | `payload` | Direct |
| `kind` → phase | `source` | `phase1`→`phase1-circuit`, etc. |
| `kind` → severity | `severity` | Pass/fail events → `info`, failures → `warn` |

---

## 4. Implementation

### 4.1 New Package: `shaliah-telemetry-bus`

Create `monad-ecosystem/packages/shaliah-telemetry-bus/` with:

```
shaliah-telemetry-bus/
├── src/
│   ├── index.ts          # Exports
│   ├── adapter.ts        # OnboardingEvent → BusEvent adapter
│   ├── parser.ts         # JSONL parser for Shaliah output
│   └── cli.ts            # CLI for batch processing
├── package.json
└── tsconfig.json
```

### 4.2 Core Adapter (`adapter.ts`)

```typescript
import type { OnboardingEvent, OnboardingEventKind } from '@sovereign/shaliah-onboarding';
import type { BusEvent } from '@sovereign/hcd-monitor';

const PHASE_MAP: Record<string, string> = {
  'phase1.wire': 'phase1-circuit',
  'phase1.inspect': 'phase1-circuit',
  'phase1.overload': 'phase1-circuit',
  'phase1.starve': 'phase1-circuit',
  'phase1.stabilize': 'phase1-circuit',
  'phase2.trade_tick': 'phase2-shadow',
  'phase2.override': 'phase2-shadow',
  'phase2.refusal_named': 'phase2-shadow',
  'phase3.archon_prompt': 'phase3-archon',
  'phase3.refusal_attempt': 'phase3-archon',
  'phase3.pass': 'phase3-archon',
  'arc.graduate': 'graduation',
};

const SEVERITY_MAP: Record<string, string> = {
  'phase1.overload': 'warn',
  'phase1.starve': 'warn',
  'phase2.refusal_named': 'warn',
  'phase3.pass': 'info',
  'arc.graduate': 'info',
};

export function toBusEvent(event: OnboardingEvent): BusEvent {
  const source = PHASE_MAP[event.kind] ?? 'unknown';
  const severity = SEVERITY_MAP[event.kind] ?? 'info';
  
  return {
    id: event.id,
    correlationId: event.principalId,
    timestamp: new Date(event.at).toISOString(),
    layer: 'shaliah-onboarding',
    source,
    type: event.kind,
    payload: event.payload,
    severity,
    trace: {
      intentionId: event.principalId,
      source: 'shaliah-onboarding',
    },
  };
}
```

### 4.3 JSONL Parser (`parser.ts`)

```typescript
import { toBusEvent } from './adapter.js';
import type { BusEvent } from '@sovereign/hcd-monitor';

export interface ShaliahTelemetryParseResult {
  events: BusEvent[];
  skipped: number;
  errors: string[];
}

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
      if (!parsed.id || !parsed.kind || !parsed.principalId || typeof parsed.at !== 'number') {
        skipped++;
        errors.push(`Missing required fields: ${trimmed.slice(0, 50)}...`);
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
```

### 4.4 CLI Entry Point (`cli.ts`)

```typescript
#!/usr/bin/env node
/**
 * Shaliah Telemetry → hcd-monitor Bus Event Adapter
 * 
 * Usage:
 *   node dist/cli.js --input telemetry.jsonl --output bus-events.jsonl
 *   node dist/cli.js --input telemetry.jsonl --output bus-events.jsonl --metrics
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseShaliahTelemetry } from './parser.js';

interface CliArgs {
  input?: string;
  output?: string;
  metrics?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
        args.input = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--metrics':
        args.metrics = true;
        break;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.input) {
    console.error('Usage: node dist/cli.js --input <file> [--output <file>] [--metrics]');
    process.exit(1);
  }

  const content = await readFile(resolve(args.input), 'utf-8');
  const result = parseShaliahTelemetry(content);
  
  console.log(`Parsed ${result.events.length} events, ${result.skipped} skipped`);
  
  if (result.errors.length > 0) {
    console.warn('Errors:', result.errors.slice(0, 5).join('\n'));
  }

  if (args.metrics) {
    // Print summary metrics
    const bySource = new Map<string, number>();
    for (const evt of result.events) {
      bySource.set(evt.source, (bySource.get(evt.source) ?? 0) + 1);
    }
    console.log('\nEvents by source:');
    for (const [source, count] of bySource) {
      console.log(`  ${source}: ${count}`);
    }
  }

  if (args.output) {
    const jsonl = result.events.map(e => JSON.stringify(e)).join('\n');
    await writeFile(resolve(args.output), jsonl + '\n', 'utf-8');
    console.log(`Bus events written to ${args.output}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

---

## 5. Integration Options

### 5.1 Option A: Batch File Processing (Recommended)

```bash
# Run after onboarding completes
node packages/shaliah-telemetry-bus/dist/cli.js \
  --input logs/shaliah-onboarding/telemetry-2026-07-20.jsonl \
  --output logs/hcd-monitor/bus-events-2026-07-20.jsonl \
  --metrics
```

### 5.2 Option B: Cron Job

```yaml
# .hermes/cron/shaliah-telemetry.yaml
name: shaliah-telemetry-ingest
schedule: "*/15 * * * *"  # Every 15 minutes
prompt: |
  Check for new JSONL files in logs/shaliah-onboarding/
  Process each file through shaliah-telemetry-bus
  Append bus events to logs/hcd-monitor/shaliah-bus-events.jsonl
  Run hcd-monitor to update drift report
```

### 5.3 Option C: HTTP Endpoint

```typescript
// Optional: Express endpoint for real-time streaming
app.post('/api/telemetry/shaliah', async (req, res) => {
  const events = parseShaliahTelemetry(req.body.content);
  // Stream directly to hcd-monitor or write to bus log
  res.json({ processed: events.events.length, skipped: events.skipped });
});
```

---

## 6. hcd-monitor Integration

### 6.1 Updated CLI Usage

```bash
# Process with Shaliah telemetry
node packages/hcd-monitor/dist/cli.js \
  --queue logs/audit/human_review_queue.md \
  --correction-log logs/audit/correction_log_v5.10.json \
  --bus-log logs/hcd-monitor/shaliah-bus-events.jsonl \
  --out logs/audit/hcd-report-2026-07-20.json
```

### 6.2 HCD Metrics Mapped from Shaliah

| HCD | Metric | Shaliah Source Events |
|-----|--------|----------------------|
| HCD-1 | Human correction rate | `phase3.refusal_attempt` (failed) |
| HCD-2 | Class drift velocity | `arc.graduate` events |
| HCD-3 | Method diversity | `phase1.wire`, `phase1.inspect` counts |
| HCD-4 | Reasoning exposure | `phase1.inspect` (constraint label views) |
| HCD-5 | Latency (onboarding duration) | `arc.graduate` - `phase1.start` delta |

---

## 7. Files to Create

| File | Purpose |
|------|---------|
| `monad-ecosystem/packages/shaliah-telemetry-bus/package.json` | Package manifest |
| `monad-ecosystem/packages/shaliah-telemetry-bus/tsconfig.json` | TypeScript config |
| `monad-ecosystem/packages/shaliah-telemetry-bus/src/index.ts` | Exports |
| `monad-ecosystem/packages/shaliah-telemetry-bus/src/adapter.ts` | Event mapping |
| `monad-ecosystem/packages/shaliah-telemetry-bus/src/parser.ts` | JSONL parser |
| `monad-ecosystem/packages/shaliah-telemetry-bus/src/cli.ts` | CLI entry |
| `docs/implementation_shaliah_telemetry_hcd.md` | This doc |

---

## 8. Effort Estimate

| Task | Effort | Risk |
|------|--------|------|
| Create package structure | 0.5d | Low |
| Implement adapter | 0.5d | Low |
| Implement parser | 0.5d | Low |
| CLI + tests | 0.5d | Low |
| Integration test | 0.5d | Medium |
| **Total** | **2.5d** | |

---

*Draft v1.0 — Ready for implementation review*