# Technical Implementation Plan: Layer 6 Letter-Pair Reconstruction & Fourth-Figure Tabula Generalis

**Layer**: TTCL Layer 6 (Scheduler)  
**Status**: Deferred follow-up (per PR #46 spec NOTE)  
**Author**: Hermes Agent Code Review  
**Date**: 2026-07-20

---

## 1. Background & Context

### 1.1 Current Implementation

The Layer 6 Scheduler (`@sovereign/scheduler`) currently operates with:

- **11 wheels** (8 generative + 3 domain): A, P, E, T, V, Q, F, S + Teologia, Kosmologia, Technologia
- **28 wheel-level pairs**: C(8,2)=28 — all combinations of the 8 generative wheels
- **Simulated annealing optimizer** producing `canonical_schedule.json`
- **Objective**: J = αC + βL + γT − δS (weights: 0.35/0.25/0.30/0.10)

### 1.2 The Deferred Items

From `SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md` and `PROJECT_STATE.md`:

| Item | Description | Current Status |
|------|-------------|-----------------|
| **45-letter-pair reconstruction** | Secondary interpretation: 36 Third-Figure cameras + 9 self-pairs = T₉ | Deferred as letter-level composite-validity filter |
| **Fourth-Figure Tabula Generalis** | 3-letter cameras (BCD, BCE...) — separate from 2-letter Third Figure | Deferred — separate structure |

### 1.3 Doctrinal Clarification (from Spec NOTE)

- **Primary source** (Llull's Ars Magna, Chapter 3): Third Figure has **36** two-letter cameras (BC…IK, J skipped, C(9,2)=36), **no self-pairs**
- **"45"** = 36 + 9 self-pairs = T₉ — reconstruction the source does NOT state
- **Fourth Figure** (Chapter 4): Tabula Generalis — **3-letter cameras** (BCD, BCE…) — separate, larger structure
- The 45 is **letter-level** (over 9 Prima-Figura letters B-K), NOT wheel-level
- Does NOT fit the registry's `pairs` field (stays at C(8,2)=28)

---

## 2. Architectural Integration Strategy

### 2.1 Where the Letter-Pairs Fit

The letter-level pairs are NOT wheel-level pairs (which stay at 28). Instead, they function as:

1. **Composite-validity filter** — constrain which wheel-position combinations are "valid" composites
2. **Objective term enhancement** — reward transitions that hit letter-pair targets
3. **Data asset** — loaded from registry, not hard-coded

### 2.2 Where the Fourth-Figure Fits

The Fourth-Figure Tabula Generalis is:

1. **Separate from the 3-letter pair table** — a different combinatorial structure
2. **Future extension** — potentially used for higher-order composite generation
3. **Not in scope for this PR** — marked as deferred follow-up

---

## 3. Implementation Plan

### 3.1 Phase 1: Schema Extension

**File**: `shared/ttcl-specs/wheel-registry-schema.json`

Add new fields to support letter-level pairs:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    // ... existing fields ...
    "letterPairs": {
      "type": "object",
      "description": "Letter-level pair table (45-pair reconstruction over Prima-Figura letters B-K)",
      "properties": {
        "alphabet": {
          "type": "array",
          "items": { "type": "string", "minLength": 1, "maxLength": 1 },
          "description": "The 9 Prima-Figura letters (B-K, J skipped)"
        },
        "pairs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "letters": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 2 }
            }
          },
          "description": "45 pairs: 36 distinct + 9 self-pairs (T₉)"
        },
        "includeSelfPairs": {
          "type": "boolean",
          "default": true,
          "description": "Whether to include self-pairs (BB, CC, ... KK)"
        }
      },
      "required": ["alphabet", "pairs"]
    },
    "fourthFigure": {
      "type": "object",
      "description": "Fourth-Figure Tabula Generalis (3-letter cameras) — deferred",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "cameras": {
          "type": "array",
          "items": { "type": "string" },
          "description": "3-letter camera combinations (BCD, BCE, ...)"
        }
      }
    }
  }
}
```

### 3.2 Phase 2: Registry Loader Updates

**File**: `monad-ecosystem/packages/scheduler/src/registry.ts`

Add new types and loader logic:

```typescript
// New types (add to registry.ts)

export interface LetterPair {
  readonly id: string;
  readonly letters: readonly [string, string];
}

export interface FourthFigureConfig {
  readonly enabled: boolean;
  readonly cameras: readonly string[];
}

export interface LetterPairsConfig {
  readonly alphabet: readonly string[];
  readonly pairs: readonly LetterPair[];
  readonly includeSelfPairs: boolean;
}

// Extend WheelRegistry interface
export interface WheelRegistry {
  // ... existing fields ...
  readonly letterPairs: LetterPairsConfig | null;
  readonly fourthFigure: FourthFigureConfig | null;
  readonly letterPairLookup: ReadonlyMap<string, LetterPair>;  // "BC" -> LetterPair
}

