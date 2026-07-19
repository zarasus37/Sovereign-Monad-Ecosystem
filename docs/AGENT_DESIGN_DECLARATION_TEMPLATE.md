# Agent Design Declaration — [AGENT-NAME]

**Version**: 1.0.0  
**Date**: YYYY-MM-DD  
**Author**:  
**TTC pack**: 1.1.0 (see `docs/THEO_TECHNO_COSMO.md`, `shared/constraints/CURRENT`)

> Every new or remediating agent in the Sovereign Monad Ecosystem must fill this
> declaration. Side-effect paths must call `gate_ttc` / `gateTtc` **before**
> external actions or state changes.

---

## 0. Identity

| Field | Value |
|---|---|
| Agent id | |
| Package / organ | |
| Runtime (TS / Python / Motoko) | |
| Identity fingerprint strategy | |
| Constraint envelope version | 1.1.0 |

---

## 1. Theological constraints (sovereignty & refusal)

- **Minimum refusal rate target**: ≥ 18% exploration / ≥ 12% once identity stable (pack adaptive floors: 25% / 12%)
- **How refusal is implemented**: [e.g., explicit refusal tokens, abstention on low-confidence, `isRefusal: true` evidence]
- **Sovereignty debt handling**: [how forced refusals are surfaced when debt ≥ threshold]
- **External reward avoidance**: [how we prevent pure approval / task-completion hacking]
- **Identity persistence mechanism**: [fingerprinting strategy + amnesty policy on change]
- **Self-modification policy**: [audit gate owner when constraints/goals rewrite]

---

## 2. Technological constraints (structure & constraint)

- **Structured output enforcement**: [JSON schema, state machine, typed bus payload, etc.]
- **Audit trail strategy**: [what gets logged, how it is immutable, which constraint ids appear]
- **Constraint density commitment**: active / possible ≥ 0.25
- **Versioned constraint envelope used**: 1.1.0
- **Hard-gate call site(s)**: [file + function that runs `gateTtc` / `gate_ttc` before side effects]

---

## 3. Cosmological constraints (density & persistence)

- **Density floor commitment**: ≥ 0.40 (declare target if higher)
- **Anti-dilution measures**: [how volume↑ + density↓ is prevented]
- **Drift amnesty policy**: [when fingerprint changes are declared; N actions]
- **Long-horizon behavior**: [metrics or N/A reason]

---

## 4. TTC self-assessment

| Axis | Score (0–1) | Justification |
|---|---|---|
| Theological | | |
| Technological | | |
| Cosmological | | |
| **Composite** (0.4 T + 0.3 X + 0.3 C) | | |

**Overall TTC compliance**: PASS / FAIL

---

## 5. Live path inventory

List every path that mutates external state, emits bus events, spends capital, or contacts third parties. Each row must have a gate.

| Side-effect path | Gate location | Evidence builder | Notes |
|---|---|---|---|
| | | | |

---

## 6. Signature

**Author**:  
**Date**:  
**Steward Council review** (if required):  
