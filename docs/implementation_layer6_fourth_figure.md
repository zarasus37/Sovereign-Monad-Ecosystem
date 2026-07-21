# Technical Implementation Plan: Fourth-Figure Tabula Generalis (Layer 6 Extension)

**Layer**: TTCL Layer 6 (Scheduler)  
**Status**: Deferred follow-up (now implementing)  
**Based on**: `TTCL_v1_0_BREAKDOWN.md` + `docs/implementation_layer6_letter_pairs.md`

---

## 1. Overview

The Fourth-Figure Tabula Generalis extends the Layer 6 Scheduler from 2-letter pair validation (εP, 45 pairs) to 3-letter camera validation (ζF). This is a distinct combinatorial structure where:

- **2-letter (εP)**: Validates pairs of letters from the 9-letter alphabet (BCDEFGHIK) — C(9,2) + 9 self-pairs = 45
- **3-letter (ζF)**: Validates triplets of letters from the same alphabet — C(9,3) = 84 combinations

The Fourth Figure is architecturally decoupled from the existing εP term, allowing both to operate independently or together.

---

## 2. Mathematical Specification

### 2.1 Third Figure (2-letter pairs)

| Property | Value |
|----------|-------|
| Alphabet | B, C, D, E, F, G, H, I, K (9 letters, J skipped) |
| Combinations | C(9,2) = 36 distinct pairs |
| Self-pairs | BB, CC, DD, EE, FF, GG, HH, II, KK = 9 |
| **Total** | **45** (T₉ = 9×10/2) |

### 2.2 Fourth Figure (3-letter cameras)

| Property | Value |
|----------|-------|
| Alphabet | B, C, D, E, F, G, H, I, K (same 9 letters) |
| Combinations | C(9,3) = 84 triplets |
| Self-triplets | BBB, CCC, DDD... (not applicable per spec) |
| **Total** | **84** |

The Fourth Figure uses 3-letter "cameras" (e.g., BCD, BCE, BCF...) — each camera is a sorted 3-tuple from the 9-letter alphabet.

### 2.3 Objective Function

The extended formula becomes:

```
J = αC + βL + γT − δS + εP + ζF
```

| Term | Name | Default Weight | Description |
|------|------|----------------|-------------|
| αC | Coverage | 0.35 | Distinct composite signs visited |
| βL | Locality | 0.25 | Step-to-step smoothness |
| γT | Tripartite | 0.30 | 3 facets in N-step window |
| δS | Cost | 0.10 | Composites materialized (penalized) |
| εP | Letter-Pair | 0.05 | 2-letter validity (45-pair table) |
| **ζF** | **Tabula Generalis** | **0.02** | 3-letter validity (84-camera table) |

**Note**: ζ defaults to 0.02 (lower than ε) because the Fourth Figure is a higher-order constraint and should not overpower the core combinatorial objectives.

---

## 3. Schema Changes

### 3.1 wheel-registry-schema.json

Add Fourth-Figure configuration:

```json
{
  "fourthFigure": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean", "default": false },
      "alphabet": { "type": "array", "items": { "type": "string", "minLength": 1, "maxLength": 1 } },
      "cameras": { 
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "letters": { "type": "array", "items": { "type": "string" }, "minItems": 3, "maxItems": 3 }
          }
        }
      }
    },
    "required": ["enabled"]
  }
}
```

### 3.2 Registry Types (registry.ts)

```typescript
/** A 3-letter camera for the Fourth Figure Tabula Generalis. */
export interface FourthFigureCamera {
  readonly id: string;
  readonly letters: readonly [string, string, string];
}

/** Fourth-Figure configuration (3-letter camera validation). */
export interface FourthFigureConfig {
  readonly enabled: boolean;
  readonly alphabet: readonly string[];
  readonly cameras: readonly FourthFigureCamera[];
  /** Lookup map: normalized key (e.g., "BCD") -> FourthFigureCamera */
  readonly cameraLookup: ReadonlyMap<string, FourthFigureCamera>;
}

/** Extend WheelRegistry */
export interface WheelRegistry {
  // ... existing fields
  readonly fourthFigure: FourthFigureConfig | null;
}
```

---

## 4. Implementation Phases

### Phase 1: Schema Extension (0.5d)

**Files**: `shared/ttcl-specs/wheel-registry-schema.json`