// New loader function
export function buildLetterPairs(json: unknown): LetterPairsConfig | null {
  if (!json || !json.letterPairs) return null;
  // Validate 45 pairs (36 + 9 self-pairs)
  // Build lookup map
}
```

### 3.3 Phase 3: Letter-Pair Validity Check

**File**: `monad-ecosystem/packages/scheduler/src/objective.ts`

Per spec clarification: letter-pair validity is its own term (εP), NOT a move filter that rejects invalid composites. The validity check is used by the objective function, not by move acceptance.

```typescript
/**
 * Check if a composite (wheel pair + positions) satisfies letter-pair validity.
 * Returns 1 if valid, 0 if invalid (used by εP term in objective).
 * 
 * Per spec: letter-pair validity is a DISTINCT term (εP), NOT a filter that 
 * rejects moves. Invalid composites still execute but receive no εP bonus.
 */
export function letterPairValidity(
  state: ScheduleState,
  registry: WheelRegistry
): number {
  if (!registry.letterPairs) return 1; // No filter configured = always valid
  
  const pair = registry.pairById.get(state.pattern)!;
  const [w1, w2] = pair.wheels;
  
  const wheel1 = registry.wheels.get(w1)!;
  const wheel2 = registry.wheels.get(w2)!;
  
  const pos1 = state.offsets[w1]!;
  const pos2 = state.offsets[w2]!;
  
  // Get letters at current positions (fallback to A, B, C... if no alphabet defined)
  const letter1 = wheel1.alphabet?.[pos1] ?? String.fromCharCode(65 + pos1);
  const letter2 = wheel2.alphabet?.[pos2] ?? String.fromCharCode(65 + pos2);
  
  // Normalize key order (BC = CB for lookup)
  const key = letter1 < letter2 ? `${letter1}${letter2}` : `${letter2}${letter1}`;
  
  // Valid if letter pair exists in the 45-pair table
  return registry.letterPairLookup.has(key) ? 1 : 0;
}
```

**Note**: This is now in `objective.ts` (Phase 4) since it's used by the objective term. The original Phase 3 move filter is no longer needed — the spec explicitly says letter-pair validity should NOT affect Coverage (C).

### 3.4 Phase 4: Objective Enhancement

**File**: `monad-ecosystem/packages/scheduler/src/objective.ts`

Add new objective term for letter-pair validity (separate from Coverage):

```typescript
// Extended weights interface (per spec clarification)
export interface ObjectiveWeights {
  readonly alpha: number;  // Coverage (default: 0.35)
  readonly beta: number;   // Locality (default: 0.25)
  readonly gamma: number;  // Tripartite (default: 0.30)
  readonly delta: number;  // Cost (default: 0.10)
  /** Letter-pair validity weight (default: 0.05) — separate from core J formula */
  readonly epsilon: number;
}

// New objective term: Letter-Pair Validity P ∈ [0, 1]
// Per spec clarification: this is a DISTINCT term (εP), NOT modifying Coverage (C)
export function letterPairValidity(
  state: ScheduleState,
  registry: WheelRegistry
): number {
  if (!registry.letterPairs) return 1; // No filter = always valid
  
  const pair = registry.pairById.get(state.pattern)!;
  const [w1, w2] = pair.wheels;
  
  const wheel1 = registry.wheels.get(w1)!;
  const wheel2 = registry.wheels.get(w2)!;
  
  const pos1 = state.offsets[w1]!;
  const pos2 = state.offsets[w2]!;
  
  // Get letters at current positions (fallback to A, B, C... if no alphabet)
  const letter1 = wheel1.alphabet?.[pos1] ?? String.fromCharCode(65 + pos1);
  const letter2 = wheel2.alphabet?.[pos2] ?? String.fromCharCode(65 + pos2);
  
  // Normalize key order (BC = CB)
  const key = letter1 < letter2 ? `${letter1}${letter2}` : `${letter2}${letter1}`;
  
  // Valid if letter pair exists in the table
  return registry.letterPairLookup.has(key) ? 1 : 0;
}

