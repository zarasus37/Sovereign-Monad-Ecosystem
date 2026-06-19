# Sovereign Monad Control Center — Design Brief

## Tone & Differentiation
Cyberpunk brutalism. Neon-on-black minimalism. Purpose-built for ecosystem operators governing a self-sustaining multi-agent system. Philosophical integrity meets operational control.

## Architecture
**Six Panels**: Integrity Auditor (cyan), Build Pipeline Tracker (magenta), Kafka Wiring Diagram (cyan), Skills Matrix (magenta), Cost Estimator (orange), Deployment Orchestration (orange).  
**15-Layer Sidebar**: L1–L15 navigation reflecting ecosystem structure (Foundation → System Observability).  
**Legacy Panels**: Metrics, Controls, Config, Activity Log preserved for continuity.

## Color Palette
| Name | OKLCH | Hex | Usage |
| --- | --- | --- | --- |
| Background | `0.08 0 0` | #0A0A0A | Near-black surface |
| Foreground | `0.95 0 0` | #F2F2F2 | High-contrast text |
| Cyan (Primary) | `0.85 0.25 195` | #00D9FF | Data, borders, active states |
| Magenta (Secondary) | `0.7 0.33 305` | #FF00FF | Mode changes, secondary actions |
| Orange (Accent) | `0.65 0.25 40` | #FF8C00 | Alerts, deployment status |
| Card | `0.12 0 0` | #1A1A1A | Panel surface |
| Border | `0.25 0.08 195` | #1F4D5C | Grid structure |
| Muted | `0.2 0 0` | #333333 | Disabled UI |

## Typography
| Use | Font | Scale | Weight |
| --- | --- | --- | --- |
| Display | GeneralSans | 2.5rem | 600 |
| Panel Title | GeneralSans | 1.25rem | 600 |
| Heading | GeneralSans | 1rem | 500 |
| Body | GeneralSans | 0.95rem | 400 |
| Metrics | GeistMono | 2rem–3rem | 400 |
| Label | GeneralSans | 0.8rem | 500 |
| Data | GeistMono | 0.85rem | 400 |

## Structural Zones
| Zone | Background | Border | Purpose |
| --- | --- | --- | --- |
| Header | `--card` | 1px `--border` | Title, status LED |
| Sidebar | `--background` | 1px right `--border` | 15 layers, 280px fixed |
| Main Panels | `--card` | 1px neon | Tabbed workspaces |
| Metrics | `--card` | 1px cyan | Live data |
| Activity | `--card` | 1px orange | Event stream |

## Components
- **Panels**: 1px neon border, 12px padding, no shadow
- **Metrics**: GeistMono, 0.02em letter-spacing, right-aligned, cyan
- **Sidebar Layers**: Py-2 px-3, left border indicator, hover → cyan
- **Buttons**: Neon border, transparent bg, glow on hover
- **Focus**: Cyan glow (0 0 20px / 0.5 alpha) + inset border

## Motion
- Transitions: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- Hover: Cyan glow + subtle brightness
- Active: Border highlight + indicator
- Disabled: Opacity 0.4, no glow

## Constraints
- No drop shadows, blur, or gradients
- GeistMono for numeric/log only
- Grid-based, 4px baseline
- AA+ contrast throughout
- Border-radius: 0 (panels), 2px (interactive)
- Sidebar fixed left, 15 layers scrollable

## Signature
Neon borders as structure + rhythm. Cyan glow provides feedback without distraction. GeistMono creates precision. Sidebar left borders show hierarchy/active state. Activity log color-coded by semantic meaning.