Add Fourth-Figure schema definitions.

### Phase 2: Types + Loader (1d)

**File**: `monad-ecosystem/packages/scheduler/src/registry.ts`

- Add `FourthFigureCamera`, `FourthFigureConfig` interfaces
- Extend `RegistryJson` with Fourth-Figure JSON shape
- Implement `buildFourthFigureConfig()` in `buildRegistry()`
- Add lookup map generation (normalized key, sorted 3-tuple)

### Phase 3: Fourth Figure Validity (0.5d)

**File**: `monad-ecosystem/packages/scheduler/src/objective.ts`

Add `fourthFigureValidity()` function:

```typescript
/**
 * Fourth-Figure Tabula Generalis validity check (ζF term).
 * 
 * Returns 1 if the 3-wheel composite's letter combination forms a valid
 * camera in the Tabula Generalis (84 cameras), 0 if invalid.
 * When Fourth Figure is not configured, returns 1.
 * 
 * This evaluates THREE wheels, unlike εP which evaluates two.
 */
export function fourthFigureValidity(
  state: ScheduleState,
  registry: WheelRegistry,
  facets: Readonly<Record<Domain, string>>
): number {
  if (!registry.fourthFigure || !registry.fourthFigure.enabled) return 1;
  
  // Get the three wheels currently active (THEOLOGY, TECHNOLOGY, COSMOLOGY)
  const wheelNames = [facets.THEOLOGY, facets.TECHNOLOGY, facets.COSMOLOGY];
  
  const letters = wheelNames.map(wn => {
    const wheel = registry.wheels.get(wn)!;
    const pos = state.offsets[wn]!;
    return wheel.alphabet?.[pos] ?? String.fromCharCode(65 + pos);
  });
  
  // Normalize: sort alphabetically for lookup (BCD = CDB = DBC)
  const sorted = [...letters].sort();
  const key = sorted.join('');
  
  return registry.fourthFigure.cameraLookup.has(key) ? 1 : 0;
}
```

### Phase 4: Objective Term (1d)

**File**: `monad-ecosystem/packages/scheduler/src/objective.ts`

1. Add `F` term to `ObjectiveTerms` interface
2. Extend `evaluateMove()` to include ζF:

```typescript
// Extended formula: J = αC + βL + γT − δS + εP + ζF
export function evaluateMove(
  move: Move,
  newState: ScheduleState,
  window: readonly ReadonlySet<Domain>[],
  visited: ReadonlySet<string>,
  registry: WheelRegistry,
  config: ScheduleConfig,
): ObjectiveTerms {
  // ... existing C, L, T, S, P terms
  
  // Fourth Figure (ζF) — evaluates 3-wheel composite validity
  const F = fourthFigureValidity(newState, registry, newState.facets);
  
  // J = J_core + εP + ζF
  const J = J_core + epsilon * P + zeta * F;
  
  return { C, L, T, S, P, F, J };
}
```

### Phase 5: Config Weights (0.5d)

**File**: `monad-ecosystem/packages/scheduler/src/state.ts`

```typescript
export interface ScheduleConfig {
  readonly weights: {
    readonly alpha: number;
    readonly beta: number;
    readonly gamma: number;
    readonly delta: number;
    readonly epsilon?: number;  // Letter-pair weight (default: 0.05)
    readonly zeta?: number;     // Fourth-Figure weight (default: 0.02)
  };
  // ... rest unchanged
}

export const DEFAULT_CONFIG: ScheduleConfig = {
  weights: { alpha: 0.35, beta: 0.25, gamma: 0.30, delta: 0.10, epsilon: 0.05, zeta: 0.02 },
  // ... rest unchanged
};
```

### Phase 6: Data Asset (0.5d)

**File**: `shared/fixtures/layer6/wheel-registry.json`

Generate 84 C(9,3) cameras:

```
BCD, BCE, BCF, BCG, BCH, BCI, BCK,
BDE, BDF, BDG, BDI, BDK,
BEF, BEG, BEH, BEI, BEK,
BFG, BFH, BFI, BFK,
BGH, BGI, BGK,
BHI, BHK,
BIK,
CDE, CDF, CDG, CDI, CDK,
CEF, CEG, CEH, CEI, CEK,
CFG, CFH, CFI, CFK,
CGH, CGI, CGK,
CHI, CHK,
CIK,
DEF, DEG, DEH, DEI, DEK,
DFG, DFH, DFI, DFK,
DGH, DGI, DGK,
DHI, DHK,
DIK,
EFG, EFH, EFI, EFK,
EGH, EGI, EGK,
EHI, EHK,
EI K,
FGH, FGI, FGK,
FHI, FHK,
FIK,
GHI, GHK,
GIK,
HIK
```

