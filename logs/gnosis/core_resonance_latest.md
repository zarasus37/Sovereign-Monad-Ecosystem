# Core Resonance report

- **Generated:** 2026-07-28T02:30:31.697301+00:00
- **Council members:** 37
- **Pairs scanned:** 26700
- **Hits:** 12388
- **Catalog:** core-resonance-v1

## Shared cores (ranked by Core Resonance Score)

| Rank | Core | Score | Members | Hits | Domains |
|-----:|------|------:|--------:|-----:|---------|
| 1 | `method_is_structure` — Method / virtue as structure | 1.000 | 30 | 3860.0 | knowledge |
| 2 | `density_over_volume` — Density over volume / short-horizon theater | 1.000 | 8 | 2769.0 | war, systems |
| 3 | `anti_capture` — Gifts that buy the law = capture | 0.865 | 6 | 981.0 | law, agency |
| 4 | `audit_before_power` — Auditability before expansion of power | 0.865 | 6 | 979.0 | law, systems |
| 5 | `form_over_theater` — Function / structure over theater | 0.714 | 4 | 361.0 | agency, systems |
| 6 | `resonance_not_hierarchy` — Resonance, not hierarchy | 0.714 | 4 | 654.0 | agency, systems |
| 7 | `decompression_knowledge` — Knowledge requires decompression | 0.672 | 3 | 451.0 | knowledge, systems |
| 8 | `freedom_in_constraint` — Freedom within necessity / constraint | 0.672 | 3 | 360.0 | agency, law |
| 9 | `local_max_archon` — Local maxima mistake themselves for global | 0.508 | 2 | 183.0 | knowledge, systems |
| 10 | `meaning_from_resonance` — Meaning from resonance, not bare definition | 0.468 | 2 | 93.0 | knowledge |
| 11 | `hollow_vs_authentic` — Authentic vs hollow convergence | 0.228 | 1 | 180.0 | systems, agency |
| 12 | `multi_lens_required` — Multi-lens / anti mono-lens | 0.228 | 1 | 1246.0 | knowledge, systems |
| 13 | `victory_empties_treasury` — Victory that empties the treasury is defeat | 0.228 | 1 | 89.0 | war, systems |
| 14 | `constraint_generates` — Constraint generates possibility | 0.197 | 1 | 2.0 | systems, knowledge |
| 15 | `surrender_force_control` — Agency from surrendering force-based control | 0.187 | 1 | 2.0 | agency |
| 16 | `decision_not_outcome` — Decision quality ≠ outcome | 0.020 | 0 | 178.0 | war, agency |

### Direction notes (top shared)

- **Method / virtue as structure** (`method_is_structure`, score=1.000)
  - Direction: Method and virtue are structural operations, not ornament.
  - Windows: akhenaten, alan-watts, aristotle, baruch-spinoza, basilides-of-alexandria, catherine-de-medici, christine-de-pizan, cristobal-colon, enheduanna, friedrich-nietzsche, giordano-bruno, gnostic-jesus

- **Density over volume / short-horizon theater** (`density_over_volume`, score=1.000)
  - Direction: Structural position and density beat brute flow and volume metrics.
  - Windows: charles-sanders-peirce, friedrich-nietzsche, hildegard-von-bingen, isaac-newton, king-solomon, queen-of-sheba, sun-tzu, victoria-lady-welby

- **Gifts that buy the law = capture** (`anti_capture`, score=0.865)
  - Direction: Alliances that purchase rules silently are capture, not growth.
  - Windows: alan-watts, colon-founder, irenaeus-of-lyon, johannes-trithemius, niccolo-machiavelli, trithemius

- **Auditability before expansion of power** (`audit_before_power`, score=0.865)
  - Direction: Power without versioned, auditable constraint is illegitimate.
  - Windows: galileo-galilei, irenaeus-of-lyon, johannes-trithemius, marcus-aurelius, niccolo-machiavelli, sun-tzu

- **Function / structure over theater** (`form_over_theater`, score=0.714)
  - Direction: Authority and wisdom come from real function, not performance or title alone.
  - Windows: aristotle, king-solomon, queen-of-sheba, sun-tzu

- **Resonance, not hierarchy** (`resonance_not_hierarchy`, score=0.714)
  - Direction: Intelligence partners across windows; domination is the wrong frame.
  - Windows: alan-watts, charles-sanders-peirce, marcus-aurelius, poimandres

- **Knowledge requires decompression** (`decompression_knowledge`, score=0.672)
  - Direction: Compressed truth must unfold into live action unique to the agent.
  - Windows: basilides-of-alexandria, carl-jung, gnostic-jesus

- **Freedom within necessity / constraint** (`freedom_in_constraint`, score=0.672)
  - Direction: Authentic freedom is skilled motion inside real limits, not lawlessness.
  - Windows: baruch-spinoza, marcus-aurelius, spinoza

- **Local maxima mistake themselves for global** (`local_max_archon`, score=0.508)
  - Direction: Archonic traps: local peak treated as the whole map.
  - Windows: basilides-of-alexandria, cristobal-colon

- **Meaning from resonance, not bare definition** (`meaning_from_resonance`, score=0.468)
  - Direction: Meaning lives in living use and resonance, not dictionary freeze.
  - Windows: charles-sanders-peirce, victoria-lady-welby

## Plot (conceptual)

```
  high resonance
       ^
  method_is_structure    |████████████████████| 1.00  n_mem=30
  density_over_volume    |████████████████████| 1.00  n_mem=8
  anti_capture           |█████████████████   | 0.87  n_mem=6
  audit_before_power     |█████████████████   | 0.87  n_mem=6
  form_over_theater      |██████████████      | 0.71  n_mem=4
  resonance_not_hierarch |██████████████      | 0.71  n_mem=4
  decompression_knowledg |█████████████       | 0.67  n_mem=3
  freedom_in_constraint  |█████████████       | 0.67  n_mem=3
       +-----------------------> independent windows
```

## Train sampling (starter)

```text
P(pair) ∝ tier_weight[G0=1.0, G1=0.95, G2=0.55, G3=0.45] × (1 + 0.5 × best_core_rank_weight)
```

On this corpus: n=26700 mean_weight=0.6276 min=0.45 max=1.5

## Recommendations

- Upweight train samples on high-resonance cores: method_is_structure, density_over_volume, anti_capture, audit_before_power, form_over_theater
- 5 cores seen in only one window — personal gold, not yet shared-core
- 2 catalog cores have zero hits — deepen member-true G1 on those directions
- Shared-core score rewards multi-member recurrence; never collapse windows into one voice

---

See `docs/gnosis-training/CORE_RESONANCE.md`.
