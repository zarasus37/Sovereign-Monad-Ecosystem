# Portfolio Manager

Applies portfolio-level constraints and emits execution plans.

## Constraints

- Max single trade: 10% of portfolio
- Max bridge exposure: 30%
- Max chain exposure: 50%
- Supported execution modes are explicitly configurable

## Topics

- Input: `risk.opportunity-evaluation`
- Output: `execution.execution-plan`

## Execution Planning

The execution plan now preserves:

- asset
- direction
- entry/exit venues
- entry/exit reference prices
- spread basis points
- source signal ID
- execution deadline

By default the manager only emits `inventory_based` plans. Set `SUPPORTED_EXECUTION_MODES` if you intentionally widen that surface.
