# Core Resonance report

- **Generated:** 2026-07-28T02:49:18.693726+00:00
- **Council members:** 37
- **Pairs scanned:** 26811
- **Hits:** 10488
- **Catalog:** core-resonance-v1

## Shared cores (ranked by Core Resonance Score)

| Rank | Core | Score | Members | Hits | Domains |
|-----:|------|------:|--------:|-----:|---------|
| 1 | `method_is_structure` — Method / virtue as structure | 1.000 | 36 | 4336.5 | knowledge |
| 2 | `density_over_volume` — Density over volume / short-horizon theater | 1.000 | 9 | 449.75 | war, systems |
| 3 | `decompression_knowledge` — Knowledge requires decompression | 1.000 | 8 | 480.25 | knowledge, systems |
| 4 | `resonance_not_hierarchy` — Resonance, not hierarchy | 1.000 | 8 | 754.75 | agency, systems |
| 5 | `meaning_from_resonance` — Meaning from resonance, not bare definition | 0.674 | 4 | 106.75 | knowledge |
| 6 | `local_max_archon` — Local maxima mistake themselves for global | 0.672 | 3 | 278.25 | knowledge, systems |
| 7 | `surrender_force_control` — Agency from surrendering force-based control | 0.611 | 3 | 10.75 | agency |
| 8 | `freedom_in_constraint` — Freedom within necessity / constraint | 0.508 | 2 | 450.25 | agency, law |
| 9 | `hollow_vs_authentic` — Authentic vs hollow convergence | 0.508 | 2 | 267.75 | systems, agency |
| 10 | `audit_before_power` — Auditability before expansion of power | 0.228 | 1 | 1229.75 | law, systems |
| 11 | `constraint_generates` — Constraint generates possibility | 0.228 | 1 | 88.75 | systems, knowledge |
| 12 | `decision_not_outcome` — Decision quality ≠ outcome | 0.228 | 1 | 179.0 | war, agency |
| 13 | `form_over_theater` — Function / structure over theater | 0.228 | 1 | 349.0 | agency, systems |
| 14 | `anti_capture` — Gifts that buy the law = capture | 0.020 | 0 | 172.25 | law, agency |
| 15 | `multi_lens_required` — Multi-lens / anti mono-lens | 0.020 | 0 | 1329.25 | knowledge, systems |
| 16 | `victory_empties_treasury` — Victory that empties the treasury is defeat | 0.020 | 0 | 172.25 | war, systems |

### Direction notes (top shared)

- **Method / virtue as structure** (`method_is_structure`, score=1.000)
  - Direction: Method and virtue are structural operations, not ornament.
  - Windows: akhenaten, alan-watts, aristotle, baruch-spinoza, basilides-of-alexandria, catherine-de-medici, charles-sanders-peirce, christine-de-pizan, cristobal-colon, cyrus-the-great, enheduanna, friedrich-nietzsche

- **Density over volume / short-horizon theater** (`density_over_volume`, score=1.000)
  - Direction: Structural position and density beat brute flow and volume metrics.
  - Windows: akhenaten, catherine-de-medici, cyrus-the-great, giordano-bruno, irenaeus-of-lyon, napoleon-bonaparte, niccolo-machiavelli, queen-of-sheba, sun-tzu

- **Knowledge requires decompression** (`decompression_knowledge`, score=1.000)
  - Direction: Compressed truth must unfold into live action unique to the agent.
  - Windows: basilides-of-alexandria, carl-jung, cristobal-colon, gnostic-jesus, hildegard-von-bingen, irenaeus-of-lyon, marcus-aurelius, niccolo-machiavelli

- **Resonance, not hierarchy** (`resonance_not_hierarchy`, score=1.000)
  - Direction: Intelligence partners across windows; domination is the wrong frame.
  - Windows: basilides-of-alexandria, charles-sanders-peirce, gnostic-jesus, johannes-trithemius, queen-of-sheba, sor-juana-ines-de-la-cruz, victoria-lady-welby, zarathustra

- **Meaning from resonance, not bare definition** (`meaning_from_resonance`, score=0.674)
  - Direction: Meaning lives in living use and resonance, not dictionary freeze.
  - Windows: charles-sanders-peirce, hildegard-von-bingen, niccolo-machiavelli, victoria-lady-welby

- **Local maxima mistake themselves for global** (`local_max_archon`, score=0.672)
  - Direction: Archonic traps: local peak treated as the whole map.
  - Windows: basilides-of-alexandria, cristobal-colon, gnostic-jesus

- **Agency from surrendering force-based control** (`surrender_force_control`, score=0.611)
  - Direction: Authentic agency emerges when force-control is released into alignment.
  - Windows: alan-watts, jiang-xueqin, sun-tzu

- **Freedom within necessity / constraint** (`freedom_in_constraint`, score=0.508)
  - Direction: Authentic freedom is skilled motion inside real limits, not lawlessness.
  - Windows: baruch-spinoza, marcus-aurelius

- **Authentic vs hollow convergence** (`hollow_vs_authentic`, score=0.508)
  - Direction: Looking alike without self-consistent navigation is hollow; resonance is earned.
  - Windows: alan-watts, cristobal-colon

## Plot (conceptual)

```
  high resonance
       ^
  method_is_structure    |████████████████████| 1.00  n_mem=36
  density_over_volume    |████████████████████| 1.00  n_mem=9
  decompression_knowledg |████████████████████| 1.00  n_mem=8
  resonance_not_hierarch |████████████████████| 1.00  n_mem=8
  meaning_from_resonance |█████████████       | 0.67  n_mem=4
  local_max_archon       |█████████████       | 0.67  n_mem=3
  surrender_force_contro |████████████        | 0.61  n_mem=3
  freedom_in_constraint  |██████████          | 0.51  n_mem=2
       +-----------------------> independent windows
```

## Train sampling (starter)

```text
P(pair) ∝ tier_weight[G0=1.0, G1=0.95, G2=0.55, G3=0.45] × (1 + 0.5 × best_core_rank_weight)
```

On this corpus: n=26811 mean_weight=0.605 min=0.45 max=1.5

## Recommendations

- Upweight train samples on high-resonance cores: method_is_structure, density_over_volume, decompression_knowledge, resonance_not_hierarchy, meaning_from_resonance
- 4 cores seen in only one window — personal gold, not yet shared-core
- 4 catalog cores have zero hits — deepen member-true G1 on those directions
- Shared-core score rewards multi-member recurrence; never collapse windows into one voice

---

See `docs/gnosis-training/CORE_RESONANCE.md`.