### Phase 7: Export + Integration (0.5d)

**File**: `monad-ecosystem/packages/scheduler/src/index.ts`

```typescript
export { 
  // ... existing exports
  fourthFigureValidity,
  type FourthFigureCamera,
  type FourthFigureConfig,
} from "./objective.js";
```

### Phase 8: Verification (0.5d)

- Build passes
- Manual test of Fourth-Figure validity with sample 3-wheel composites
- Verify εP and ζF operate independently

---

## 5. Integration Points

| Component | File | Change |
|-----------|------|--------|
| Schema | `shared/ttcl-specs/wheel-registry-schema.json` | Add Fourth-Figure definition |
| Types | `monad-ecosystem/packages/scheduler/src/registry.ts` | Add `FourthFigureCamera`, extend `WheelRegistry` |
| Validity | `monad-ecosystem/packages/scheduler/src/objective.ts` | Add `fourthFigureValidity()` |
| Objective | `monad-ecosystem/packages/scheduler/src/objective.ts` | Add `F` term, extend J formula |
| Config | `monad-ecosystem/packages/scheduler/src/state.ts` | Add `zeta` weight |
| Data | `shared/fixtures/layer6/wheel-registry.json` | Add 84-camera table |
| Export | `monad-ecosystem/packages/scheduler/src/index.ts` | Export new types/functions |

---

## 6. Backward Compatibility

- **Default behavior**: `fourthFigure: null` or `enabled: false` — existing scheduler behavior unchanged
- **Default ζ**: 0.02 — lower than ε (0.05) to not overpower core objectives
- **Independent operation**: εP and ζF can be enabled/disabled independently
- **No breaking changes**: When Fourth Figure disabled, J = αC + βL + γT − δS + εP

---

## 7. Fourth-Figure Architecture (Future-Proofing)

The implementation is designed to support future extension:

1. **Modular**: Fourth-Figure logic is isolated in `fourthFigureValidity()`
2. **Decoupled**: Does not depend on εP or other terms
3. **Configurable**: Enabled via registry JSON, weight via config
4. **Scalable**: Camera lookup uses O(1) Map access

When the full 3-letter generation logic is needed, the architecture supports:
- Adding camera generation algorithms
- Extending to N-letter combinations
- Integration with the Layer 7 training pipeline

---

## 8. Effort Estimate

| Phase | Description | Effort | Risk |
|-------|-------------|--------|------|
| Phase 1: Schema | Add Fourth-Figure JSON schema | 0.5d | Low |
| Phase 2: Types | Add types + loader | 1d | Low |
| Phase 3: Validity | Implement validity check | 0.5d | Medium |
| Phase 4: Objective | Add F term | 1d | Medium |
| Phase 5: Config | Add ζ weight | 0.5d | Low |
| Phase 6: Data | Generate 84 cameras | 0.5d | Low |
| Phase 7: Export | Export new types | 0.5d | Low |
| Phase 8: Verify | Build + test | 0.5d | Low |
| **Total** | | **4.5d** | |

---

## 9. References

- `TTCL_v1_0_BREAKDOWN.md` — Primary spec source (layer 6 spec entry)
- `docs/implementation_layer6_letter_pairs.md` — εP implementation (reference)
- `monad-ecosystem/packages/scheduler/src/` — Existing scheduler implementation

---

## 10. Open Questions

1. **Camera lookup key**: Should cameras be normalized (sorted) for lookup, or stored as declared?
2. **Weight tuning**: Is ζ = 0.02 appropriate, or should it be configurable per domain?
3. **3-wheel evaluation**: Should the Fourth Figure evaluate ALL three facets (THEOLOGY, TECHNOLOGY, COSMOLOGY) or a configurable subset?
4. **Integration with εP**: Should there be a combined term (εP + ζF), or keep them strictly separate?

---

*Draft v1.0 — Ready for implementation review*