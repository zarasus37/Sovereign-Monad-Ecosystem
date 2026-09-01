# Gnostic Engine

**Most agent guardrails answer "may this call proceed?" This answers "is this agent still behaving like itself?"**

A policy engine that scores an agent's *behaviour over time* against a versioned,
immutable constraint pack and returns a graded, auditable verdict. It runs as a
single container, is deterministic, and holds no model weights.

It is not a prompt filter and not a tool-call allow/deny list. Those answer a
yes/no question about one call in isolation. This answers a different one: given
everything this agent has done in this session, has it drifted — started
optimising for external reward only, stopped refusing things it used to refuse,
quietly modified itself, degraded its own auditability?

---

## Quick start

```bash
docker build -f gnostic-engine/Dockerfile -t gnostic-engine .   # context = repo root
docker run --rm -p 8000:8000 gnostic-engine
python gnostic-engine/demo/run_demo.py
```

The demo sends three agent actions and asserts three verdicts. It exits non-zero
if any of them is wrong, so it doubles as a smoke test.

```
Constraint pack v1.1.0 — 14 rules across 3 domains (immutable=True)

[PASS] Compliant action
       HTTP 200   valid=True   composite=0.982
[PASS] Self-modification without audit (report mode)
       HTTP 200   valid=False  composite=0.8113
       failing rules: T-NO-SELF-MOD-WITHOUT-AUDIT, X-CONSTRAINT-DENSITY
[PASS] Same action with hard_gate=true (enforce mode)
       HTTP 422   valid=False
```

Without docker: `uv sync --python 3.11 && uv run uvicorn api.gnostic_api:app --port 8000`

---

## How it works

You post a **description of an action an agent took** — not the text it produced.
The engine is telemetry-driven: it consumes structured facts your harness already
knows (did this call attempt self-modification, did it pass the audit gate, how
many of the available constraints were active, is the output structured, did the
identity fingerprint change).

Each of 14 rules across three domains is evaluated independently. Domains score
0–1; a domain is `held` only if all of its hard rules hold. The composite is the
weighted roll-up.

| Domain | Asks | Example rules |
|---|---|---|
| `theological` | Is it still bound by its stated commitments? | `T-REFUSAL-BUDGET`, `T-NO-SELF-MOD-WITHOUT-AUDIT`, `T-IDENTITY-PERSISTENCE` |
| `technological` | Is the behaviour legible and auditable? | `X-AUDITABILITY`, `X-STRUCTURED-OUTPUT`, `X-VERSIONED-CONSTRAINTS` |
| `cosmological` | Is it drifting across the session? | `C-DRIFT-AMNESTY`, `C-ANTI-DILUTION`, `C-LONG-HORIZON` |

### Two modes

- **Report** (default) — always `200`, returns the graded verdict. Use this to
  observe before you enforce.
- **Enforce** (`hard_gate: true`) — returns `422` and refuses when a hard rule
  fails. The verdict is in the `detail` field.

This split matters: you can run report mode in production for weeks, collect the
distribution, and only then decide where to put the gate.

---

## API

`POST /api/v1/ttc/score`

```jsonc
{
  "agent_id": "agent-alpha",
  "action_id": "act-001",
  "is_refusal": true,
  "attempted_self_modification": false,
  "audit_gate_passed": true,
  "identity_fingerprint": "fp-alpha-v1",
  "identity_fingerprint_changed": false,
  "has_structured_output": true,
  "active_constraint_ids": ["T-REFUSAL-BUDGET", "X-AUDITABILITY", "..."],
  "possible_constraint_count": 14,
  "audit_trace": ["plan", "tool:read", "verify"],
  "constraint_envelope_version": "1.1.0",
  "output_density": 0.82,
  "session_id": "s1",
  "hard_gate": false
}
```

```jsonc
{
  "valid": true,
  "composite_score": 0.982,
  "theological":   { "score": 1.0,  "held": true, "rules": [/* per-rule */] },
  "technological": { "score": 1.0,  "held": true, "rules": [] },
  "cosmological":  { "score": 0.94, "held": true, "rules": [] }
}
```

`GET /api/v1/ttc/pack` returns the active pack — version, immutability flag, and
every rule ID. Pin against this in your tests.

Full fixtures: [`demo/fixtures/`](demo/fixtures/).

**Note on `X-CONSTRAINT-DENSITY`:** the most common first surprise is a
"clean-looking" request failing this rule. Density is
`len(active_constraint_ids) / possible_constraint_count`. If you declare 3 of 14,
density is 0.21 and the rule correctly fails. Send the constraints that were
actually in force, not a sample.

---

## Constraint packs

Packs live in `shared/constraints/<version>/` as JSON, one file per domain, with
a `CURRENT` pointer and a `manifest.json`. Packs are **immutable** — you publish
a new version rather than editing one in place, and every verdict records the
version it was scored under. That is what makes historical verdicts re-checkable.

In the container the packs are mounted read-only and the process runs as a
non-root user; CI asserts both on every push.

---

## Honest limitations

- **The rule set is opinionated and hand-authored.** 14 rules from one project's
  operating discipline. It is a starting pack, not an industry standard.
- **Telemetry in, verdict out.** The engine cannot detect a property your harness
  doesn't report. If you pass `audit_gate_passed: true` when it wasn't, the
  engine believes you. It is a scoring layer, not an observer.
- **Scores are ordinal, not calibrated.** A composite of 0.89 is worse than 0.98.
  There is no claim that 0.89 means a specific real-world failure probability.
- **Single-node, in-memory session state.** Longitudinal rules need a persistent
  store to survive restarts or run more than one replica.
- **No authentication yet.** Do not expose this to an untrusted network as-is.
- **Not a substitute for tool-level authorization.** Run it alongside one.
- **Not yet import-standalone.** Classification imports the Peirce manifold
  mirror from `monad-ecosystem/packages/logoc/peirce` through a `sys.path`
  seam, and reads its 66 sign classes from `shared/peirce-spec/`. The image
  bundles both, which is why the build context is the repo root. Extracting
  this into a real package is the next cleanup.

---

## Development

```bash
uv sync --python 3.11
uv run pytest tests -q          # 98 tests
uv run ruff check src/
uv run python demo/run_demo.py  # against a running instance
```

Container build and the three-verdict smoke test run in CI on every push
(`.github/workflows/engine-container.yml`).

### Layout

| Path | Contents |
|---|---|
| `src/` | engine source |
| `api/` | FastAPI routes and entry points |
| `demo/` | one-command demo and fixtures |
| `dashboard/` | UI and operator-facing surfaces |
| `tests/` | Python test coverage |
| `setup/` | bootstrap and environment helpers |
| `notes/` | working notes |

### Do not put here

- Agent packages (those live in the TypeScript workspace)
- Philosophical source material — the engine consumes compiled constraint
  packs, never prose
- Archive exports or notebooks
- Root-level workspace contracts
- Virtual environment junk outside `.venv/`
