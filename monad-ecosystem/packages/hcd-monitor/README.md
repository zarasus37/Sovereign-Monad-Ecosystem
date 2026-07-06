# @sovereign/hcd-monitor

Human Capability Drift monitor for the Sovereign Monad Ecosystem.

Implements the five draft metrics defined in [`docs/HUMAN_CAPABILITY_DRIFT_METRICS.md`](../../docs/HUMAN_CAPABILITY_DRIFT_METRICS.md) (CHARTER.md §2.1):

- **HCD‑1** — Human Review Queue Burden Rate
- **HCD‑2** — Override Fidelity Index
- **HCD‑3** — Human-Initiated Query Diversity
- **HCD‑4** — Reasoning Exposure Ratio
- **HCD‑5** — Meaningful Correction Latency

## Usage

### CLI

```bash
pnpm build
node dist/cli.js \
  --queue logs/audit/human_review_queue.md \
  --correction-log logs/audit/correction_log_v5.10.json \
  --bus-log monad-ecosystem/packages/gnosis-core/logs/signal-stream.jsonl \
  --out logs/audit/human_capability_drift_$(date +%Y-%m-%d).json
```

### Programmatic

```typescript
import { parseHumanReviewQueue, parseCorrectionLog, parseBusLog, buildReport } from '@sovereign/hcd-monitor';

const queue = parseHumanReviewQueue(queueMarkdown);
const correctionLog = parseCorrectionLog(correctionJson);
const { events } = parseBusLog(busJsonl);

const report = buildReport({ queue, correctionLog, busEvents: events });
console.log(JSON.stringify(report, null, 2));
```

## Data sources

- `logs/audit/human_review_queue.md` — HCD‑1
- `logs/audit/correction_log_v*.json` — HCD‑2, HCD‑5
- Bus event JSONL files (`*.jsonl`) — HCD‑3, HCD‑4, HCD‑5

## Tests

```bash
pnpm test
```

## Related

- [`docs/CHARTER.md`](../../docs/CHARTER.md) §2.1
- [`docs/HUMAN_CAPABILITY_DRIFT_METRICS.md`](../../docs/HUMAN_CAPABILITY_DRIFT_METRICS.md)
