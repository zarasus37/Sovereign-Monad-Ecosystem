# Enheduanna TempleGrid (IV. Grid of the Universe)

TTCL substrate for Enheduanna’s **42 Temple Hymns** as nodes on an underlying cosmological grid.

| Asset | Path |
|--------|------|
| JSON Schema | `shared/ttcl-specs/temple-grid-schema.json` |
| Fixture | `shared/fixtures/layer6/enheduanna-temple-grid.json` |
| Generator | `scripts/gen-enheduanna-temple-grid.mjs` |
| Runtime API | `@sovereign/ttcl` → `templeGrid.ts` |

## Semantics (self-describing)

| Axis | Mode |
|------|------|
| Theology | `polytheism-networked-system` |
| Technology | `semantic-protocol` (hymn as standardized packet) |
| Cosmology | `underlying-grid` |
| Provenance | `ttc_domain: THEO_TECHNO_COSMO` |

## Wheel binding

Bound to Llull domain wheels: **Teologia**, **Kosmologia**, **Technologia** (16 slots B–R each).  
`slot_mapping` attaches hymn nodes 1–16 to each wheel’s alphabet for scheduler / data-gen.

## Runtime pipeline

```
wheel / scheduler  →  slot_mapping  →  TempleNode
                                    →  gridSign / wheelGridSign  →  scoreSign
                                    →  nodeToEventPayload        →  gnosis / SignalEvent
```

```ts
import {
  gridSign,
  wheelGridSign,
  resolveTemple,
  type TempleGrid,
} from "@sovereign/ttcl";

const grid = loadFixture() as TempleGrid;
const sign = wheelGridSign(grid, "Teologia", "B");
const eanna = resolveTemple(grid, "temple-uruk-e-anna");
```

## Data honesty (schema v1.2.0)

- **40** nodes `status: active` filled from **ETCSL t.4.80.1** colophons (Sjöberg–Bergmann TCS 3 order).
- **2** nodes `status: unknown` where ETCSL colophon is fragmentary (hymns **28**, **39**).
- Connectivity edges among major hubs (Eridu / Nippur / Ur / Uruk / Lagash / Sippar / Larsa / Agade / Eresh).
- Closing hymn **42** = Nisaba at Eresh (compiler signature: En-hedu-ana).
- Every node carries **`logoc_fingerprint`** (static curated channel vector + penalty priors + baseline_total).

## Two-layer LOGOC memory

| Layer | File | Role |
|--------|------|------|
| **Embedded fingerprint** | on each `TempleNode` in `enheduanna-temple-grid.json` | Slow-changing doctrine: what the node *is* |
| **Runtime priors** | `temple-grid-logoc-priors.json` | Sparse mutable overlay: Hepar / scheduler / training drift |

```
channel_effective = 0.70 · fingerprint + 0.30 · runtime_prior
```

```ts
import { blendNodeExpectation, scoreTempleGridSign } from "@sovereign/ttcl";

const exp = blendNodeExpectation(node, priors); // exploration_bias, scheduler_bias, channels
const L = scoreTempleGridSign(sign, node, undefined, {
  derivedFromGrid: true,
  priors,
  useFingerprintBaseline: true, // soft-anchor live score toward blended expectation
});
```

Schemas:

- `shared/ttcl-specs/temple-grid-schema.json` — optional `logoc_fingerprint` on TempleNode
- `shared/ttcl-specs/temple-grid-logoc-priors.schema.json` — priors overlay

## Gnosis training wiring

```ts
import { generateGnosisEvents } from "@sovereign/gnosis-training-data";
import type { TempleGrid } from "@sovereign/ttcl";

const events = generateGnosisEvents(schedule, registry, { templeGrid });
// each event may carry:
//   temple_grid: nodeToEventPayload(...)
//   temple_grid_logoc: scoreTempleGridSign(...)  // logoc.temple-grid.v1
```

## LOGOC profile `logoc.temple-grid.v1`

Three-channel fusion (native TTCL, not a side interpreter):

| Channel | Evidence |
|---------|----------|
| **Theo** | temple/deity identity, `theo_slots.function`, hymn signature, relations |
| **Tech** | `protocol_version`, naming profile, packet form, interop tags |
| **Cosmo** | wheel/slot placement, `role_in_grid`, connectivity, energy profile |
| **Coherence** | low spread across T/X/C + TTC triad bonus |
| **Sovereignty** | source=temple-grid / derived; kill-switch / unsigned penalties |

```
L = 0.26·T + 0.18·X + 0.24·C + 0.18·H + 0.14·S − P
```

Thresholds: accept ≥ 0.78 · review ≥ 0.58 · else reject.

```ts
import { scoreTempleGridSign, TEMPLE_GRID_LOGOC_V1, gridSign } from "@sovereign/ttcl";

const sign = gridSign(grid, node.temple_id);
const L = scoreTempleGridSign(sign, node, TEMPLE_GRID_LOGOC_V1, {
  derivedFromGrid: true,
  wheelId: "Teologia",
  slotId: "B",
});
```

## CI

```powershell
pnpm check:temple-grid   # ajv validate fixture vs temple-grid-schema.json
node scripts/gen-enheduanna-temple-grid.mjs
```