// Extended evaluateMove: J = αC + βL + γT − δS + εP
export function evaluateMove(
  move: Move,
  newState: ScheduleState,
  prevState: ScheduleState,
  window: readonly ReadonlySet<Domain>[],
  visited: ReadonlySet<string>,
  registry: WheelRegistry,
  config: ScheduleConfig,
): ObjectiveTerms {
  const C = visited.has(compositeKey(newState, registry)) ? 0 : 1;
  const L = locality(move);
  const T = tripartite(window);
  const S = cost(move);
  
  // NEW: Letter-pair validity (εP) — distinct from Coverage (C) per spec
  const P = letterPairValidity(newState, registry);
  
  // Core objective: αC + βL + γT − δS
  const J_core = config.weights.alpha * C 
               + config.weights.beta * L 
               + config.weights.gamma * T 
               - config.weights.delta * S;
               
  // Add letter-pair bonus: J = J_core + εP
  const epsilon = config.weights.epsilon ?? 0.05;
  const J = J_core + epsilon * P;
          
  return { C, L, T, S, P, J };
}
```

### 3.5 Phase 5: Data Asset (JSON)

**File**: `shared/fixtures/layer6/letter-pairs.json`

```json
{
  "alphabet": ["B", "C", "D", "E", "F", "G", "H", "I", "K"],
  "includeSelfPairs": true,
  "pairs": [
    { "id": "BC", "letters": ["B", "C"] },
    { "id": "BD", "letters": ["B", "D"] },
    // ... 36 distinct pairs ...
    { "id": "KK", "letters": ["K", "K"] }
  ]
}
```

Generated from the 9-letter alphabet (B-K, J skipped):
- 36 distinct pairs: C(9,2) = 36
- 9 self-pairs: BB, CC, ..., KK
- Total: 45

### 3.6 Phase 6: Fourth-Figure (Deferred)

The Fourth-Figure Tabula Generalis is marked as **out of scope** for this implementation. When eventually implemented:

1. **Separate structure** — 3-letter cameras (BCD, BCE...) — not 2-letter pairs
2. **Higher-order composite** — could enable 3-wheel composites
3. **Separate objective term** — distinct from εP (e.g., future `zeta` term)
4. **Architecture**: Keep it cleanly separated; design for modular extension

The current 2-letter logic is NOT entangled with Fourth-Figure concerns.

---

## 4. Integration Points

| Component | File | Change |
|-----------|------|--------|
| Schema | `shared/ttcl-specs/wheel-registry-schema.json` | Add `letterPairs`, `fourthFigure` |
| Types | `monad-ecosystem/packages/scheduler/src/registry.ts` | Add `LetterPair`, `LetterPairsConfig` |
| Loader | `monad-ecosystem/packages/scheduler/src/registry.ts` | Extend `buildRegistry()` |
| Validity Check | `monad-ecosystem/packages/scheduler/src/objective.ts` | Add `letterPairValidity()` function |
| Objective | `monad-ecosystem/packages/scheduler/src/objective.ts` | Add `P` term (εP), extend `ObjectiveTerms` |
| Config | `monad-ecosystem/packages/scheduler/src/state.ts` | Extend `ScheduleConfig.weights` with `epsilon` |
| Data | `shared/fixtures/layer6/letter-pairs.json` | New asset file (45 pairs) |

---

## 5. Core Formula (Per Spec Clarification)

The objective function is extended as follows:

```
J = αC + βL + γT − δS + εP
```

Where:
- **αC** = Coverage (distinct composites visited) — weight 0.35
- **βL** = Locality (step-to-step smoothness) — weight 0.25
- **γT** = Tripartite (all 3 facets in N-step window) — weight 0.30
- **δS** = Cost (composites materialized per step) — weight 0.10
- **εP** = Letter-Pair Validity (valid letter combination) — weight **0.05** (new)

**Key distinction**: Letter-pair validity (P) is a **distinct term**, NOT modifying Coverage (C). Invalid composites still execute but receive no εP bonus.

---

## 6. Backward Compatibility

- **Default behavior**: `letterPairs: null` — existing scheduler behavior unchanged
- **Default epsilon**: 0.05 — only applies when letter-pairs are configured
- **Opt-in**: Enable via registry JSON config
- **No breaking changes**: Existing `canonical_schedule.json` regenerates identically
- **Core formula unchanged**: αC + βL + γT − δS remains the base; εP is additive
- **Byte-reproducibility**: Maintained via seeded PRNG

---

## 7. Testing Strategy

1. **Unit tests** for `letterPairValidity()` — valid/invalid letter combinations
2. **Integration tests** for `evaluateMove()` with εP term
3. **Regenerate artifact test** — verify `canonical_schedule.json` unchanged with null config
4. **Schema validation tests** — valid/invalid letter-pair JSON
5. **Weight sensitivity tests** — verify εP doesn't overpower core objectives
6. **Backward-compatibility test** — no letterPairs config produces same schedule

---

## 7. Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Schema | 0.5d | Low |
| Phase 2: Loader | 1d | Low |
| Phase 3: Validity Check | 0.5d | Low |
| Phase 4: Objective | 1d | Medium |
| Phase 5: Data | 0.5d | Low |
| Phase 6: Fourth-Figure | **Deferred** | — |
| **Total** | **3.5d** | — |

---

## 8. References

- `TTCL_v1_0_BREAKDOWN.md` — Primary spec source (layer 6 spec entry)
- `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md` — Layer 6 spec entry
- `docs/PROJECT_STATE.md` — Layer 6 status table
- `monad-ecosystem/packages/scheduler/src/` — Current implementation
- `shared/fixtures/layer6/wheel-registry.json` — Current registry (28 pairs)
- `shared/ttcl-specs/wheel-registry-schema.json` — Current schema